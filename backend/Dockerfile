FROM node:20-slim

RUN apt-get update && apt-get install -y redis-server && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

COPY . .

EXPOSE 10000

CMD redis-server --daemonize yes && npx prisma db push --skip-generate && npm start
