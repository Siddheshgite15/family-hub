import mongoose from "mongoose";
import {
  User,
  Student,
  Homework,
  HomeworkStatus,
  Attendance,
  Score,
  Quiz,
  Meeting,
} from "../models";

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "family_hub";

  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName,
    });

    console.log("✓ Connected to MongoDB");

    // Skip index creation on startup to avoid hanging
    // Indexes will be created on-demand when queries need them
    // await createIndexes();
  } catch (err) {
    console.error("✗ Failed to connect to MongoDB:", err);
    throw err;
  }
}

/**
 * Create database indexes for query performance
 * Runs automatically on database connection
 */
async function createIndexes(): Promise<void> {
  try {
    console.log("🔍 Creating database indexes...");

    // Create indexes with timeout
    const indexTimeout = 10000; // 10 second timeout per index

    // User indexes - per-role email uniqueness (already in schema)
    await Promise.race([
      User.collection.createIndex({ email: 1, role: 1 }, { unique: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    // Student indexes
    await Promise.race([
      Student.collection.createIndex({ className: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Student.collection.createIndex({ studentUserId: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Student.collection.createIndex(
        { className: 1, studentUserId: 1 },
        { name: "student_class_user_idx" }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    // Homework indexes
    await Promise.race([
      Homework.collection.createIndex({ className: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Homework.collection.createIndex({ createdByTeacherId: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Homework.collection.createIndex(
        { className: 1, createdByTeacherId: 1 },
        { name: "homework_class_teacher_idx" }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    // HomeworkStatus indexes
    await Promise.race([
      HomeworkStatus.collection.createIndex({ studentId: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      HomeworkStatus.collection.createIndex({ homeworkId: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      HomeworkStatus.collection.createIndex(
        { studentId: 1, homeworkId: 1 },
        { unique: true, name: "homework_status_unique_idx" }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    // Attendance indexes
    await Promise.race([
      Attendance.collection.createIndex({ studentId: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Attendance.collection.createIndex({ date: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Attendance.collection.createIndex(
        { studentId: 1, date: 1 },
        { name: "attendance_student_date_idx" }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    // Score indexes
    await Promise.race([
      Score.collection.createIndex({ studentId: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Score.collection.createIndex({ date: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Score.collection.createIndex(
        { studentId: 1, date: 1 },
        { name: "score_student_date_idx" }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    // Quiz indexes
    await Promise.race([
      Quiz.collection.createIndex({ className: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Quiz.collection.createIndex({ createdByTeacherId: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    // Meeting indexes
    await Promise.race([
      Meeting.collection.createIndex({ date: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);
    
    await Promise.race([
      Meeting.collection.createIndex({ status: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Index creation timeout")), indexTimeout))
    ]);

    console.log("✓ All database indexes created successfully!\n");
  } catch (error: any) {
    // Index creation errors are not fatal (indexes may already exist)
    if (error.message.includes("timeout")) {
      console.warn("⚠️  Index creation timeout - continuing with server startup");
    } else if (error.code === 85) {
      // Index already exists with different options
      console.log("✓ Indexes already exist (or similar indexes present)\n");
    } else {
      console.warn("⚠️  Warning while creating indexes:", error.message);
    }
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log("? Disconnected from MongoDB");
  } catch (err) {
    console.error("? Failed to disconnect from MongoDB:", err);
    throw err;
  }
}
