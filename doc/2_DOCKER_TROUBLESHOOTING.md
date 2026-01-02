# 2. Docker 빌드 및 실행 트러블슈팅

## 📋 개요

이 문서는 Next.js + Prisma + SQLite 애플리케이션을 Docker로 빌드하고 실행할 때 발생한 문제들과 해결 방법을 정리한 것입니다.

## 🔍 발생한 문제들

### 1. Prisma CLI WASM 파일 경로 문제

#### 문제 증상
```
Error: ENOENT: no such file or directory, open '/app/node_modules/.bin/prisma_schema_build_bg.wasm'
```

#### 원인 분석
- Next.js의 `standalone` 빌드 모드는 최소한의 파일만 포함하여 이미지 크기를 줄입니다
- Prisma CLI는 WASM (WebAssembly) 파일을 필요로 하는데, `.bin/prisma` 스크립트가 실행될 때 상대 경로로 WASM 파일을 찾으려고 시도합니다
- `.bin/prisma` 스크립트는 `/app/node_modules/.bin/prisma_schema_build_bg.wasm` 경로에서 WASM 파일을 찾지만, 실제 파일은 `/app/node_modules/prisma/build/prisma_schema_build_bg.wasm`에 위치합니다

#### 해결 방법
```dockerfile
# Prisma CLI의 WASM 파일 경로 문제 해결
# .bin/prisma 스크립트가 WASM 파일을 찾을 수 있도록 심볼릭 링크 생성
RUN ln -sf /app/node_modules/prisma/build/prisma_schema_build_bg.wasm /app/node_modules/.bin/prisma_schema_build_bg.wasm || true
```

**설명**: 심볼릭 링크를 생성하여 `.bin` 디렉토리에서도 WASM 파일에 접근할 수 있도록 했습니다.

---

### 2. Prisma CLI package.json 경로 문제

#### 문제 증상
```
Error: Cannot find module '../package.json'
Require stack:
- /app/node_modules/.bin/prisma
```

#### 원인 분석
- `.bin/prisma` 스크립트는 실행 시 상대 경로로 `../package.json`을 찾으려고 합니다
- 하지만 standalone 빌드 환경에서는 디렉토리 구조가 달라져서 상대 경로가 맞지 않습니다
- `npx prisma`를 사용하면 네트워크에서 패키지를 다운로드하려고 시도하지만, 이는 프로덕션 환경에서 바람직하지 않습니다

#### 해결 방법
```dockerfile
# Prisma CLI를 올바른 디렉토리에서 실행 (package.json 경로 문제 해결)
CMD sh -c "cd /app && node /app/node_modules/prisma/build/index.js migrate deploy || (echo 'Prisma migration failed' && exit 1) && node server.js"
```

**설명**: `.bin/prisma` 스크립트를 거치지 않고 Prisma CLI의 메인 진입점(`build/index.js`)을 직접 실행하여 경로 문제를 우회했습니다.

---

### 3. OpenSSL 라이브러리 누락 문제

#### 문제 증상
```
prisma:warn Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-1.1.x".
Please manually install OpenSSL and try installing Prisma again.
```

또는 런타임 에러:
```
Error loading shared library libssl.so.1.1: No such file or directory
```

#### 원인 분석
- Prisma는 네이티브 바이너리(Query Engine)를 사용하며, 이는 OpenSSL 라이브러리에 의존합니다
- Alpine Linux 기반 이미지(`node:20-alpine`)는 최소한의 패키지만 포함하므로 OpenSSL이 기본적으로 설치되어 있지 않습니다
- Prisma가 OpenSSL을 찾지 못하면 경고를 출력하고 기본값으로 폴백하지만, 실제 런타임에서 문제가 발생할 수 있습니다

#### 해결 방법
```dockerfile
# Prisma CLI 실행을 위한 OpenSSL 설치
RUN apk add --no-cache openssl
```

**설명**: Alpine Linux의 패키지 매니저(`apk`)를 사용하여 OpenSSL을 설치했습니다. `--no-cache` 옵션은 패키지 인덱스를 캐시하지 않아 이미지 크기를 줄입니다.

---

### 4. Prisma Query Engine 버전 불일치 문제

#### 문제 증상
```
Error [PrismaClientInitializationError]: Prisma Client could not locate the Query Engine for runtime "linux-musl-arm64-openssl-3.0.x".

This happened because Prisma Client was generated for "linux-musl-arm64-openssl-1.1.x", but the actual deployment required "linux-musl-arm64-openssl-3.0.x".
```

#### 원인 분석
- Prisma Client는 빌드 시점에 특정 플랫폼용 Query Engine을 생성합니다
- 로컬 개발 환경(MacOS)에서는 `native` 타겟으로 빌드되지만, Docker 컨테이너(Alpine Linux)에서는 다른 플랫폼이 필요합니다
- 빌드 시점과 런타임의 OpenSSL 버전이 다를 수 있습니다:
  - 빌드 시점: `openssl-1.1.x` (기본값 또는 이전 버전)
  - 런타임: `openssl-3.0.x` (Alpine Linux 최신 버전)
- `binaryTargets`를 명시하지 않으면 Prisma는 현재 플랫폼만을 타겟으로 빌드합니다

#### 해결 방법
```prisma
// prisma/schema.prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x", "linux-musl-openssl-3.0.x"]
}
```

**설명**: 
- `native`: 로컬 개발 환경(MacOS)용
- `linux-musl-arm64-openssl-3.0.x`: Alpine Linux (musl libc) + ARM64 아키텍처 + OpenSSL 3.0.x용
- `linux-musl-openssl-3.0.x`: Alpine Linux (musl libc) + x86_64 아키텍처 + OpenSSL 3.0.x용

이렇게 하면 빌드 시점에 여러 플랫폼용 Query Engine이 모두 생성되어, 어떤 환경에서든 실행할 수 있습니다.

**아키텍처별 binaryTargets**:
- Intel/AMD (x86_64): `linux-musl-openssl-3.0.x` (x86_64는 아키텍처 명시 불필요)
- Apple Silicon (ARM64): `linux-musl-arm64-openssl-3.0.x`
- 여러 아키텍처를 지원하려면 배열에 모두 추가

---

### 5. 데이터베이스 권한 문제 (볼륨 마운트)

#### 문제 증상
```
Error: Schema engine error:
SQLite database error
unable to open database file: /app/data/prod.db
```

컨테이너가 `Restarting` 상태로 계속 재시작됩니다.

#### 원인 분석
- Docker 볼륨 마운트(`-v $(pwd)/data:/app/data`)를 사용할 때, 호스트의 디렉토리가 컨테이너 내부 디렉토리를 **완전히 덮어씁니다**
- Dockerfile에서 `RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data`로 권한을 설정해도, 볼륨 마운트 시 호스트 디렉토리의 권한이 우선됩니다
- 컨테이너 내부의 `nextjs` 사용자(UID 1001)가 호스트 디렉토리에 쓰기 권한이 없습니다
- SQLite는 데이터베이스 파일뿐만 아니라 **디렉토리에도 쓰기 권한**이 필요합니다
- 볼륨 마운트는 컨테이너 내부의 파일 시스템을 호스트의 디렉토리로 대체하므로, 이미지 빌드 시 설정한 권한이 무시됩니다

#### 해결 방법

**방법 1: 호스트에서 권한 설정 (권장)**
```bash
# 데이터 디렉토리 생성
mkdir -p ./data

# nextjs 사용자(UID 1001)에게 권한 부여
sudo chown -R 1001:1001 ./data

# 컨테이너 재시작
docker restart tmplanner
```

**방법 2: Docker Compose에서 user 지정**
```yaml
services:
  app:
    image: codingpenguinyoon1081/tmplanner:latest
    user: "1001:1001"  # nextjs 사용자로 실행
    volumes:
      - ./data:/app/data
```

그리고 호스트에서:
```bash
mkdir -p ./data
sudo chown -R 1001:1001 ./data
docker-compose up -d
```

**방법 3: Named Volume 사용**
```bash
# named volume 생성 (Docker가 권한 관리)
docker volume create tmplanner-data

# 컨테이너 실행
docker run -d \
  --name tmplanner \
  -v tmplanner-data:/app/data \
  codingpenguinyoon1081/tmplanner:latest
```

**설명**: 
- 볼륨 마운트는 호스트의 디렉토리를 컨테이너에 직접 연결하므로, 호스트의 권한 설정이 그대로 적용됩니다
- 컨테이너 내부의 `nextjs` 사용자(UID 1001)가 파일에 접근하려면, 호스트 디렉토리도 UID 1001에게 권한이 있어야 합니다
- Named Volume을 사용하면 Docker가 자동으로 권한을 관리하지만, 호스트에서 직접 파일에 접근하기 어렵습니다

---

## ✅ 최종 해결된 Dockerfile 구조

```dockerfile
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
RUN mkdir -p /app/node_modules/.bin
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma /app/node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma /app/node_modules/.bin/prisma

# Prisma CLI의 WASM 파일 경로 문제 해결
RUN ln -sf /app/node_modules/prisma/build/prisma_schema_build_bg.wasm /app/node_modules/.bin/prisma_schema_build_bg.wasm || true

# Prisma CLI 실행을 위한 PATH 설정
ENV PATH="/app/node_modules/.bin:${PATH}"

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 초기 마이그레이션 실행 후 서버 시작
CMD sh -c "cd /app && node /app/node_modules/prisma/build/index.js migrate deploy || (echo 'Prisma migration failed' && exit 1) && node server.js"
```

## 🧪 테스트 방법

### 이미지 빌드
```bash
docker build -t tmplanner:test .
```

### 컨테이너 실행 및 테스트
```bash
# 데이터 디렉토리 생성
mkdir -p ./data
sudo chown -R 1001:1001 ./data

# 컨테이너 실행
docker run --rm -d \
  --name tmplanner-test \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  tmplanner:test

# 로그 확인
docker logs -f tmplanner-test

# 서버 응답 테스트
curl http://localhost:3000
```

### docker-compose 사용
```bash
mkdir -p ./data
sudo chown -R 1001:1001 ./data
docker-compose up -d --build
docker-compose logs -f
```

## 📋 문제 해결 체크리스트

### 이미지 빌드 시
- [ ] Prisma schema에 올바른 `binaryTargets` 설정
- [ ] OpenSSL 패키지 설치 확인
- [ ] Prisma CLI WASM 파일 심볼릭 링크 생성
- [ ] HOSTNAME="0.0.0.0" 설정 확인

### 컨테이너 실행 시
- [ ] 데이터 디렉토리 생성 (`mkdir -p ./data`)
- [ ] 데이터 디렉토리 권한 설정 (`sudo chown -R 1001:1001 ./data`)
- [ ] 포트 바인딩 확인 (`-p 0.0.0.0:3000:3000`)
- [ ] 방화벽 설정 확인 (원격 접속 시)

### 문제 발생 시 확인 사항
1. 컨테이너 로그 확인: `docker logs tmplanner`
2. 컨테이너 상태 확인: `docker ps -a`
3. 포트 바인딩 확인: `docker port tmplanner`
4. 권한 확인: `ls -la ./data`
5. 로컬 접속 테스트: `curl http://localhost:3000`

## 🔍 추가 진단 명령어

### OpenSSL 버전 확인
```bash
docker run --rm tmplanner:test apk info openssl
```

### Prisma Query Engine 확인
```bash
docker run --rm tmplanner:test ls -la /app/node_modules/.prisma/client/
```

### 컨테이너 내부 권한 확인
```bash
docker exec tmplanner whoami
docker exec tmplanner id
docker exec tmplanner ls -la /app/data
```

## 📝 참고 사항

1. **아키텍처별 binaryTargets**: 
   - Intel/AMD (x86_64): `linux-musl-openssl-3.0.x` (x86_64는 아키텍처 명시 불필요)
   - Apple Silicon (ARM64): `linux-musl-arm64-openssl-3.0.x`
   - 여러 아키텍처를 지원하려면 배열에 모두 추가

2. **볼륨 마운트 권한**: 
   - 호스트 디렉토리의 권한이 컨테이너 내부 권한보다 우선됩니다
   - 항상 호스트에서 적절한 권한을 설정해야 합니다

3. **Prisma 마이그레이션**: 
   - 컨테이너 시작 시 자동으로 `prisma migrate deploy`가 실행됩니다
   - 실패 시 컨테이너가 종료되므로 로그를 확인해야 합니다

## 🔗 관련 문서

- [코드 아키텍처](./1_CODE_ARCHITECTURE.md)
- [호스트 설정 가이드](./3_HOST_SETUP.md)
- [Docker 실행 가이드](./4_DOCKER_RUN_GUIDE.md)
- [Prisma Binary Targets](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#binarytargets-options)
- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Alpine Linux Package Management](https://wiki.alpinelinux.org/wiki/Alpine_Linux_package_management)
- [Docker Volume Mount Permissions](https://docs.docker.com/storage/volumes/)

