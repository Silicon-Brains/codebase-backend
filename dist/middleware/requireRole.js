export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.profile)
            return res.status(401).json({ error: "Unauthorized" });
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
