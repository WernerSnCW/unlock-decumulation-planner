import { pgTable, serial, text, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investorsTable = pgTable(
  "investors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    accessCode: varchar("access_code", { length: 10 }).notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("investors_access_code_idx").on(table.accessCode)]
);

export const insertInvestorSchema = createInsertSchema(investorsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvestor = z.infer<typeof insertInvestorSchema>;
export type Investor = typeof investorsTable.$inferSelect;
