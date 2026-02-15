
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../index.css";

export const metadata: Metadata = {
  title: "SoulBound",
  description: "Agentic dating platform",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
