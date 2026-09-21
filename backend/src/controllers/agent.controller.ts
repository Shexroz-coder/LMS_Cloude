/**
 * AI AGENT CONTROLLER (HTTP)
 *
 * API-kalit bilan himoyalangan endpointlar. Barcha mantiq
 * agent-tools.service da — bu yerda faqat HTTP qatlami.
 * Yozish amallari audit-log qoldiradi (servis ichida).
 */
import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response.utils';
import * as tools from '../services/agent-tools.service';

function branchOf(req: AuthRequest): number | undefined {
  const raw = (req.query?.branchId ?? (req.body as any)?.branchId) as string | undefined;
  if (!raw || raw === 'all') return undefined;
  const n = parseInt(String(raw));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const handle = (fn: () => Promise<any>, res: Response, okMsg?: string) =>
  fn().then(d => sendSuccess(res, d, okMsg)).catch((e: any) => {
    console.error('agent error:', e);
    sendError(res, e.message || 'Xato', 400);
  });

// ── O'qish ──
export const agentOverview = (req: AuthRequest, res: Response) => handle(() => tools.getOverview(branchOf(req)), res);
export const agentFinance = (req: AuthRequest, res: Response) => handle(() => tools.getFinance(req.query.month as string | undefined, branchOf(req)), res);
export const agentDebtors = (req: AuthRequest, res: Response) => handle(() => tools.listDebtors(branchOf(req), parseInt(String(req.query.limit || '50'))), res);
export const agentStudents = (req: AuthRequest, res: Response) => handle(() => tools.searchStudents(String(req.query.search || ''), branchOf(req), parseInt(String(req.query.limit || '30'))), res);
export const agentGroups = (req: AuthRequest, res: Response) => handle(() => tools.listGroups(branchOf(req)), res);
export const agentGroupStudents = (req: AuthRequest, res: Response) => handle(() => tools.groupStudents(parseInt(req.params.groupId)), res);

// ── Filiallar (statistika bilan — servisda yo'q, alohida) ──
import prisma from '../lib/prisma';
import { getFinanceTotals } from '../services/finance.service';
const p = prisma as any;
export const agentBranches = (_req: AuthRequest, res: Response) => handle(async () => {
  const branches = await p.branch.findMany({ orderBy: { id: 'asc' } });
  return Promise.all(branches.map(async (b: any) => {
    const [students, groups, rooms, finance] = await Promise.all([
      p.student.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
      p.group.count({ where: { branchId: b.id, status: 'ACTIVE' } }),
      p.room.count({ where: { branchId: b.id } }),
      getFinanceTotals(b.id),
    ]);
    return { id: b.id, name: b.name, isActive: b.isActive, students, groups, rooms, totalDebt: finance.totalDebt };
  }));
}, res);

// ── Yozish ──
export const agentCreatePayment = (req: AuthRequest, res: Response) =>
  handle(() => tools.createPayment(req.body, req.user!.id), res, 'To\'lov qabul qilindi.');

export const agentMarkAttendance = (req: AuthRequest, res: Response) =>
  handle(() => tools.markAttendance(req.body, req.user!.id), res, 'Davomat belgilandi.');

export const agentCreateStudent = (req: AuthRequest, res: Response) =>
  handle(() => tools.createStudent(req.body, req.user!.id), res, 'O\'quvchi qo\'shildi.');

// adjust-debt va announcement — servisda yo'q, shu yerda (audit bilan)
export const agentAdjustDebt = (req: AuthRequest, res: Response) => handle(async () => {
  const { studentId, debt, balance } = req.body;
  if (!studentId || (debt === undefined && balance === undefined)) throw new Error('studentId va debt yoki balance kerak');
  const sid = parseInt(String(studentId));
  const cur = await p.studentBalance.findUnique({ where: { studentId: sid } });
  const newDebt = debt !== undefined ? Math.max(0, Math.round(Number(debt))) : Math.round(Number(cur?.debt || 0));
  const newBalance = balance !== undefined ? Math.max(0, Math.round(Number(balance))) : Math.round(Number(cur?.balance || 0));
  await p.studentBalance.upsert({
    where: { studentId: sid },
    update: { debt: newDebt, balance: newBalance, lastUpdated: new Date() },
    create: { studentId: sid, debt: newDebt, balance: newBalance },
  });
  await tools.auditLog(req.user!.id, 'Qarz/balans tuzatildi', `O'quvchi #${sid}: qarz=${newDebt.toLocaleString()}, balans=${newBalance.toLocaleString()}.`);
  return { studentId: sid, debt: newDebt, balance: newBalance };
}, res, 'Qarz/balans yangilandi.');

export const agentAnnouncement = (req: AuthRequest, res: Response) => handle(async () => {
  const { title, body, roles } = req.body;
  if (!title || !body) throw new Error('title va body kerak');
  const targetRoles = Array.isArray(roles) && roles.length ? roles : ['STUDENT', 'PARENT'];
  const announcement = await p.announcement.create({ data: { title: String(title), body: String(body), targetRoles, createdBy: req.user!.id } });
  const users = await p.user.findMany({ where: { role: { in: targetRoles }, isActive: true }, select: { id: true } });
  if (users.length) {
    await p.notification.createMany({ data: users.map((u: any) => ({ userId: u.id, title: String(title), body: String(body), type: 'ANNOUNCEMENT' })) });
  }
  await tools.auditLog(req.user!.id, 'E\'lon yuborildi', `"${title}" — ${users.length} kishiga.`);
  return { announcementId: announcement.id, sentTo: users.length };
}, res, 'E\'lon yuborildi.');
