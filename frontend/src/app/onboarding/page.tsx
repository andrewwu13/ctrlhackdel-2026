
"use client";

import dynamic from "next/dynamic";


const Onboarding = dynamic(() => import("../../pages/Onboarding"), {
  ssr: false,
});


export default function OnboardingPage() {
  return <Onboarding />;
}

