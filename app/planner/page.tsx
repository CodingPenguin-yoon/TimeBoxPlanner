import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { AccountMenu } from "../components/AccountMenu";
import { PlannerView } from "../components/PlannerView";
import { TodayRedirect } from "../components/TodayRedirect";
import { dateSchema } from "@/lib/planner-validation";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const date = dateSchema.safeParse(params.date);
  return <><AccountMenu email={user.email} />{date.success
    ? <PlannerView key={`${user.id}:${date.data}`} date={date.data} />
    : <TodayRedirect />}</>;
}
