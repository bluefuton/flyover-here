import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Flyover Here — What’s up?",
  description:
    "Look up. Discover the nearest aircraft above you, one flight at a time.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
