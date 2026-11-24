import { redirect } from "next/navigation";
import { getProfileStatus, routeForStatus } from "@/lib/supabase/profile";
import { OnboardingWizard } from "./wizard";

export const metadata = {
  title: "Onboarding — PrivateSocial",
};

export default async function OnboardingPage() {
  const info = await getProfileStatus();
  if (!info) redirect("/login");

  // Se já completou onboarding, vai pra próxima etapa (verificação ou app)
  if (info.status.state !== "signup") {
    redirect(routeForStatus(info.status.state));
  }

  return <OnboardingWizard />;
}
