#!/usr/bin/env node
/**
 * Robotic Edu LMS — MCP Server
 *
 * AI agent (Claude Desktop, Cursor, ...) tizimni to'liq boshqarishi uchun.
 * LMS backend'ning /agent/* endpointlarini API-kalit bilan chaqiradi.
 *
 * Muhit o'zgaruvchilari:
 *   LMS_API_URL  — masalan https://roboticedu.uz/api/v1
 *   LMS_API_KEY  — backend .env dagi AGENT_API_KEY bilan bir xil
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const API_URL = (process.env.LMS_API_URL || 'https://roboticedu.uz/api/v1').replace(/\/$/, '');
const API_KEY = process.env.LMS_API_KEY || '';

if (!API_KEY) {
  console.error('[roboticedu-mcp] OGOHLANTIRISH: LMS_API_KEY o\'rnatilmagan.');
}

// ── LMS backend chaqiruvi ──
async function callApi(method, path, { query, body } = {}) {
  let url = `${API_URL}/agent${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json?.data ?? json;
}

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: `Xato: ${msg}` }], isError: true });

// ── Tool ta'riflari ──
const TOOLS = [
  {
    name: 'get_overview',
    description: 'Tizim umumiy holati: o\'quvchilar, ustozlar, guruhlar soni, oylik tushum/xarajat, sof foyda, umumiy qarz, davomat foizi, bugungi darslar. Ixtiyoriy branchId bilan bitta filial.',
    inputSchema: { type: 'object', properties: { branchId: { type: 'number', description: 'Filial ID (ixtiyoriy, bo\'lmasa barcha filiallar)' } } },
  },
  {
    name: 'get_finance',
    description: 'Moliya xulosasi: tushum, xarajat, sof foyda, qarz, balans. month (YYYY-MM) va branchId ixtiyoriy.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM formatida oy' }, branchId: { type: 'number' } } },
  },
  {
    name: 'list_debtors',
    description: 'Qarzdor o\'quvchilar ro\'yxati (qarz miqdori bo\'yicha kamayish tartibida). branchId, limit ixtiyoriy.',
    inputSchema: { type: 'object', properties: { branchId: { type: 'number' }, limit: { type: 'number', description: 'Maksimum (default 50)' } } },
  },
  {
    name: 'list_branches',
    description: 'Barcha filiallar: o\'quvchi, guruh, xona soni va qarzi.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_students',
    description: 'O\'quvchilarni ism yoki telefon bo\'yicha qidirish. Har birida guruhlar, qarz, balans.',
    inputSchema: { type: 'object', properties: { search: { type: 'string', description: 'Ism yoki telefon' }, branchId: { type: 'number' }, limit: { type: 'number' } } },
  },
  {
    name: 'list_groups',
    description: 'Guruhlar: kurs, ustoz, oylik narx, o\'quvchilar soni. branchId ixtiyoriy.',
    inputSchema: { type: 'object', properties: { branchId: { type: 'number' } } },
  },
  {
    name: 'create_payment',
    description: 'O\'quvchidan to\'lov qabul qilish. Avval qarzni yopadi, ortig\'i balansga o\'tadi.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'number', description: 'O\'quvchi ID' },
        amount: { type: 'number', description: 'Summa (so\'m)' },
        method: { type: 'string', enum: ['CASH', 'CARD', 'TRANSFER', 'ONLINE'], description: 'To\'lov turi (default CASH)' },
        month: { type: 'string', description: 'Qaysi oy uchun (YYYY-MM, ixtiyoriy)' },
        note: { type: 'string' },
      },
      required: ['studentId', 'amount'],
    },
  },
  {
    name: 'adjust_debt',
    description: 'O\'quvchi qarzi yoki balansini to\'g\'ridan-to\'g\'ri o\'rnatish (voz kechish uchun debt=0).',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'number' },
        debt: { type: 'number', description: 'Yangi qarz (ixtiyoriy)' },
        balance: { type: 'number', description: 'Yangi balans (ixtiyoriy)' },
      },
      required: ['studentId'],
    },
  },
  {
    name: 'send_announcement',
    description: 'E\'lon yuborish. Tegishli rollarga bildirishnoma boradi.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        roles: { type: 'array', items: { type: 'string', enum: ['STUDENT', 'PARENT', 'TEACHER'] }, description: 'Kimga (default: STUDENT, PARENT)' },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'create_student',
    description: 'Yangi o\'quvchi qo\'shish. Parol berilmasa student123 bo\'ladi.',
    inputSchema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        phone: { type: 'string' },
        branchId: { type: 'number' },
        password: { type: 'string' },
      },
      required: ['fullName', 'phone'],
    },
  },
];

// ── Tool → API xaritasi ──
async function runTool(name, args = {}) {
  switch (name) {
    case 'get_overview':     return callApi('GET', '/overview', { query: args });
    case 'get_finance':      return callApi('GET', '/finance', { query: args });
    case 'list_debtors':     return callApi('GET', '/debtors', { query: args });
    case 'list_branches':    return callApi('GET', '/branches');
    case 'search_students':  return callApi('GET', '/students', { query: args });
    case 'list_groups':      return callApi('GET', '/groups', { query: args });
    case 'create_payment':   return callApi('POST', '/payment', { body: args });
    case 'adjust_debt':      return callApi('POST', '/adjust-debt', { body: args });
    case 'send_announcement':return callApi('POST', '/announcement', { body: args });
    case 'create_student':   return callApi('POST', '/student', { body: args });
    default: throw new Error(`Noma'lum tool: ${name}`);
  }
}

// ── MCP server ──
const server = new Server(
  { name: 'roboticedu-lms', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const data = await runTool(name, args || {});
    return ok(data);
  } catch (err) {
    return fail(err.message || String(err));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[roboticedu-mcp] MCP server ishga tushdi →', API_URL);
