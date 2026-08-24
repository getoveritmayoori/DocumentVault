FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Copy dependency files
COPY package.json bun.lock* ./

# Install project dependencies
RUN bun install --frozen-lockfile || bun install

# Copy application source code
COPY . .

# Generate Prisma client artifacts
RUN bun run prisma:generate

# Expose server port
EXPOSE 4000

ENV PORT=4000

# Start Document Vault GraphQL API
CMD ["bun", "run", "dev"]
