FROM node:20-slim

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

COPY . .

RUN npx tsc

EXPOSE 10000

CMD npx prisma db push --skip-generate && node dist/server.js
