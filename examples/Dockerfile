# Minimal image for examples/server.js. Build from repo root:
#   docker build -f examples/Dockerfile -t shitools-server .
#   docker run --rm -p 3000:3000 shitools-server
FROM node:22-alpine

WORKDIR /app

# Install only production deps for a leaner image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the library + the server example.
COPY src ./src
COPY examples ./examples

ENV PORT=3000
EXPOSE 3000

CMD ["node", "examples/server.js"]
