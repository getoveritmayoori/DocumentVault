import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../context';
import { validateCollectionInput } from '../utils/validation';

export interface CreateCollectionInput {
  name: string;
  slug: string;
}

export const collectionResolvers = {
  Query: {
    collections: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const collections = await context.prisma.collection.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return collections.map((col) => ({
        ...col,
        createdAt: col.createdAt.toISOString(),
      }));
    },

    collection: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const collection = await context.prisma.collection.findUnique({
        where: { id: args.id },
      });
      if (!collection) {
        return null;
      }
      return {
        ...collection,
        createdAt: collection.createdAt.toISOString(),
      };
    },
  },

  Mutation: {
    createCollection: async (
      _parent: unknown,
      args: { input: CreateCollectionInput },
      context: GraphQLContext
    ) => {
      validateCollectionInput(args.input);

      const trimmedName = args.input.name.trim();
      const trimmedSlug = args.input.slug.trim();

      const existing = await context.prisma.collection.findUnique({
        where: { slug: trimmedSlug },
      });

      if (existing) {
        throw new GraphQLError(`Collection with slug "${trimmedSlug}" already exists`, {
          extensions: { code: 'ALREADY_EXISTS' },
        });
      }

      const collection = await context.prisma.collection.create({
        data: {
          name: trimmedName,
          slug: trimmedSlug,
        },
      });

      return {
        ...collection,
        createdAt: collection.createdAt.toISOString(),
      };
    },
  },

  Collection: {
    documents: async (
      parent: { id: string },
      _args: unknown,
      context: GraphQLContext
    ) => {
      const docs = await context.prisma.document.findMany({
        where: { collectionId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
      return docs.map((doc) => ({
        ...doc,
        createdAt: doc.createdAt.toISOString(),
      }));
    },
  },
};
