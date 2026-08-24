import type { PrismaClient } from '@prisma/client';
import { prisma } from './db/client';

export interface GraphQLContext {
  prisma: PrismaClient;
}

export function createContext(): GraphQLContext {
  return {
    prisma,
  };
}
