"use client";

import dynamic from "next/dynamic";

const ProfilePage = dynamic(() => import("../../pages/Profile"), {
  ssr: false,
});

export default function ProfileRoutePage() {
  return <ProfilePage />;
}
