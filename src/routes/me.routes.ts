import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import type { Response } from "express";

export const meRouter = Router();

// Lets the frontend ask "who am I / what's my role" right after sign-in,
// so admin/portal layouts can redirect appropriately.
meRouter.get("/", requireAuth, (req: AuthedRequest, res: Response) => {
  res.json(req.profile);
});
