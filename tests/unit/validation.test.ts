import { describe, test, expect } from 'bun:test';
import { GraphQLError } from 'graphql';
import {
  validateCollectionInput,
  validateCreateDocumentInput,
  validateUpdateDocumentInput,
} from '../../src/utils/validation';

describe('Validation Unit Tests', () => {
  describe('validateCollectionInput', () => {
    test('accepts valid name and slug', () => {
      expect(() =>
        validateCollectionInput({ name: 'Engineering', slug: 'engineering' })
      ).not.toThrow();

      expect(() =>
        validateCollectionInput({ name: 'Tech Specs 2026', slug: 'tech-specs-2026' })
      ).not.toThrow();
    });

    test('rejects empty collection name', () => {
      try {
        validateCollectionInput({ name: '   ', slug: 'valid-slug' });
        expect.unreachable('Should have thrown GraphQLError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.message).toContain('Collection name cannot be empty');
        expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });

    test('rejects empty collection slug', () => {
      try {
        validateCollectionInput({ name: 'Valid Name', slug: '  ' });
        expect.unreachable('Should have thrown GraphQLError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.message).toContain('Collection slug cannot be empty');
        expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });

    test('rejects malformed slugs with uppercase, spaces, or invalid characters', () => {
      const invalidSlugs = ['My-Slug', 'my_slug', 'my slug', 'slug!', '-slug-', 'slug--two'];

      for (const slug of invalidSlugs) {
        try {
          validateCollectionInput({ name: 'Name', slug });
          expect.unreachable(`Should have thrown for slug "${slug}"`);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(GraphQLError);
          const gqlErr = err as GraphQLError;
          expect(gqlErr.message).toContain('Malformed slug');
          expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
        }
      }
    });
  });

  describe('validateCreateDocumentInput', () => {
    test('accepts valid title, content, and collectionId', () => {
      expect(() =>
        validateCreateDocumentInput({
          title: 'System Architecture',
          content: 'Detailed description of system components...',
          collectionId: 'col-123',
        })
      ).not.toThrow();
    });

    test('rejects empty document title', () => {
      try {
        validateCreateDocumentInput({
          title: '  ',
          content: 'Valid content',
          collectionId: 'col-123',
        });
        expect.unreachable('Should have thrown GraphQLError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.message).toContain('Document title cannot be empty');
        expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });

    test('rejects empty document content', () => {
      try {
        validateCreateDocumentInput({
          title: 'Valid Title',
          content: '   ',
          collectionId: 'col-123',
        });
        expect.unreachable('Should have thrown GraphQLError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.message).toContain('Document content cannot be empty');
        expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });

    test('rejects empty collectionId', () => {
      try {
        validateCreateDocumentInput({
          title: 'Valid Title',
          content: 'Valid content',
          collectionId: '  ',
        });
        expect.unreachable('Should have thrown GraphQLError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.message).toContain('collectionId cannot be empty');
        expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });
  });

  describe('validateUpdateDocumentInput', () => {
    test('accepts valid updates or undefined fields', () => {
      expect(() => validateUpdateDocumentInput({ title: 'New Title' })).not.toThrow();
      expect(() => validateUpdateDocumentInput({ content: 'New Content' })).not.toThrow();
      expect(() => validateUpdateDocumentInput({})).not.toThrow();
    });

    test('rejects whitespace-only title update', () => {
      try {
        validateUpdateDocumentInput({ title: '   ' });
        expect.unreachable('Should have thrown GraphQLError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.message).toContain('Document title cannot be empty');
        expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });

    test('rejects whitespace-only content update', () => {
      try {
        validateUpdateDocumentInput({ content: '   ' });
        expect.unreachable('Should have thrown GraphQLError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GraphQLError);
        const gqlErr = err as GraphQLError;
        expect(gqlErr.message).toContain('Document content cannot be empty');
        expect(gqlErr.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });
  });
});
