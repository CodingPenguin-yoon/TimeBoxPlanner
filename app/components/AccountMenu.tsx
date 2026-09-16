import Link from "next/link";
import { signOut } from "@/auth";
import { Layers2, LogOut } from "lucide-react";

export function AccountMenu({ email }: { email?: string | null }) {
  return <div className="border-b bg-card/80">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
      <Link href="/" className="flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Layers2 className="h-4 w-4" /></span>Timebox<span className="hidden font-normal text-muted-foreground sm:inline">Planner</span></Link>
      <div className="flex min-w-0 items-center gap-3 text-xs">
    <Link href="/planner" className="shrink-0 rounded-lg px-2 py-2 hover:bg-muted">플래너</Link>
    <span className="max-w-28 truncate text-muted-foreground sm:max-w-64">{email}</span>
    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
      <button aria-label="로그아웃" className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-muted-foreground hover:bg-muted"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">로그아웃</span></button>
    </form>
      </div>
    </div>
  </div>;
}
