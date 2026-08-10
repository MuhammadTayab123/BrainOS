import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Database client abstraction.
 *
 * A repository can work with either:
 * - the global Prisma client
 * - a transaction-scoped Prisma client
 */
export type DatabaseClient =
  | PrismaClient
  | Prisma.TransactionClient;