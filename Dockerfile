# Next.js 애플리케이션 Dockerfile

FROM node:20-alpine AS base

# 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package.json package-lock.json* ./
RUN npm ci

# 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client 생성
RUN npx prisma generate

# Next.js 빌드
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 프로덕션 이미지
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Prisma CLI 실행을 위한 OpenSSL 설치
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 필요한 파일들 복사
COPY --from=builder /app/public ./public

# standalone 빌드 결과물 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma 관련 파일 복사
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Prisma schema와 마이그레이션 복사
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# DB 파일 디렉토리 생성 (볼륨 마운트용)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Prisma CLI를 프로덕션에서도 사용할 수 있도록 복사 (마이그레이션용)
# standalone 빌드에는 devDependencies가 포함되지 않으므로 수동으로 복사
# Prisma CLI와 모든 의존성 파일 복사 (WASM 파일 포함)
RUN mkdir -p /app/node_modules/.bin
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma /app/node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma /app/node_modules/.bin/prisma

# Prisma CLI의 WASM 파일 경로 문제 해결
# .bin/prisma 스크립트가 WASM 파일을 찾을 수 있도록 심볼릭 링크 생성
RUN ln -sf /app/node_modules/prisma/build/prisma_schema_build_bg.wasm /app/node_modules/.bin/prisma_schema_build_bg.wasm || true

# Prisma CLI 실행을 위한 PATH 설정
ENV PATH="/app/node_modules/.bin:${PATH}"

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 초기 마이그레이션 실행 후 서버 시작
# Prisma CLI를 올바른 디렉토리에서 실행 (package.json 경로 문제 해결)
# 에러 발생 시 명확한 메시지 출력
CMD sh -c "cd /app && node /app/node_modules/prisma/build/index.js migrate deploy || (echo 'Prisma migration failed' && exit 1) && node server.js"

