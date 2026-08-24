# Document Vault — GraphQL API

A backend GraphQL API for organizing documents into collections, built with **Bun**, **TypeScript** (strict mode), **GraphQL Yoga** (schema-first), **PostgreSQL**, and **Prisma ORM**.

---

## Quick Start (One-Command Setup)

Ensure Docker Desktop / Docker Engine and Bun are installed, then run:

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

The GraphQL API server and GraphQL GraphiQL Playground will be available at:
`http://localhost:4000/graphql`

---

## Features & Highlights

- **Schema-First GraphQL Architecture**: Clear contract defined in `src/schema/schema.graphql` paired with typed TypeScript resolvers.
- **Domain Data Modeling**:
  - **Collection**: `id`, `name`, `slug` (unique), `createdAt`, nested `documents`.
  - **Document**: `id`, `title`, `content`, `tags`, `collectionId`, `isArchived`, `createdAt`, related `collection`.
- **Operations & Capabilities**:
  - **Collections**: Fetch all collections, fetch collection by ID with nested documents, create collection with slug uniqueness checks.
  - **Documents Search & Filter**: Substring match search across document `title` or `content`, filtering by `collectionId` or `isArchived` state.
  - **Cursor-Based Pagination**: Paginate document lists using `take` and `cursor` parameters returning `edges`, `nodes`, `pageInfo`, and `totalCount`.
  - **Document Management**: Create document, update document, delete document, and move document across collections.
- **Strict Validation & Error Handling**:
  - Rejects empty titles, empty contents, and malformed slugs with formatted `GraphQLError` responses (`BAD_USER_INPUT`, `NOT_FOUND`, `ALREADY_EXISTS`) instead of 500 server crashes.
  - Masked internal server errors in production mode.
- **Database Migrations**: Managed via Prisma migrations (`prisma/migrations`).
- **Comprehensive Testing**: Unit tests for resolvers and validation logic + end-to-end integration tests using `bun test`.

---

## Available Scripts

| Script | Command | Description |
| --- | --- | --- |
| `bun run dev` | `bun run src/index.ts` | Starts dev server on port 4000 |
| `bun run test` | `bun test` | Runs unit and integration test suite |
| `bun run typecheck` | `tsc --noEmit` | Validates TypeScript strict mode |
| `bun run lint` | `tsc --noEmit` | Runs static code analysis |
| **`bun run sanity`** | `bun run lint && bun run typecheck && bun run test` | One-command sanity suite |
| `bun run gendb` | `prisma generate && prisma migrate deploy` | Generates Prisma client and applies migrations |

---

## GraphQL Operations Guide

### 1. Fetch Collections with Nested Documents
```graphql
query GetCollections {
  collections {
    id
    name
    slug
    createdAt
    documents {
      id
      title
      isArchived
    }
  }
}
```

### 2. Search & Paginate Documents
```graphql
query SearchDocuments($collectionId: ID, $search: String, $take: Int, $cursor: ID) {
  documents(
    collectionId: $collectionId
    search: $search
    isArchived: false
    take: $take
    cursor: $cursor
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        title
        content
        tags
      }
    }
  }
}
```

### 3. Create Collection
```graphql
mutation CreateCollection($input: CreateCollectionInput!) {
  createCollection(input: $input) {
    id
    name
    slug
    createdAt
  }
}
```
*Variables:*
```json
{
  "input": {
    "name": "Engineering Docs",
    "slug": "engineering-docs"
  }
}
```

### 4. Create Document
```graphql
mutation CreateDocument($input: CreateDocumentInput!) {
  createDocument(input: $input) {
    id
    title
    content
    tags
    collectionId
  }
}
```
*Variables:*
```json
{
  "input": {
    "title": "API Specification",
    "content": "Detailed specification of GraphQL schemas and resolvers.",
    "tags": ["graphql", "backend"],
    "collectionId": "<COLLECTION_ID>"
  }
}
```

### 5. Move Document to Another Collection
```graphql
mutation MoveDocument($id: ID!, $collectionId: ID!) {
  moveDocument(id: $id, collectionId: $collectionId) {
    id
    collectionId
    collection {
      name
      slug
    }
  }
}
```

---

## Extension Roadmap & Future Design Considerations

How this API can be extended for production scaling:

1. **Authentication & Role-Based Access Control (RBAC)**:
   - Integrate JWT / OAuth2 context middleware.
   - Enforce collection-level permissions (`READ`, `WRITE`, `ADMIN`) per workspace or tenant.
2. **Full-Text & Vector Search**:
   - Upgrade Postgres `contains` substring search to PostgreSQL Full-Text Search (`tsvector` / `tsquery`) with `pg_trgm` indexes for fuzzy matching and relevance ranking.
   - Add embeddings (`pgvector`) for semantic document similarity search.
3. **Caching & DataLoader**:
   - Add DataLoader batching to prevent N+1 query patterns on nested document-collection relationships.
   - Introduce Redis caching layer for frequent read queries (e.g., collection metadata).
4. **Soft Deletion & Audit Logs**:
   - Implement soft delete (`deletedAt` field) for documents to enable recovery.
   - Track version history and audit trails for document changes.
