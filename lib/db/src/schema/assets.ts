import { pgTable, serial, integer, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { investorsTable } from "./investors";

export const assetsTable = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    investorId: integer("investor_id")
      .notNull()
      .references(() => investorsTable.id, { onDelete: "cascade" }),
    assetId: text("asset_id").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("assets_investor_asset_idx").on(table.investorId, table.assetId),
  ]
);

export const insertAssetSchema = createInsertSchema(assetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type AssetRow = typeof assetsTable.$inferSelect;
