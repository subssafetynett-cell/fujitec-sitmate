# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Coolify passes NODE_ENV=production as a build-arg. Ignore it for this stage — Vite is a
# devDependency and must be installed. The final nginx image has no Node/npm.
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

COPY package*.json ./
RUN npm ci --include=dev || npm install --include=dev

COPY . .

# We pass the backend URL as a build argument
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
# When "true", SPA calls same-origin /api (proxied by nginx to the backend service).
ARG VITE_USE_RELATIVE_API
ENV VITE_USE_RELATIVE_API=$VITE_USE_RELATIVE_API
# Optional subpath deploy, e.g. /app/ (must start and end with / except root).
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN npx vite build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine

# Copy the build output from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx workers run as non-root; assets copied with mode 600 (e.g. from some hosts) cause "Permission denied"
RUN chmod -R a+rX /usr/share/nginx/html

# Copy a custom nginx configuration to handle React routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
