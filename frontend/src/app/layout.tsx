import "../styles/global.css";

export const metadata = {
  title: "INIT",
  description: "AI interview recruiting platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
