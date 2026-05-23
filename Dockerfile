FROM node:20-bullseye-slim

# Set working directory
WORKDIR /app

# Install system dependencies (stable + retry fix)
RUN apt-get update --fix-missing -o Acquire::Retries=3 && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ca-certificates \
        openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first (better caching)
COPY package*.json ./

# Install Node dependencies
RUN npm ci

# Copy rest of the code
COPY . .

# Environment (override in Railway)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Install Python dependencies
RUN python3 -m pip install --no-cache-dir --upgrade pip && \
    python3 -m pip install --no-cache-dir \
        requests \
        beautifulsoup4 \
        scrapling \
        curl_cffi

# Generate Prisma client
RUN npx prisma generate

# Build app
RUN npm run build

# Start app (with DB sync)
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
