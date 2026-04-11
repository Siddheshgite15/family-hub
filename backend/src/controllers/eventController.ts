import { Request, Response } from "express";
import { Event, Notification, User } from "../models";
import { AuthRequest } from "../middleware/auth";
import { getMetaValue } from "../utils/auth";
import { z } from "zod";
import mongoose from "mongoose";

// ✅ Validation Schema
const CreateEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().datetime(),
  type: z.enum(["notice", "event"]),
  icon: z.string().optional(),
  targetAudience: z.enum(["all", "students", "parents", "teachers"]).default("all"),
  targetClasses: z.array(z.string().min(1)).optional(),
});

// ✅ Helper: format response
const toClientEvent = (event: any) => ({
  id: event._id.toString(),
  title: event.title,
  description: event.description,
  date: event.date,
  type: event.type,
  icon: event.icon,
  targetAudience: event.targetAudience,
  targetClasses: event.targetClasses ?? [],
});

/**
 * GET /api/events
 * Public (student/parent dashboards)
 */
export async function listEvents(req: Request, res: Response): Promise<void> {
  try {
    const type = req.query.type as string | undefined;
    const audience = req.query.audience as string | undefined;

    // ✅ Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (type) filter.type = type;

    if (audience) {
      filter.$or = [
        { targetAudience: audience },
        { targetAudience: "all" },
      ];
    }

    const viewerClass = req.query.viewerClass as string | undefined;
    if (viewerClass) {
      const classClause = {
        $or: [
          { targetClasses: { $exists: false } },
          { targetClasses: { $eq: [] } },
          { targetClasses: viewerClass },
        ],
      };
      if (filter.$and) {
        filter.$and.push(classClause);
      } else {
        filter.$and = [classClause];
      }
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Event.countDocuments(filter),
    ]);

    res.json({
      events: events.map(toClientEvent),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("GetEvents error:", err);
    res.status(500).json({ 
      error: "Failed to fetch events",
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined
    });
  }
}

/**
 * POST /api/events
 * Teacher/Admin only
 */
export async function createEvent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // ✅ Role check
    if (!["teacher", "admin"].includes(user.role)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const body = CreateEventSchema.parse(req.body);
    const teacherClass = user.role === "teacher" ? getMetaValue(user.meta, "class") : "";
    let targetClasses = body.targetClasses;
    if (user.role === "teacher" && teacherClass) {
      if (!targetClasses?.length) {
        targetClasses = [teacherClass];
      }
    }

    const event = await Event.create({
      title: body.title,
      description: body.description,
      date: new Date(body.date),
      type: body.type,
      icon: body.icon,
      targetAudience: body.targetAudience,
      targetClasses: targetClasses ?? [],
      createdBy: user._id,
    });

    // 🔔 ✅ Send notifications (IMPORTANT FEATURE)
    try {
      let userFilter: any = {};

      if (body.targetAudience !== "all") {
        const roleMap: any = {
          students: "student",
          parents: "parent",
          teachers: "teacher",
        };
        userFilter.role = roleMap[body.targetAudience];
      }

      const users = await User.find(userFilter)
        .select("_id")
        .lean();

      if (users.length > 0) {
        const notifications = users.map((u) => ({
          userId: u._id,
          event: "event_created",
          title: event.title,
          message: event.description,
          relatedId: event._id,
          relatedModel: "Event",
        }));

        await Notification.insertMany(notifications);
      }
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    res.status(201).json({
      event: toClientEvent(event),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid input",
        details: err.errors,
      });
      return;
    }

    console.error("createEvent error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/events/:id
 * Teacher/Admin only
 */
export async function deleteEvent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { id } = req.params;

    // ✅ Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid event ID" });
      return;
    }

    // ✅ Role check
    if (!["teacher", "admin"].includes(user.role)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("deleteEvent error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}