import { describe, test, expect } from 'bun:test';
import { GraphQLError } from 'graphql';
import { collectionResolvers } from '../../src/resolvers/collection';
import { documentResolvers } from '../../src/resolvers/document';
import type { GraphQLContext } from '../../src/context';

function createMockContext(): GraphQLContext {
  const mockCollections = [
    {
      id: 'col-1',
      name: 'Engineering',
      slug: 'engineering',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'col-2',
      name: 'Product',
      slug: 'product',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    },
  ];

  const mockDocuments = [
    {
      id: 'doc-1',
      title: 'GraphQL API Design',
      content: 'Building schema-first API with Yoga and Prisma.',
      tags: ['graphql', 'backend'],
      collectionId: 'col-1',
      isArchived: false,
      createdAt: new Date('2026-01-03T00:00:00Z'),
    },
    {
      id: 'doc-2',
      title: 'Roadmap 2026',
      content: 'Quarterly priorities and release schedule.',
      tags: ['planning'],
      collectionId: 'col-2',
      isArchived: true,
      createdAt: new Date('2026-01-04T00:00:00Z'),
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPrisma: any = {
    collection: {
      findMany: async () => mockCollections,
      findUnique: async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id) return mockCollections.find((c) => c.id === where.id) || null;
        if (where.slug) return mockCollections.find((c) => c.slug === where.slug) || null;
        return null;
      },
      create: async ({ data }: { data: { name: string; slug: string } }) => {
        const newCol = {
          id: `col-${Date.now()}`,
          name: data.name,
          slug: data.slug,
          createdAt: new Date(),
        };
        mockCollections.push(newCol);
        return newCol;
      },
    },
    document: {
      findMany: async ({ where, take }: { where?: any; take?: number }) => {
        let results = [...mockDocuments];
        if (where?.collectionId) {
          results = results.filter((d) => d.collectionId === where.collectionId);
        }
        if (where?.isArchived !== undefined) {
          results = results.filter((d) => d.isArchived === where.isArchived);
        }
        if (where?.OR) {
          const search = where.OR[0].title.contains.toLowerCase();
          results = results.filter(
            (d) =>
              d.title.toLowerCase().includes(search) ||
              d.content.toLowerCase().includes(search)
          );
        }
        if (take) {
          results = results.slice(0, take);
        }
        return results;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return mockDocuments.find((d) => d.id === where.id) || null;
      },
      count: async ({ where }: { where?: any }) => {
        let results = [...mockDocuments];
        if (where?.collectionId) {
          results = results.filter((d) => d.collectionId === where.collectionId);
        }
        if (where?.isArchived !== undefined) {
          results = results.filter((d) => d.isArchived === where.isArchived);
        }
        return results.length;
      },
      create: async ({ data }: { data: any }) => {
        const newDoc = {
          id: `doc-${Date.now()}`,
          title: data.title,
          content: data.content,
          tags: data.tags || [],
          collectionId: data.collectionId,
          isArchived: false,
          createdAt: new Date(),
        };
        mockDocuments.push(newDoc);
        return newDoc;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const docIndex = mockDocuments.findIndex((d) => d.id === where.id);
        if (docIndex === -1) throw new Error('Not found');
        const updated = { ...mockDocuments[docIndex], ...data };
        mockDocuments[docIndex] = updated;
        return updated;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const docIndex = mockDocuments.findIndex((d) => d.id === where.id);
        if (docIndex === -1) throw new Error('Not found');
        const deleted = mockDocuments.splice(docIndex, 1)[0];
        return deleted;
      },
    },
  };

  return { prisma: mockPrisma };
}

describe('Resolver Unit Tests', () => {
  describe('Collection Resolvers', () => {
    test('collections query returns all collections', async () => {
      const context = createMockContext();
      const result = await collectionResolvers.Query.collections(null, {}, context);
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('engineering');
    });

    test('collection query returns collection by id', async () => {
      const context = createMockContext();
      const result = await collectionResolvers.Query.collection(null, { id: 'col-1' }, context);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Engineering');
    });

    test('collection query returns null if not found', async () => {
      const context = createMockContext();
      const result = await collectionResolvers.Query.collection(null, { id: 'non-existent' }, context);
      expect(result).toBeNull();
    });

    test('createCollection creates a new collection successfully', async () => {
      const context = createMockContext();
      const result = await collectionResolvers.Mutation.createCollection(
        null,
        { input: { name: 'Design Specs', slug: 'design-specs' } },
        context
      );
      expect(result.name).toBe('Design Specs');
      expect(result.slug).toBe('design-specs');
    });

    test('createCollection throws error when slug exists', async () => {
      const context = createMockContext();
      try {
        await collectionResolvers.Mutation.createCollection(
          null,
          { input: { name: 'Engineering Dup', slug: 'engineering' } },
          context
        );
        expect.unreachable('Should throw ALREADY_EXISTS error');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.extensions?.code).toBe('ALREADY_EXISTS');
      }
    });
  });

  describe('Document Resolvers', () => {
    test('documents query returns paginated document connection', async () => {
      const context = createMockContext();
      const result = await documentResolvers.Query.documents(null, {}, context);
      expect(result.totalCount).toBe(2);
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].title).toBe('GraphQL API Design');
    });

    test('createDocument throws error if target collection does not exist', async () => {
      const context = createMockContext();
      try {
        await documentResolvers.Mutation.createDocument(
          null,
          {
            input: {
              title: 'Orphan Doc',
              content: 'No collection',
              collectionId: 'invalid-col',
            },
          },
          context
        );
        expect.unreachable('Should throw NOT_FOUND');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.extensions?.code).toBe('NOT_FOUND');
      }
    });

    test('moveDocument updates collectionId of document', async () => {
      const context = createMockContext();
      const moved = await documentResolvers.Mutation.moveDocument(
        null,
        { id: 'doc-1', collectionId: 'col-2' },
        context
      );
      expect(moved.collectionId).toBe('col-2');
    });

    test('deleteDocument removes document', async () => {
      const context = createMockContext();
      const success = await documentResolvers.Mutation.deleteDocument(
        null,
        { id: 'doc-1' },
        context
      );
      expect(success).toBe(true);
    });
  });
});
