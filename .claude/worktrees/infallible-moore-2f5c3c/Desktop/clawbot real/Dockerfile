# Build Stage
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM node:20-slim

WORKDIR /app

# Install Python and dependencies for skills
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv curl libpq-dev build-essential && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder /app /app

# Install production dependencies
RUN npm install --only=production

# Install Python requirements
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

EXPOSE 18789

CMD ["npm", "start"]
