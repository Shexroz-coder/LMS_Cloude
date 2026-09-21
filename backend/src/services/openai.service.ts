/**
 * OpenAI xizmati — Whisper (ovoz→matn) va GPT (mantiq + tool calling).
 * fetch orqali, qo'shimcha npm paket kerak emas (Node 18+).
 *
 * .env:
 *   OPENAI_API_KEY   — OpenAI kaliti
 *   OPENAI_MODEL     — ixtiyoriy (default gpt-4o)
 */

const OPENAI_BASE = 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('OPENAI_API_KEY .env da yo\'q');
  return k;
}

// ══════════════════════════════════════════════════════════════════
// Whisper — ovozli faylni matnga o'girish
// audio: Buffer (ogg/oga/mp3...), filename kengaytma bilan
// ══════════════════════════════════════════════════════════════════
export async function transcribeAudio(audio: Buffer, filename = 'voice.oga'): Promise<string> {
  const form = new FormData();
  const blob = new Blob([audio]);
  form.append('file', blob, filename);
  form.append('model', 'whisper-1');
  // O'zbek/rus aralash — tilni avtomatik aniqlaydi, lekin ipucha beramiz
  form.append('prompt', 'Bu o\'quv markazi administratori uchun buyruq. O\'zbekcha yoki ruscha.');

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Whisper xato: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = await res.json() as { text: string };
  return json.text?.trim() || '';
}

// ══════════════════════════════════════════════════════════════════
// GPT chat — tool calling bilan
// ══════════════════════════════════════════════════════════════════
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ToolDef {
  type: 'function';
  function: { name: string; description: string; parameters: any };
}

export interface ChatResult {
  content: string | null;
  toolCalls: Array<{ id: string; name: string; args: any }>;
}

export async function chatWithTools(
  messages: ChatMessage[],
  tools?: ToolDef[],
): Promise<ChatResult> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GPT xato: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  const msg = json.choices?.[0]?.message;
  return {
    content: msg?.content ?? null,
    toolCalls: (msg?.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name,
      args: (() => { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return {}; } })(),
    })),
  };
}

// ══════════════════════════════════════════════════════════════════
// Oddiy matn tahlili (tool'siz) — hisobot uchun
// ══════════════════════════════════════════════════════════════════
export async function analyzeText(system: string, user: string): Promise<string> {
  const res = await chatWithTools([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  return res.content || '';
}
