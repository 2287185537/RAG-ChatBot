import { serial } from "drizzle-orm/pg-core";
import { integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const fileTable = pgTable("files", {
  id: serial('id').primaryKey(),
  file_name: varchar('file_name').notNull(),
  file_key: varchar('file_key').notNull(),
  createAt: timestamp('create_at').defaultNow(),
});

export type FileModel = typeof fileTable.$inferSelect;
