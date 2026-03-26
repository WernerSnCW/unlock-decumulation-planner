import { pgTable, serial, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { investorsTable } from "./investors";

export const simulationSettingsTable = pgTable(
  "simulation_settings",
  {
    id: serial("id").primaryKey(),
    investorId: integer("investor_id")
      .notNull()
      .references(() => investorsTable.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("simulation_settings_investor_idx").on(table.investorId),
  ]
);

export const insertSimulationSettingsSchema = createInsertSchema(simulationSettingsTable).omit({
  id: true,
  updatedAt: true,
});

export type InsertSimulationSettings = z.infer<typeof insertSimulationSettingsSchema>;
export type SimulationSettingsRow = typeof simulationSettingsTable.$inferSelect;
