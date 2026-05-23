FROM node:20-bullseye-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates python3 python3-pip && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN python3 -m pip install --no-cache-dir --upgrade pip && \
    python3 -m pip install --no-cache-dir requests beautifulsoup4 scrapling curl_cffi
RUN npx prisma generate
RUN npm run build
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
