import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { investorsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      investor?: typeof investorsTable.$inferSelect;
    }
  }
}

export async function investorAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accessCode = req.headers["x-access-code"] as string | undefined;
  if (!accessCode) {
    res.status(401).json({ error: "Missing access code" });
    return;
  }

  const [investor] = await db
    .select()
    .from(investorsTable)
    .where(eq(investorsTable.accessCode, accessCode.toUpperCase()))
    .limit(1);

  if (!investor) {
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  req.investor = investor;
  next();
}
