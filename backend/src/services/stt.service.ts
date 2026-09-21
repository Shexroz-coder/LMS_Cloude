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

  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, {
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
    throw new Error(`Gemini STT xato: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = await res.json() as any;
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ') || '';
  return text.trim();
}

// ── Umumiy: provayderga qarab ──
export async function transcribe(audio: Buffer, filename = 'voice.oga', mime = 'audio/ogg'): Promise<string> {
  if (sttProvider() === 'gemini') {
    return geminiTranscribe(audio, mime);
  }
  return whisperTranscribe(audio, filename);
}
