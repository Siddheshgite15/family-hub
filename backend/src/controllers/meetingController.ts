import { Response } from "express";
import { Meeting, Student } from "../models";
import { AuthRequest } from "../middleware/auth";
import { getMetaValue } from "../utils/auth";
import { z } from "zod";

/**
 * ============================
 * 📌 Validation Schema
 * ============================
 */
const CreateMeetingSchema = z
  .object({
    studentId: z.string().optional(),
    classWide: z.boolean().optional(),
    date: z.string().min(1, "Date is required"),
    timeLabel: z.string().min(1, "Time is required"),
    mode: z.enum(["प्रत्यक्ष", "ऑनलाइन"]),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.classWide && (!data.studentId || !data.studentId.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studentId is required unless classWide is true",
        path: ["studentId"],
      });
    }
  });

const RescheduleSchema = z.object({
  date: z.string().min(1),
  timeLabel: z.string().min(1),
  mode: z.enum(["प्रत्यक्ष", "ऑनलाइन"]).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * ============================
 * 📌 GET /api/meetings
 * - Teacher → their class students
 * - Parent → their children
 * - Admin → all meetings
 * ============================
 */
export async function listMeetings(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    let filter: any = {};

    /**
     * 🧑‍🏫 TEACHER
     */
    if (user.role === "teacher") {
      filter.teacherId = user._id;

      const teacherClass = getMetaValue(user.meta, "class");

      if (teacherClass) {
        const classStudents = await Student.find({
          className: teacherClass,
        }).select("_id");
        const ids = classStudents.map((s) => s._id);
        filter.$or = [
          { studentId: { $in: ids } },
          { classWide: true, className: teacherClass },
        ];
      }
    }

    /**
     * 👨‍👩‍👧 PARENT
     */
    else if (user.role === "parent") {
      const students = await Student.find({
        parentUserId: user._id,
      })
        .select("_id className")
        .lean();
      const ids = students.map((s) => s._id);
      const classNames = [...new Set(students.map((s) => s.className).filter(Boolean))];
      filter.$or = [
        { studentId: { $in: ids } },
        { classWide: true, className: { $in: classNames } },
      ];
    }

    /**
     * 🛠️ ADMIN (NEW)
     */
    else if (user.role === "admin") {
      filter = {};
    }

    /**
     * 📦 FETCH DATA
     */
    const meetings = await Meeting.find(filter)
      .sort({ date: 1 })
      .limit(50)
      .populate("studentId", "name className")
      .lean();

    /**
     * 📤 FORMAT RESPONSE (AI + FRONTEND FRIENDLY)
     */
    const formatted = meetings.map((m: any) => ({
      id: m._id.toString(),
      classWide: !!m.classWide,
      className: m.className || "",
      student: m.studentId
        ? {
            id: m.studentId._id,
            name: m.studentId.name,
            className: m.studentId.className,
          }
        : null,
      studentName: m.studentName,
      date: m.date,
      timeLabel: m.timeLabel,
      mode: m.mode,
      notes: m.notes || null,
      status: m.status || "नियोजित",
      teacherName: m.teacherName,
      createdAt: m.createdAt,
    }));

    res.json({ meetings: formatted });
  } catch (err: any) {
    console.error("GetMeetings error:", err);
    res.status(500).json({ 
      error: "Failed to fetch meetings",
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined
    });
  }
}

/**
 * ============================
 * 📌 POST /api/meetings
 * Teacher/Admin schedules meeting
 * ============================
 */
export async function createMeeting(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    /**
     * 🔐 ROLE CHECK
     */
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      res.status(403).json({
        error: "Only teachers or admins can schedule meetings",
      });
      return;
    }

    /**
     * 📥 VALIDATION
     */
    const body = CreateMeetingSchema.parse(req.body);

    const teacherClass =
      req.user.role === "teacher" ? getMetaValue(req.user.meta, "class") : "";

    let student: InstanceType<typeof Student> | null = null;
    let classWide = !!body.classWide;
    let studentName = "";
    let parentId: unknown = undefined;
    let studentId: unknown = undefined;
    let meetingClassName = "";

    if (classWide) {
      if (req.user.role === "teacher") {
        if (!teacherClass) {
          res.status(400).json({ error: "Teacher class not assigned" });
          return;
        }
        meetingClassName = teacherClass;
        studentName = `वर्ग सभा — ${teacherClass}`;
      } else {
        meetingClassName = (req.body.className as string) || "";
        if (!meetingClassName) {
          res.status(400).json({ error: "className required for admin class meeting" });
          return;
        }
        studentName = `वर्ग सभा — ${meetingClassName}`;
      }
    } else {
      student = await Student.findById(body.studentId);
      if (!student) {
        res.status(404).json({ error: "Student not found" });
        return;
      }
      if (req.user.role === "teacher" && teacherClass && student.className !== teacherClass) {
        res.status(403).json({
          error: "You can only schedule meetings for your class students",
        });
        return;
      }
      studentName = student.name;
      parentId = student.parentUserId;
      studentId = student._id;
      meetingClassName = student.className;
    }

    const meeting = await Meeting.create({
      studentId: studentId || undefined,
      classWide,
      className: meetingClassName,
      studentName,
      date: new Date(body.date),
      timeLabel: body.timeLabel,
      mode: body.mode,
      notes: body.notes,
      teacherId: req.user._id,
      teacherName: req.user.name,
      parentId: parentId || undefined,
    });

    /**
     * 🔔 FUTURE: NOTIFICATION SYSTEM
     */
    // await sendNotification({
    //   userId: student.parentUserId,
    //   title: "New Meeting Scheduled",
    //   message: `${req.user.name} scheduled a meeting on ${body.date}`,
    // });

    /**
     * 📤 RESPONSE
     */
    res.status(201).json({
      meeting: {
        id: meeting._id.toString(),
        studentId: meeting.studentId,
        classWide: meeting.classWide,
        className: meeting.className,
        studentName: meeting.studentName,
        date: meeting.date,
        timeLabel: meeting.timeLabel,
        mode: meeting.mode,
        notes: meeting.notes,
        status: meeting.status,
        teacherName: meeting.teacherName,
        createdAt: meeting.createdAt,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: err.errors,
      });
      return;
    }

    console.error("❌ createMeeting error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * ============================
 * 📌 PATCH /api/meetings/:id/status
 * - Teacher/Admin → update any
 * - Parent → only their meeting
 * ============================
 */
export async function updateMeetingStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    /**
     * ✅ VALID STATUS
     */
    const allowedStatus = ["नियोजित", "पूर्ण", "रद्द"];
    if (!allowedStatus.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    /**
     * 🔍 FETCH MEETING
     */
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }

    /**
     * 🔐 ACCESS CONTROL
     */
    if (req.user.role === "admin") {
      /* allowed */
    } else if (req.user.role === "teacher") {
      if (!meeting.teacherId?.equals(req.user._id)) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }
    } else if (req.user.role === "parent") {
      if (meeting.classWide && meeting.className) {
        const ok = await Student.exists({
          parentUserId: req.user._id,
          className: meeting.className,
        });
        if (!ok) {
          res.status(403).json({ error: "Not authorized" });
          return;
        }
      } else if (!meeting.parentId?.equals(req.user._id)) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }
    } else {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    /**
     * 📝 UPDATE
     */
    meeting.status = status;
    await meeting.save();

    /**
     * 🔔 NOTIFICATION HOOK
     */
    // await sendNotification({
    //   userId: meeting.parentId,
    //   title: "Meeting Updated",
    //   message: `Meeting status changed to ${status}`,
    // });

    res.json({
      meeting: {
        id: meeting._id.toString(),
        status: meeting.status,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("❌ updateMeetingStatus error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PATCH /api/meetings/:id/reschedule — teacher/admin only
 */
export async function rescheduleMeeting(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      res.status(403).json({ error: "Only teachers or admins can reschedule" });
      return;
    }

    const { id } = req.params;
    const body = RescheduleSchema.parse(req.body);

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }

    if (req.user.role === "teacher" && !meeting.teacherId?.equals(req.user._id)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    meeting.date = new Date(body.date);
    meeting.timeLabel = body.timeLabel;
    if (body.mode) meeting.mode = body.mode;
    if (body.notes !== undefined) meeting.notes = body.notes;
    await meeting.save();

    res.json({
      meeting: {
        id: meeting._id.toString(),
        date: meeting.date,
        timeLabel: meeting.timeLabel,
        mode: meeting.mode,
        notes: meeting.notes,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    console.error("❌ rescheduleMeeting error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}