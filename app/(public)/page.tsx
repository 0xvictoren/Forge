import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { LandingHero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FingerprintDemo } from "@/components/landing/fingerprint-demo";
import { CategoryRail } from "@/components/landing/category-rail";
import { CompliancePreview, FinalCta, Promises, VerifySection } from "@/components/landing/sections";
import { ReferralTracker } from "@/components/v2/referral-tracker";
import { AuthRedirectNotice } from "@/components/auth/auth-redirect-notice";

export default function LandingPage() {
  return (
    <AppFrame overHero bare>
      <Suspense fallback={null}>
        <ReferralTracker />
        <AuthRedirectNotice />
      </Suspense>
      <LandingHero />
      <Promises />
      <HowItWorks />
      <FingerprintDemo />
      <CategoryRail />
      <CompliancePreview />
      <VerifySection />
      <FinalCta />
    </AppFrame>
  );
}
