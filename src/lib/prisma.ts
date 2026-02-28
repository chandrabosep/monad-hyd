import { PrismaClient } from "@/generated/prisma";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString)
	throw new Error("DATABASE_URL or DIRECT_URL must be set");

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrisma() {
	return new PrismaClient({
		datasourceUrl: connectionString,
		log:
			process.env.NODE_ENV === "development"
				? ["error", "warn"]
				: ["error"],
	});
}

export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
