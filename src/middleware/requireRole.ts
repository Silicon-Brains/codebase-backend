import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./requireAuth.js";

export function requireRole(...roles: Array<"admin" | "client">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.profile) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.profile.role)) {
      console.warn(JSON.stringify({
        event: "authorization_failed",
        timestamp: new Date().toISOString(),
        userId: req.clerkUserId,
        role: req.profile.role,
        path: req.path,
        ip: req.ip,
      }));
      return res.status(403).json({ error: "Forbidden — insufficient role" });
    }
    next();
  };
}
