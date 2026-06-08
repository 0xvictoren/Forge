import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  redirect("/home");
}
