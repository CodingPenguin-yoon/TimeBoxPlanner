import { Suspense } from "react";
import { PlannerView } from "./components/PlannerView";
import { parseDateFromISO } from "@/lib/utils";
import { isValid } from "date-fns";
import { currentUser } from "@/auth";
import { redirect } from "next/navigation";
import { AccountMenu } from "./components/AccountMenu";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

/**
 * 메인 페이지 컴포넌트
 * - searchParams에서 date 쿼리 파라미터 읽기
 * - 기본값: 오늘 날짜 (date 파라미터가 없을 때)
 * - 로그인한 사용자의 날짜별 플래너를 API에서 로드
 */
export default async function Home({ searchParams }: PageProps) {
  const user = await currentUser();
  if (!user) redirect("/login");
  // searchParams가 Promise이므로 await 필요
  const params = await searchParams;
  const dateParam = params?.date;

  // 날짜 파싱 및 검증
  let selectedDate: Date;
  if (dateParam) {
    const parsed = parseDateFromISO(dateParam);
    if (parsed && isValid(parsed)) {
      selectedDate = parsed;
    } else {
      // 잘못된 날짜 형식이면 오늘로 기본값 사용
      selectedDate = new Date();
    }
  } else {
    // 날짜가 없으면 오늘 날짜 사용 (기본 동작)
    selectedDate = new Date();
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-lg text-muted-foreground">로딩 중...</div>
        </div>
      }
    >
      <AccountMenu email={user.email} />
      <PlannerView key={`${user.id}:${dateParam ?? "today"}`} date={selectedDate} />
    </Suspense>
  );
}
