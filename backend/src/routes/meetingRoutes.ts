import { Router } from "express";
import {
  listMeetings,
  createMeeting,
  updateMeetingStatus,
  rescheduleMeeting,
} from "../controllers/meetingController";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, listMeetings);
router.post("/", authMiddleware, requireRole("teacher", "admin"), createMeeting);
router.patch("/:id/status", authMiddleware, updateMeetingStatus);
router.patch(
  "/:id/reschedule",
  authMiddleware,
  requireRole("teacher", "admin"),
  rescheduleMeeting
);

export default router;
