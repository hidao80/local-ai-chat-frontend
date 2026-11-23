# Build stage
FROM jdxcode/mise:2026.11.3-debian AS builder
WORKDIR /app
# Toolchain (Node.js, Bun) from mise.toml; trust the project config so mise loads it
ENV MISE_TRUSTED_CONFIG_PATHS=/app
COPY mise.toml ./
RUN mise install
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

# Production stage – serve static files with nginx
FROM nginx:stable-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
# Config with security headers (same values as bin/security-headers.json)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
