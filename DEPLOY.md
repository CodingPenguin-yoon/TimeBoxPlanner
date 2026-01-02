# 배포 가이드

## 📋 필요한 파일

1. **Dockerfile** - 서비스 이미지 빌드용 ✅
2. **docker-compose.yml** - 컨테이너 오케스트레이션 ✅
3. **DB 설정 2가지**:
   - DATABASE_URL 환경변수 (docker-compose.yml에 설정됨)
   - DB 파일 볼륨 마운트 (`./data:/app/data`)

## 🚀 배포 방법

### 방법 1: Docker Compose 사용 (권장)

```bash
# 1. DB 디렉토리 생성 (호스트에 자동 생성되지 않으므로 필요)
mkdir -p ./data

# 2. 이미지 빌드 및 실행
docker-compose up -d --build

# 3. 로그 확인
docker-compose logs -f

# 4. 서비스 접속
# 브라우저에서 http://localhost:3000 접속
```

### 방법 2: Docker 직접 사용

```bash
# 1. DB 디렉토리 생성
mkdir -p ./data

# 2. 이미지 빌드
docker build -t tmplanner:latest .

# 3. 컨테이너 실행
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --name tmplanner \
  --restart unless-stopped \
  tmplanner:latest

# 4. 로그 확인
docker logs -f tmplanner
```

## ⚙️ 환경변수 설정

### docker-compose.yml (프로덕션)
```yaml
environment:
  - NODE_ENV=production
  - DATABASE_URL=file:/app/data/prod.db
```

### .env 파일 (로컬 개발 - 선택사항)
```
DATABASE_URL=file:./dev.db
```

## 💾 DB 설정 요약

### 1. DATABASE_URL 환경변수
- **로컬 개발**: `file:./dev.db`
- **프로덕션 (Docker)**: `file:/app/data/prod.db`

### 2. 볼륨 마운트
- **설정**: `./data:/app/data` (docker-compose.yml)
- **목적**: DB 파일(`prod.db`)을 호스트에 저장하여 데이터 영속성 보장
- **위치**: 프로젝트 루트의 `./data` 디렉토리

## 🔄 초기 마이그레이션

컨테이너 시작 시 자동으로 `prisma migrate deploy`가 실행되어 DB 테이블이 생성됩니다.

## 📦 SQLite DB 특징

- ✅ **별도의 DB 컨테이너 불필요**: SQLite는 파일 기반이므로 DB 이미지/컨테이너가 필요 없습니다
- ✅ **단일 컨테이너**: 앱 컨테이너 하나만으로 충분합니다
- ✅ **볼륨 마운트**: DB 파일을 호스트에 저장하여 컨테이너 재시작 시에도 데이터 유지

## 🔧 유용한 명령어

```bash
# 컨테이너 중지
docker-compose down

# 컨테이너 재시작
docker-compose restart

# 로그 확인
docker-compose logs -f app

# 컨테이너 내부 접속
docker-compose exec app sh

# 이미지 재빌드
docker-compose build --no-cache
```

## 💾 데이터 백업

DB 파일은 `./data/prod.db`에 저장되므로, 이 파일을 정기적으로 백업하세요:

```bash
# 백업
cp ./data/prod.db ./data/prod.db.backup

# 복원
cp ./data/prod.db.backup ./data/prod.db
```

## 🐛 문제 해결

### 컨테이너가 시작되지 않는 경우
```bash
# 로그 확인
docker-compose logs app

# 컨테이너 상태 확인
docker-compose ps
```

### DB 마이그레이션 오류
```bash
# 컨테이너 내부에서 수동 마이그레이션
docker-compose exec app prisma migrate deploy
```

### 포트 충돌
```bash
# docker-compose.yml에서 포트 변경
ports:
  - "3001:3000"  # 호스트:컨테이너
```

