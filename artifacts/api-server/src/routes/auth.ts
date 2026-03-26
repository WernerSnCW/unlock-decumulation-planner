import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { investorsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// POST /auth/login — validate access code, return investor profile
router.post("/auth/login", async (req, res) => {
  const { access_code } = req.body;
  if (!access_code || typeof access_code !== "string") {
    res.status(400).json({ error: "access_code is required" });
    return;
  }

  const [investor] = await db
    .select()
    .from(investorsTable)
    .where(eq(investorsTable.accessCode, access_code.toUpperCase()))
    .limit(1);

  if (!investor) {
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  res.json({
    id: investor.id,
    name: investor.name,
    email: investor.email,
    accessCode: investor.accessCode,
    createdAt: investor.createdAt,
  });
});

export default router;
