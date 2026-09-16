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
- 홈 대시보드: `/`
- 계정별 플래너: `/planner`
- DB 상태 확인: `/api/health`
- API: 로그인한 사용자의 날짜별 데이터만 조회·저장·삭제

저장 시 할 일 ID와 생성 시각을 유지하며, 저장 요청은 브라우저에서 순서대로 처리합니다. 여러 탭의 오래된 저장 요청은 409로 차단합니다. 완료 이벤트 이력, LLM, MCP는 다음 단계입니다.

## 홈과 하루 플래너

- `/`: 브라우저의 오늘 날짜를 기준으로 중요한 일, 완료율, 최근 7일의 날짜별 완료 상태, 지난 날짜의 미완료 일(최근 5개), 회고를 보여줍니다.
- `/planner?date=YYYY-MM-DD`: 날짜별 플래너. 예전 `/?date=...` 링크도 이 경로로 연결됩니다.
- 체크박스는 완료, 별은 중요한 일(최대 3개)입니다. 메모·회고와 함께 자동 저장됩니다.
- 시작 시간은 선택 메뉴 또는 시간표 드롭으로 15분 단위로 배치합니다. 소요 시간에 15·30·45·90분도 지원합니다.
- 미완료 할 일의 ‘다음 날’ 버튼은 같은 ID의 할 일을 다음 날짜로 **이동**합니다. 원래 날짜에서는 사라지며 시간 배치·중요 표시는 해제됩니다. 두 날짜의 버전을 함께 갱신해 중복 이동과 오래된 탭의 덮어쓰기를 방지합니다.
- 삭제 후 안내의 ‘되돌리기’는 현재 화면에 머무는 동안 마지막으로 삭제한 한 항목을 복원합니다.
- 주간 완료율은 각 날짜에 현재 남아 있는 할 일 기준이며, 완료 이벤트 이력이나 실제 집중 시간을 의미하지 않습니다.
- 개발 환경 전용 `/preview?view=dashboard`에서 샘플 대시보드를, `/preview`에서 플래너를 볼 수 있습니다. 미리보기에서는 저장·날짜 간 이동을 하지 않습니다.

완료 상태를 위한 `20260916010000_task_completion` 마이그레이션을 추가했습니다. 로컬 기존 DB에는 `npm run db:migrate`를 적용하고 새 서버를 실행하세요. 배포 컨테이너에서는 기존 시작 스크립트가 적용합니다.
