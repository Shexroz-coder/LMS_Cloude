/**
 * TELEGRAM VOICE AI AGENT
 *
 * ADMIN / FOUNDER uchun shaxsiy ovozli administrator.
 *  - Ovozli xabar → Whisper (STT) → matn
 *  - Matn → GPT (tool calling) → LMS operatsiyasi
 *  - Yozish amallari (to'lov, davomat, o'quvchi...) FAQAT tasdiqdan keyin
 *
 * FOUNDER faqat o'qish tool'laridan foydalanadi (moliya/tahlil).
 */
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../bot';
import { getUserByChatId } from '../services/data.service';
import { isOpenAIConfigured, transcribeAudio, chatWithTools, ChatMessage, ToolDef } from '../../services/openai.service';
import * as tools from '../../services/agent-tools.service';

// ─── Kim AI agentdan foydalana oladi ───
async function getAgentUser(ctx: BotContext): Promise<{ id: number; role: string; fullName: string } | null> {
  const chatId = String(ctx.chat?.id);
  const user = await getUserByChatId(chatId);
  if (!user) return null;
  const role = user.role as string;
  if (role !== 'ADMIN' && role !== 'FOUNDER') return null;
  return { id: user.id, role, fullName: user.fullName };
}

// ─── GPT tool ta'riflari ───
const READ_TOOLS: ToolDef[] = [
  { type: 'function', function: { name: 'get_overview', description: 'Tizim umumiy holati: o\'quvchi/guruh soni, oylik tushum/xarajat, sof foyda, qarz, davomat, bugungi darslar.', parameters: { type: 'object', properties: { branchId: { type: 'number' } } } } },
  { type: 'function', function: { name: 'get_finance', description: 'Moliya: tushum, xarajat, foyda, qarz. month=YYYY-MM ixtiyoriy.', parameters: { type: 'object', properties: { month: { type: 'string' }, branchId: { type: 'number' } } } } },
  { type: 'function', function: { name: 'list_debtors', description: 'Qarzdorlar ro\'yxati.', parameters: { type: 'object', properties: { branchId: { type: 'number' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'search_students', description: 'O\'quvchini ism yoki telefon bo\'yicha qidirish. To\'lov/davomat uchun avval shu bilan ID toping.', parameters: { type: 'object', properties: { search: { type: 'string' }, branchId: { type: 'number' } }, required: ['search'] } } },
  { type: 'function', function: { name: 'list_groups', description: 'Guruhlar ro\'yxati (ID, nom, kurs, ustoz). Davomat uchun guruh ID topish.', parameters: { type: 'object', properties: { branchId: { type: 'number' } } } } },
  { type: 'function', function: { name: 'group_students', description: 'Bitta guruhning faol o\'quvchilari (ID va ism). Davomatdan oldin ismlarni ID ga bog\'lash uchun.', parameters: { type: 'object', properties: { groupId: { type: 'number' } }, required: ['groupId'] } } },
];

const WRITE_TOOLS: ToolDef[] = [
  { type: 'function', function: { name: 'create_payment', description: 'To\'lov qabul qilish. Avval search_students bilan studentId toping.', parameters: { type: 'object', properties: { studentId: { type: 'number' }, amount: { type: 'number' }, method: { type: 'string', enum: ['CASH', 'CARD', 'TRANSFER'] }, month: { type: 'string' }, note: { type: 'string' } }, required: ['studentId', 'amount'] } } },
  { type: 'function', function: { name: 'mark_attendance', description: 'Davomat belgilash. Avval list_groups va group_students bilan ID larni toping. entries: har biri {studentId, status}. status: PRESENT(keldi), ABSENT(kelmadi), LATE(kechikdi), EXCUSED(sababli).', parameters: { type: 'object', properties: { groupId: { type: 'number' }, date: { type: 'string', description: 'YYYY-MM-DD (bugun bo\'lsa ham aniq sana)' }, entries: { type: 'array', items: { type: 'object', properties: { studentId: { type: 'number' }, status: { type: 'string' } } } } }, required: ['groupId', 'date', 'entries'] } } },
  { type: 'function', function: { name: 'adjust_debt', description: 'Qarz yoki balansni o\'rnatish (voz kechish uchun debt=0).', parameters: { type: 'object', properties: { studentId: { type: 'number' }, debt: { type: 'number' }, balance: { type: 'number' } }, required: ['studentId'] } } },
  { type: 'function', function: { name: 'create_student', description: 'Yangi o\'quvchi qo\'shish.', parameters: { type: 'object', properties: { fullName: { type: 'string' }, phone: { type: 'string' }, branchId: { type: 'number' } }, required: ['fullName', 'phone'] } } },
  { type: 'function', function: { name: 'send_announcement', description: 'E\'lon yuborish.', parameters: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, roles: { type: 'array', items: { type: 'string' } } }, required: ['title', 'body'] } } },
];

const WRITE_NAMES = new Set(WRITE_TOOLS.map(t => t.function.name));

// ─── READ tool bajarish ───
async function runRead(name: string, args: any): Promise<any> {
  switch (name) {
    case 'get_overview':    return tools.getOverview(args.branchId);
    case 'get_finance':     return tools.getFinance(args.month, args.branchId);
    case 'list_debtors':    return tools.listDebtors(args.branchId, args.limit);
    case 'search_students': return tools.searchStudents(args.search, args.branchId);
    case 'list_groups':     return tools.listGroups(args.branchId);
    case 'group_students':  return tools.groupStudents(args.groupId);
    default: throw new Error(`Noma'lum tool: ${name}`);
  }
}

// ─── Yozish amali tasdig'i uchun qisqa xulosa ───
function summarize(tool: string, args: any): string {
  const money = (v: any) => Number(v || 0).toLocaleString('uz-UZ');
  switch (tool) {
    case 'create_payment': return `💳 To'lov\nO'quvchi ID: ${args.studentId}\nSumma: ${money(args.amount)} so'm\nUsul: ${args.method || 'CASH'}${args.month ? `\nOy: ${args.month}` : ''}`;
    case 'mark_attendance': {
      const n = (args.entries || []).length;
      const present = (args.entries || []).filter((e: any) => e.status === 'PRESENT' || e.status === 'LATE').length;
      return `✅ Davomat\nGuruh ID: ${args.groupId}\nSana: ${args.date}\nJami: ${n} o'quvchi (${present} keldi)`;
    }
    case 'adjust_debt': return `⚖️ Qarz/balans\nO'quvchi ID: ${args.studentId}${args.debt !== undefined ? `\nQarz: ${money(args.debt)}` : ''}${args.balance !== undefined ? `\nBalans: ${money(args.balance)}` : ''}`;
    case 'create_student': return `👤 Yangi o'quvchi\nIsm: ${args.fullName}\nTelefon: ${args.phone}`;
    case 'send_announcement': return `📢 E'lon\nSarlavha: ${args.title}\nMatn: ${args.body}\nKimga: ${(args.roles || ['STUDENT', 'PARENT']).join(', ')}`;
    default: return tool;
  }
}

// ─── Yozish amalini bajarish (tasdiqdan keyin) ───
export async function executePendingAction(actorId: number, tool: string, args: any): Promise<string> {
  const money = (v: any) => Number(v || 0).toLocaleString('uz-UZ');
  switch (tool) {
    case 'create_payment': {
      const r = await tools.createPayment(args, actorId);
      return `✅ To'lov qabul qilindi: ${r.studentName} — ${money(r.amount)} so'm.`;
    }
    case 'mark_attendance': {
      const r = await tools.markAttendance(args, actorId);
      return `✅ Davomat belgilandi: ${r.group} (${r.date}) — ${r.marked} o'quvchi, ${r.present} keldi.`;
    }
    case 'adjust_debt': {
      const sid = Number(args.studentId);
      const cur = await (await import('../../lib/prisma')).default.studentBalance.findUnique({ where: { studentId: sid } });
      const newDebt = args.debt !== undefined ? Math.max(0, Math.round(Number(args.debt))) : Math.round(Number(cur?.debt || 0));
      const newBalance = args.balance !== undefined ? Math.max(0, Math.round(Number(args.balance))) : Math.round(Number(cur?.balance || 0));
      const prisma = (await import('../../lib/prisma')).default as any;
      await prisma.studentBalance.upsert({ where: { studentId: sid }, update: { debt: newDebt, balance: newBalance, lastUpdated: new Date() }, create: { studentId: sid, debt: newDebt, balance: newBalance } });
      await tools.auditLog(actorId, 'Qarz/balans tuzatildi', `O'quvchi #${sid}: qarz=${money(newDebt)}, balans=${money(newBalance)}.`);
      return `✅ Qarz/balans yangilandi (o'quvchi #${sid}).`;
    }
    case 'create_student': {
      const r = await tools.createStudent(args, actorId);
      return `✅ O'quvchi qo'shildi: ${r.fullName} (${r.phone}).\n🔑 Parol: <code>${r.password}</code>\n(Faqat hozir ko'rsatiladi — saqlab qo'ying.)`;
    }
    case 'send_announcement': {
      const prisma = (await import('../../lib/prisma')).default as any;
      const roles = Array.isArray(args.roles) && args.roles.length ? args.roles : ['STUDENT', 'PARENT'];
      const ann = await prisma.announcement.create({ data: { title: args.title, body: args.body, targetRoles: roles, createdBy: actorId } });
      const users = await prisma.user.findMany({ where: { role: { in: roles }, isActive: true }, select: { id: true } });
      if (users.length) await prisma.notification.createMany({ data: users.map((u: any) => ({ userId: u.id, title: args.title, body: args.body, type: 'ANNOUNCEMENT' })) });
      await tools.auditLog(actorId, 'E\'lon yuborildi', `"${args.title}" — ${users.length} kishiga.`);
      return `✅ E'lon ${users.length} kishiga yuborildi.`;
    }
    default: throw new Error('Noma\'lum amal');
  }
}

// ─── Asosiy: matnli buyruqni qayta ishlash ───
export async function processAgentCommand(ctx: BotContext, text: string, agentUser: { id: number; role: string }): Promise<void> {
  if (!isOpenAIConfigured()) {
    await ctx.reply('🤖 AI agent sozlanmagan (OPENAI_API_KEY yo\'q). Admin bilan bog\'laning.');
    return;
  }

  const isFounder = agentUser.role === 'FOUNDER';
  // FOUNDER faqat o'qiy oladi
  const availableTools = isFounder ? READ_TOOLS : [...READ_TOOLS, ...WRITE_TOOLS];

  const today = new Date().toISOString().slice(0, 10);
  const system = `Sen "Robotic Edu" o'quv markazining shaxsiy AI administratorisan. Foydalanuvchi rol: ${agentUser.role}.
Bugungi sana: ${today}.
Vazifang: administrator buyruqlarini bajarish uchun mavjud tool'lardan foydalanish.
QOIDALAR:
- To'lov yoki davomat uchun avval search_students / list_groups / group_students bilan ANIQ ID larni top.
- Ismlar to'liq mos kelmasa, eng yaqin nomzodni top va foydalanuvchiga aniqlashtir.
- Sana kerak bo'lsa "bugun" = ${today}.
- Javoblar qisqa, o'zbek tilida, aniq raqamlar bilan.
${isFounder ? '- Sen FOUNDER uchun ishlaysan: faqat ma\'lumot ko\'rsatasan, hech narsa o\'zgartira olmaysan.' : '- Yozish amali (to\'lov, davomat, o\'quvchi qo\'shish) tool\'ini chaqirsang, tizim uni foydalanuvchiga tasdiqlatadi — sen bajarilgan deb hisoblama.'}`;

  const history = ctx.session.aiHistory || [];
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...history.map(h => ({ role: h.role, content: h.content } as ChatMessage)),
    { role: 'user', content: text },
  ];

  // READ tool loop (maksimum 5 iteratsiya)
  for (let i = 0; i < 5; i++) {
    const result = await chatWithTools(messages, availableTools);

    // Yozish tool'i chaqirilganmi? → tasdiqlash
    const writeCall = result.toolCalls.find(tc => WRITE_NAMES.has(tc.name));
    if (writeCall) {
      const summary = summarize(writeCall.name, writeCall.args);
      ctx.session.pendingAction = { tool: writeCall.name, args: writeCall.args, summary };
      const kb = new InlineKeyboard().text('✅ Tasdiqlash', 'ai_confirm').text('❌ Bekor', 'ai_cancel');
      await ctx.reply(`${summary}\n\nTasdiqlaysizmi?`, { parse_mode: 'HTML', reply_markup: kb });
      return;
    }

    // O'qish tool'lari → bajarib, natijani qaytaramiz
    if (result.toolCalls.length > 0) {
      messages.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args) } })) });
      for (const tc of result.toolCalls) {
        let out: any;
        try { out = await runRead(tc.name, tc.args); }
        catch (e: any) { out = { error: e.message }; }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) });
      }
      continue; // yana GPT ga
    }

    // Yakuniy javob
    const answer = result.content || 'Tushunmadim, qayta ayting.';
    ctx.session.aiHistory = [...history, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: answer }].slice(-6);
    await ctx.reply(answer, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('🤖 So\'rov juda murakkab bo\'ldi. Iltimos, soddaroq ayting.');
}

// ─── Ovozli xabar handleri ───
export async function handleVoice(ctx: BotContext): Promise<void> {
  const agentUser = await getAgentUser(ctx);
  if (!agentUser) {
    await ctx.reply('🎙 Ovozli buyruq faqat administrator uchun. /start bilan hisobingizni ulang.');
    return;
  }
  if (!isOpenAIConfigured()) {
    await ctx.reply('🤖 AI agent sozlanmagan (OPENAI_API_KEY yo\'q).');
    return;
  }

  try {
    await ctx.replyWithChatAction('typing');
    const file = await ctx.getFile();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const resp = await fetch(url);
    const buf = Buffer.from(await resp.arrayBuffer());

    const text = await transcribeAudio(buf, 'voice.oga');
    if (!text) { await ctx.reply('🎙 Ovozni tushunolmadim, qayta urinib ko\'ring.'); return; }

    await ctx.reply(`🗣 <i>${text}</i>`, { parse_mode: 'HTML' });
    await processAgentCommand(ctx, text, agentUser);
  } catch (err: any) {
    console.error('handleVoice error:', err);
    await ctx.reply('🎙 Ovozni qayta ishlashda xato: ' + (err.message || ''));
  }
}

// ─── Matnli AI buyruq (menyu bosqichida bo'lmaganda) ───
export async function handleAiText(ctx: BotContext): Promise<boolean> {
  const agentUser = await getAgentUser(ctx);
  if (!agentUser) return false; // AI foydalanuvchisi emas — oddiy oqim davom etadi
  const text = ctx.message?.text?.trim();
  if (!text || text.startsWith('/')) return false;
  await ctx.replyWithChatAction('typing');
  await processAgentCommand(ctx, text, agentUser);
  return true;
}

// ─── Tasdiqlash/Bekor callback ───
export async function handleAiConfirm(ctx: BotContext): Promise<void> {
  const pending = ctx.session.pendingAction;
  await ctx.answerCallbackQuery();
  if (!pending) { await ctx.reply('⏳ Tasdiqlanadigan amal yo\'q.'); return; }
  const agentUser = await getAgentUser(ctx);
  if (!agentUser || agentUser.role === 'FOUNDER') { ctx.session.pendingAction = undefined; await ctx.reply('❌ Ruxsat yo\'q.'); return; }

  ctx.session.pendingAction = undefined;
  try {
    const msg = await executePendingAction(agentUser.id, pending.tool, pending.args);
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (e: any) {
    await ctx.reply('❌ Xato: ' + (e.message || 'bajarilmadi'));
  }
}

export async function handleAiCancel(ctx: BotContext): Promise<void> {
  ctx.session.pendingAction = undefined;
  await ctx.answerCallbackQuery();
  await ctx.reply('❌ Bekor qilindi.');
}
