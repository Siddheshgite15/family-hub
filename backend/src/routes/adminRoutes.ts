import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
  getDashboard,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  createAnnouncement,
  getAnnouncements,
  getEnquiries,
  respondToEnquiry,
  markEnquiryAsRead,
} from "../controllers/adminController";

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware, requireRole("admin"));

// Dashboard
router.get("/dashboard", getDashboard);

// User management
router.get("/users", getAllUsers);
router.post("/users", createUser);
router.patch("/users/:userId", updateUser);
router.delete("/users/:userId", deleteUser);

// Announcements
router.get("/announcements", getAnnouncements);
router.post("/announcements", createAnnouncement);

// Enquiries
router.get("/enquiries", getEnquiries);
router.patch("/enquiries/:enquiryId/mark-read", markEnquiryAsRead);
router.patch("/enquiries/:enquiryId/respond", respondToEnquiry);

export default router;
