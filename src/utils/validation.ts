import { GraphQLError } from 'graphql';

/**
 * Validates slug format: lowercase alphanumeric characters separated by single hyphens.
 * Examples of valid slugs: "engineering", "tech-specs-2026", "my-collection"
 * Examples of invalid slugs: "My Collection", "tech_specs", "-tech-", "slug!!", ""
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCollectionInput(input: { name: string; slug: string }): void {
  const trimmedName = input.name.trim();
  if (trimmedName === '') {
    throw new GraphQLError('Collection name cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  const trimmedSlug = input.slug.trim();
  if (trimmedSlug === '') {
    throw new GraphQLError('Collection slug cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (!SLUG_REGEX.test(trimmedSlug)) {
    throw new GraphQLError(
      `Malformed slug "${input.slug}". Slugs must contain only lowercase alphanumeric characters and single hyphens (e.g. 'my-collection').`,
      {
        extensions: { code: 'BAD_USER_INPUT' },
      }
    );
  }
}

export function validateCreateDocumentInput(input: {
  title: string;
  content: string;
  collectionId: string;
}): void {
  if (input.title.trim() === '') {
    throw new GraphQLError('Document title cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (input.content.trim() === '') {
    throw new GraphQLError('Document content cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (input.collectionId.trim() === '') {
    throw new GraphQLError('collectionId cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

export function validateUpdateDocumentInput(input: {
  title?: string | null;
  content?: string | null;
}): void {
  if (input.title !== undefined && input.title !== null && input.title.trim() === '') {
    throw new GraphQLError('Document title cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (input.content !== undefined && input.content !== null && input.content.trim() === '') {
    throw new GraphQLError('Document content cannot be empty', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}
