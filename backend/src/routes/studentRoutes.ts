import { Router } from "express";
import {
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
} from "../controllers/studentController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, getStudents);
router.put("/:id", authMiddleware, updateStudent);
router.delete("/:id", authMiddleware, deleteStudent);
router.get("/:id", authMiddleware, getStudentById);

export default router;
