#!/bin/bash
set -e

echo "Running migrations..."
npx wrangler d1 migrations apply custom-link-hub --local || true

echo "Applying seed data..."
npm run seed:generate
npx wrangler d1 execute custom-link-hub --local --file=seeds/dev_seed.sql

echo "Starting dev server..."
npm run dev &
WRANGLER_PID=$!

echo "Waiting for dev server to be ready..."
sleep 5

echo "Running vitest..."
npm run test

echo "Running smoke test..."
npm run smoke -- --base http://127.0.0.1:8788 --slug home

echo "Killing dev server..."
kill $WRANGLER_PID
