import type { Document } from "mongoose";

/** Normalized profile for report cards, print/PDF templates, and API consumers. */
export type StudentReportProfile = {
  name: string;
  roll: string;
  className: string;
  parentName: string;
  studentEmail: string;
  parentEmail: string;
  motherName: string;
  fatherName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  mailingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
  };
  studentPhone: string;
  parentPhone: string;
  alternateGuardianName: string;
  alternateGuardianPhone: string;
  admissionDate: string;
  bloodGroup: string;
  previousSchool: string;
  notes: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
};

function asRecord(student: Document | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!student) return {};
  if (typeof student === "object") {
    const maybe = student as { toObject?: () => Record<string, unknown> };
    if (typeof maybe.toObject === "function") {
      return maybe.toObject();
    }
  }
  return student as Record<string, unknown>;
}

export function buildStudentReportProfile(student: Document | Record<string, unknown> | null | undefined): StudentReportProfile {
  const s = asRecord(student);
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : s[k] != null ? String(s[k]) : "");

  const m = (s.mailingAddress as Record<string, unknown> | undefined) || {};
  const e = (s.emergencyContact as Record<string, unknown> | undefined) || {};

  return {
    name: str("name"),
    roll: str("roll"),
    className: str("className"),
    parentName: str("parentName"),
    studentEmail: str("studentEmail"),
    parentEmail: str("parentEmail"),
    motherName: str("motherName"),
    fatherName: str("fatherName"),
    dateOfBirth: str("dateOfBirth"),
    gender: str("gender"),
    address: str("address"),
    mailingAddress: {
      line1: typeof m.line1 === "string" ? m.line1 : "",
      line2: typeof m.line2 === "string" ? m.line2 : "",
      city: typeof m.city === "string" ? m.city : "",
      state: typeof m.state === "string" ? m.state : "",
      pincode: typeof m.pincode === "string" ? m.pincode : "",
    },
    studentPhone: str("studentPhone"),
    parentPhone: str("parentPhone"),
    alternateGuardianName: str("alternateGuardianName"),
    alternateGuardianPhone: str("alternateGuardianPhone"),
    admissionDate: str("admissionDate"),
    bloodGroup: str("bloodGroup"),
    previousSchool: str("previousSchool"),
    notes: str("notes"),
    emergencyContact: {
      name: typeof e.name === "string" ? e.name : "",
      phone: typeof e.phone === "string" ? e.phone : "",
      relation: typeof e.relation === "string" ? e.relation : "",
    },
  };
}

/** Prefer frozen enrollment snapshot on the report card for print/PDF; else live student. */
export function studentProfileForReportCard(
  liveStudent: Document | Record<string, unknown> | null | undefined,
  enrollmentSnapshot?: Record<string, unknown> | null
): StudentReportProfile {
  let snap: Record<string, unknown> | null = null;
  if (enrollmentSnapshot && typeof enrollmentSnapshot === "object") {
    const raw = enrollmentSnapshot as unknown as { toObject?: () => Record<string, unknown> };
    snap =
      typeof raw.toObject === "function"
        ? raw.toObject()
        : (enrollmentSnapshot as Record<string, unknown>);
  }
  if (snap && (String(snap.name || "").length > 0 || String(snap.roll || "").length > 0)) {
    return buildStudentReportProfile(snap);
  }
  return buildStudentReportProfile(liveStudent);
}
