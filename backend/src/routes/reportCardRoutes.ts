import { Router } from "express";
import {
  getScores,
  addScore,
  generateReportCard,
  generateAllReportCards,
  listReportCards,
  saveReportCard,
  getStudentReportCard,
} from "../controllers/reportCardController";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, listReportCards);
router.post("/save", authMiddleware, requireRole("teacher"), saveReportCard);
router.post("/generate-all", authMiddleware, requireRole("teacher"), generateAllReportCards);
router.post("/generate/:studentId", authMiddleware, requireRole("teacher"), generateReportCard);
router.get("/:studentId", authMiddleware, getStudentReportCard);

export default router;
