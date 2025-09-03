# ------------------------------------------------------------------------------
# Build stage: compile Vue (Vite) app
# ------------------------------------------------------------------------------
FROM node:23 AS builder

WORKDIR /app

# Make the Vite var available during build
ARG VITE_KEYCLOAK_AUTH_PATH
ENV VITE_KEYCLOAK_AUTH_PATH=${VITE_KEYCLOAK_AUTH_PATH:-http://localhost/keycloak/}

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build for production (outputs to /app/dist)
RUN npm run build

# ------------------------------------------------------------------------------
# Runtime stage: serve built app with nginx
# ------------------------------------------------------------------------------
FROM nginx:stable-alpine

# Copy build artifacts from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default nginx config with custom one
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8004

CMD ["nginx", "-g", "daemon off;"]
