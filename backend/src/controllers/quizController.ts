import { Request, Response } from "express";
import { Quiz, QuizResult, Student } from "../models";
import { AuthRequest } from "../middleware/auth";
import { getMetaValue } from "../utils/auth";
import { z } from "zod";

const CreateQuizSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  className: z.string().min(1),
  icon: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  questions: z.array(
    z.object({
      question: z.string().min(1),
      options: z.array(z.string()).min(2),
      correctIndex: z.number().int().min(0),
    })
  ).min(1),
});

const SubmitQuizSchema = z.object({
  answers: z.array(z.number().int().min(0)),
});

// GET /api/quizzes?className=X → list quizzes for a class
export async function listQuizzes(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = req.user;
    let filter: any = {};
    const teacherClass = getMetaValue(user.meta, "class");

    if (user.role === "teacher") {
      filter.createdByTeacherId = user._id;
      if (teacherClass) {
        filter.className = teacherClass;
      } else if (req.query.className) {
        filter.className = req.query.className as string;
      }
    } else if (user.role === "student") {
      const studentDoc = await Student.findOne({ studentUserId: user._id }).select("className").lean();
      const cn = studentDoc?.className || getMetaValue(user.meta, "class");
      if (cn) filter.className = cn;
    } else if (user.role === "parent") {
      const children = await Student.find({ parentUserId: user._id }).select("className").lean();
      const classes = [...new Set(children.map((c) => c.className).filter(Boolean))];
      if (classes.length === 0) {
        res.json({ quizzes: [] });
        return;
      }
      filter.className = { $in: classes };
    } else if (req.query.className) {
      filter.className = req.query.className;
    }

    const quizzes = await Quiz.find(filter).sort({ createdAt: -1 });
    res.json({ quizzes });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.errors });
      return;
    }
    console.error("GetQuizzes error:", err);
    res.status(500).json({ 
      error: "Failed to fetch quizzes",
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined
    });
  }
}

// POST /api/quizzes → teacher creates a quiz
export async function createQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const body = CreateQuizSchema.parse(req.body);
    const teacherClass = getMetaValue(req.user.meta, "class");
    const className = teacherClass || body.className;
    if (teacherClass && body.className !== teacherClass) {
      res.status(403).json({ error: "Quizzes can only be created for your assigned class" });
      return;
    }
    const quiz = await Quiz.create({
      ...body,
      className,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdByTeacherId: req.user._id,
    });
    res.status(201).json({ quiz });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.errors });
      return;
    }
    console.error("createQuiz error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/quizzes/:id → get a single quiz (strip correct answers for students)
export async function getQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }
    const isTeacher = req.user.role === "teacher";
    if (!isTeacher) {
      const studentDoc = await Student.findOne({ studentUserId: req.user._id }).select("className").lean();
      const parentChild = req.user.role === "parent"
        ? await Student.findOne({ parentUserId: req.user._id, className: quiz.className }).select("_id").lean()
        : null;
      const allowed =
        (req.user.role === "student" && studentDoc?.className === quiz.className) ||
        (req.user.role === "parent" && parentChild);
      if (!allowed) {
        res.status(403).json({ error: "Not allowed to view this quiz" });
        return;
      }
    } else {
      const teacherClass = getMetaValue(req.user.meta, "class");
      if (teacherClass && quiz.className !== teacherClass) {
        res.status(403).json({ error: "Not allowed to view this quiz" });
        return;
      }
    }
    const quizObj: any = quiz.toObject();
    if (!isTeacher) {
      quizObj.questions = quizObj.questions.map(({ correctIndex, ...q }: any) => q);
    }
    res.json({ quiz: quizObj });
  } catch (err) {
    console.error("getQuiz error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// POST /api/quizzes/:id/submit → student submits quiz
export async function submitQuiz(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }

    const { answers } = SubmitQuizSchema.parse(req.body);
    const student = await Student.findOne({ studentUserId: req.user._id });
    if (!student) {
      res.status(404).json({ error: "Student record not found" });
      return;
    }
    if (student.className !== quiz.className) {
      res.status(403).json({ error: "This quiz is not for your class" });
      return;
    }

    // Allow re-submission (upsert) — student can replay
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) score++;
    });

    const result = await QuizResult.findOneAndUpdate(
      { quizId: quiz._id, studentId: student._id },
      { answers, score, total: quiz.questions.length, submittedAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(201).json({ result, score, total: quiz.questions.length });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.errors });
      return;
    }
    console.error("submitQuiz error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/quizzes/:id/results → teacher sees all results
export async function getQuizResults(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can view quiz results" });
      return;
    }
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      res.status(404).json({ error: "Quiz not found" });
      return;
    }
    const teacherClass = getMetaValue(req.user.meta, "class");
    if (teacherClass && quiz.className !== teacherClass) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    const results = await QuizResult.find({ quizId: req.params.id }).populate("studentId", "name roll");
    res.json({ results });
  } catch (err) {
    console.error("getQuizResults error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
