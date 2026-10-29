import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
export const meRouter = Router();
// Lets the frontend ask "who am I / what's my role" right after sign-in,
// so admin/portal layouts can redirect appropriately.
meRouter.get("/", requireAuth, (req, res) => {
    res.json(req.profile);
});
