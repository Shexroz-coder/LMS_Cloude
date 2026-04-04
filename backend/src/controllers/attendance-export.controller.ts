/**
 * Davomat Export — Guruh, O'quvchi va Oylik kesimida Excel (.xlsx) yaratish
 */
// @ts-ignore — exceljs Docker build paytida o'rnatiladi
import ExcelJS from 'exceljs';
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

// ── Ranglar ──────────────────────────────────────────────────────────────────
const COLOR = {
  headerBg:   'FF1E3A5F',
  headerFont: 'FFFFFFFF',
  present:    'FFD4EDDA',
  absent:     'FFF8D7DA',
  late:       'FFFFF3CD',
  excused:    'FFD1ECF1',
  rowAlt:     'FFF8F9FA',
  summaryBg:  'FFE8F4FD',
  border:     'FFCCCCCC',
};

const STATUS_SHORT: Record<string, string> = {
  PRESENT: '✅',
  ABSENT:  '❌',
  LATE:    '⏰',
  EXCUSED: '📝',
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Keldi ✅',
  ABSENT:  'Kelmadi ❌',
  LATE:    'Kech ⏰',
  EXCUSED: 'Sababli 📝',
};

const STATUS_COLOR: Record<string, string> = {
  PRESENT: COLOR.present,
  ABSENT:  COLOR.absent,
  LATE:    COLOR.late,
  EXCUSED: COLOR.excused,
};

const MONTH_NAMES = [
  '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

function parseMonth(monthStr: string) {
  const parts = monthStr.split('-');
  return { y: parseInt(parts[0]), m: parseInt(parts[1]) };
}

function monthRange(y: number, m: number) {
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end:   new Date(Date.UTC(y, m, 1)),
  };
}

function formatDateUz(date: Date): string {
  const d = new Date(date);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

function currentMonthStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function styleHeader(cell: any) {
  cell.font = { bold: true, color: { argb: COLOR.headerFont }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = border();
}

function styleData(cell: any, bgColor?: string) {
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  if (bgColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.border = thinBorder();
}

function border() {
  return {
    top:    { style: 'thin', color: { argb: COLOR.border } },
    bottom: { style: 'thin', color: { argb: COLOR.border } },
    left:   { style: 'thin', color: { argb: COLOR.border } },
    right:  { style: 'thin', color: { argb: COLOR.border } },
  };
}

function thinBorder() {
  return {
    top:    { style: 'hair', color: { argb: COLOR.border } },
    bottom: { style: 'hair', color: { argb: COLOR.border } },
    left:   { style: 'hair', color: { argb: COLOR.border } },
    right:  { style: 'hair', color: { argb: COLOR.border } },
  };
}

function styleLeft(cell: any, bgColor?: string) {
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  if (bgColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.border = thinBorder();
}

async function sendXlsx(res: Response, wb: any, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GURUH KESIMIDA EXPORT
//    GET /attendance/export/group?groupId=X&month=YYYY-MM
// ══════════════════════════════════════════════════════════════════════════════
export const exportByGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.query.groupId as string);
    const monthStr = (req.query.month as string) || currentMonthStr();

    if (!groupId || isNaN(groupId)) { res.status(400).json({ error: 'groupId kiritilmagan' }); return; }

    const { y, m } = parseMonth(monthStr);
    const { start, end } = monthRange(y, m);
    const monthLabel = `${MONTH_NAMES[m]} ${y}`;

    const group: any = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        course:  { select: { name: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        groupStudents: {
          where:   { status: 'ACTIVE' },
          include: { student: { include: { user: { select: { fullName: true } } } } },
          orderBy: { student: { user: { fullName: 'asc' } } },
        },
      },
    });

    if (!group) { res.status(404).json({ error: 'Guruh topilmadi' }); return; }

    const lessons: any[] = await prisma.lesson.findMany({
      where:   { groupId, date: { gte: start, lt: end }, status: 'COMPLETED' },
      orderBy: { date: 'asc' },
      include: { attendance: { select: { studentId: true, status: true } } },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Robotic Edu LMS';
    const ws = wb.addWorksheet('Davomat');
    ws.properties.defaultRowHeight = 22;

    const students: any[] = group.groupStudents;
    const totalCols = 2 + lessons.length + 3;

    // Sarlavha
    ws.mergeCells(1, 1, 1, totalCols);
    const tc = ws.getCell(1, 1);
    tc.value = `📋 DAVOMAT — ${group.name.toUpperCase()} | ${monthLabel}`;
    tc.font = { bold: true, size: 13, color: { argb: COLOR.headerFont } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    // Meta
    ws.mergeCells(2, 1, 2, totalCols);
    const mc = ws.getCell(2, 1);
    mc.value = `Kurs: ${group.course.name}  |  Ustoz: ${group.teacher.user.fullName}  |  Darslar: ${lessons.length}`;
    mc.font = { italic: true, color: { argb: 'FF555555' }, size: 10 };
    mc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    // Ustun sarlavhalari
    ws.getRow(3).height = 36;
    const headers = [
      { value: '№',              width: 4 },
      { value: "O'quvchi ismi", width: 22 },
      ...lessons.map((l: any) => ({ value: formatDateUz(l.date), width: 6 })),
      { value: 'Keldi',          width: 7 },
      { value: 'Kelmadi',        width: 8 },
      { value: 'Davomat %',      width: 10 },
    ];
    headers.forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = h.value;
      styleHeader(cell);
      ws.getColumn(i + 1).width = h.width;
    });

    // O'quvchilar
    students.forEach((gs: any, idx: number) => {
      const student = gs.student;
      const rowNum = 4 + idx;
      const bg = idx % 2 === 1 ? COLOR.rowAlt : undefined;
      let presentCount = 0, absentCount = 0;

      ws.getCell(rowNum, 1).value = idx + 1;
      styleData(ws.getCell(rowNum, 1), bg);

      ws.getCell(rowNum, 2).value = student.user.fullName;
      styleLeft(ws.getCell(rowNum, 2), bg);

      lessons.forEach((lesson: any, li: number) => {
        const att = lesson.attendance.find((a: any) => a.studentId === student.id);
        const status = att?.status ?? 'ABSENT';
        const cell = ws.getCell(rowNum, 3 + li);
        cell.value = STATUS_SHORT[status] ?? '—';
        styleData(cell, STATUS_COLOR[status] ?? bg);
        if (status === 'PRESENT' || status === 'LATE') presentCount++;
        else absentCount++;
      });

      const pct = lessons.length > 0 ? Math.round((presentCount / lessons.length) * 100) : 0;

      const pc = ws.getCell(rowNum, 3 + lessons.length);
      pc.value = presentCount; pc.font = { bold: true, color: { argb: 'FF155724' } };
      styleData(pc, COLOR.present);

      const ac = ws.getCell(rowNum, 4 + lessons.length);
      ac.value = absentCount; ac.font = { bold: true, color: { argb: 'FF721C24' } };
      styleData(ac, COLOR.absent);

      const pctc = ws.getCell(rowNum, 5 + lessons.length);
      pctc.value = `${pct}%`; pctc.font = { bold: true };
      styleData(pctc, pct >= 80 ? COLOR.present : pct >= 60 ? COLOR.late : COLOR.absent);
    });

    // Xulosa
    const sumRow = 4 + students.length;
    ws.getRow(sumRow).height = 22;
    ws.mergeCells(sumRow, 1, sumRow, 2);
    const sl = ws.getCell(sumRow, 1);
    sl.value = "Guruh bo'yicha jami";
    sl.font = { bold: true, color: { argb: COLOR.headerFont } };
    sl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    sl.alignment = { horizontal: 'center', vertical: 'middle' };

    lessons.forEach((lesson: any, li: number) => {
      const presentInLesson = lesson.attendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;
      const cell = ws.getCell(sumRow, 3 + li);
      cell.value = `${presentInLesson}/${students.length}`;
      cell.font = { bold: true };
      styleData(cell, COLOR.summaryBg);
    });

    const totalPresent = students.reduce((acc: number, gs: any) => {
      return acc + lessons.reduce((a: number, l: any) => {
        const att = l.attendance.find((x: any) => x.studentId === gs.student.id);
        return a + ((att?.status === 'PRESENT' || att?.status === 'LATE') ? 1 : 0);
      }, 0);
    }, 0);
    const totalCells = students.length * lessons.length;
    const totalPct = totalCells > 0 ? Math.round((totalPresent / totalCells) * 100) : 0;

    [totalPresent, totalCells - totalPresent, `${totalPct}%`].forEach((v, vi) => {
      const cell = ws.getCell(sumRow, 3 + lessons.length + vi);
      cell.value = v; cell.font = { bold: true };
      styleData(cell, COLOR.summaryBg);
    });

    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
    await sendXlsx(res, wb, `Davomat_${group.name}_${monthLabel}`);
  } catch (err) {
    console.error('exportByGroup error:', err);
    res.status(500).json({ error: "Export xatoligi" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. O'QUVCHI KESIMIDA EXPORT
//    GET /attendance/export/student?studentId=X&month=YYYY-MM
// ══════════════════════════════════════════════════════════════════════════════
export const exportByStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.query.studentId as string);
    const monthStr = (req.query.month as string) || currentMonthStr();

    if (!studentId || isNaN(studentId)) { res.status(400).json({ error: 'studentId kiritilmagan' }); return; }

    const { y, m } = parseMonth(monthStr);
    const { start, end } = monthRange(y, m);
    const monthLabel = `${MONTH_NAMES[m]} ${y}`;

    const student: any = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { fullName: true } },
        groupStudents: {
          where:   { status: 'ACTIVE' },
          include: { group: { include: { course: { select: { name: true } } } } },
        },
      },
    });

    if (!student) { res.status(404).json({ error: "O'quvchi topilmadi" }); return; }

    const attendances: any[] = await prisma.attendance.findMany({
      where: {
        studentId,
        lesson: { date: { gte: start, lt: end }, status: 'COMPLETED' },
      },
      include: {
        lesson: {
          include: { group: { include: { course: { select: { name: true } } } } },
        },
      },
      orderBy: { lesson: { date: 'asc' } },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Robotic Edu LMS';
    const ws = wb.addWorksheet('Davomat');
    ws.properties.defaultRowHeight = 22;

    // Sarlavha
    ws.mergeCells(1, 1, 1, 6);
    const tc = ws.getCell(1, 1);
    tc.value = `📋 DAVOMAT — ${student.user.fullName.toUpperCase()} | ${monthLabel}`;
    tc.font = { bold: true, size: 13, color: { argb: COLOR.headerFont } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    // Meta
    const groupNames = student.groupStudents.map((gs: any) => gs.group.course.name).join(', ');
    ws.mergeCells(2, 1, 2, 6);
    const mc = ws.getCell(2, 1);
    mc.value = `Kurslar: ${groupNames || '—'}  |  Jami darslar: ${attendances.length}`;
    mc.font = { italic: true, color: { argb: 'FF555555' }, size: 10 };
    mc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    // Ustunlar
    const cols = [
      { header: '№',      width: 4  },
      { header: 'Sana',   width: 12 },
      { header: 'Kun',    width: 12 },
      { header: 'Guruh',  width: 20 },
      { header: 'Status', width: 14 },
      { header: 'Izoh',   width: 24 },
    ];
    ws.getRow(3).height = 28;
    cols.forEach((c, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = c.header;
      styleHeader(cell);
      ws.getColumn(i + 1).width = c.width;
    });

    attendances.forEach((att: any, idx: number) => {
      const rowNum = 4 + idx;
      const bg = idx % 2 === 1 ? COLOR.rowAlt : undefined;
      const d = new Date(att.lesson.date);
      const dateStr = `${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${d.getUTCFullYear()}`;

      ws.getCell(rowNum, 1).value = idx + 1;
      styleData(ws.getCell(rowNum, 1), bg);

      ws.getCell(rowNum, 2).value = dateStr;
      styleData(ws.getCell(rowNum, 2), bg);

      ws.getCell(rowNum, 3).value = DAY_NAMES[d.getUTCDay()];
      styleData(ws.getCell(rowNum, 3), bg);

      ws.getCell(rowNum, 4).value = att.lesson.group.course.name;
      styleLeft(ws.getCell(rowNum, 4), bg);

      const sc = ws.getCell(rowNum, 5);
      sc.value = STATUS_LABEL[att.status] ?? att.status;
      styleData(sc, STATUS_COLOR[att.status] ?? bg);
      if (att.status === 'PRESENT') sc.font = { bold: true, color: { argb: 'FF155724' } };
      if (att.status === 'ABSENT')  sc.font = { bold: true, color: { argb: 'FF721C24' } };

      ws.getCell(rowNum, 6).value = att.note ?? '';
      styleLeft(ws.getCell(rowNum, 6), bg);
    });

    // Xulosa
    const present = attendances.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const absent  = attendances.filter((a: any) => a.status === 'ABSENT').length;
    const excused = attendances.filter((a: any) => a.status === 'EXCUSED').length;
    const pct     = attendances.length > 0 ? Math.round((present / attendances.length) * 100) : 0;

    const sumRow = 4 + attendances.length;
    ws.mergeCells(sumRow, 1, sumRow, 3);
    const sl = ws.getCell(sumRow, 1);
    sl.value = 'XULOSA';
    sl.font = { bold: true, color: { argb: COLOR.headerFont } };
    sl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    sl.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(sumRow, 4, sumRow, 6);
    const sv = ws.getCell(sumRow, 4);
    sv.value = `Keldi: ${present}  |  Kelmadi: ${absent}  |  Sababli: ${excused}  |  Davomat: ${pct}%`;
    sv.font = { bold: true };
    sv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.summaryBg } };
    sv.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(sumRow).height = 22;

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    await sendXlsx(res, wb, `Davomat_${student.user.fullName}_${monthLabel}`);
  } catch (err) {
    console.error('exportByStudent error:', err);
    res.status(500).json({ error: "Export xatoligi" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. OYLIK XULOSA EXPORT (barcha guruhlar)
//    GET /attendance/export/monthly?month=YYYY-MM
// ══════════════════════════════════════════════════════════════════════════════
export const exportMonthly = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const monthStr = (req.query.month as string) || currentMonthStr();
    const { y, m } = parseMonth(monthStr);
    const { start, end } = monthRange(y, m);
    const monthLabel = `${MONTH_NAMES[m]} ${y}`;

    const groups: any[] = await prisma.group.findMany({
      where: { status: 'ACTIVE' },
      include: {
        course:   { select: { name: true } },
        teacher:  { include: { user: { select: { fullName: true } } } },
        groupStudents: {
          where:   { status: 'ACTIVE' },
          include: { student: { include: { user: { select: { fullName: true } } } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const allLessons: any[] = await prisma.lesson.findMany({
      where: {
        date:    { gte: start, lt: end },
        status:  'COMPLETED',
        groupId: { in: groups.map((g: any) => g.id) },
      },
      include: { attendance: { select: { studentId: true, status: true } } },
      orderBy: { date: 'asc' },
    });

    // GroupId → lessons
    const lessonsByGroup = new Map<number, any[]>();
    for (const l of allLessons) {
      if (!lessonsByGroup.has(l.groupId)) lessonsByGroup.set(l.groupId, []);
      lessonsByGroup.get(l.groupId)!.push(l);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Robotic Edu LMS';

    // ── 1-varaq: Umumiy xulosa ──────────────────────────────────────────────
    const wsSummary = wb.addWorksheet('Umumiy xulosa');
    wsSummary.properties.defaultRowHeight = 22;

    wsSummary.mergeCells(1, 1, 1, 8);
    const tc = wsSummary.getCell(1, 1);
    tc.value = `📋 OYLIK DAVOMAT XULOSASI — ${monthLabel.toUpperCase()}`;
    tc.font = { bold: true, size: 13, color: { argb: COLOR.headerFont } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(1).height = 30;

    const summaryCols = [
      { header: '№',              width: 4  },
      { header: 'Guruh',          width: 22 },
      { header: 'Kurs',           width: 20 },
      { header: 'Ustoz',          width: 22 },
      { header: "O'quvchilar",    width: 13 },
      { header: 'Darslar',        width: 10 },
      { header: "O'rt. keldi",    width: 12 },
      { header: 'Davomat %',      width: 12 },
    ];
    wsSummary.getRow(2).height = 28;
    summaryCols.forEach((c, i) => {
      const cell = wsSummary.getCell(2, i + 1);
      cell.value = c.header;
      styleHeader(cell);
      wsSummary.getColumn(i + 1).width = c.width;
    });

    let totalStudentsAll = 0, totalLessonsAll = 0, totalPresentAll = 0, totalPossibleAll = 0;

    groups.forEach((group: any, idx: number) => {
      const lessons = lessonsByGroup.get(group.id) ?? [];
      const students: any[] = group.groupStudents;
      const rowNum = 3 + idx;
      const bg = idx % 2 === 1 ? COLOR.rowAlt : undefined;

      let groupPresent = 0;
      for (const l of lessons) {
        groupPresent += l.attendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;
      }
      const possible = students.length * lessons.length;
      const pct = possible > 0 ? Math.round((groupPresent / possible) * 100) : 0;
      const avgPerLesson = lessons.length > 0 ? Math.round(groupPresent / lessons.length) : 0;

      totalStudentsAll  += students.length;
      totalLessonsAll   += lessons.length;
      totalPresentAll   += groupPresent;
      totalPossibleAll  += possible;

      const vals = [
        idx + 1, group.name, group.course.name, group.teacher.user.fullName,
        students.length, lessons.length, avgPerLesson, `${pct}%`,
      ];
      vals.forEach((v: any, vi: number) => {
        const cell = wsSummary.getCell(rowNum, vi + 1);
        cell.value = v;
        if (vi <= 1)      styleLeft(cell, bg);
        else if (vi === 2 || vi === 3) styleLeft(cell, bg);
        else if (vi === 7) {
          styleData(cell, pct >= 80 ? COLOR.present : pct >= 60 ? COLOR.late : COLOR.absent);
          cell.font = { bold: true };
        } else {
          styleData(cell, bg);
          if (vi >= 5) cell.font = { bold: true };
        }
      });
    });

    // Jami
    const sumRowNum = 3 + groups.length;
    const totalPct = totalPossibleAll > 0 ? Math.round((totalPresentAll / totalPossibleAll) * 100) : 0;
    wsSummary.mergeCells(sumRowNum, 1, sumRowNum, 4);
    const jl = wsSummary.getCell(sumRowNum, 1);
    jl.value = `JAMI (${groups.length} ta guruh)`;
    jl.font = { bold: true, color: { argb: COLOR.headerFont } };
    jl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    jl.alignment = { horizontal: 'center', vertical: 'middle' };
    [
      totalStudentsAll, totalLessonsAll,
      Math.round(totalPresentAll / (totalLessonsAll || 1)),
      `${totalPct}%`
    ].forEach((v: any, vi: number) => {
      const cell = wsSummary.getCell(sumRowNum, 5 + vi);
      cell.value = v; cell.font = { bold: true };
      styleData(cell, COLOR.summaryBg);
    });
    wsSummary.getRow(sumRowNum).height = 24;
    wsSummary.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

    // ── 2+ varaqlar: Har bir guruh ──────────────────────────────────────────
    for (const group of groups) {
      const lessons = lessonsByGroup.get(group.id) ?? [];
      if (lessons.length === 0) continue;

      const wsName = group.name.slice(0, 31);
      const ws = wb.addWorksheet(wsName);
      ws.properties.defaultRowHeight = 20;

      const students: any[] = group.groupStudents;
      const totalCols = 2 + lessons.length + 3;

      ws.mergeCells(1, 1, 1, totalCols);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `${group.name} — ${monthLabel} | Ustoz: ${group.teacher.user.fullName}`;
      titleCell.font = { bold: true, size: 12, color: { argb: COLOR.headerFont } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 26;

      ws.getRow(2).height = 30;
      const hCols = [
        { value: '№',              width: 4 },
        { value: "O'quvchi ismi", width: 22 },
        ...lessons.map((l: any) => ({ value: formatDateUz(l.date), width: 6 })),
        { value: 'Keldi',          width: 7 },
        { value: 'Kelmadi',        width: 8 },
        { value: '%',              width: 7 },
      ];
      hCols.forEach((h: any, i: number) => {
        const cell = ws.getCell(2, i + 1);
        cell.value = h.value; styleHeader(cell);
        ws.getColumn(i + 1).width = h.width;
      });

      students.forEach((gs: any, idx: number) => {
        const student = gs.student;
        const rowNum = 3 + idx;
        const bg = idx % 2 === 1 ? COLOR.rowAlt : undefined;
        let presentCount = 0, absentCount = 0;

        ws.getCell(rowNum, 1).value = idx + 1;
        styleData(ws.getCell(rowNum, 1), bg);
        ws.getCell(rowNum, 2).value = student.user.fullName;
        styleLeft(ws.getCell(rowNum, 2), bg);

        lessons.forEach((lesson: any, li: number) => {
          const att = lesson.attendance.find((a: any) => a.studentId === student.id);
          const status = att?.status ?? 'ABSENT';
          const cell = ws.getCell(rowNum, 3 + li);
          cell.value = STATUS_SHORT[status] ?? '—';
          styleData(cell, STATUS_COLOR[status] ?? bg);
          if (status === 'PRESENT' || status === 'LATE') presentCount++;
          else absentCount++;
        });

        const pct2 = lessons.length > 0 ? Math.round((presentCount / lessons.length) * 100) : 0;

        ws.getCell(rowNum, 3 + lessons.length).value = presentCount;
        ws.getCell(rowNum, 3 + lessons.length).font = { bold: true };
        styleData(ws.getCell(rowNum, 3 + lessons.length), COLOR.present);

        ws.getCell(rowNum, 4 + lessons.length).value = absentCount;
        ws.getCell(rowNum, 4 + lessons.length).font = { bold: true };
        styleData(ws.getCell(rowNum, 4 + lessons.length), COLOR.absent);

        ws.getCell(rowNum, 5 + lessons.length).value = `${pct2}%`;
        ws.getCell(rowNum, 5 + lessons.length).font = { bold: true };
        styleData(ws.getCell(rowNum, 5 + lessons.length), pct2 >= 80 ? COLOR.present : pct2 >= 60 ? COLOR.late : COLOR.absent);
      });

      ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }];
    }

    await sendXlsx(res, wb, `Davomat_Oylik_${monthLabel}`);
  } catch (err) {
    console.error('exportMonthly error:', err);
    res.status(500).json({ error: "Export xatoligi" });
  }
};

// ── Filter uchun yordamchi endpointlar ──────────────────────────────────────

export const getGroupsList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groups = await prisma.group.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, course: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: groups });
  } catch {
    res.status(500).json({ error: "Xatolik" });
  }
};

export const getStudentsList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const students: any[] = await prisma.student.findMany({
      where: { groupStudents: { some: { status: 'ACTIVE' } } },
      select: {
        id:   true,
        user: { select: { fullName: true } },
        groupStudents: {
          where:  { status: 'ACTIVE' },
          select: { group: { select: { name: true } } },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    });
    const data = students.map((s: any) => ({
      id:        s.id,
      fullName:  s.user.fullName,
      groupName: s.groupStudents.map((gs: any) => gs.group.name).join(', '),
    }));
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ error: "Xatolik" });
  }
};
