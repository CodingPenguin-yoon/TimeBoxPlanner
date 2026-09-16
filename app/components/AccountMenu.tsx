import { signOut } from "@/auth";

export function AccountMenu({ email }: { email?: string | null }) {
  return <div className="flex items-center justify-end gap-3 border-b px-4 py-2 text-sm">
    <span className="truncate text-muted-foreground">{email}</span>
    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
      <button className="whitespace-nowrap rounded-md border px-3 py-1 hover:bg-muted">로그아웃</button>
    </form>
  </div>;
}
