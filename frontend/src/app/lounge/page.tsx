"use client";

import dynamic from "next/dynamic";

const AgentLounge = dynamic(() => import("../../pages/AgentLounge"), {
  ssr: false,
});

export default function LoungePage() {
  return <AgentLounge />;
}
