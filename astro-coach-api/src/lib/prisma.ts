import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client for the API process.
 */
export const prisma = new PrismaClient();
