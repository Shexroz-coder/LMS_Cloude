# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Install dependencies
COPY package*.json ./
RUN npm ci --frozen-lockfile

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Production - Nginx ────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config for frontend
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    
    # ── Root directory ────────────────────────────────────────
    root /usr/share/nginx/html;
    index index.html index.htm;

    # ── Gzip compression ──────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml image/svg+xml;
    gzip_disable "msie6";

    # ── Cache static assets (CSS, JS, images) ────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ── HTML files - no cache (fresh build check) ────────────
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "public, must-revalidate, proxy-revalidate";
    }

    # ── API proxy to backend ──────────────────────────────────
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        client_max_body_size 20M;
    }

    # ── WebSocket (Socket.io) ─────────────────────────────────
    location /socket.io/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }

    # ── SPA routing - serve index.html for all unknown routes ─
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # ── Error pages ───────────────────────────────────────────
    error_page 404 /index.html;
    error_page 500 502 503 504 /index.html;
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]CMD ["nginx", "-g", "daemon off;"]
