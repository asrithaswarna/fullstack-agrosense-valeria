import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { valeriaPrisma?: PrismaClient }

export const prisma = globalForPrisma.valeriaPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.valeriaPrisma = prisma
