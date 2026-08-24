import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../context';
import {
  validateCreateDocumentInput,
  validateUpdateDocumentInput,
} from '../utils/validation';

export interface CreateDocumentInput {
  title: string;
  content: string;
  tags?: string[] | null;
  collectionId: string;
}

export interface UpdateDocumentInput {
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
  isArchived?: boolean | null;
}

export interface DocumentsArgs {
  collectionId?: string | null;
  search?: string | null;
  isArchived?: boolean | null;
  take?: number | null;
  cursor?: string | null;
}

export const documentResolvers = {
  Query: {
    documents: async (
      _parent: unknown,
      args: DocumentsArgs,
      context: GraphQLContext
    ) => {
      const take = args.take ?? 10;
      if (take < 1 || take > 100) {
        throw new GraphQLError('take parameter must be between 1 and 100', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Build Prisma filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (args.collectionId) {
        where.collectionId = args.collectionId;
      }

      if (args.isArchived !== undefined && args.isArchived !== null) {
        where.isArchived = args.isArchived;
      }

      if (args.search && args.search.trim() !== '') {
        const searchTerm = args.search.trim();
        where.OR = [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { content: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      const totalCount = await context.prisma.document.count({ where });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryOptions: any = {
        where,
        take: take + 1,
        orderBy: { createdAt: 'desc' },
      };

      if (args.cursor) {
        queryOptions.cursor = { id: args.cursor };
        queryOptions.skip = 1;
      }

      const rawDocs = await context.prisma.document.findMany(queryOptions);
      const hasNextPage = rawDocs.length > take;
      const docs = hasNextPage ? rawDocs.slice(0, take) : rawDocs;

      const nodes = docs.map((doc) => ({
        ...doc,
        createdAt: doc.createdAt.toISOString(),
      }));

      const edges = nodes.map((doc) => ({
        cursor: doc.id,
        node: doc,
      }));

      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      return {
        edges,
        nodes,
        pageInfo: {
          hasNextPage,
          endCursor,
        },
        totalCount,
      };
    },
  },

  Mutation: {
    createDocument: async (
      _parent: unknown,
      args: { input: CreateDocumentInput },
      context: GraphQLContext
    ) => {
      validateCreateDocumentInput(args.input);

      const targetCollection = await context.prisma.collection.findUnique({
        where: { id: args.input.collectionId },
      });

      if (!targetCollection) {
        throw new GraphQLError(
          `Collection with id "${args.input.collectionId}" not found`,
          {
            extensions: { code: 'NOT_FOUND' },
          }
        );
      }

      const doc = await context.prisma.document.create({
        data: {
          title: args.input.title.trim(),
          content: args.input.content.trim(),
          tags: args.input.tags ?? [],
          collectionId: args.input.collectionId,
        },
      });

      return {
        ...doc,
        createdAt: doc.createdAt.toISOString(),
      };
    },

    updateDocument: async (
      _parent: unknown,
      args: { id: string; input: UpdateDocumentInput },
      context: GraphQLContext
    ) => {
      validateUpdateDocumentInput(args.input);

      const existingDoc = await context.prisma.document.findUnique({
        where: { id: args.id },
      });

      if (!existingDoc) {
        throw new GraphQLError(`Document with id "${args.id}" not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {};
      if (args.input.title !== undefined && args.input.title !== null) {
        updateData.title = args.input.title.trim();
      }
      if (args.input.content !== undefined && args.input.content !== null) {
        updateData.content = args.input.content.trim();
      }
      if (args.input.tags !== undefined && args.input.tags !== null) {
        updateData.tags = args.input.tags;
      }
      if (args.input.isArchived !== undefined && args.input.isArchived !== null) {
        updateData.isArchived = args.input.isArchived;
      }

      const updatedDoc = await context.prisma.document.update({
        where: { id: args.id },
        data: updateData,
      });

      return {
        ...updatedDoc,
        createdAt: updatedDoc.createdAt.toISOString(),
      };
    },

    deleteDocument: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      const existingDoc = await context.prisma.document.findUnique({
        where: { id: args.id },
      });

      if (!existingDoc) {
        throw new GraphQLError(`Document with id "${args.id}" not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      await context.prisma.document.delete({
        where: { id: args.id },
      });

      return true;
    },

    moveDocument: async (
      _parent: unknown,
      args: { id: string; collectionId: string },
      context: GraphQLContext
    ) => {
      const targetCollection = await context.prisma.collection.findUnique({
        where: { id: args.collectionId },
      });

      if (!targetCollection) {
        throw new GraphQLError(
          `Target collection with id "${args.collectionId}" not found`,
          {
            extensions: { code: 'NOT_FOUND' },
          }
        );
      }

      const existingDoc = await context.prisma.document.findUnique({
        where: { id: args.id },
      });

      if (!existingDoc) {
        throw new GraphQLError(`Document with id "${args.id}" not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const movedDoc = await context.prisma.document.update({
        where: { id: args.id },
        data: { collectionId: args.collectionId },
      });

      return {
        ...movedDoc,
        createdAt: movedDoc.createdAt.toISOString(),
      };
    },
  },

  Document: {
    collection: async (
      parent: { collectionId: string; collection?: unknown },
      _args: unknown,
      context: GraphQLContext
    ) => {
      if (parent.collection) {
        return parent.collection;
      }

      const col = await context.prisma.collection.findUnique({
        where: { id: parent.collectionId },
      });

      if (!col) {
        throw new GraphQLError(
          `Associated collection with id "${parent.collectionId}" not found`,
          {
            extensions: { code: 'NOT_FOUND' },
          }
        );
      }

      return {
        ...col,
        createdAt: col.createdAt.toISOString(),
      };
    },
  },
};
