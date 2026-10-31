FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY functions/package.json functions/package-lock.json ./functions/
RUN npm --prefix functions ci --omit=dev --ignore-scripts
COPY server ./server
COPY functions ./functions
ENV NODE_ENV=production ALLGO_ENVIRONMENT=production ACCOUNT_API_HOST=0.0.0.0 ACCOUNT_API_PORT=3005
USER node
EXPOSE 3005
CMD ["node", "server/start-production.mjs"]
