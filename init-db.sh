#!/bin/sh
# DB 초기화 스크립트 (컨테이너 시작 전에 실행)

set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node server.js

