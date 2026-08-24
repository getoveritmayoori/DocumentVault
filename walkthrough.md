# Document Vault — Technical Walkthrough & Key Decisions

This document presents a written walkthrough of the **Document Vault GraphQL API** backend implementation, design choices, trade-offs, and verification results.

---

## 1. Architecture & Design Overview

The Document Vault backend is built with a **schema-first GraphQL architecture** using **Bun**, **TypeScript** (strict mode), **GraphQL Yoga**, **PostgreSQL**, and **Prisma ORM**.

```
┌─────────────────────────────────────────────────────────┐
│                    Client Request                       │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP POST /graphql
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   GraphQL Yoga Server                   │
│   - Schema Validation (src/schema/schema.graphql)       │
│   - Error Masking (Formatted GraphQLErrors)              │
└───────────────────────────┬─────────────────────────────┘
                            │ Context Call
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Typed Resolvers                      │
│   - Collection Resolvers (src/resolvers/collection.ts)  │
│   - Document Resolvers (src/resolvers/document.ts)    │
└───────────────────────────┬─────────────────────────────┘
                            │ Input Validation (src/utils)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Prisma ORM Client                    │
│   - Collections Table & Documents Table                 │
└───────────────────────────┬─────────────────────────────┘
                            │ SQL DDL / Queries
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Key Technical Decisions & Trade-offs

### A. Schema-First GraphQL Approach
- **Decision**: Used a standalone `.graphql` schema file (`src/schema/schema.graphql`) coupled with TypeScript resolver objects rather than code-first schema builders (e.g. Nexus / Pothos).
- **Rationale**: Schema-first provides a clear, language-agnostic contract that can be reviewed independently by frontend and API consumers.
- **Trade-off**: Requires manually keeping TypeScript resolver types in sync with the GraphQL schema, which we mitigated using strict TypeScript interfaces and context typing.

### B. Cursor-Based Pagination (`take` / `cursor`)
- **Decision**: Implemented Relay-style cursor pagination (`DocumentConnection`, `edges`, `nodes`, `pageInfo`, `totalCount`).
- **Rationale**: Offset-based pagination (`skip`/`limit`) performs poorly on large datasets and causes missing or duplicate records when new items are added while paginating. Cursor-based pagination provides stable `O(1)` indexed lookups.
- **Trade-off**: Slightly higher schema complexity (`edges`, `pageInfo`), but offers significantly better performance and user experience.

### C. Domain Validation & Error Formatting
- **Decision**: Enforced strict validation before database mutation. Empty titles (`""` or `"   "`), empty content, missing collection IDs, and malformed slugs (e.g., uppercase, spaces, special symbols) throw explicit `GraphQLError` instances with extension code `BAD_USER_INPUT`.
- **Slug Rule**: Regexp `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` enforces lowercase alphanumeric hyphens (e.g., `engineering-docs`).
- **Error Masking**: Internal server exceptions are masked to prevent leaking database stack traces, while domain validation errors pass through cleanly to clients.

### D. Single Foreign Key Cascade Deletion
- **Decision**: Configured `onDelete: Cascade` on the `Document.collectionId` relation.
- **Rationale**: Deleting a Collection automatically cleans up associated Documents, maintaining relational integrity without leaving orphan records.

---

## 3. Operations & API Capabilities

| Operation Type | Name | Purpose | Validation / Edge Cases |
| --- | --- | --- | --- |
| **Query** | `collections` | List all collections | Returns empty array if none exist |
| **Query** | `collection(id)` | Fetch collection by ID with nested `documents` | Returns `null` if ID not found |
| **Query** | `documents` | Search & filter documents with cursor pagination | Substring search on title & content, collection & archive filters |
| **Mutation** | `createCollection` | Create collection | Validates name & slug format, rejects duplicates |
| **Mutation** | `createDocument` | Create document | Validates title, content, collection existence |
| **Mutation** | `updateDocument` | Update title, content, tags, isArchived | Rejects whitespace-only updates, validates doc existence |
| **Mutation** | `deleteDocument` | Delete document by ID | Validates document existence |
| **Mutation** | `moveDocument` | Reassign document to target collection | Validates target collection & document existence |

---

## 4. Testing & Verification

### Test Suite Execution
Run all 27 unit and integration tests using Bun test runner:

```bash
bun test
```

```
bun test v1.4.0 (34cbb9a40)

tests\integration\graphql.test.ts:
(pass) GraphQL API Integration Tests > Query: collections with nested documents
(pass) GraphQL API Integration Tests > Query: single collection by id
(pass) GraphQL API Integration Tests > Mutation: createCollection with valid input
(pass) GraphQL API Integration Tests > Mutation: createCollection with invalid slug returns GraphQL error
(pass) GraphQL API Integration Tests > Query: documents substring search on title or content
(pass) GraphQL API Integration Tests > Mutation: moveDocument moves document between collections
(pass) GraphQL API Integration Tests > Mutation: createDocument rejects empty title with GraphQL error

tests\unit\resolvers.test.ts:
(pass) Resolver Unit Tests > Collection Resolvers > collections query returns all collections
(pass) Resolver Unit Tests > Collection Resolvers > collection query returns collection by id
(pass) Resolver Unit Tests > Collection Resolvers > collection query returns null if not found
(pass) Resolver Unit Tests > Collection Resolvers > createCollection creates a new collection successfully
(pass) Resolver Unit Tests > Collection Resolvers > createCollection throws error when slug exists
(pass) Resolver Unit Tests > Document Resolvers > documents query returns paginated document connection
(pass) Resolver Unit Tests > Document Resolvers > createDocument throws error if target collection does not exist
(pass) Resolver Unit Tests > Document Resolvers > moveDocument updates collectionId of document
(pass) Resolver Unit Tests > Document Resolvers > deleteDocument removes document

tests\unit\validation.test.ts:
(pass) Validation Unit Tests > validateCollectionInput > accepts valid name and slug
(pass) Validation Unit Tests > validateCollectionInput > rejects empty collection name
(pass) Validation Unit Tests > validateCollectionInput > rejects empty collection slug
(pass) Validation Unit Tests > validateCollectionInput > rejects malformed slugs with uppercase, spaces, or invalid characters
(pass) Validation Unit Tests > validateCreateDocumentInput > accepts valid title, content, and collectionId
(pass) Validation Unit Tests > validateCreateDocumentInput > rejects empty document title
(pass) Validation Unit Tests > validateCreateDocumentInput > rejects empty document content
(pass) Validation Unit Tests > validateCreateDocumentInput > rejects empty collectionId
(pass) Validation Unit Tests > validateUpdateDocumentInput > accepts valid updates or undefined fields
(pass) Validation Unit Tests > validateUpdateDocumentInput > rejects whitespace-only title update
(pass) Validation Unit Tests > validateUpdateDocumentInput > rejects whitespace-only content update

 27 pass
 0 fail
 81 expect() calls
Ran 27 tests across 3 files. [191.00ms]
```

### One-Command Sanity Check
```bash
bun run sanity
```
Executes TypeScript typechecking, static lint checks, and test runner in a single pipeline.

---

## 5. Git Commit Strategy

All development was performed in incremental commits:
1. `feat: initialize Bun project structure, strict tsconfig, and package dependencies`
2. `feat: add Prisma schema, database client, and initial SQL migration`
3. `feat: define GraphQL schema, validation utilities, and formatted error handlers`
4. `feat: implement collection and document resolvers with search and cursor pagination`
5. `test: add comprehensive unit and GraphQL integration tests`
6. `chore: add Dockerfile, docker-compose, CI workflow, and documentation`
