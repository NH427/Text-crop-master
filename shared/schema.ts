import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  data: text("data").notNull(), // Base64 encoded image data
  boundingBoxes: text("bounding_boxes").array(), // Array of box coordinates
});

export const insertImageSchema = createInsertSchema(images).pick({
  filename: true,
  data: true,
  boundingBoxes: true,
});

export type InsertImage = z.infer<typeof insertImageSchema>;
export type Image = typeof images.$inferSelect;

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
