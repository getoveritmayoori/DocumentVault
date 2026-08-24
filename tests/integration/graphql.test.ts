import { describe, test, expect, beforeEach } from 'bun:test';
import { createYoga, createSchema } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvers } from '../../src/resolvers';
import type { GraphQLContext } from '../../src/context';

const typeDefs = readFileSync(join(__dirname, '../../src/schema/schema.graphql'), 'utf-8');

describe('GraphQL API Integration Tests', () => {
  let mockCollections: any[] = [];
  let mockDocuments: any[] = [];

  beforeEach(() => {
    mockCollections = [
      {
        id: 'col-main',
        name: 'Main Vault',
        slug: 'main-vault',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'col-archive',
        name: 'Archive Vault',
        slug: 'archive-vault',
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    ];

    mockDocuments = [
      {
        id: 'doc-alpha',
        title: 'Project Alpha Proposal',
        content: 'Confidential project details regarding Alpha architecture.',
        tags: ['proposal', 'alpha'],
        collectionId: 'col-main',
        isArchived: false,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
      {
        id: 'doc-beta',
        title: 'Beta Testing Guidelines',
        content: 'Step-by-step guidelines for external beta testers.',
        tags: ['testing', 'beta'],
        collectionId: 'col-main',
        isArchived: true,
        createdAt: new Date('2026-01-04T00:00:00Z'),
      },
    ];
  });

  const createTestContext = (): GraphQLContext => {
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
          if (where?.OR) {
            const search = where.OR[0].title.contains.toLowerCase();
            results = results.filter(
              (d) =>
                d.title.toLowerCase().includes(search) ||
                d.content.toLowerCase().includes(search)
            );
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
  };

  const testYoga = createYoga<GraphQLContext>({
    schema: createSchema({
      typeDefs,
      resolvers,
    }),
    context: createTestContext,
    graphqlEndpoint: '/graphql',
    maskedErrors: false,
  });

  const executeGraphQL = async (query: string, variables?: Record<string, any>) => {
    const response = await testYoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  };

  test('Query: collections with nested documents', async () => {
    const query = `
      query GetCollections {
        collections {
          id
          name
          slug
          documents {
            id
            title
          }
        }
      }
    `;

    const res = await executeGraphQL(query);
    expect(res.errors).toBeUndefined();
    expect(res.data.collections).toHaveLength(2);
    expect(res.data.collections[0].name).toBe('Main Vault');
    expect(res.data.collections[0].documents).toHaveLength(2);
  });

  test('Query: single collection by id', async () => {
    const query = `
      query GetCollection($id: ID!) {
        collection(id: $id) {
          id
          name
          slug
        }
      }
    `;

    const res = await executeGraphQL(query, { id: 'col-main' });
    expect(res.errors).toBeUndefined();
    expect(res.data.collection.name).toBe('Main Vault');
  });

  test('Mutation: createCollection with valid input', async () => {
    const mutation = `
      mutation CreateCol($input: CreateCollectionInput!) {
        createCollection(input: $input) {
          id
          name
          slug
        }
      }
    `;

    const res = await executeGraphQL(mutation, {
      input: { name: 'New Legal Specs', slug: 'legal-specs' },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.createCollection.name).toBe('New Legal Specs');
    expect(res.data.createCollection.slug).toBe('legal-specs');
  });

  test('Mutation: createCollection with invalid slug returns GraphQL error', async () => {
    const mutation = `
      mutation CreateCol($input: CreateCollectionInput!) {
        createCollection(input: $input) {
          id
          name
        }
      }
    `;

    const res = await executeGraphQL(mutation, {
      input: { name: 'Invalid Slug Vault', slug: 'Invalid_Slug!' },
    });

    expect(res.errors).toBeDefined();
    expect(res.errors[0].message).toContain('Malformed slug');
    expect(res.errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  test('Query: documents substring search on title or content', async () => {
    const query = `
      query SearchDocs($search: String) {
        documents(search: $search) {
          totalCount
          nodes {
            id
            title
            content
          }
        }
      }
    `;

    const res = await executeGraphQL(query, { search: 'alpha' });
    expect(res.errors).toBeUndefined();
    expect(res.data.documents.totalCount).toBe(1);
    expect(res.data.documents.nodes[0].title).toBe('Project Alpha Proposal');
  });

  test('Mutation: moveDocument moves document between collections', async () => {
    const mutation = `
      mutation MoveDoc($id: ID!, $collectionId: ID!) {
        moveDocument(id: $id, collectionId: $collectionId) {
          id
          collectionId
        }
      }
    `;

    const res = await executeGraphQL(mutation, {
      id: 'doc-alpha',
      collectionId: 'col-archive',
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.moveDocument.collectionId).toBe('col-archive');
  });

  test('Mutation: createDocument rejects empty title with GraphQL error', async () => {
    const mutation = `
      mutation CreateDoc($input: CreateDocumentInput!) {
        createDocument(input: $input) {
          id
        }
      }
    `;

    const res = await executeGraphQL(mutation, {
      input: { title: '  ', content: 'Some content', collectionId: 'col-main' },
    });

    expect(res.errors).toBeDefined();
    expect(res.errors[0].message).toContain('Document title cannot be empty');
    expect(res.errors[0].extensions?.code).toBe('BAD_USER_INPUT');
  });
});
