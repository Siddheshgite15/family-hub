import { Request, Response } from "express";
import mongoose from "mongoose";
import { Score, Student, ReportCard, Attendance, Homework, HomeworkStatus } from "../models";
import { AuthRequest } from "../middleware/auth";
import { getMetaValue } from "../utils/auth";
import { studentProfileForReportCard } from "../utils/studentProfile";
import { enrollmentSnapshotFromStudent } from "../utils/reportCardSnapshot";
import { z } from "zod";

const emptyAttendance = () => ({
  totalDays: 0,
  presentDays: 0,
  absentDays: 0,
  lateDays: 0,
});

const emptyHomework = () => ({ total: 0, completed: 0 });

async function summarizeAttendance(studentId: mongoose.Types.ObjectId) {
  const records = await Attendance.find({ studentId });
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  for (const r of records) {
    if (r.status === "present") presentDays += 1;
    else if (r.status === "absent") absentDays += 1;
    else if (r.status === "late") lateDays += 1;
  }
  return {
    totalDays: records.length,
    presentDays,
    absentDays,
    lateDays,
  };
}

async function summarizeHomework(studentId: mongoose.Types.ObjectId, className: string) {
  const total = await Homework.countDocuments({ className });
  const completed = await HomeworkStatus.countDocuments({
    studentId,
    status: { $in: ["completed", "submitted", "late"] },
  });
  return { total, completed };
}

const ScoreSchema = z.object({
  studentId: z.string(),
  subject: z.string().min(1),
  testName: z.string().min(1),
  scorePercent: z.number().min(0).max(100),
  grade: z.string().min(1),
  date: z.string(),
});

const SaveReportCardSchema = z.object({
  studentId: z.string(),
  term: z.enum(["सत्र १", "सत्र २", "वार्षिक"]),
  academicYear: z.string().optional(),
  subjectGrades: z.array(
    z.object({
      subject: z.string(),
      grade: z.string(),
      scorePercent: z.number().min(0).max(100),
      effort: z.enum(["उत्कृष्ट", "चांगले", "समाधानकारक", "सुधारणा आवश्यक"]),
      remark: z.string().optional(),
    })
  ),
  teacherComment: z.string().optional(),
  attendanceSummary: z
    .object({
      totalDays: z.number().min(0).optional(),
      presentDays: z.number().min(0).optional(),
      absentDays: z.number().min(0).optional(),
      lateDays: z.number().min(0).optional(),
    })
    .optional(),
  homeworkCompletion: z
    .object({
      total: z.number().min(0).optional(),
      completed: z.number().min(0).optional(),
    })
    .optional(),
});

// ──────────────────────────────────────────────
// GET /api/scores?studentId=X&className=X
// ──────────────────────────────────────────────
export async function getScores(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const query: any = {};
    const forceStudentId = req.query.studentId as string | undefined;
    const className = req.query.className as string | undefined;

    if (forceStudentId) {
      if (req.user.role === "teacher") {
        const teacherClass = getMetaValue(req.user.meta, "class");
        const student = await Student.findById(forceStudentId);
        if (student && student.className !== teacherClass) {
          res.status(403).json({ error: "Student not in your class" }); return;
        }
      }
      query.studentId = forceStudentId;
    } else if (req.user.role === "student") {
      const studentDoc = await Student.findOne({ studentUserId: req.user._id });
      if (!studentDoc) { res.json({ scores: [] }); return; }
      query.studentId = studentDoc._id;
    } else if (req.user.role === "parent") {
      const children = await Student.find({ parentUserId: req.user._id }).select("_id");
      query.studentId = { $in: children.map((c) => c._id) };
    } else if (req.user.role === "teacher") {
      const teacherClass = className || getMetaValue(req.user.meta, "class");
      if (teacherClass) {
        const students = await Student.find({ className: teacherClass }).select("_id");
        query.studentId = { $in: students.map((s) => s._id) };
      }
    } else if (className) {
      const students = await Student.find({ className }).select("_id");
      query.studentId = { $in: students.map((s) => s._id) };
    }

    const scores = await Score.find(query)
      .populate("studentId", "name roll className")
      .sort({ date: -1 })
      .limit(50);

    const items = scores.map((s: any) => ({
      _id: s._id.toString(),
      id: s._id.toString(),
      studentId: s.studentId?._id?.toString(),
      studentName: s.studentId?.name,
      studentRoll: s.studentId?.roll,
      subject: s.subject,
      title: s.testName,
      testName: s.testName,
      score: s.scorePercent,
      scorePercent: s.scorePercent,
      total: 100,
      grade: s.grade,
      date: s.date,
    }));

    res.json({ scores: items });
  } catch (err) {
    console.error("GetScores error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────
// POST /api/scores  (add a score entry)
// ──────────────────────────────────────────────
export async function addScore(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (req.user.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can add scores" }); return;
    }

    const body = ScoreSchema.parse(req.body);
    const { studentId, subject, testName, scorePercent, grade, date } = body;

    const teacherClass = getMetaValue(req.user.meta, "class");
    const student = await Student.findById(studentId);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }
    if (teacherClass && student.className !== teacherClass) {
      res.status(403).json({ error: "Student not in your class" }); return;
    }

    const score = new Score({ studentId, subject, testName, scorePercent, grade, date });
    await score.save();

    res.status(201).json({
      score: {
        id: score._id.toString(), studentId, studentName: student.name,
        subject, testName, scorePercent, grade, date,
      }
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.errors }); return;
    }
    console.error("AddScore error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────
// GET /api/report-cards  (list for teacher's class)
// ──────────────────────────────────────────────
export async function listReportCards(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const query: any = {};

    if (req.user.role === "student") {
      const student = await Student.findOne({ studentUserId: req.user._id });
      if (!student) { res.json({ reportCards: [] }); return; }
      query.studentId = student._id;
    } else if (req.user.role === "parent") {
      const children = await Student.find({ parentUserId: req.user._id }).select("_id");
      query.studentId = { $in: children.map((c) => c._id) };
    } else if (req.user.role === "teacher") {
      const teacherClass = getMetaValue(req.user.meta, "class");
      if (teacherClass) {
        const students = await Student.find({ className: teacherClass }).select("_id");
        query.studentId = { $in: students.map((s) => s._id) };
      }
    } else if (req.user.role !== "admin") {
      res.status(403).json({ error: "Not allowed" });
      return;
    }

    const reportCards = await ReportCard.find(query)
      .populate("studentId")
      .sort({ createdAt: -1 });

    const items = reportCards.map((r: any) => ({
      _id: r._id.toString(),
      studentId: r.studentId?._id?.toString(),
      studentName: r.studentId?.name,
      studentRoll: r.studentId?.roll,
      className: r.className,
      term: r.term,
      academicYear: r.academicYear,
      overallGrade: r.overallGrade,
      overallPercent: r.overallPercent,
      subjectGrades: r.subjectGrades,
      teacherComment: r.teacherComment,
      attendanceSummary: r.attendanceSummary ?? emptyAttendance(),
      homeworkCompletion: r.homeworkCompletion ?? emptyHomework(),
      studentProfile: studentProfileForReportCard(r.studentId, r.enrollmentSnapshot),
      generatedAt: r.createdAt,
    }));

    res.json({ reportCards: items });
  } catch (err: any) {
    console.error("GetReportCard error:", err);
    res.status(500).json({ 
      error: "Failed to fetch report card",
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined
    });
  }
}

// ──────────────────────────────────────────────
// POST /api/report-cards/save  (save/upsert a report card)
// ──────────────────────────────────────────────
export async function saveReportCard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can save report cards" }); return;
    }

    const body = SaveReportCardSchema.parse(req.body);
    const { studentId, term, subjectGrades, teacherComment, attendanceSummary: attBody, homeworkCompletion: hwBody } = body;
    const academicYear = body.academicYear || "२०२४-२५";

    const student = await Student.findById(studentId);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    const teacherClass = getMetaValue(req.user.meta, "class");
    if (teacherClass && student.className !== teacherClass) {
      res.status(403).json({ error: "Student not in your class" }); return;
    }

    // Calculate overall
    const overallPercent = subjectGrades.length > 0
      ? Math.round(subjectGrades.reduce((s, g) => s + g.scorePercent, 0) / subjectGrades.length)
      : 0;
    const overallGrade =
      overallPercent >= 90 ? "A+" :
      overallPercent >= 80 ? "A" :
      overallPercent >= 70 ? "A-" :
      overallPercent >= 60 ? "B+" :
      overallPercent >= 50 ? "B" : "C";

    const [attDb, hwDb] = await Promise.all([
      summarizeAttendance(student._id),
      summarizeHomework(student._id, student.className),
    ]);
    const attendanceSummary = { ...emptyAttendance(), ...attDb, ...(attBody ?? {}) };
    const homeworkCompletion = { ...emptyHomework(), ...hwDb, ...(hwBody ?? {}) };

    // Upsert (one report card per student per term per year)
    const snap = enrollmentSnapshotFromStudent(student.toObject() as Record<string, unknown>);
    const reportCard = await ReportCard.findOneAndUpdate(
      { studentId, term, academicYear },
      {
        studentId,
        className: student.className,
        academicYear,
        term,
        subjectGrades,
        overallGrade,
        overallPercent,
        teacherComment: teacherComment || "",
        generatedByTeacherId: req.user._id,
        enrollmentSnapshot: snap,
        attendanceSummary,
        homeworkCompletion,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      reportCard: {
        _id: reportCard._id.toString(),
        studentId,
        studentName: student.name,
        studentRoll: student.roll,
        className: student.className,
        term,
        academicYear,
        subjectGrades,
        overallGrade,
        overallPercent,
        teacherComment,
        attendanceSummary: reportCard.attendanceSummary ?? emptyAttendance(),
        homeworkCompletion: reportCard.homeworkCompletion ?? emptyHomework(),
        studentProfile: studentProfileForReportCard(student, reportCard.enrollmentSnapshot),
        generatedAt: reportCard.createdAt,
      }
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.errors }); return;
    }
    console.error("SaveReportCard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────
// POST /api/report-cards/generate-all  (generate for whole class from scores)
// ──────────────────────────────────────────────
export async function generateAllReportCards(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can generate report cards" }); return;
    }

    const teacherClass = getMetaValue(req.user.meta, "class");
    const term: string = (req.body.term as string) || "वार्षिक";
    const academicYear: string = (req.body.academicYear as string) || "२०२४-२५";

    const students = await Student.find({ className: teacherClass });
    if (students.length === 0) {
      res.json({ reportCards: [], message: "No students found in your class" }); return;
    }

    const generated: any[] = [];

    for (const student of students) {
      const scores = await Score.find({ studentId: student._id });
      if (scores.length === 0) continue;

      // Aggregate subject grades from score records
      const subjectMap: Record<string, number[]> = {};
      for (const sc of scores) {
        if (!subjectMap[sc.subject]) subjectMap[sc.subject] = [];
        subjectMap[sc.subject].push(sc.scorePercent);
      }

      const subjectGrades = Object.entries(subjectMap).map(([subject, percents]) => {
        const avg = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
        const grade =
          avg >= 90 ? "A+" : avg >= 80 ? "A" : avg >= 70 ? "A-" :
          avg >= 60 ? "B+" : avg >= 50 ? "B" : "C";
        const effort =
          avg >= 85 ? "उत्कृष्ट" : avg >= 70 ? "चांगले" :
          avg >= 50 ? "समाधानकारक" : "सुधारणा आवश्यक";
        return { subject, grade, scorePercent: avg, effort, remark: "" };
      });

      const overallPercent = Math.round(
        subjectGrades.reduce((s, g) => s + g.scorePercent, 0) / subjectGrades.length
      );
      const overallGrade =
        overallPercent >= 90 ? "A+" : overallPercent >= 80 ? "A" :
        overallPercent >= 70 ? "A-" : overallPercent >= 60 ? "B+" :
        overallPercent >= 50 ? "B" : "C";

      const enrollmentSnapshot = enrollmentSnapshotFromStudent(
        student.toObject() as Record<string, unknown>
      );

      const [attDb, hwDb] = await Promise.all([
        summarizeAttendance(student._id),
        summarizeHomework(student._id, student.className),
      ]);
      const attendanceSummary = { ...emptyAttendance(), ...attDb };
      const homeworkCompletion = { ...emptyHomework(), ...hwDb };

      const rc = await ReportCard.findOneAndUpdate(
        { studentId: student._id, term, academicYear },
        {
          studentId: student._id,
          className: teacherClass,
          academicYear,
          term,
          subjectGrades,
          overallGrade,
          overallPercent,
          teacherComment: "",
          generatedByTeacherId: req.user._id,
          enrollmentSnapshot,
          attendanceSummary,
          homeworkCompletion,
        },
        { upsert: true, new: true }
      );

      generated.push({
        _id: rc._id.toString(),
        studentId: student._id.toString(),
        studentName: student.name,
        studentRoll: student.roll,
        className: student.className,
        term,
        academicYear,
        subjectGrades,
        overallGrade,
        overallPercent,
        attendanceSummary: rc.attendanceSummary ?? emptyAttendance(),
        homeworkCompletion: rc.homeworkCompletion ?? emptyHomework(),
        studentProfile: studentProfileForReportCard(student, rc.enrollmentSnapshot),
        generatedAt: rc.createdAt,
      });
    }

    res.json({ reportCards: generated, total: generated.length });
  } catch (err) {
    console.error("GenerateAllReportCards error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────
// POST /api/report-cards/generate/:studentId  (for one student from scores)
// ──────────────────────────────────────────────
export async function generateReportCard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can generate report cards" }); return;
    }

    const { studentId } = req.params;
    const term: string = (req.body.term as string) || "वार्षिक";
    const academicYear: string = (req.body.academicYear as string) || "२०२४-२५";

    const student = await Student.findById(studentId);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    const teacherClass = getMetaValue(req.user.meta, "class");
    if (teacherClass && student.className !== teacherClass) {
      res.status(403).json({ error: "Student not in your class" }); return;
    }

    const scores = await Score.find({ studentId });

    // Aggregate
    const subjectMap: Record<string, number[]> = {};
    for (const sc of scores) {
      if (!subjectMap[sc.subject]) subjectMap[sc.subject] = [];
      subjectMap[sc.subject].push(sc.scorePercent);
    }

    const subjectGrades = Object.entries(subjectMap).map(([subject, percents]) => {
      const avg = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
      const grade =
        avg >= 90 ? "A+" : avg >= 80 ? "A" : avg >= 70 ? "A-" :
        avg >= 60 ? "B+" : avg >= 50 ? "B" : "C";
      const effort =
        avg >= 85 ? "उत्कृष्ट" : avg >= 70 ? "चांगले" :
        avg >= 50 ? "समाधानकारक" : "सुधारणा आवश्यक";
      return { subject, grade, scorePercent: avg, effort, remark: "" };
    });

    const overallPercent = subjectGrades.length > 0
      ? Math.round(subjectGrades.reduce((s, g) => s + g.scorePercent, 0) / subjectGrades.length)
      : 0;
    const overallGrade =
      overallPercent >= 90 ? "A+" : overallPercent >= 80 ? "A" :
      overallPercent >= 70 ? "A-" : overallPercent >= 60 ? "B+" :
      overallPercent >= 50 ? "B" : "C";

    const snap = enrollmentSnapshotFromStudent(student.toObject() as Record<string, unknown>);
    const [attDb, hwDb] = await Promise.all([
      summarizeAttendance(student._id),
      summarizeHomework(student._id, student.className),
    ]);
    const attendanceSummary = { ...emptyAttendance(), ...attDb };
    const homeworkCompletion = { ...emptyHomework(), ...hwDb };

    const rc = await ReportCard.findOneAndUpdate(
      { studentId, term, academicYear },
      {
        studentId,
        className: student.className,
        academicYear,
        term,
        subjectGrades,
        overallGrade,
        overallPercent,
        teacherComment: "",
        generatedByTeacherId: req.user._id,
        enrollmentSnapshot: snap,
        attendanceSummary,
        homeworkCompletion,
      },
      { upsert: true, new: true }
    );

    res.json({
      reportCard: {
        _id: rc._id.toString(),
        studentId,
        studentName: student.name,
        studentRoll: student.roll,
        parentName: student.parentName,
        className: student.className,
        term,
        academicYear,
        subjectGrades,
        overallGrade,
        overallPercent,
        attendanceSummary: rc.attendanceSummary ?? emptyAttendance(),
        homeworkCompletion: rc.homeworkCompletion ?? emptyHomework(),
        studentProfile: studentProfileForReportCard(student, rc.enrollmentSnapshot),
        generatedAt: rc.createdAt,
      }
    });
  } catch (err) {
    console.error("GenerateReportCard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ──────────────────────────────────────────────
// GET /api/report-cards/:studentId  (single student's card)
// ──────────────────────────────────────────────
export async function getStudentReportCard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { studentId } = req.params;
    const term = req.query.term as string | undefined;

    const student = await Student.findById(studentId);
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    // Access control
    if (req.user.role === "student") {
      const studentUser = await Student.findOne({ studentUserId: req.user._id });
      if (!studentUser || studentUser._id.toString() !== studentId) {
        res.status(403).json({ error: "Cannot access other student's report card" }); return;
      }
    } else if (req.user.role === "parent") {
      const parent = await Student.findOne({ parentUserId: req.user._id, _id: studentId });
      if (!parent) { res.status(403).json({ error: "Not parent of this student" }); return; }
    } else if (req.user.role === "teacher") {
      const teacherClass = getMetaValue(req.user.meta, "class");
      if (teacherClass && student.className !== teacherClass) {
        res.status(403).json({ error: "Student not in your class" }); return;
      }
    } else if (req.user.role === "admin") {
      // full access
    } else {
      res.status(403).json({ error: "Not allowed" }); return;
    }

    const query: any = { studentId };
    if (term) query.term = term;

    const cards = await ReportCard.find(query).sort({ createdAt: -1 });

    if (cards.length === 0) {
      // Fallback: build a card from Score collection
      const scores = await Score.find({ studentId }).sort({ date: -1 });
      const subjectMap: Record<string, number[]> = {};
      for (const sc of scores) {
        if (!subjectMap[sc.subject]) subjectMap[sc.subject] = [];
        subjectMap[sc.subject].push(sc.scorePercent);
      }
      const subjectGrades = Object.entries(subjectMap).map(([subject, percents]) => {
        const avg = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
        const grade = avg >= 90 ? "A+" : avg >= 80 ? "A" : avg >= 70 ? "A-" : avg >= 60 ? "B+" : avg >= 50 ? "B" : "C";
        const effort = avg >= 85 ? "उत्कृष्ट" : avg >= 70 ? "चांगले" : avg >= 50 ? "समाधानकारक" : "सुधारणा आवश्यक";
        return { subject, grade, scorePercent: avg, effort, remark: "" };
      });
      const overallPercent = subjectGrades.length
        ? Math.round(subjectGrades.reduce((s, g) => s + g.scorePercent, 0) / subjectGrades.length) : 0;
      const overallGrade = overallPercent >= 90 ? "A+" : overallPercent >= 80 ? "A" : overallPercent >= 70 ? "A-" : overallPercent >= 60 ? "B+" : overallPercent >= 50 ? "B" : "C";

      const [attDb, hwDb] = await Promise.all([
        summarizeAttendance(student._id),
        summarizeHomework(student._id, student.className),
      ]);

      res.json({
        reportCard: {
          studentId, studentName: student.name, studentRoll: student.roll,
          parentName: student.parentName, className: student.className,
          term: "वार्षिक", academicYear: "२०२४-२५",
          subjectGrades, overallGrade, overallPercent, teacherComment: "",
          attendanceSummary: { ...emptyAttendance(), ...attDb },
          homeworkCompletion: { ...emptyHomework(), ...hwDb },
          studentProfile: studentProfileForReportCard(student, null),
        }
      });
      return;
    }

    const r = cards[0] as any;
    res.json({
      reportCard: {
        _id: r._id.toString(),
        studentId, studentName: student.name, studentRoll: student.roll,
        parentName: student.parentName, className: student.className,
        term: r.term, academicYear: r.academicYear,
        subjectGrades: r.subjectGrades,
        overallGrade: r.overallGrade, overallPercent: r.overallPercent,
        teacherComment: r.teacherComment,
        attendanceSummary: r.attendanceSummary ?? emptyAttendance(),
        homeworkCompletion: r.homeworkCompletion ?? emptyHomework(),
        studentProfile: studentProfileForReportCard(student, r.enrollmentSnapshot),
        generatedAt: r.createdAt,
      }
    });
  } catch (err) {
    console.error("GetStudentReportCard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
