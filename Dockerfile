FROM node:23-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine

# Version reported by /marva/health, which the Blue Core dashboard displays.
# Possible values:
#   v3.12                  a GitHub Release (publish.yml passes the tag)
#   unversioned            a hand-run `docker build` with no --build-arg
# (Running the stack locally via scripts/dev/run bypasses this image entirely
# and reports "local-dev" from the stack's own nginx config.)
ARG MARVA_VERSION=unversioned

COPY --from=builder /app/dist /usr/share/nginx/html/marva
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN printf '{"status":"ok","version":"%s"}' "$MARVA_VERSION" \
      > /usr/share/nginx/html/marva/health

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
