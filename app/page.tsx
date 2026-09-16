import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { AccountMenu } from "./components/AccountMenu";
import { Dashboard } from "./components/Dashboard";
import { dateSchema } from "@/lib/planner-validation";

export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { date } = await searchParams;
  // Preserve bookmarks to the previous planner route.
  if (dateSchema.safeParse(date).success) redirect(`/planner?date=${date}`);
  return <><AccountMenu email={user.email} /><Dashboard key={user.id} name={user.name} /></>;
}
