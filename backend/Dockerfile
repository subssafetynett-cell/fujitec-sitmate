# AWS ECR Public Gallery mirror (avoids Docker Hub TLS timeouts on some networks).
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:20-alpine
FROM ${NODE_IMAGE}

# Prisma on Alpine needs OpenSSL
RUN apk add --no-cache openssl libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (skip postinstall: schema not present yet)
RUN npm install --ignore-scripts

# Copy application (includes prisma/schema.prisma)
COPY . .

# Generate Prisma client (dummy URLs only for this RUN — must not persist in the image).
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build" \
    npx prisma generate

RUN chmod +x docker-entrypoint.sh
RUN chmod +x docker-migrate.sh

# Expose the port the app runs on
EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
