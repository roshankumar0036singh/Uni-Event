import { z } from "zod";

export const setRoleSchema = z.object({
  uid: z.string().min(1, "uid is required"),
  role: z.enum(["admin", "club", "student"]),
});

export const getTopContributorsSchema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
  lastPoints: z.number().optional(),
  lastUserId: z.string().optional(),
  startRank: z.number().int().min(1).optional(),
});