import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "init company recruiting",
  description: "Company recruiting happy path",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
