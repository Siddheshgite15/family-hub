import { Router } from "express";
import { login, getMe, refreshToken } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.post("/refresh", authMiddleware, refreshToken);

export default router;
