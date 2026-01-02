# 3. 호스트 설정 가이드

## 📋 개요

이 문서는 Docker 컨테이너를 실행하는 호스트 서버에서 발생할 수 있는 설정 문제들과 해결 방법을 정리한 것입니다.

## 🔴 문제 1: 원격 접속 불가

### 증상
다른 서버에서 `http://서버IP:3000`으로 접속했을 때 연결이 안 됩니다.

### 원인
1. 포트 바인딩이 `localhost`(127.0.0.1)로만 되어 있음
2. 방화벽에서 3000 포트가 차단됨
3. 클라우드 서버의 보안 그룹에서 포트가 열려있지 않음

### 해결 방법

#### 1. 포트 바인딩 확인 및 수정

**문제 확인**:
```bash
# 컨테이너 포트 바인딩 확인
docker port tmplanner

# 네트워크 포트 확인
netstat -tuln | grep 3000
# 또는
ss -tuln | grep 3000
```

**해결**: `0.0.0.0`으로 명시적 바인딩
```bash
# 기존 컨테이너 중지 및 삭제
docker stop tmplanner
docker rm tmplanner

# 0.0.0.0으로 명시적 바인딩
docker run -d \
  --name tmplanner \
  -p 0.0.0.0:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest
```

**Docker Compose 사용 시**:
```yaml
services:
  app:
    image: codingpenguinyoon1081/tmplanner:latest
    ports:
      - "0.0.0.0:3000:3000"  # 명시적으로 0.0.0.0 지정
```

#### 2. 방화벽 설정

**Linux (ufw)**:
```bash
# 방화벽 상태 확인
sudo ufw status

# 3000 포트 열기
sudo ufw allow 3000/tcp
sudo ufw reload
```

**Linux (firewalld)**:
```bash
# 방화벽 상태 확인
sudo firewall-cmd --list-all

# 3000 포트 열기
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

**Linux (iptables)**:
```bash
# 3000 포트 열기
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables-save
```

#### 3. 클라우드 서버 보안 그룹 설정

**AWS, GCP, Azure 등 클라우드 서버 사용 시**:
- 보안 그룹/방화벽 규칙에서 인바운드 규칙 추가:
  - 포트: `3000`
  - 프로토콜: `TCP`
  - 소스: `0.0.0.0/0` (모든 IP) 또는 특정 IP만 허용

#### 4. 서버 내부에서 접속 테스트

```bash
# 서버 내부에서 localhost로 접속 테스트
curl http://localhost:3000

# 서버의 실제 IP로 접속 테스트
curl http://$(hostname -I | awk '{print $1}'):3000
```

**성공 시**: HTML 응답이 반환되어야 합니다.
**실패 시**: 컨테이너나 애플리케이션 문제일 가능성이 높습니다.

### 진단 스크립트

```bash
#!/bin/bash
echo "=== Docker 컨테이너 상태 ==="
docker ps | grep tmplanner

echo -e "\n=== 컨테이너 로그 (최근 20줄) ==="
docker logs --tail 20 tmplanner

echo -e "\n=== 포트 바인딩 확인 ==="
docker port tmplanner

echo -e "\n=== 네트워크 포트 확인 ==="
netstat -tuln | grep 3000 || ss -tuln | grep 3000

echo -e "\n=== 서버 IP 주소 ==="
echo "공인 IP: $(curl -s ifconfig.me)"
echo "사설 IP: $(hostname -I | awk '{print $1}')"

echo -e "\n=== 로컬 접속 테스트 ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000

echo -e "\n=== 방화벽 상태 (ufw) ==="
sudo ufw status 2>/dev/null || echo "ufw가 설치되지 않았거나 권한이 없습니다"
```

---

## 🔴 문제 2: 데이터베이스 권한 문제

### 증상
```
Error: Schema engine error:
SQLite database error
unable to open database file: /app/data/prod.db
```

컨테이너가 `Restarting` 상태로 계속 재시작됩니다.

### 원인
- Docker 볼륨 마운트(`-v $(pwd)/data:/app/data`)를 사용할 때, 호스트의 디렉토리가 컨테이너 내부 디렉토리를 **완전히 덮어씁니다**
- 컨테이너 내부의 `nextjs` 사용자(UID 1001)가 호스트 디렉토리에 쓰기 권한이 없습니다
- SQLite는 데이터베이스 파일뿐만 아니라 **디렉토리에도 쓰기 권한**이 필요합니다

### 해결 방법

#### 방법 1: 호스트에서 권한 설정 (권장)

```bash
# 데이터 디렉토리 생성
mkdir -p ./data

# nextjs 사용자(UID 1001)에게 권한 부여
sudo chown -R 1001:1001 ./data

# 컨테이너 재시작
docker restart tmplanner
```

#### 방법 2: Docker Compose에서 user 지정

```yaml
version: '3.8'

services:
  app:
    image: codingpenguinyoon1081/tmplanner:latest
    container_name: tmplanner
    ports:
      - "0.0.0.0:3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/prod.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    user: "1001:1001"  # nextjs 사용자로 실행
```

그리고 호스트에서:
```bash
mkdir -p ./data
sudo chown -R 1001:1001 ./data
docker-compose up -d
```

#### 방법 3: Named Volume 사용

```bash
# named volume 생성 (Docker가 권한 관리)
docker volume create tmplanner-data

# 컨테이너 실행
docker run -d \
  --name tmplanner \
  -p 0.0.0.0:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v tmplanner-data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest
```

**단점**: 호스트에서 직접 파일에 접근하기 어렵습니다.

### 권한 확인

```bash
# 호스트 디렉토리 권한 확인
ls -la ./data

# 컨테이너 내부에서 권한 확인
docker exec tmplanner ls -la /app/data
docker exec tmplanner whoami
docker exec tmplanner id
```

**예상 결과**: 
- 호스트: `drwxr-xr-x 1001 1001 ... data`
- 컨테이너: `drwxr-xr-x nextjs nodejs ... /app/data`

### 빠른 해결 스크립트

```bash
#!/bin/bash
# 데이터 디렉토리 생성 및 권한 설정

# 디렉토리 생성
mkdir -p ./data

# 권한 설정 (UID 1001 = nextjs 사용자)
sudo chown -R 1001:1001 ./data

# 기존 컨테이너 정리
docker stop tmplanner 2>/dev/null
docker rm tmplanner 2>/dev/null

# 컨테이너 재시작
docker run -d \
  --name tmplanner \
  -p 0.0.0.0:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest

# 로그 확인
echo "컨테이너 로그 확인 중..."
sleep 3
docker logs tmplanner
```

---

## 🌐 문제 3: 도메인 설정 및 리버스 프록시

### 목표
포트 번호 없이 도메인으로 접속: `http://your-domain.com` → 내부 3000 포트로 자동 프록시

### Nginx 리버스 프록시 설정

#### 1. Nginx 설치

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# 설치 확인
sudo systemctl status nginx
```

#### 2. Docker 컨테이너 포트 변경

기존 컨테이너가 있다면 중지:
```bash
docker stop tmplanner
docker rm tmplanner
```

**localhost만 바인딩**하도록 재실행:
```bash
mkdir -p ./data
sudo chown -R 1001:1001 ./data

docker run -d \
  --name tmplanner \
  -p 127.0.0.1:3000:3000 \
  -e DATABASE_URL=file:/app/data/prod.db \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  codingpenguinyoon1081/tmplanner:latest
```

**중요**: `-p 0.0.0.0:3000:3000` → `-p 127.0.0.1:3000:3000`으로 변경
- 외부에서 직접 3000 포트로 접속 불가
- Nginx를 통해서만 접속 가능 (보안 강화)

#### 3. Nginx 설정 파일 생성

```bash
sudo nano /etc/nginx/sites-available/tmplanner
```

다음 내용 입력:
```nginx
server {
    listen 80;
    server_name tmbox.com www.tmbox.com;

    # 로그 설정
    access_log /var/log/nginx/tmplanner-access.log;
    error_log /var/log/nginx/tmplanner-error.log;

    # 프록시 설정
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # WebSocket 지원 (필요한 경우)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 헤더 설정
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 캐시 비활성화
        proxy_cache_bypass $http_upgrade;
        
        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**설명**:
- `listen 80`: HTTP(80) 포트로 리스닝
- `server_name tmbox.com www.tmbox.com`: 도메인 설정 (포트 번호 없이 접속 가능)
- `proxy_pass http://127.0.0.1:3000`: 내부 Docker 컨테이너(3000 포트)로 프록시
- 이제 `http://tmbox.com`만 입력해도 자동으로 접속됩니다 (포트 번호 불필요)

#### 4. 설정 파일 활성화

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/tmplanner /etc/nginx/sites-enabled/

# 기본 설정 비활성화 (선택사항)
sudo rm /etc/nginx/sites-enabled/default
```

#### 5. Nginx 설정 테스트 및 재시작

```bash
# 설정 파일 문법 확인
sudo nginx -t

# 성공하면 "test is successful" 메시지 출력
# 실패하면 에러 메시지 확인 후 수정

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 자동 시작 설정
sudo systemctl enable nginx
```

#### 6. 방화벽 설정

```bash
# HTTP (80) 포트 열기
sudo ufw allow 80/tcp

# 방화벽 재로드
sudo ufw reload

# 방화벽 상태 확인
sudo ufw status
```

#### 7. 도메인 DNS 설정

**로컬에서만 테스트하는 경우 (Mac)**:
- `/etc/hosts` 파일 수정 (아래 "로컬 DNS 설정" 참고)
- 도메인 제공업체 설정 불필요

**공인 도메인 사용하는 경우**:
도메인 제공업체(가비아, 후이즈, Cloudflare 등)에서:

```
Type: A
Name: @ (또는 비워두기)
Value: [서버 IP 주소]
TTL: 3600

Type: A
Name: www
Value: [서버 IP 주소]
TTL: 3600
```

**DNS 전파 확인** (몇 분~몇 시간 소요):
```bash
nslookup your-domain.com
# 또는
dig your-domain.com
```

#### 8. 접속 확인

```bash
# 서버에서 로컬 테스트
curl http://localhost

# 브라우저에서 접속
# 포트 번호 없이 도메인만 입력하면 자동으로 접속됩니다
http://tmbox.com
```

**설정 완료!** 이제 `http://tmbox.com`만 입력해도 자동으로 접속됩니다 (포트 번호 불필요).

---

## 🔒 HTTPS 설정 (SSL 인증서)

### 목표
외부에서 `https://tmbox.com`으로 접속 가능하도록 SSL 인증서 설정

### Let's Encrypt 사용 (무료 SSL 인증서)

#### 1. Certbot 설치

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 설치 확인
certbot --version
```

#### 2. 사전 준비사항 확인

```bash
# 도메인이 서버 IP로 올바르게 설정되어 있는지 확인
nslookup tmbox.com
dig tmbox.com

# Nginx가 HTTP(80) 포트에서 정상 작동하는지 확인
curl http://tmbox.com

# 방화벽에서 80 포트가 열려있는지 확인
sudo ufw status | grep 80
```

**중요**: 
- 도메인 DNS A 레코드가 서버 IP로 설정되어 있어야 합니다
- HTTP(80) 포트가 열려있어야 Certbot이 인증서를 발급할 수 있습니다

#### 3. SSL 인증서 자동 발급 및 설정

```bash
# tmbox.com 도메인용 (www 포함)
sudo certbot --nginx -d tmbox.com -d www.tmbox.com
```

**Certbot 실행 과정**:
1. 이메일 주소 입력 (인증서 만료 알림용)
2. 이용약관 동의 (`A` 입력)
3. EFF 이메일 공유 여부 선택 (선택사항, Y/N)
4. HTTP → HTTPS 리다이렉트 선택 (`2` 입력 권장)

**Certbot이 자동으로**:
- SSL 인증서 발급 (Let's Encrypt)
- Nginx 설정 파일 자동 수정 (HTTPS 서버 블록 추가, HTTP → HTTPS 리다이렉트 추가)
- 자동 갱신 설정 (systemd timer)

#### 4. Certbot 실행 후 Nginx 설정 확인

```bash
sudo cat /etc/nginx/sites-available/tmplanner
```

**Certbot이 자동으로 수정한 결과**:
```nginx
# HTTP → HTTPS 리다이렉트 (Certbot이 자동 추가)
server {
    listen 80;
    server_name tmbox.com www.tmbox.com;
    
    # HTTP → HTTPS 리다이렉트
    return 301 https://$server_name$request_uri;
}

# HTTPS 서버 블록 (Certbot이 자동 추가)
server {
    listen 443 ssl http2;
    server_name tmbox.com www.tmbox.com;

    # SSL 인증서 경로 (Certbot이 자동 추가)
    ssl_certificate /etc/letsencrypt/live/tmbox.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tmbox.com/privkey.pem;
    
    # SSL 설정 (Certbot이 자동으로 추가)
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # 로그 설정
    access_log /var/log/nginx/tmplanner-access.log;
    error_log /var/log/nginx/tmplanner-error.log;

    # 프록시 설정 (기존 설정 유지)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # WebSocket 지원
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 헤더 설정
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 캐시 비활성화
        proxy_cache_bypass $http_upgrade;
        
        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**중요**: 
- Certbot이 **자동으로** Nginx 설정 파일을 수정합니다
- 수동으로 Nginx 설정을 변경할 필요가 없습니다
- 프록시 설정 부분은 기존 설정을 유지합니다

#### 5. Nginx 설정 테스트 및 재시작

```bash
# 설정 파일 문법 확인
sudo nginx -t

# 성공하면 Nginx 재시작
sudo systemctl restart nginx

# Nginx 상태 확인
sudo systemctl status nginx
```

#### 6. 방화벽에 HTTPS 포트 추가

```bash
# HTTPS (443) 포트 열기
sudo ufw allow 443/tcp

# 방화벽 재로드
sudo ufw reload

# 방화벽 상태 확인
sudo ufw status
```

#### 7. 자동 갱신 확인

Let's Encrypt 인증서는 90일마다 갱신해야 합니다. Certbot이 자동으로 갱신하도록 설정됩니다:

```bash
# 갱신 테스트 (실제로 갱신하지 않고 테스트만)
sudo certbot renew --dry-run

# 자동 갱신 타이머 확인
sudo systemctl status certbot.timer

# 자동 갱신 로그 확인
sudo journalctl -u certbot.timer
```

#### 8. 접속 확인

```bash
# HTTPS 접속 테스트
curl https://tmbox.com

# SSL 인증서 정보 확인
openssl s_client -connect tmbox.com:443 -servername tmbox.com < /dev/null
```

**브라우저에서 접속**:
- `https://tmbox.com` (HTTPS로 접속)
- `http://tmbox.com` (자동으로 HTTPS로 리다이렉트)

**설정 완료!** 이제 외부에서 `https://tmbox.com`으로 안전하게 접속할 수 있습니다.

---

### SSL 인증서 문제 해결

#### 인증서 발급 실패

**증상**: `certbot` 실행 시 에러 발생

**원인 및 해결**:
1. **도메인이 서버 IP로 올바르게 설정되지 않음**
   ```bash
   # DNS 확인
   nslookup tmbox.com
   dig tmbox.com
   ```
   - 도메인 제공업체에서 A 레코드가 올바르게 설정되었는지 확인
   - DNS 전파 시간 대기 (최대 24시간, 보통 10-30분)

2. **방화벽에서 80 포트가 차단됨**
   ```bash
   # 방화벽 확인
   sudo ufw status
   sudo ufw allow 80/tcp
   ```

3. **Nginx가 실행되지 않음**
   ```bash
   # Nginx 상태 확인
   sudo systemctl status nginx
   sudo systemctl start nginx
   ```

4. **이미 인증서가 발급된 경우**
   ```bash
   # 기존 인증서 확인
   sudo certbot certificates
   
   # 기존 인증서 삭제 후 재발급
   sudo certbot delete --cert-name tmbox.com
   sudo certbot --nginx -d tmbox.com -d www.tmbox.com
   ```

#### 인증서 갱신 실패

**증상**: 자동 갱신이 실패하거나 만료 경고

**해결**:
```bash
# 갱신 로그 확인
sudo journalctl -u certbot.timer
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# 수동 갱신 시도
sudo certbot renew --force-renewal

# 특정 도메인만 갱신
sudo certbot renew --cert-name tmbox.com
```

**자동 갱신 설정 확인**:
```bash
# Certbot 타이머 상태 확인
sudo systemctl status certbot.timer

# 타이머 활성화 (비활성화된 경우)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### HTTPS 접속 시 "연결이 안전하지 않음" 경고

**원인**: 
- 인증서가 만료됨
- 인증서가 올바르게 설치되지 않음
- 중간 인증서(chain) 누락

**해결**:
```bash
# 인증서 만료일 확인
sudo certbot certificates
sudo openssl x509 -in /etc/letsencrypt/live/tmbox.com/cert.pem -noout -dates

# 인증서 재발급
sudo certbot renew --force-renewal

# Nginx 설정 확인 (fullchain.pem 사용 확인)
sudo cat /etc/nginx/sites-available/tmplanner | grep ssl_certificate
```

---

### Nginx 문제 해결

#### 502 Bad Gateway 에러

**원인**: Docker 컨테이너가 실행되지 않았거나 포트가 맞지 않음

```bash
# 컨테이너 상태 확인
docker ps | grep tmplanner

# 컨테이너 로그 확인
docker logs tmplanner

# 포트 확인
docker port tmplanner

# localhost:3000 접속 테스트
curl http://127.0.0.1:3000
```

**해결**: 컨테이너가 실행 중이고 `127.0.0.1:3000`으로 접속 가능한지 확인

#### 도메인으로 접속이 안 되는 경우

1. **DNS 확인**:
   ```bash
   nslookup your-domain.com
   dig your-domain.com
   ```

2. **방화벽 확인**:
   ```bash
   sudo ufw status
   sudo netstat -tuln | grep :80
   ```

3. **Nginx 설정 확인**:
   ```bash
   sudo nginx -t
   sudo cat /etc/nginx/sites-available/tmplanner
   ```

#### 포트 80이 이미 사용 중인 경우

```bash
# 포트 80 사용 중인 프로세스 확인
sudo lsof -i :80
# 또는
sudo netstat -tulpn | grep :80

# 다른 서비스 중지 (필요한 경우)
sudo systemctl stop apache2  # Apache가 실행 중인 경우
```

---

## 🔧 로컬 DNS 설정 (Mac)

### 목적
로컬 개발 환경이나 내부 네트워크에서 도메인으로 접속하기 위한 설정

### hosts 파일 수정

```bash
sudo nano /etc/hosts
```

파일 끝에 추가:
```
[서버 IP 주소]    your-domain.com
[서버 IP 주소]    www.your-domain.com
```

**예시**:
```
192.168.1.100    tmplanner.local
192.168.1.100    www.tmplanner.local
```

또는 서버가 같은 맥에서 실행 중이라면:
```
127.0.0.1    tmplanner.local
127.0.0.1    www.tmplanner.local
```

### 저장 및 확인

- `Ctrl + O` (저장)
- `Enter` (확인)
- `Ctrl + X` (종료)

### DNS 캐시 클리어 (필요한 경우)

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### 접속 확인

```bash
# DNS 확인
nslookup tmplanner.local

# 접속 테스트
curl http://tmplanner.local:3000
# 또는 리버스 프록시 설정했다면
curl http://tmplanner.local
```

### 브라우저에서 접속

- `http://tmplanner.local:3000` (포트 번호 명시)
- 또는 `http://tmplanner.local` (리버스 프록시 설정 시)

---

## 📋 전체 설정 체크리스트

### 원격 접속 설정
- [ ] 포트 바인딩이 `0.0.0.0:3000:3000`으로 설정됨
- [ ] 방화벽에서 3000 포트가 열려있음
- [ ] 클라우드 보안 그룹 설정 확인 (클라우드 서버 사용 시)
- [ ] 서버 내부에서 접속 테스트 성공

### 데이터베이스 권한 설정
- [ ] 데이터 디렉토리 생성 (`mkdir -p ./data`)
- [ ] 권한 설정 (`sudo chown -R 1001:1001 ./data`)
- [ ] 컨테이너가 정상 실행 중
- [ ] 데이터베이스 파일 생성 확인

### 도메인 및 리버스 프록시 설정
- [ ] Nginx 설치 완료
- [ ] Docker 컨테이너를 `127.0.0.1:3000`으로 실행
- [ ] Nginx 설정 파일 생성 (`/etc/nginx/sites-available/tmplanner`)
- [ ] 설정 파일 활성화 (`sites-enabled`에 심볼릭 링크)
- [ ] Nginx 설정 테스트 (`nginx -t`)
- [ ] Nginx 재시작
- [ ] 방화벽 80 포트 열기
- [ ] 도메인 DNS A 레코드 설정 (공인 도메인 사용 시)
- [ ] DNS 전파 확인
- [ ] 접속 테스트

---

## 🔗 관련 문서

- [코드 아키텍처](./1_CODE_ARCHITECTURE.md)
- [Docker 트러블슈팅](./2_DOCKER_TROUBLESHOOTING.md)
- [Docker 실행 가이드](./4_DOCKER_RUN_GUIDE.md)

