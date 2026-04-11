import { jsPDF } from "jspdf";

type Mail = { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
type Emerg = { name?: string; phone?: string; relation?: string };

function formatMailing(m?: Mail): string {
  if (!m) return "";
  const parts = [
    m.line1,
    m.line2,
    [m.city, m.state].filter(Boolean).join(", "),
    m.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

function classLabel(p: Record<string, unknown>): string {
  return String(p.className ?? p.class ?? "");
}

export type ReportCardPdfInput = {
  academicYear: string;
  term: string;
  overallGrade?: string;
  overallPercent?: number;
  subjectGrades: Array<{
    subject: string;
    grade: string;
    scorePercent: number;
    effort?: string;
    remark?: string;
  }>;
  teacherComment?: string;
  attendanceSummary?: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
  };
  homeworkCompletion?: { total: number; completed: number };
  studentProfile: Record<string, unknown>;
};

export function downloadReportCardPdf(opts: ReportCardPdfInput): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 12;

  const addBlock = (text: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += Math.max(lines.length, 1) * (size * 0.42) + 1.5;
    if (y > 280) {
      doc.addPage();
      y = 12;
    }
  };

  addBlock("pragati pustika / Report card", 14);
  addBlock(`saikshanik varsh: ${opts.academicYear}  |  satr: ${opts.term}`);

  const p = opts.studentProfile;
  addBlock(
    `vidyarthi: ${p.name || ""}  |  anu. kr.: ${p.roll || ""}  |  iyatta: ${classLabel(p)}`
  );
  addBlock(`palakache nav: ${p.parentName || ""}`);
  if (p.motherName || p.fatherName) {
    addBlock(`aai: ${String(p.motherName || "-")}  |  vadil: ${String(p.fatherName || "-")}`);
  }
  addBlock(
    `email (vidyarthi): ${String(p.studentEmail || "-")}  |  email (palak): ${String(p.parentEmail || "-")}`
  );
  if (p.dateOfBirth) addBlock(`janmatarikh: ${String(p.dateOfBirth)}`);
  if (p.gender) addBlock(`ling: ${String(p.gender)}`);
  if (p.bloodGroup) addBlock(`raktgat: ${String(p.bloodGroup)}`);
  if (p.admissionDate) addBlock(`pravesh tarikh: ${String(p.admissionDate)}`);
  if (p.previousSchool) addBlock(`magil shala: ${String(p.previousSchool)}`);
  if (p.address) addBlock(`patta: ${String(p.address)}`);
  const mail = formatMailing(p.mailingAddress as Mail | undefined);
  if (mail) addBlock(`patr vyavahar patta: ${mail}`);
  if (p.studentPhone || p.parentPhone) {
    addBlock(
      `phone vidyarthi: ${String(p.studentPhone || "-")}  |  phone palak: ${String(p.parentPhone || "-")}`
    );
  }
  const e = p.emergencyContact as Emerg | undefined;
  if (e?.name || e?.phone) {
    addBlock(`aapatkaalin: ${e?.name || ""} (${e?.relation || ""}) ${e?.phone || ""}`);
  }
  if (p.alternateGuardianName) {
    addBlock(
      `palya palIkaDe palak: ${String(p.alternateGuardianName)} ${String(p.alternateGuardianPhone || "")}`
    );
  }
  if (p.notes) addBlock(`tip: ${String(p.notes)}`);

  y += 2;
  addBlock("vishaynihay gun", 11);
  for (const g of opts.subjectGrades) {
    addBlock(
      `${g.subject}: ${g.grade} (${g.scorePercent}%) - ${g.effort || ""}${g.remark ? " | " + g.remark : ""}`
    );
  }

  if (opts.overallGrade) {
    addBlock(`ekun shreni: ${opts.overallGrade} (${opts.overallPercent ?? ""}%)`);
  }

  const a = opts.attendanceSummary;
  if (a && (a.totalDays > 0 || a.presentDays > 0)) {
    addBlock(
      `hajeri: ekun ${a.totalDays}, upasthit ${a.presentDays}, anupasthit ${a.absentDays}, ushira ${a.lateDays}`
    );
  }
  const h = opts.homeworkCompletion;
  if (h && h.total > 0) {
    addBlock(`grhapath: ${h.completed}/${h.total} purn`);
  }
  if (opts.teacherComment) {
    addBlock(`shikshakancha abhipray: ${opts.teacherComment}`);
  }

  const fname = `report-card-${String(p.roll || "student").replace(/\W/g, "")}.pdf`;
  doc.save(fname);
}

const statusLetter = (s: string) => {
  if (s === "present") return "P";
  if (s === "absent") return "A";
  if (s === "late") return "L";
  return "";
};

function ymdKey(d: string | Date): string {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

/**
 * Monthly class attendance PDF.
 * Structure: Blank cover page | Filled attendance data page(s) | Blank summary/signature last page
 */
export function downloadClassMonthlyAttendancePdf(opts: {
  ym: string;
  className: string;
  dates: string[];
  students: Array<{ id: string; name: string; roll: string }>;
  records: Array<{ studentId: string; date: string | Date; status: string }>;
}): void {
  const byStudent: Record<string, Record<string, string>> = {};
  for (const r of opts.records) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = {};
    byStudent[r.studentId][ymdKey(r.date)] = statusLetter(r.status);
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  // ===== PAGE 1: BLANK COVER PAGE =====
  doc.setFontSize(16);
  doc.text("Upasthiti Patrak / Attendance Register", pageW / 2, 30, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Varg / Class: ${opts.className}`, pageW / 2, 45, { align: "center" });
  doc.text(`Mahina / Month: ${opts.ym}`, pageW / 2, 55, { align: "center" });
  doc.text(
    `Ekun Vidyarthi: ${opts.students.length}  |  Ekun Divas: ${opts.dates.length}`,
    pageW / 2,
    65,
    { align: "center" }
  );

  // Blank table on cover page
  const blankTableY = 80;
  const bColW = [70, 40, 40];
  const bHeaders = ["Shikshakache Nav / Teacher Name", "Swakshari / Signature", "Tarikh / Date"];
  const bRowH = 9;
  let bx = margin;
  doc.setFontSize(8);
  bHeaders.forEach((h, i) => {
    doc.rect(bx, blankTableY, bColW[i], bRowH);
    doc.text(h, bx + 2, blankTableY + 6);
    bx += bColW[i];
  });
  for (let i = 1; i <= 5; i++) {
    const ry = blankTableY + i * bRowH;
    bx = margin;
    bColW.forEach((cw) => {
      doc.rect(bx, ry, cw, bRowH);
      bx += cw;
    });
  }

  // ===== INNER PAGE(S): FILLED ATTENDANCE DATA =====
  doc.addPage();
  let y = margin;
  doc.setFontSize(11);
  doc.text(`Upasthiti -- ${opts.className} -- ${opts.ym}`, margin, y + 6);
  y += 10;

  const dayLabels = opts.dates.map((d) => d.slice(-2));
  const nameCol = 42;
  const rollCol = 14;
  const n = dayLabels.length;
  const usable = pageW - nameCol - rollCol - 12;
  const colW = Math.max(4, Math.min(5.5, usable / Math.max(n, 1)));

  doc.setFontSize(7);
  doc.text("Nav", margin, y);
  doc.text("A.Kr.", margin + nameCol, y);
  let x = margin + nameCol + rollCol;
  for (let i = 0; i < dayLabels.length; i++) {
    doc.text(dayLabels[i], x + i * colW, y, { align: "center" });
  }
  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 3;

  for (const s of opts.students) {
    if (y > pageH - 12) {
      doc.addPage();
      y = margin;
    }
    doc.text(doc.splitTextToSize(s.name, nameCol - 2)[0] || s.name, margin, y);
    doc.text(String(s.roll), margin + nameCol, y);
    const row = byStudent[s.id] || {};
    for (let i = 0; i < opts.dates.length; i++) {
      const cell = row[opts.dates[i]] || "";
      doc.text(cell, x + i * colW, y, { align: "center" });
    }
    y += 5;
  }

  doc.setFontSize(7);
  doc.text("P = Upasthit (Present), A = Anupasthit (Absent), L = Ushira (Late)", margin, pageH - 6);

  // ===== LAST PAGE: BLANK SUMMARY / SIGNATURE PAGE =====
  doc.addPage();
  doc.setFontSize(12);
  doc.text("Mahinaakher Saransh / Monthly Summary", pageW / 2, 20, { align: "center" });
  doc.setFontSize(9);

  const sumY = 30;
  const sumColW = [70, 30, 30, 40];
  const sumHeaders = ["Vidyarthi Nav (Name)", "Upasthit (Present)", "Anupasthit (Absent)", "Shikshak Swakshari"];
  const sumRowH = 9;
  let sx = margin;

  sumHeaders.forEach((h, i) => {
    doc.rect(sx, sumY, sumColW[i], sumRowH);
    doc.text(h, sx + 2, sumY + 6);
    sx += sumColW[i];
  });

  opts.students.forEach((s, si) => {
    const ry = sumY + (si + 1) * sumRowH;
    if (ry + sumRowH > pageH - 25) return;
    sx = margin;
    const row = byStudent[s.id] || {};
    const present = Object.values(row).filter((v) => v === "P").length;
    const absent = Object.values(row).filter((v) => v === "A").length;
    const vals = [s.name, String(present), String(absent), ""];
    vals.forEach((v, i) => {
      doc.rect(sx, ry, sumColW[i], sumRowH);
      if (v) doc.text(v.slice(0, 25), sx + 2, ry + 6);
      sx += sumColW[i];
    });
  });

  // Signature section at bottom of last page
  const sigY = pageH - 25;
  doc.setFontSize(9);
  doc.text("Mukhyadhyapak Swakshari: _____________________", margin, sigY);
  doc.text("Shikshak Swakshari: _____________________", pageW / 2 - 20, sigY);
  doc.text("Tarikh: ________________", pageW - margin - 55, sigY);

  doc.save(`attendance-${opts.ym}-${opts.className.replace(/\s/g, "_")}.pdf`);
}

export function downloadPersonalAttendanceMonthPdf(opts: {
  ym: string;
  studentName: string;
  roll: string;
  rows: Array<{ date: string; status: string }>;
}): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 14;
  const add = (t: string, sz = 10) => {
    doc.setFontSize(sz);
    doc.text(t, 14, y);
    y += sz * 0.5;
  };
  add("Masik Upasthiti", 14);
  add(`${opts.studentName} (A.Kr. ${opts.roll}) -- ${opts.ym}`, 10);
  y += 4;
  doc.setFontSize(10);
  for (const r of opts.rows) {
    const label =
      r.status === "present"
        ? "Upasthit"
        : r.status === "absent"
        ? "Anupasthit"
        : r.status === "late"
        ? "Ushira"
        : r.status;
    add(`${r.date}: ${label}`);
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  }
  doc.save(`attendance-${opts.ym}-${String(opts.roll)}.pdf`);
}
