# ------------------------------------------------------------------------------
# Build stage: compile Vue (Vite) app
# ------------------------------------------------------------------------------
FROM node:23 AS builder

WORKDIR /app

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
