#!/bin/bash
npx prisma db push --skip-generate
node dist/server.js &
node dist/worker.js &
wait
