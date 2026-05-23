FROM node:20-bullseye-slim

WORKDIR /app

# Fix unstable mirror + reduce size + avoid failures
RUN sed -i 's/deb.debian.org/ftp.debian.org/g' /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ca-certificates \
        openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Node deps first (better caching)
COPY package*.json ./
RUN npm ci

# Copy rest of app
COPY . .

# Python deps (optimized)
RUN python3 -m pip install --no-cache-dir --upgrade pip && \
    python3 -m pip install --no-cache-dir \
        requests \
        beautifulsoup4 \
        scrapling \
        curl_cffi

# Prisma
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Build
RUN npm run build

# Start
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
