import { PageShell } from "@/components/layout/page-shell";
import { LandingHero } from "@/components/landing/landing-hero";

export default function HomePage() {
  return (
    <PageShell showSearch={false}>
      <LandingHero />
    </PageShell>
  );
}
