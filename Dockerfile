FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# node_modules lives in a named volume (docker-compose.yml) that outlives image rebuilds, so a
# dependency added later is missing until it is installed into the volume. Sync on every start;
# it is a quick no-op when nothing changed.
CMD ["sh","-c","npm install --no-audit --no-fund && npm run dev"]
