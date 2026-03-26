import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { assetsTable, simulationSettingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { investorAuth } from "../middlewares/investor-auth";

const router: IRouter = Router();

// All routes require a valid access code
router.use(investorAuth);

// GET /investor/profile
router.get("/investor/profile", (req, res) => {
  const inv = req.investor!;
  res.json({
    id: inv.id,
    name: inv.name,
    email: inv.email,
    createdAt: inv.createdAt,
  });
});

// GET /investor/assets
router.get("/investor/assets", async (req, res) => {
  const rows = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.investorId, req.investor!.id));

  // Return just the JSONB data for each asset
  res.json(rows.map((r) => r.data));
});

// PUT /investor/assets — replace all assets for this investor
router.put("/investor/assets", async (req, res) => {
  const assets: Array<{ asset_id: string; [key: string]: unknown }> = req.body;
  if (!Array.isArray(assets)) {
    res.status(400).json({ error: "Body must be an array of assets" });
    return;
  }

  const investorId = req.investor!.id;

  await db.transaction(async (tx) => {
    // Delete all existing assets for this investor
    await tx
      .delete(assetsTable)
      .where(eq(assetsTable.investorId, investorId));

    // Insert the new set
    if (assets.length > 0) {
      await tx.insert(assetsTable).values(
        assets.map((asset) => ({
          investorId,
          assetId: asset.asset_id as string,
          data: asset,
        })),
      );
    }
  });

  res.json({ ok: true, count: assets.length });
});

// GET /investor/settings
router.get("/investor/settings", async (req, res) => {
  const [row] = await db
    .select()
    .from(simulationSettingsTable)
    .where(eq(simulationSettingsTable.investorId, req.investor!.id))
    .limit(1);

  res.json(row?.data ?? null);
});

// PUT /investor/settings — upsert simulation settings
router.put("/investor/settings", async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "Body must be a settings object" });
    return;
  }

  const investorId = req.investor!.id;

  // Check if settings exist
  const [existing] = await db
    .select({ id: simulationSettingsTable.id })
    .from(simulationSettingsTable)
    .where(eq(simulationSettingsTable.investorId, investorId))
    .limit(1);

  if (existing) {
    await db
      .update(simulationSettingsTable)
      .set({ data, updatedAt: new Date() })
      .where(eq(simulationSettingsTable.investorId, investorId));
  } else {
    await db
      .insert(simulationSettingsTable)
      .values({ investorId, data });
  }

  res.json({ ok: true });
});

export default router;
