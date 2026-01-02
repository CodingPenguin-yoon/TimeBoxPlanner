# 4. Docker 실행 가이드

## 🚀 빠른 시작

### 방법 1: Docker 직접 실행 (권장)

```bash
# 1. 데이터 디렉토리 생성 및 권한 설정
mkdir -p ./data
sudo chown -R 1001:1001 ./data  # nextjs 사용자(UID 1001) 권한 부여

# 2. 이미지 실행 (원격 접속 허용)
docker run -d \
  --name tmplanner \
  -p 0.0.0.0:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest
```

### 방법 2: Docker Hub에서 이미지 Pull 후 실행

```bash
# 1. 이미지 Pull
docker pull codingpenguinyoon1081/tmplanner:latest

# 2. 데이터 디렉토리 생성 및 권한 설정
mkdir -p ./data
sudo chown -R 1001:1001 ./data  # nextjs 사용자(UID 1001) 권한 부여

# 3. 컨테이너 실행 (원격 접속 허용)
docker run -d \
  --name tmplanner \
  -p 0.0.0.0:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest
```

### 방법 3: Docker Compose 사용

```bash
# 1. 데이터 디렉토리 생성 및 권한 설정
mkdir -p ./data
sudo chown -R 1001:1001 ./data  # nextjs 사용자(UID 1001) 권한 부여

# 2. docker-compose.yml 확인 (이미지 지정)
# services:
#   app:
#     image: codingpenguinyoon1081/tmplanner:latest

# 3. 실행
docker-compose up -d
```

---

## 📋 명령어 옵션 설명

### 기본 실행 명령어
```bash
docker run [옵션] 이미지명:태그
```

### 주요 옵션

- `-d` 또는 `--detach`: 백그라운드에서 실행
- `--name tmplanner`: 컨테이너 이름 지정
- `-p 3000:3000`: 포트 매핑 (호스트:컨테이너)
  - `-p 0.0.0.0:3000:3000`: 모든 네트워크 인터페이스에서 접속 허용
  - `-p 127.0.0.1:3000:3000`: localhost에서만 접속 허용 (리버스 프록시 사용 시)
- `-e KEY=VALUE`: 환경 변수 설정
- `-v 호스트경로:컨테이너경로`: 볼륨 마운트 (데이터 영속성)
- `--restart unless-stopped`: 자동 재시작 설정
- `--user "1001:1001"`: 특정 사용자로 실행 (권한 문제 해결 시)

---

## 🔍 컨테이너 관리

### 로그 확인
```bash
# 실시간 로그 확인
docker logs -f tmplanner

# 최근 100줄 로그 확인
docker logs --tail 100 tmplanner

# 특정 시간 이후 로그 확인
docker logs --since 10m tmplanner
```

### 컨테이너 상태 확인
```bash
# 실행 중인 컨테이너 목록
docker ps

# 모든 컨테이너 목록 (중지된 것 포함)
docker ps -a

# 특정 컨테이너 상세 정보
docker inspect tmplanner

# 컨테이너 포트 매핑 확인
docker port tmplanner
```

### 컨테이너 제어
```bash
# 컨테이너 중지
docker stop tmplanner

# 컨테이너 시작
docker start tmplanner

# 컨테이너 재시작
docker restart tmplanner

# 컨테이너 삭제 (중지 후)
docker rm tmplanner

# 컨테이너 중지 및 삭제 (한 번에)
docker rm -f tmplanner
```

### 컨테이너 내부 접속
```bash
# 컨테이너 내부 쉘 접속
docker exec -it tmplanner sh

# 컨테이너 내부에서 명령어 실행
docker exec tmplanner ls -la /app
docker exec tmplanner whoami
docker exec tmplanner id
docker exec tmplanner cat /app/package.json
```

---

## 🌐 서비스 접속

컨테이너 실행 후 다음 URL로 접속:
- **로컬**: http://localhost:3000
- **원격 서버**: http://[서버IP]:3000
- **도메인 설정 시**: http://your-domain.com (리버스 프록시 사용 시)

### 접속 테스트
```bash
# 로컬 접속 테스트
curl http://localhost:3000

# 원격 서버 접속 테스트
curl http://[서버IP]:3000

# HTTP 상태 코드 확인
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000
```

---

## 🔧 환경 변수 커스터마이징

### 포트 변경
```bash
docker run -d \
  --name tmplanner \
  -p 8080:3000 \  # 호스트 포트 8080으로 변경
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  codingpenguinyoon1081/tmplanner:latest
```

접속: `http://localhost:8080`

### 데이터베이스 경로 변경
```bash
docker run -d \
  --name tmplanner \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/custom.db \  # DB 파일명 변경
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  codingpenguinyoon1081/tmplanner:latest
```

### 환경 변수 목록

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `NODE_ENV` | `production` | Node.js 환경 |
| `DATABASE_URL` | `file:/app/data/prod.db` | SQLite 데이터베이스 경로 |
| `PORT` | `3000` | 서버 포트 (이미지 내부 설정) |
| `HOSTNAME` | `0.0.0.0` | 서버 호스트명 (이미지 내부 설정) |

---

## 📦 Docker Compose 설정

### docker-compose.yml (이미지 사용)
```yaml
version: '3.8'

services:
  app:
    image: codingpenguinyoon1081/tmplanner:latest
    container_name: tmplanner
    ports:
      - "0.0.0.0:3000:3000"  # 모든 네트워크 인터페이스에서 접속 허용
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/prod.db
    volumes:
      - ./data:/app/data  # DB 파일 영속성을 위한 볼륨 마운트
    restart: unless-stopped
    user: "1001:1001"  # nextjs 사용자로 실행 (권한 문제 해결)
```

### Docker Compose 명령어
```bash
# 백그라운드 실행
docker-compose up -d

# 포그라운드 실행 (로그 확인)
docker-compose up

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down

# 중지 및 볼륨 삭제
docker-compose down -v

# 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart app

# 이미지 업데이트 후 재시작
docker-compose pull
docker-compose up -d
```

---

## 🐛 문제 해결

### 포트가 이미 사용 중인 경우
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000
# 또는 (Linux)
netstat -tuln | grep 3000
ss -tuln | grep 3000

# 다른 포트 사용
docker run -d --name tmplanner -p 3001:3000 ...
```

### 컨테이너가 즉시 종료되는 경우
```bash
# 로그 확인
docker logs tmplanner

# 포그라운드로 실행하여 에러 확인
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  codingpenguinyoon1081/tmplanner:latest
```

### 데이터베이스 초기화
```bash
# 기존 DB 파일 삭제 후 재시작
rm -rf ./data/prod.db*
docker restart tmplanner
```

### 컨테이너가 계속 재시작되는 경우
```bash
# 로그 확인
docker logs tmplanner

# 데이터베이스 권한 문제일 가능성
# 해결: sudo chown -R 1001:1001 ./data
```

자세한 내용은 [호스트 설정 가이드](./3_HOST_SETUP.md)의 "데이터베이스 권한 문제" 섹션을 참고하세요.

---

## 📝 전체 실행 예시

### 처음 실행하는 경우

```bash
# 1. 기존 컨테이너 정리 (있는 경우)
docker stop tmplanner 2>/dev/null || true
docker rm tmplanner 2>/dev/null || true

# 2. 데이터 디렉토리 생성 및 권한 설정
mkdir -p ./data
sudo chown -R 1001:1001 ./data

# 3. 이미지 Pull (최신 버전)
docker pull codingpenguinyoon1081/tmplanner:latest

# 4. 컨테이너 실행
docker run -d \
  --name tmplanner \
  -p 0.0.0.0:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest

# 5. 로그 확인
docker logs -f tmplanner

# 6. 서비스 접속
# 브라우저에서 http://localhost:3000 접속
```

### Docker Compose 사용 시

```bash
# 1. 데이터 디렉토리 생성 및 권한 설정
mkdir -p ./data
sudo chown -R 1001:1001 ./data

# 2. docker-compose.yml 확인

# 3. 실행
docker-compose up -d

# 4. 로그 확인
docker-compose logs -f

# 5. 서비스 접속
# 브라우저에서 http://localhost:3000 접속
```

---

## 🔄 이미지 업데이트

### 이미지 업데이트 및 재시작

```bash
# 1. 최신 이미지 Pull
docker pull codingpenguinyoon1081/tmplanner:latest

# 2. 기존 컨테이너 중지 및 삭제
docker stop tmplanner
docker rm tmplanner

# 3. 새 컨테이너 실행 (기존 데이터 디렉토리 유지)
docker run -d \
  --name tmplanner \
  -p 0.0.0.0:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest
```

### Docker Compose 사용 시

```bash
# 1. 최신 이미지 Pull
docker-compose pull

# 2. 컨테이너 재시작 (기존 데이터 유지)
docker-compose up -d
```

---

## 💾 데이터 백업 및 복원

### 데이터 백업

```bash
# 데이터 디렉토리 전체 백업
tar -czf tmplanner-backup-$(date +%Y%m%d).tar.gz ./data

# 또는 DB 파일만 백업
cp ./data/prod.db ./data/prod.db.backup
```

### 데이터 복원

```bash
# 전체 데이터 복원
tar -xzf tmplanner-backup-YYYYMMDD.tar.gz

# DB 파일만 복원
cp ./data/prod.db.backup ./data/prod.db

# 권한 재설정
sudo chown -R 1001:1001 ./data

# 컨테이너 재시작
docker restart tmplanner
```

---

## 🔐 보안 고려사항

### 프로덕션 환경 권장 사항

1. **리버스 프록시 사용**: Nginx 등을 사용하여 포트 번호 없이 접속
2. **HTTPS 설정**: Let's Encrypt 등을 사용하여 SSL/TLS 인증서 적용
3. **방화벽 규칙 제한**: 특정 IP만 허용
4. **정기적인 이미지 업데이트**: 보안 패치 적용
5. **데이터 백업**: 정기적으로 데이터 백업

자세한 내용은 [호스트 설정 가이드](./3_HOST_SETUP.md)의 "도메인 설정 및 리버스 프록시" 섹션을 참고하세요.

---

## 📊 모니터링

### 컨테이너 리소스 사용량 확인
```bash
# 실시간 리소스 사용량
docker stats tmplanner

# 특정 시간 동안의 통계
docker stats --no-stream tmplanner
```

### 디스크 사용량 확인
```bash
# 데이터 디렉토리 크기
du -sh ./data

# 컨테이너 내부 디스크 사용량
docker exec tmplanner du -sh /app/data
```

---

## 🔗 관련 문서

- [코드 아키텍처](./1_CODE_ARCHITECTURE.md)
- [Docker 트러블슈팅](./2_DOCKER_TROUBLESHOOTING.md)
- [호스트 설정 가이드](./3_HOST_SETUP.md)

---

## 📞 추가 도움말

문제가 지속되면 다음 정보를 수집하세요:

```bash
# 진단 정보 수집
docker ps -a > container_status.txt
docker logs tmplanner > container_logs.txt
docker inspect tmplanner > container_inspect.txt
netstat -tuln > network_status.txt
ls -la ./data > data_permissions.txt
```

이 파일들을 함께 제공하면 더 정확한 진단이 가능합니다.

