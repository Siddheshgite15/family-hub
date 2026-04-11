import { Request, Response } from "express";
import { User, Student } from "../models";
import { AuthRequest } from "../middleware/auth";
import { hashPassword, toClientUser } from "../utils/auth";
import { getMetaValue } from "../utils/auth";
import { z } from "zod";

const EnrollSchema = z.object({
  name: z.string().min(1),
  parentName: z.string().min(1),
  className: z.string().min(1),
  motherName: z.string().optional(),
  fatherName: z.string().optional(),
  roll: z.string().min(1).max(32).optional(),
  idNumber: z.string().optional(),
  regNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["", "male", "female", "other"]).optional(),
  address: z.string().optional(),
  parentPhone: z.string().optional(),
  alternateGuardianName: z.string().optional(),
  alternateGuardianPhone: z.string().optional(),
  admissionDate: z.string().optional(),
  bloodGroup: z.string().optional(),
  previousSchool: z.string().optional(),
  notes: z.string().optional(),
  studentPhone: z.string().optional(),
  motherTongue: z.string().optional(),
  medium: z.string().optional(),
  udiseNumber: z.string().optional(),
  mailingAddress: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      relation: z.string().optional(),
    })
    .optional(),
});

function generatePassword(): string {
  return "Pass" + Math.floor(1000 + Math.random() * 9000);
}

export async function enrollStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== "teacher") {
      res.status(403).json({ error: "Only teachers can enroll students" });
      return;
    }

    const body = EnrollSchema.parse(req.body);
    let { className } = body;
    const teacherClass = getMetaValue(req.user.meta, "class");
    if (teacherClass && className !== teacherClass) {
      res.status(403).json({ error: "You can only enroll students in your assigned class" });
      return;
    }
    if (teacherClass) {
      className = teacherClass;
    }

    const {
      name,
      parentName,
      roll: rollOverride,
      motherName = "",
      fatherName = "",
      idNumber = "",
      regNumber = "",
      dateOfBirth = "",
      gender = "",
      address = "",
      parentPhone = "",
      alternateGuardianName = "",
      alternateGuardianPhone = "",
      admissionDate = "",
      bloodGroup = "",
      previousSchool = "",
      notes = "",
      studentPhone = "",
      motherTongue = "",
      medium = "",
      udiseNumber = "",
      mailingAddress,
      emergencyContact,
    } = body;

    let rollNum: string;
    if (rollOverride?.trim()) {
      rollNum = rollOverride.trim();
      const dup = await Student.findOne({ className, roll: rollNum });
      if (dup) {
        res.status(400).json({ error: "Roll number already used in this class" });
        return;
      }
    } else {
      const existingCount = await Student.countDocuments({ className });
      rollNum = String(existingCount + 1).padStart(2, "0");
    }

    const baseEmail = name
      .toLowerCase()
      .replace(/\s/g, ".")
      .replace(/[^a-z.]/g, "");
    const timestamp = Date.now().toString(36).slice(-4);
    const studentEmail = `${baseEmail}.${timestamp}@school.edu`;
    const parentEmail = `parent.${baseEmail}.${timestamp}@school.edu`;

    const studentPasswordPlain = generatePassword();
    const parentPasswordPlain = generatePassword();

    const studentHash = await hashPassword(studentPasswordPlain);
    const parentHash = await hashPassword(parentPasswordPlain);

    const studentUser = new User({
      name,
      email: studentEmail,
      passwordHash: studentHash,
      role: "student",
      meta: new Map([
        ["class", className],
        ["roll", rollNum],
      ]),
    });

    const parentUser = new User({
      name: parentName,
      email: parentEmail,
      passwordHash: parentHash,
      role: "parent",
      meta: new Map([
        ["child", name],
        ["class", className],
      ]),
    });

    await studentUser.save();
    await parentUser.save();

    const student = new Student({
      name,
      roll: rollNum,
      idNumber,
      regNumber,
      className,
      parentName,
      motherName,
      fatherName,
      studentEmail,
      parentEmail,
      studentUserId: studentUser._id,
      parentUserId: parentUser._id,
      createdByTeacherId: req.user._id,
      dateOfBirth,
      gender,
      address,
      parentPhone,
      alternateGuardianName,
      alternateGuardianPhone,
      admissionDate,
      bloodGroup,
      previousSchool,
      notes,
      studentPhone,
      motherTongue,
      medium,
      udiseNumber,
      mailingAddress: mailingAddress || {},
      emergencyContact: emergencyContact || {},
    });

    await student.save();

    res.status(201).json({
      student: {
        id: student._id.toString(),
        name,
        roll: rollNum,
        class: className,
        parentName,
        motherName: student.motherName,
        fatherName: student.fatherName,
        studentEmail,
        studentPassword: studentPasswordPlain,
        parentEmail,
        parentPassword: parentPasswordPlain,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        address: student.address,
        mailingAddress: student.mailingAddress,
        studentPhone: student.studentPhone,
        parentPhone: student.parentPhone,
        alternateGuardianName: student.alternateGuardianName,
        alternateGuardianPhone: student.alternateGuardianPhone,
        admissionDate: student.admissionDate,
        bloodGroup: student.bloodGroup,
        previousSchool: student.previousSchool,
        notes: student.notes,
        emergencyContact: student.emergencyContact,
        studentUser: toClientUser(studentUser),
        parentUser: toClientUser(parentUser),
      }
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: err.errors });
      return;
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      res.status(400).json({ error: `${field} already exists` });
      return;
    }
    console.error("Enroll error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
