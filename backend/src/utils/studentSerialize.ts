import mongoose from "mongoose";

export type StudentAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export type StudentEmergency = {
  name?: string;
  phone?: string;
  relation?: string;
};

function normAddr(v: unknown): StudentAddress {
  if (v && typeof v === "object") {
    const a = v as Record<string, string>;
    return {
      line1: a.line1 || "",
      line2: a.line2 || "",
      city: a.city || "",
      state: a.state || "",
      pincode: a.pincode || "",
    };
  }
  return { line1: "", line2: "", city: "", state: "", pincode: "" };
}

function normEmerg(v: unknown): StudentEmergency {
  if (v && typeof v === "object") {
    const e = v as Record<string, string>;
    return {
      name: e.name || "",
      phone: e.phone || "",
      relation: e.relation || "",
    };
  }
  return { name: "", phone: "", relation: "" };
}

/** Enrollment fields for report cards / PDF (plain object, no DB ids). */
export function studentProfileForReport(s: Record<string, unknown>): Record<string, unknown> {
  return {
    name: s.name ?? "",
    roll: s.roll ?? "",
    className: s.className ?? "",
    parentName: s.parentName ?? "",
    motherName: s.motherName ?? "",
    fatherName: s.fatherName ?? "",
    dateOfBirth: s.dateOfBirth ?? "",
    gender: s.gender ?? "",
    address: s.address ?? "",
    studentPhone: s.studentPhone ?? "",
    parentPhone: s.parentPhone ?? "",
    mailingAddress: normAddr(s.mailingAddress),
    admissionDate: s.admissionDate ?? "",
    bloodGroup: s.bloodGroup ?? "",
    previousSchool: s.previousSchool ?? "",
    alternateGuardianName: s.alternateGuardianName ?? "",
    alternateGuardianPhone: s.alternateGuardianPhone ?? "",
    notes: s.notes ?? "",
    emergencyContact: normEmerg(s.emergencyContact),
  };
}

/** Fields safe to return to the owning student or their parent. */
export function serializeStudentForViewer(
  s: Record<string, unknown>,
  role: string,
  viewerUserId?: mongoose.Types.ObjectId | string
): Record<string, unknown> {
  const id = (s._id as mongoose.Types.ObjectId)?.toString();
  const studentUserId = (s.studentUserId as mongoose.Types.ObjectId)?.toString();
  const parentUserId = (s.parentUserId as mongoose.Types.ObjectId)?.toString();
  const viewerId = viewerUserId != null ? String(viewerUserId) : "";
  const isSelfStudent = role === "student" && viewerId && studentUserId === viewerId;
  const isParentOf = role === "parent" && viewerId && parentUserId === viewerId;
  const isStaff = role === "teacher" || role === "admin";

  const showEmail = isStaff;
  const showContact = isStaff || isParentOf || isSelfStudent;

  const base: Record<string, unknown> = {
    id,
    name: s.name,
    roll: s.roll,
    class: s.className,
    parentName: s.parentName,
    motherName: s.motherName ?? "",
    fatherName: s.fatherName ?? "",
    studentUserId,
    parentUserId,
    createdAt: s.createdAt,
  };

  if (showContact) {
    Object.assign(base, studentProfileForReport(s));
  }

  if (showEmail) {
    base.studentEmail = s.studentEmail;
    base.parentEmail = s.parentEmail;
  }

  return base;
}

export const STUDENT_UPDATABLE_FIELDS = [
  "name",
  "roll",
  "className",
  "parentName",
  "motherName",
  "fatherName",
  "dateOfBirth",
  "gender",
  "studentPhone",
  "parentPhone",
  "address",
  "mailingAddress",
  "admissionDate",
  "bloodGroup",
  "previousSchool",
  "alternateGuardianName",
  "alternateGuardianPhone",
  "notes",
  "emergencyContact",
] as const;
