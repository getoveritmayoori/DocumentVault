import { yoga } from './server';

const PORT = Number(process.env.PORT || 4000);

const server = Bun.serve({
  port: PORT,
  fetch(request) {
    return yoga.fetch(request);
  },
});

console.log(
  `🚀 Document Vault GraphQL API running at http://localhost:${server.port}${yoga.graphqlEndpoint}`
);
