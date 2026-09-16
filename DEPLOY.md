# PostgreSQL + Google 로그인 배포

## Heimdall 서비스 설정

[Heimdall](https://github.com/CodingPenguin-yoon/heimdall_final)의 프로젝트 설정에서 다음 값을 사용합니다.

| 항목 | 값 |
| --- | --- |
| 서비스 이름 | `app` |
| Build context | `.` |
| Dockerfile | `Dockerfile` |
| Internal port | `3000` |
| Health path | `/api/health` |
| Project database access | 활성화 (`true`) |
| Route | `/` → `app` |

프로젝트 DB를 생성하고 상태가 `ACTIVE`인지 확인합니다. 배포마다 바뀌지 않는 HTTPS hostname을 설정하세요. OAuth는 이 주소를 기준으로 동작합니다. `main`에 코드를 push한 뒤 해당 commit으로 배포합니다.

Heimdall은 `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_SCHEMA`, `DATABASE_PASSWORD_FILE`을 주입합니다. `DATABASE_*`는 예약 변수이므로 직접 추가하지 않습니다. 시작 스크립트가 비밀번호 파일을 읽고 URL 인코딩하여 Prisma용 `DATABASE_URL`을 구성합니다. 마이그레이션과 앱의 Prisma Client 모두 `DATABASE_SCHEMA`를 우선 적용합니다. Managed DB에서 이 값이 없으면 시작을 중단하며 `public`으로 대체하지 않습니다.

### 환경변수

| 이름 | 종류 | 값 |
| --- | --- | --- |
| `AUTH_URL` | PLAIN | `https://실제-서비스-도메인` (경로 없이) |
| `AUTH_TRUST_HOST` | PLAIN | `true` |
| `AUTH_REGISTRATION` | PLAIN | `open` — 누구나 Google 로그인 가능 |
| `AUTH_GOOGLE_ID` | PLAIN | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | SECRET | Google OAuth client secret |
| `AUTH_SECRET` | SECRET | `openssl rand -base64 32`로 생성한 고정 값 |

Heimdall의 SECRET 값은 컨테이너에서 `/run/secrets/...` 파일 경로가 됩니다. `scripts/runtime-env.mjs`가 파일 내용으로 변환합니다. 일반 호스팅의 직접 환경변수와 `AUTH_SECRET_FILE` 같은 `_FILE` 방식도 지원합니다. 비밀값은 로그나 이미지에 넣지 않습니다. Heimdall의 root 소유 0400 파일을 읽기 위해 시작 스크립트만 root로 시작하고, 파일을 읽은 뒤 UID/GID 1001로 권한을 낮춰 마이그레이션과 서버를 실행합니다.

`AUTH_SECRET`은 재배포마다 바꾸지 않습니다. 임시로 가입을 제한하려면 `AUTH_REGISTRATION=allowlist`, `AUTH_ALLOWED_EMAILS=owner@example.com,friend@example.com`을 설정합니다. 목록에서 제거하면 기존 세션도 플래너에 접근할 수 없습니다. 설정 누락 시에는 기본적으로 허용 목록 정책을 적용합니다.

신뢰할 수 있는 Heimdall gateway를 통해서만 앱에 접근하도록 운영합니다. `AUTH_URL`의 외부 HTTPS 주소를 정확히 설정하면 내부 HTTP 프록시에서도 Google callback과 secure cookie가 외부 주소를 기준으로 만들어집니다.

## Google OAuth 설정

Google Cloud Console에서 OAuth 동의 화면과 **웹 애플리케이션** 클라이언트를 생성합니다.

- 승인된 JavaScript 원본: `https://실제-서비스-도메인`
- 승인된 리디렉션 URI: `https://실제-서비스-도메인/api/auth/callback/google`
- 로컬 개발용 원본: `http://localhost:3000`
- 로컬 callback: `http://localhost:3000/api/auth/callback/google`

외부 사용자에게 개방하려면 Google 동의 화면도 실제 외부 사용자 로그인이 가능한 게시 상태로 설정해야 합니다. Testing 상태에서는 등록한 테스트 사용자만 로그인할 수 있습니다. 앱은 Google이 검증한 이메일만 받아 계정을 만듭니다.

## DB 마이그레이션과 배포 확인

컨테이너는 설정 검증 → `prisma migrate deploy` → 서버 실행 순서로 시작합니다. 설정이나 마이그레이션이 실패하면 서버를 실행하지 않습니다. `/api/health`는 사용자·계정·세션·플래너·할 일 테이블의 조회 권한까지 확인하고 성공 시 200, 실패 시 503을 반환합니다.

새 PostgreSQL DB에서 시작합니다. `prisma/migrations/`에는 테이블을 만드는 초기 스키마만 포함되어 있습니다.

배포 후 확인:

1. `/api/health`가 200을 반환하는지 확인.
2. 로그아웃 상태에서 `/`는 로그인 화면으로 이동, `/api/planner`는 401인지 확인.
3. Google 로그인 후 할 일 작성 → 새로고침 → 같은 ID와 내용이 유지되는지 확인.
4. 두 계정으로 같은 날짜를 열어 데이터가 섞이지 않는지 확인.
5. 로그아웃 후 API 접근이 차단되는지 확인.

Heimdall은 새 candidate가 기존 버전과 같은 DB를 사용하므로, 이후 스키마 변경은 구버전과 호환되도록 추가 후 전환하는 방식으로 진행합니다. 앱 버전 롤백은 DB 스키마 롤백을 의미하지 않습니다.

## PostgreSQL 백업

앱 컨테이너가 아닌 Heimdall managed PostgreSQL의 영속 볼륨과 DB를 백업합니다. DB 접근이 가능한 관리 환경에서 접속 정보를 환경변수로 주입하고:

```sh
pg_dump --format=custom --file=backups/timebox.dump
# 별도로 만든 빈 복원 검증용 DB를 PGDATABASE에 지정한 뒤
pg_restore --no-owner --no-privileges --dbname="$PGDATABASE" backups/timebox.dump
```

`PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSFILE`을 관리 환경에 설정합니다. 스케줄러에서 매일 백업하고, 운영 정책에 맞는 보존 기간과 주기적인 별도 DB 복원 검증을 설정하세요. 저장소 변경만으로 운영 서버의 백업 스케줄이 만들어지지는 않습니다.

## 구현 참고

- [Auth.js Prisma adapter](https://authjs.dev/getting-started/adapters/prisma)
- [Auth.js deployment](https://authjs.dev/getting-started/deployment)
- [Auth.js Google provider](https://authjs.dev/getting-started/providers/google)
