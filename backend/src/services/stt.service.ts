/**
 * OVOZ → MATN (STT) — provayder tanlanadi.
 *
 * .env:
 *   STT_PROVIDER = whisper | gemini   (default whisper)
 *   GEMINI_API_KEY   — Gemini uchun (ai.google.dev dan bepul olinadi)
 *   GEMINI_STT_MODEL — ixtiyoriy (default gemini-2.0-flash)
 *
 * Gemini o'zbek tilidagi ovozni Whisper'dan yaxshiroq tushunadi.
 */
import { transcribeAudio as whisperTranscribe } from './openai.service';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function fetchRetry(url: string, init: RequestInit, tries = 4): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status === 503 || res.status === 500) && i < tries - 1) {
        await new Promise(r => setTimeout(r, 800 * Math.pow(2, i))); continue;
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

export function sttProvider(): 'whisper' | 'gemini' {
  return (process.env.STT_PROVIDER === 'gemini') ? 'gemini' : 'whisper';
}

export function isSttConfigured(): boolean {
  return sttProvider() === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.OPENAI_API_KEY;
}

// ── Gemini: ovozni to'g'ridan-to'g'ri matnga ──
async function geminiTranscribe(audio: Buffer, mime = 'audio/ogg'): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY .env da yo\'q');
  const model = process.env.GEMINI_STT_MODEL || 'gemini-3.6-flash';

  const res = await fetchRetry(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: 'Bu o\'zbek tilidagi ovozli xabar (o\'quv markazi administratori buyrug\'i). Uni FAQAT o\'zbek tilida, aniq matn qilib yozib ber. Hech qanday izoh qo\'shma, faqat eshitilgan matnni qaytar.' },
          { inline_data: { mime_type: mime, data: audio.toString('base64') } },
        ],
      }],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 503 || res.status === 429) throw new Error('Ovoz tanish xizmati band. Qayta urinib ko\'ring.');
    throw new Error(`Gemini STT xato: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ') || '';
  return text.trim();
}

// ── Umumiy: provayderga qarab (Gemini band bo'lsa Whisper'ga tushadi) ──
export async function transcribe(audio: Buffer, filename = 'voice.oga', mime = 'audio/ogg'): Promise<string> {
  if (sttProvider() === 'gemini') {
    try {
      return await geminiTranscribe(audio, mime);
    } catch (e) {
      // Gemini band/xato → OpenAI Whisper zaxira (kalit bo'lsa)
      if (process.env.OPENAI_API_KEY) {
        console.warn('⚠️ Gemini STT band — Whisper zaxiraga o\'tildi:', (e as Error).message);
        return whisperTranscribe(audio, filename);
      }
      throw e;
    }
  }
  return whisperTranscribe(audio, filename);
}
