import type { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res.status(500).json({ error: "ADMIN_PASSWORD not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing admin authorization" });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== adminPassword) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  next();
}
