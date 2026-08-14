# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

# Production stage – serve static files with nginx
FROM nginx:stable-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    \n\
    location / {\n\
    try_files $uri $uri/ /index.html;\n\
    }\n\
    }\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
