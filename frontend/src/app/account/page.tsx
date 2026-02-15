"use client";

import dynamic from "next/dynamic";

const AccountAuth = dynamic(() => import("../../pages/AccountAuth"), {
  ssr: false,
});

export default function AccountPage() {
  return <AccountAuth />;
}
