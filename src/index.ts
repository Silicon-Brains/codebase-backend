import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { publicRouter } from "./routes/public.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { portalRouter } from "./routes/portal.routes.js";
import { webhooksRouter } from "./routes/webhooks.routes.js";
import { meRouter } from "./routes/me.routes.js";
import { rateLimit } from "./middleware/rateLimit.js";

const app = express();
app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Only trust the X-Forwarded-For chain when explicitly told to (e.g. behind a single reverse
// proxy like Render/Fly/nginx). Without this, req.ip / the rate limiter would key off the proxy's
// own IP instead of the real client — either failing to rate-limit at all (everyone shares one
// bucket) or accidentally rate-limiting every request behind that proxy together.
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, '')) // tolerate trailing slashes
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = server-to-server or curl (e.g. the Clerk webhook); allow.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Webhook route needs the raw body for signature verification — must come
// before express.json() and must not be affected by it.
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Apply a broad abuse limit to API traffic in addition to the stricter contact-form limit.
app.use("/api", rateLimit({ windowMs: 60_000, max: 300 }));
app.use("/api", publicRouter);
app.use("/api/admin", adminRouter);
app.use("/api/portal", portalRouter);
app.use("/api/me", meRouter);

// Keep parser and unexpected server errors generic at the HTTP boundary.
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const candidateStatus = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 500;
  const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
    ? candidateStatus
    : 500;
  if (status === 413) return res.status(413).json({ error: "Request body is too large" });
  if (status === 400) return res.status(400).json({ error: "Invalid request body" });
  console.error("Unhandled API error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`SiliconBrains API listening on :${PORT}`));
