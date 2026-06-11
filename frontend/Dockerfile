# AWS ECR Public Gallery mirrors Docker Hub official images (avoids registry-1.docker.io timeouts).
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:20-alpine
ARG NGINX_IMAGE=public.ecr.aws/docker/library/nginx:stable-alpine

# Stage 1: Build the React application
FROM ${NODE_IMAGE} AS build

WORKDIR /app

# PaaS (Coolify) often passes --build-arg NODE_ENV=production. Vite must still be installed;
# it is listed in package.json "dependencies" so `npm ci` always installs it.
COPY package*.json ./
RUN npm ci || npm install

COPY . .

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ARG VITE_USE_RELATIVE_API
ENV VITE_USE_RELATIVE_API=$VITE_USE_RELATIVE_API
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

# Call the binary directly (avoids npm script / npx / PATH edge cases → exit 127).
RUN node ./node_modules/vite/bin/vite.js build

# Stage 2: Serve the application using Nginx
FROM ${NGINX_IMAGE}

COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod -R a+rX /usr/share/nginx/html

# BACKEND_HOST = docker-compose service name (default `backend`); override in Coolify if needed.
# NGINX_ENVSUBST_FILTER limits envsubst to BACKEND_HOST only (keeps $host, $scheme, etc.).
ENV BACKEND_HOST=backend \
    NGINX_ENVSUBST_FILTER=^BACKEND_HOST$
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
