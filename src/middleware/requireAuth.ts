import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";
import { supabase } from "../lib/supabase.js";

export interface AuthedRequest extends Request {
  clerkUserId?: string;
  profile?: { id: string; role: "admin" | "client"; clerk_user_id: string };
}

// Verifies the Clerk session token sent as `Authorization: Bearer <token>`
// and attaches the matching Supabase `profiles` row to the request.
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    });
    const clerkUserId = payload.sub;
    if (!clerkUserId) return res.status(401).json({ error: "Invalid token" });

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, clerk_user_id")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (error || !profile) return res.status(403).json({ error: "No profile found for user" });

    req.clerkUserId = clerkUserId;
    req.profile = profile;
    next();
  } catch (err) {
    console.warn(JSON.stringify({
      event: "authentication_failed",
      timestamp: new Date().toISOString(),
      ip: req.ip,
      path: req.path,
    }));
    return res.status(401).json({ error: "Unauthorized" });
  }
}
