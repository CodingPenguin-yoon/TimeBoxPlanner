# 배포 가이드

## 필요한 파일

1. **Dockerfile** - 서비스 이미지 빌드용
2. **DB 설정 2가지**:
   - DATABASE_URL 환경변수 (`.env` 또는 docker-compose.yml)
   - DB 파일 볼륨 마운트 (데이터 영속성)

## 배포 방법

### 방법 1: Docker Compose 사용 (권장)

```bash
# DB 디렉토리 생성 (호스트에 자동 생성되지 않으므로 필요)
mkdir -p ./data

# 이미지 빌드 및 실행
docker-compose up -d --build
```

### 방법 2: Docker 직접 사용

```bash
# 이미지 빌드
docker build -t tmplanner:latest .

# 컨테이너 실행 (DB 볼륨 마운트 포함)
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -v $(pwd)/data:/app/data \
  --name tmplanner \
  tmplanner:latest
```

## 환경변수 설정

### .env 파일 (로컬 개발)
```
DATABASE_URL=file:./dev.db
```

### 프로덕션 환경
```
DATABASE_URL=file:/app/data/prod.db
```

## DB 설정 요약

1. **DATABASE_URL**: SQLite DB 파일 경로
   - 로컬: `file:./dev.db`
   - 프로덕션: `file:/app/data/prod.db`

2. **볼륨 마운트**: `/app/data` 디렉토리를 호스트에 마운트하여 DB 파일 영속성 보장
   - docker-compose.yml에서 `./data:/app/data`로 설정

## 초기 마이그레이션

컨테이너 시작 시 자동으로 `prisma migrate deploy`가 실행됩니다.

## 데이터 백업

DB 파일은 `./data/prod.db`에 저장되므로, 이 파일을 정기적으로 백업하세요.

