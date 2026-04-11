import "dotenv/config";
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { connectDB } from "../backend/src/utils/db";
import { getCorsOriginList } from "../backend/src/utils/corsOrigins";

// Import routes
import authRoutes from "../backend/src/routes/authRoutes";
import studentRoutes from "../backend/src/routes/studentRoutes";
import teacherRoutes from "../backend/src/routes/teacherRoutes";
import homeworkRoutes from "../backend/src/routes/homeworkRoutes";
import attendanceRoutes from "../backend/src/routes/attendanceRoutes";
import scoresRoutes from "../backend/src/routes/scoresRoutes";
import eventRoutes from "../backend/src/routes/eventRoutes";
import meetingRoutes from "../backend/src/routes/meetingRoutes";
import instructionRoutes from "../backend/src/routes/instructionRoutes";
import quizRoutes from "../backend/src/routes/quizRoutes";
import adminRoutes from "../backend/src/routes/adminRoutes";
import enquiryRoutes from "../backend/src/routes/enquiryRoutes";
import notificationRoutes from "../backend/src/routes/notificationRoutes";
import reportCardRoutes from "../backend/src/routes/reportCardRoutes";

const app: Express = express();

// Middleware
app.use(cors({
  origin: getCorsOriginList(),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Connect to database on first request
let dbConnected = false;
app.use(async (req, res, next) => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
    } catch (error) {
      console.error("Database connection failed:", error);
    }
  }
  next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/scores", scoresRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/instructions", instructionRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/report-cards", reportCardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

export default app;
