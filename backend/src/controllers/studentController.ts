import { Request, Response } from "express";
import { z } from "zod";
import { Student } from "../models";
import { AuthRequest } from "../middleware/auth";
import { getMetaValue } from "../utils/auth";
import { serializeStudentForViewer, STUDENT_UPDATABLE_FIELDS } from "../utils/studentSerialize";

const MailingSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  })
  .optional();

const EmergencySchema = z
  .object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relation: z.string().optional(),
  })
  .optional();

const UpdateStudentSchema = z
  .object({
    name: z.string().min(1).optional(),
    roll: z.string().min(1).max(32).optional(),
    idNumber: z.string().optional(),
    regNumber: z.string().optional(),
    className: z.string().min(1).optional(),
    parentName: z.string().min(1).optional(),
    motherName: z.string().optional(),
    fatherName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["", "male", "female", "other"]).optional(),
    address: z.string().optional(),
    mailingAddress: MailingSchema,
    studentPhone: z.string().optional(),
    parentPhone: z.string().optional(),
    alternateGuardianName: z.string().optional(),
    alternateGuardianPhone: z.string().optional(),
    admissionDate: z.string().optional(),
    bloodGroup: z.string().optional(),
    previousSchool: z.string().optional(),
    notes: z.string().optional(),
    motherTongue: z.string().optional(),
    medium: z.string().optional(),
    udiseNumber: z.string().optional(),
    emergencyContact: EmergencySchema,
  })
  .strict();

/**
 * GET /api/students
 */
export async function getStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = req.user;
    let query: any = {};

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    // Filters
    const search = req.query.search as string;
    const className = req.query.className as string;

    // Role-based filtering
    if (user.role === "teacher") {
      const teacherClass = getMetaValue(user.meta, "class");
      if (teacherClass) {
        query.className = teacherClass;
      }
    } else if (user.role === "parent") {
      query.parentUserId = user._id;
    } else if (user.role === "student") {
      query.studentUserId = user._id;
    } else if (user.role === "admin") {
      query = {};
    } else {
      res.status(403).json({ error: "Not allowed" });
      return;
    }

    // Additional filters
    if (className) {
      query.className = className;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { roll: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Student.countDocuments(query);

    const students = await Student.find(query)
      .populate("studentUserId", "name email role")
      .populate("parentUserId", "name email role")
      .populate("createdByTeacherId", "name email")
      .sort({ roll: 1 })
      .skip(skip)
      .limit(limit);

    const items = students.map((s: any) => {
      const plain = s.toObject ? s.toObject() : s;
      return serializeStudentForViewer(
        {
          ...plain,
          studentUserId: plain.studentUserId?._id ?? plain.studentUserId,
          parentUserId: plain.parentUserId?._id ?? plain.parentUserId,
        },
        user.role,
        user._id
      );
    });

    res.json({
      students: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("GetStudents error:", err);
    res.status(500).json({ 
      error: "Failed to fetch students",
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined
    });
  }
}

/**
 * GET /api/students/:id
 */
export async function getStudentById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const student = await Student.findById(id)
      .populate("studentUserId", "name email role")
      .populate("parentUserId", "name email role");

    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = req.user;

    // Access control
    if (user.role === "teacher") {
      const teacherClass = getMetaValue(user.meta, "class");
      if (student.className !== teacherClass) {
        res.status(403).json({ error: "Student not in your class" });
        return;
      }
    } else if (user.role === "parent") {
      if (student.parentUserId?.toString() !== user._id.toString()) {
        res.status(403).json({ error: "Not your child" });
        return;
      }
    } else if (user.role === "student") {
      if (student.studentUserId?.toString() !== user._id.toString()) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }
    } else if (user.role !== "admin") {
      res.status(403).json({ error: "Not allowed" });
      return;
    }

    const plain = (student as any).toObject ? (student as any).toObject() : student;
    const item = serializeStudentForViewer(
      {
        ...plain,
        studentUserId: plain.studentUserId?._id ?? plain.studentUserId,
        parentUserId: plain.parentUserId?._id ?? plain.parentUserId,
      },
      user.role,
      user._id
    );

    res.json({ student: item });
  } catch (err) {
    console.error("GetStudentById error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/students/:id
 */
export async function updateStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!["teacher", "admin"].includes(req.user.role)) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }

    const { id } = req.params;
    let updates: Record<string, unknown>;
    try {
      updates = UpdateStudentSchema.parse(req.body);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid input", details: e.errors });
        return;
      }
      throw e;
    }

    const student = await Student.findById(id);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    // Teacher can update only their class
    if (req.user.role === "teacher") {
      const teacherClass = getMetaValue(req.user.meta, "class");
      if (student.className !== teacherClass) {
        res.status(403).json({ error: "Student not in your class" });
        return;
      }
    }

    if (updates.roll !== undefined && updates.roll !== student.roll) {
      const targetClass = updates.className ?? student.className;
      const dup = await Student.findOne({
        className: targetClass,
        roll: updates.roll,
        _id: { $ne: student._id },
      });
      if (dup) {
        res.status(400).json({ error: "Roll number already used in this class" });
        return;
      }
    }

    for (const key of STUDENT_UPDATABLE_FIELDS) {
      if (key in updates && updates[key as keyof typeof updates] !== undefined) {
        (student as any)[key] = updates[key as keyof typeof updates];
      }
    }

    await student.save();

    const plain = student.toObject();
    res.json({
      student: serializeStudentForViewer(
        {
          ...plain,
          studentUserId: plain.studentUserId,
          parentUserId: plain.parentUserId,
        },
        req.user.role,
        req.user._id
      ),
    });
  } catch (err) {
    console.error("updateStudent error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/students/:id
 */
export async function deleteStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (req.user.role !== "admin") {
      res.status(403).json({ error: "Only admin can delete" });
      return;
    }

    const { id } = req.params;

    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error("deleteStudent error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}