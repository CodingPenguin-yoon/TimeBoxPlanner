#!/bin/bash
# Docker 이미지 빌드 및 테스트 스크립트

set -e

echo "🔨 Docker 이미지 빌드 중..."
docker build -t tmplanner:test .

echo "📦 데이터 디렉토리 생성..."
mkdir -p ./data

echo "🚀 컨테이너 실행 중..."
docker run --rm -d \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --name tmplanner-test \
  tmplanner:test

echo "⏳ 컨테이너 시작 대기 중 (5초)..."
sleep 5

echo "📋 컨테이너 로그 확인:"
docker logs tmplanner-test

echo ""
echo "🧪 서버 응답 테스트..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
  echo "✅ 서버가 정상적으로 응답합니다!"
else
  echo "❌ 서버 응답 실패"
  echo "로그를 확인하세요: docker logs tmplanner-test"
  docker stop tmplanner-test
  exit 1
fi

echo ""
echo "🛑 테스트 완료. 컨테이너를 중지합니다..."
docker stop tmplanner-test

echo "✅ 테스트 성공!"

