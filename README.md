# Timebox Planner

개인별 Google 로그인과 PostgreSQL 저장을 지원하는 Next.js 타임박스 플래너입니다.

## 로컬 실행

Node.js 22와 Docker를 사용합니다.

```sh
cp .env.example .env
# .env에 로컬 DB 비밀번호, AUTH_SECRET, Google OAuth 정보를 입력
npm ci
docker compose up -d db
npm run db:migrate
npm run dev
```

[로컬 앱](http://localhost:3000)에 접속합니다. Google OAuth에 `http://localhost:3000/api/auth/callback/google`을 등록해야 합니다. `AUTH_REGISTRATION=open`이면 누구나 로그인할 수 있습니다.

## 확인

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

실제 PostgreSQL 통합 테스트는 데이터베이스 이름에 `timebox_test`가 들어가는 **별도 테스트 DB**를 사용합니다. `DATABASE_URL`을 해당 DB로 설정한 뒤 `npm run db:migrate`, `npm run test:integration`을 실행합니다. 테스트는 생성한 계정만 정리합니다.

HTTP 테스트까지 실행하려면 동일 테스트 DB와 `AUTH_REGISTRATION=open`, `AUTH_URL=http://localhost:3000`, 테스트용 `AUTH_SECRET`, `AUTH_TRUST_HOST=true`로 앱을 실행하고 `TEST_BASE_URL=http://localhost:3000`을 지정합니다. HTTPS 앱의 경우 테스트 쿠키 이름을 secure-cookie 환경에 맞춰야 합니다. 테스트는 DB 세션을 직접 생성하며 실제 Google OAuth 왕복은 별도 확인합니다.

## 배포

[DEPLOY.md](DEPLOY.md)에 Heimdall 서비스 설정, Google OAuth 등록과 PostgreSQL 백업 절차를 정리했습니다. 컨테이너 시작 시 비밀값 파일을 읽고 DB 마이그레이션을 실행합니다.

- 로그인: `/login`
- 계정별 플래너: `/`
- DB 상태 확인: `/api/health`
- API: 로그인한 사용자의 날짜별 데이터만 조회·저장·삭제

저장 시 할 일 ID와 생성 시각을 유지하며, 저장 요청은 브라우저에서 순서대로 처리합니다. 여러 탭의 오래된 저장 요청은 409로 차단합니다. 이력 기록, 통합 대시보드, LLM, MCP는 다음 단계입니다.
