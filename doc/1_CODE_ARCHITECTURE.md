# 1. TMPlanner 코드 아키텍처

## 📋 개요

TMPlanner는 Next.js 16 + React 19 + Prisma + SQLite를 사용한 타임박싱 플래너 애플리케이션입니다. 날짜별로 할일을 관리하고 타임테이블에 배치할 수 있습니다.

## 🏗️ 애플리케이션 구조

```
tmplanner/
├── app/                    # Next.js App Router
│   ├── api/
│   │   └── planner/
│   │       └── route.ts    # REST API 엔드포인트
│   ├── components/
│   │   ├── PlannerView.tsx    # 메인 플래너 뷰
│   │   ├── TimeTable.tsx       # 타임테이블 컴포넌트
│   │   ├── CalendarWidget.tsx  # 캘린더 위젯
│   │   └── BackToToday.tsx     # 오늘로 돌아가기 버튼
│   ├── page.tsx            # 메인 페이지
│   └── layout.tsx          # 레이아웃
├── lib/
│   ├── db.ts              # Prisma Client 설정
│   ├── storage.ts         # 데이터 타입 및 API 호출 함수
│   └── utils.ts           # 유틸리티 함수
├── prisma/
│   ├── schema.prisma      # 데이터베이스 스키마
│   └── migrations/       # 마이그레이션 파일
└── components/ui/         # 재사용 가능한 UI 컴포넌트
```

## 🔄 데이터 흐름

### 1. 페이지 로드 흐름

```
사용자 접속
  ↓
app/page.tsx (서버 컴포넌트)
  ↓
날짜 파라미터 파싱 (searchParams)
  ↓
PlannerView 컴포넌트 렌더링 (클라이언트)
  ↓
useEffect로 API 호출: GET /api/planner?date=YYYY-MM-DD
  ↓
Prisma로 DB 조회
  ↓
데이터 표시
```

### 2. 데이터 저장 흐름

```
사용자 입력 (할일 추가/수정/삭제, 드래그 앤 드롭)
  ↓
PlannerView 상태 업데이트 (useState)
  ↓
자동 저장: POST /api/planner
  ↓
Prisma로 DB 저장/업데이트
  ↓
성공 응답
```

## 📦 주요 컴포넌트

### app/page.tsx

**역할**: 메인 페이지 진입점 (서버 컴포넌트)

**주요 기능**:
- URL 쿼리 파라미터에서 날짜 읽기 (`?date=YYYY-MM-DD`)
- 날짜 파싱 및 검증
- 기본값: 오늘 날짜
- `PlannerView` 컴포넌트 렌더링

**코드 구조**:
```typescript
export default async function Home({ searchParams }: PageProps) {
  // searchParams는 Promise이므로 await 필요
  const params = await searchParams;
  const dateParam = params?.date;
  
  // 날짜 파싱 및 검증
  let selectedDate: Date;
  if (dateParam) {
    const parsed = parseDateFromISO(dateParam);
    selectedDate = isValid(parsed) ? parsed : new Date();
  } else {
    selectedDate = new Date(); // 기본값: 오늘
  }
  
  return <PlannerView date={selectedDate} />;
}
```

### app/components/PlannerView.tsx

**역할**: 메인 플래너 뷰 컴포넌트 (클라이언트 컴포넌트)

**주요 기능**:
- 좌우 2단 레이아웃: 왼쪽(할일 목록), 오른쪽(타임테이블)
- 할일 추가/수정/삭제
- 빅3 체크박스 선택
- 드래그 앤 드롭으로 할일을 타임테이블에 배치
- 자동 저장 (상태 변경 시 API 호출)

**상태 관리**:
- `plannerData`: 현재 날짜의 플래너 데이터
- `isLoading`: 데이터 로딩 상태
- `draggedTask`: 드래그 중인 할일 ID
- `draggedTaskIndex`: 드래그 중인 할일 인덱스
- `dragOverTaskIndex`: 드롭 대상 타임슬롯 인덱스

**주요 함수**:
- `loadData()`: API에서 데이터 로드
- `handleSave()`: 데이터 저장 (자동 저장)
- `addTask()`: 할일 추가
- `updateTask()`: 할일 업데이트
- `removeTask()`: 할일 삭제
- `handleDragStart()`: 드래그 시작
- `handleDragOver()`: 드래그 오버
- `handleDrop()`: 드롭 처리

### app/components/TimeTable.tsx

**역할**: 타임테이블 컴포넌트

**주요 기능**:
- 24시간 타임테이블 표시 (30분 단위)
- 드래그 앤 드롭으로 할일 배치
- 배치된 할일 표시
- 할일 클릭으로 수정/삭제

### app/api/planner/route.ts

**역할**: REST API 엔드포인트

**엔드포인트**:

#### GET /api/planner?date=YYYY-MM-DD
- **기능**: 특정 날짜의 플래너 데이터 조회
- **응답**: `PlannerData | null`
- **에러 처리**: 400 (날짜 파라미터 없음), 500 (서버 에러)

**처리 과정**:
1. 쿼리 파라미터에서 날짜 추출
2. Prisma로 `Planner`와 관련 `Task` 조회
3. `PlannerData` 형식으로 변환하여 반환
4. 데이터가 없으면 `null` 반환

#### POST /api/planner
- **기능**: 플래너 데이터 저장/업데이트
- **요청 본문**: `{ date: string, data: PlannerData }`
- **응답**: `{ success: true }`
- **에러 처리**: 400 (필수 파라미터 없음), 500 (서버 에러)

**처리 과정**:
1. 요청 본문에서 날짜와 데이터 추출
2. `Planner.upsert()`로 플래너 생성/업데이트
3. 기존 `Task` 삭제 (`deleteMany`)
4. 새 `Task` 생성 (`createMany`)
5. 성공 응답 반환

#### DELETE /api/planner?date=YYYY-MM-DD
- **기능**: 특정 날짜의 플래너 데이터 삭제
- **응답**: `{ success: true }`
- **에러 처리**: 400 (날짜 파라미터 없음), 500 (서버 에러)

**처리 과정**:
1. 쿼리 파라미터에서 날짜 추출
2. `Planner.delete()`로 삭제 (Cascade로 관련 Task도 자동 삭제)
3. 성공 응답 반환

### lib/db.ts

**역할**: Prisma Client 싱글톤 인스턴스

**주요 기능**:
- 개발 환경에서 hot reload 시 여러 인스턴스 생성 방지
- `globalThis`를 사용하여 인스턴스 재사용
- 프로덕션에서는 매번 새 인스턴스 생성

**코드 구조**:
```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### lib/storage.ts

**역할**: 데이터 타입 정의 및 API 호출 함수

**주요 타입**:
- `TimeboxItem`: 할일 아이템 타입
- `PlannerData`: 플래너 데이터 타입

**주요 함수**:
- `getPlannerDataByDate()`: 날짜별 데이터 조회
- `savePlannerData()`: 데이터 저장
- `deletePlannerData()`: 데이터 삭제
- `createEmptyPlannerData()`: 빈 플래너 데이터 생성

## 🗄️ 데이터베이스 스키마

### Planner 모델

```prisma
model Planner {
  id        String   @id @default(cuid())
  date      String   @unique // YYYY-MM-DD 형식
  notes     String?  // 시간 관리 메모
  reflection String? // 반성/회고
  tasks     Task[]   // 할일 목록 (1:N 관계)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("planners")
}
```

**특징**:
- 날짜를 문자열로 저장 (`YYYY-MM-DD` 형식)
- `date` 필드가 유니크 키
- `tasks`와 1:N 관계 (Cascade 삭제)

### Task 모델

```prisma
model Task {
  id                 String  @id @default(cuid())
  plannerId          String
  planner            Planner @relation(fields: [plannerId], references: [id], onDelete: Cascade)
  title              String  @default("")
  timeSpan           Int     @default(30) // 소요 시간 (분 단위)
  isBig3             Boolean @default(false) // 빅3 선택 여부
  scheduledStartHour Int?    // 타임테이블 시작 시간 (0-23)
  scheduledStartMinute Int?  // 타임테이블 시작 분 (0, 30)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@map("tasks")
  @@index([plannerId])
}
```

**특징**:
- `plannerId`로 `Planner`와 연결
- `onDelete: Cascade`로 Planner 삭제 시 Task도 자동 삭제
- `scheduledStartHour/Minute`로 타임테이블 위치 저장

## 🔄 주요 기능 동작 원리

### 1. 날짜별 데이터 로드

```typescript
// PlannerView.tsx
useEffect(() => {
  const loadData = async () => {
    setIsLoading(true);
    try {
      const dateISO = formatDateToISO(date); // Date → "YYYY-MM-DD"
      const data = await getPlannerDataByDate(dateISO);
      setPlannerData(data || createEmptyPlannerData());
    } catch (error) {
      console.error("Error loading planner data:", error);
      setPlannerData(createEmptyPlannerData());
    } finally {
      setIsLoading(false);
    }
  };
  loadData();
}, [date]); // 날짜가 변경될 때마다 실행
```

### 2. 자동 저장

```typescript
// PlannerView.tsx
const handleSave = async () => {
  if (!plannerData) return;
  try {
    const dateISO = formatDateToISO(date);
    await savePlannerData(dateISO, plannerData);
  } catch (error) {
    console.error("Error saving planner data:", error);
  }
};

// 할일 추가/수정/삭제 시 자동으로 handleSave() 호출
const addTask = () => {
  // ... 상태 업데이트
  handleSave(); // 자동 저장
};
```

### 3. 드래그 앤 드롭

```typescript
// PlannerView.tsx
const handleDragStart = (taskId: string, index: number) => {
  setDraggedTask(taskId);
  setDraggedTaskIndex(index);
};

const handleDrop = (timeSlotIndex: number) => {
  if (!draggedTask || !plannerData) return;
  
  // 타임슬롯 인덱스를 시간으로 변환
  const startHour = Math.floor(timeSlotIndex / 2);
  const startMinute = (timeSlotIndex % 2) * 30;
  
  // 할일 업데이트
  updateTask(draggedTask, "scheduledTime", {
    startHour,
    startMinute,
  });
  
  // 드래그 상태 초기화
  setDraggedTask(null);
  setDraggedTaskIndex(null);
};
```

### 4. 데이터 변환 (DB ↔ 클라이언트)

**DB → 클라이언트**:
```typescript
// route.ts (GET)
const plannerData: PlannerData = {
  tasks: planner.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    timeSpan: task.timeSpan,
    isBig3: task.isBig3,
    scheduledTime:
      task.scheduledStartHour !== null && task.scheduledStartMinute !== null
        ? {
            startHour: task.scheduledStartHour,
            startMinute: task.scheduledStartMinute,
          }
        : undefined,
  })),
  todayTime: {
    notes: planner.notes || undefined,
    reflection: planner.reflection || undefined,
  },
};
```

**클라이언트 → DB**:
```typescript
// route.ts (POST)
await prisma.task.createMany({
  data: data.tasks.map((task) => ({
    plannerId: planner.id,
    title: task.title,
    timeSpan: task.timeSpan,
    isBig3: task.isBig3,
    scheduledStartHour: task.scheduledTime?.startHour ?? null,
    scheduledStartMinute: task.scheduledTime?.startMinute ?? null,
  })),
});
```

## 🎨 UI 컴포넌트 구조

### PlannerView 레이아웃

```
┌─────────────────────────────────────────┐
│  CalendarWidget  │  BackToToday        │
├──────────────────┼──────────────────────┤
│                  │                      │
│  할일 목록        │  타임테이블          │
│  (왼쪽)          │  (오른쪽)            │
│                  │                      │
│  - 할일 추가 버튼 │  - 24시간 표시      │
│  - 할일 목록      │  - 30분 단위 슬롯    │
│  - 빅3 체크박스   │  - 드래그 앤 드롭    │
│                  │                      │
└──────────────────┴──────────────────────┘
```

### 타임테이블 구조

- **시간 범위**: 00:00 ~ 23:30
- **슬롯 단위**: 30분
- **총 슬롯 수**: 48개 (24시간 × 2)
- **슬롯 인덱스**: 0 (00:00) ~ 47 (23:30)

**인덱스 → 시간 변환**:
```typescript
const hour = Math.floor(index / 2);      // 0-23
const minute = (index % 2) * 30;          // 0 또는 30
```

## 🔐 보안 및 에러 처리

### API 에러 처리

```typescript
// route.ts
try {
  // ... 처리 로직
} catch (error) {
  console.error("Error:", error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    { error: "Failed to ...", details: errorMessage },
    { status: 500 }
  );
}
```

### 클라이언트 에러 처리

```typescript
// storage.ts
export async function getPlannerDataByDate(date: string): Promise<PlannerData | null> {
  try {
    const response = await fetch(`/api/planner?date=${encodeURIComponent(date)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch planner data");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching planner data:", error);
    return null; // 에러 시 null 반환
  }
}
```

## 📊 데이터 저장 전략

### Upsert 패턴

플래너 데이터 저장 시 `upsert`를 사용하여:
- 데이터가 있으면 업데이트
- 데이터가 없으면 생성

```typescript
const planner = await prisma.planner.upsert({
  where: { date },
  update: { notes, reflection, updatedAt: new Date() },
  create: { date, notes, reflection },
});
```

### Task 동기화

기존 Task를 모두 삭제하고 새로 생성하는 방식:
- 장점: 간단하고 확실한 동기화
- 단점: 삭제 후 생성으로 인한 약간의 오버헤드

```typescript
// 기존 Task 삭제
await prisma.task.deleteMany({
  where: { plannerId: planner.id },
});

// 새 Task 생성
await prisma.task.createMany({
  data: data.tasks.map((task) => ({ ... })),
});
```

## 🔗 관련 파일

- `app/page.tsx`: 메인 페이지
- `app/components/PlannerView.tsx`: 플래너 뷰 컴포넌트
- `app/api/planner/route.ts`: REST API 엔드포인트
- `lib/db.ts`: Prisma Client 설정
- `lib/storage.ts`: 데이터 타입 및 API 함수
- `prisma/schema.prisma`: 데이터베이스 스키마

