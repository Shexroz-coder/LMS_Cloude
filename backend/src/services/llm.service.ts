/**
 * LLM SERVICE — "miya" provayderi tanlanadi (tool calling bilan).
 *
 * .env:
 *   LLM_PROVIDER = openai | gemini   (default openai)
 *   OPENAI_API_KEY / OPENAI_MODEL    — OpenAI uchun
 *   GEMINI_API_KEY / GEMINI_MODEL    — Gemini uchun (default gemini-3.6-flash)
 *
 * Ikkalasi ham bir xil interfeys: chatWithTools(messages, tools) → ChatResult.
 * Xabarlar OpenAI formatida yig'iladi; Gemini uchun ichida konvertatsiya bo'ladi.
 */
import { chatWithTools as openaiChat, ChatMessage, ToolDef, ChatResult } from './openai.service';

export type { ChatMessage, ToolDef, ChatResult } from './openai.service';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Vaqtinchalik xatolarda (429/503/500) qayta urinish — kutish bilan
async function fetchRetry(url: string, init: RequestInit, tries = 4): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status === 503 || res.status === 500) {
        // qayta urinishdan oldin kutamiz: 0.8s, 1.6s, 3.2s...
        if (i < tries - 1) { await new Promise(r => setTimeout(r, 800 * Math.pow(2, i))); continue; }
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) { await new Promise(r => setTimeout(r, 800 * Math.pow(2, i))); continue; }
    }
  }
  if (lastErr) throw lastErr;
  return fetch(url, init);
}

export function llmProvider(): 'openai' | 'gemini' {
  return (process.env.LLM_PROVIDER === 'gemini') ? 'gemini' : 'openai';
}

export function isLlmConfigured(): boolean {
  return llmProvider() === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.OPENAI_API_KEY;
}

// ── OpenAI ChatMessage[] → Gemini contents + systemInstruction ──
function toGemini(messages: ChatMessage[], tools?: ToolDef[]) {
  let systemInstruction: any = undefined;
  const contents: any[] = [];

  // tool_call_id → funksiya nomi (tool javobini bog'lash uchun)
  const callIdToName = new Map<string, string>();

  for (const m of messages) {
    if (m.role === 'system') {
      systemInstruction = { parts: [{ text: m.content || '' }] };
      continue;
    }
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content || '' }] });
      continue;
    }
    if (m.role === 'assistant') {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.tool_calls || []) {
        callIdToName.set(tc.id, tc.function?.name);
        parts.push({ functionCall: { name: tc.function?.name, args: JSON.parse(tc.function?.arguments || '{}') } });
      }
      if (parts.length) contents.push({ role: 'model', parts });
      continue;
    }
    if (m.role === 'tool') {
      const name = m.tool_call_id ? callIdToName.get(m.tool_call_id) || 'tool' : 'tool';
      let resp: any;
      try { resp = JSON.parse(m.content || '{}'); } catch { resp = { result: m.content }; }
      contents.push({ role: 'user', parts: [{ functionResponse: { name, response: { result: resp } } }] });
      continue;
    }
  }

  const geminiTools = tools && tools.length
    ? [{ functionDeclarations: tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: cleanSchema(t.function.parameters) })) }]
    : undefined;

  return { systemInstruction, contents, geminiTools };
}

// Gemini parameters JSON Schema'ni biroz tozalaydi (OpenAI bilan mos)
function cleanSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const out: any = Array.isArray(schema) ? [] : {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue;
    out[k] = (v && typeof v === 'object') ? cleanSchema(v) : v;
  }
  return out;
}

async function geminiChat(messages: ChatMessage[], tools?: ToolDef[]): Promise<ChatResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY .env da yo\'q');
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const { systemInstruction, contents, geminiTools } = toGemini(messages, tools);

  const res = await fetchRetry(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(systemInstruction ? { systemInstruction } : {}),
      contents,
      ...(geminiTools ? { tools: geminiTools } : {}),
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 503 || res.status === 429) {
      throw new Error('Gemini hozir band. Bir necha soniyadan keyin qayta urinib ko\'ring.');
    }
    throw new Error(`Gemini xato: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  const parts = json?.candidates?.[0]?.content?.parts || [];
  let content: string | null = null;
  const toolCalls: ChatResult['toolCalls'] = [];
  let idx = 0;
  for (const part of parts) {
    if (part.text) content = (content || '') + part.text;
    if (part.functionCall) {
      toolCalls.push({ id: `gemini_${Date.now()}_${idx++}`, name: part.functionCall.name, args: part.functionCall.args || {} });
    }
  }
  return { content, toolCalls };
}

// ── Umumiy ──
export async function chatWithTools(messages: ChatMessage[], tools?: ToolDef[]): Promise<ChatResult> {
  if (llmProvider() === 'gemini') return geminiChat(messages, tools);
  return openaiChat(messages, tools);
}

// ── Oddiy matn tahlili (tool'siz) — hisobot uchun, provayderdan mustaqil ──
export async function analyze(system: string, user: string): Promise<string> {
  const res = await chatWithTools([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  return res.content || '';
}
