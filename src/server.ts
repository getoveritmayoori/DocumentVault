import { createYoga, createSchema } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvers } from './resolvers';
import { createContext, type GraphQLContext } from './context';
import { GraphQLError } from 'graphql';

const typeDefs = readFileSync(join(__dirname, 'schema', 'schema.graphql'), 'utf-8');

export const yoga = createYoga<GraphQLContext>({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  context: createContext,
  graphqlEndpoint: '/graphql',
  landingPage: true,
  maskedErrors: {
    maskError(error: unknown) {
      if (error instanceof GraphQLError) {
        return error;
      }
      return new GraphQLError('Unexpected internal server error', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    },
  },
});
