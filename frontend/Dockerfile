FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite inlines import.meta.env.* into the bundle at build time, so this has to be a
# build arg, not a runtime env var. Empty by default (Compose, local): fetch("/api/...")
# then stays same-origin through nginx. See src/lib/api.ts.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:alpine
# Docker args don't cross the stage boundary - redeclared to reach it here too.
ARG VITE_API_BASE_URL=""
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Same value the JS bundle was built against, so CSP's connect-src allows the direct
# browser->api calls src/lib/api.ts now makes. Empty (Compose, local) is a no-op.
RUN if [ -n "$VITE_API_BASE_URL" ]; then \
      sed -i "s#connect-src 'self'#connect-src 'self' ${VITE_API_BASE_URL}#" /etc/nginx/conf.d/default.conf; \
    fi
COPY docker-entrypoint.d/40-backend-host.sh /docker-entrypoint.d/40-backend-host.sh
RUN chmod +x /docker-entrypoint.d/40-backend-host.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
