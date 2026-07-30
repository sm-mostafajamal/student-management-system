/**
 * Root page — shown when no session cookie is set.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/role";
import { LandingRolePicker } from "@/components/shared/landing-role-picker";

export default async function RootPage() {
  const session = await getSessionUser();

  // if (session) {
  //   redirect("/dashboard");
  // }

  return <LandingRolePicker />;
}