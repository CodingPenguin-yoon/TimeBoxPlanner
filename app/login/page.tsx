import { auth, currentUser, signIn, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function Login({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/");
  const session = await auth();
  const { error } = await searchParams;
  const configured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <section className="w-full max-w-sm space-y-6 rounded-2xl border bg-background p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Timebox Planner</p>
          <h1 className="text-2xl font-semibold">나의 하루를 계획하세요</h1>
          <p className="text-sm leading-6 text-muted-foreground">로그인하면 나만의 할 일과 일정을 저장하고 다른 기기에서도 이어서 사용할 수 있어요.</p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">
          {error === "AccessDenied" ? "이 계정은 아직 이용할 수 없습니다. 허용된 Google 계정으로 로그인해 주세요." : "로그인을 완료하지 못했습니다. 다시 시도해 주세요."}
        </p>}
        {!configured && <p role="alert" className="text-sm text-muted-foreground">로그인 준비 중입니다. 잠시 후 다시 방문해 주세요.</p>}
        {session && <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <p className="mb-3 text-sm">현재 계정은 이용 권한이 없습니다.</p>
          <button className="text-sm underline">로그아웃하고 다른 계정 사용</button>
        </form>}
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
          <button disabled={!configured} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">Google로 시작하기</button>
        </form>
      </section>
    </main>
  );
}
