FROM node:22-alpine

WORKDIR /app

# Install dependencies first so Docker can cache this step
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the code
COPY *.js ./

ENV NODE_ENV=production
EXPOSE 4000
USER node

CMD ["node", "app.js"]
