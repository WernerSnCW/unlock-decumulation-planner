import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { investorsTable, assetsTable } from "@workspace/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { adminAuth } from "../middlewares/admin-auth";
import { generateAccessCode } from "../lib/access-code";

const router: IRouter = Router();

// All admin routes require the admin password
router.use(adminAuth);

// GET /admin/investors — list all investors
router.get("/admin/investors", async (_req, res) => {
  const investors = await db
    .select()
    .from(investorsTable)
    .orderBy(investorsTable.createdAt);

  res.json(investors);
});

// GET /admin/investors/search?q=term — search by name or email (for code retrieval)
router.get("/admin/investors/search", async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) {
    res.status(400).json({ error: "Search term must be at least 2 characters" });
    return;
  }

  const pattern = `%${q}%`;
  const investors = await db
    .select()
    .from(investorsTable)
    .where(
      or(
        ilike(investorsTable.name, pattern),
        ilike(investorsTable.email, pattern),
      ),
    );

  res.json(investors);
});

// POST /admin/investors — create a new investor
router.post("/admin/investors", async (req, res) => {
  const { name, email, assets } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  // Generate a unique access code (retry on collision)
  let accessCode: string;
  let attempts = 0;
  do {
    accessCode = generateAccessCode();
    const [existing] = await db
      .select({ id: investorsTable.id })
      .from(investorsTable)
      .where(eq(investorsTable.accessCode, accessCode))
      .limit(1);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    res.status(500).json({ error: "Failed to generate unique access code" });
    return;
  }

  const [investor] = await db
    .insert(investorsTable)
    .values({ name, email: email || null, accessCode })
    .returning();

  // Optionally pre-load assets
  if (Array.isArray(assets) && assets.length > 0) {
    await db.insert(assetsTable).values(
      assets.map((asset: { asset_id: string; [key: string]: unknown }) => ({
        investorId: investor.id,
        assetId: asset.asset_id as string,
        data: asset,
      })),
    );
  }

  res.status(201).json(investor);
});

// DELETE /admin/investors/:id — delete an investor (cascades to assets & settings)
router.delete("/admin/investors/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid investor id" });
    return;
  }

  const [deleted] = await db
    .delete(investorsTable)
    .where(eq(investorsTable.id, id))
    .returning({ id: investorsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Investor not found" });
    return;
  }

  res.json({ ok: true });
});

export default router;
