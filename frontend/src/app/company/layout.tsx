import { CompanyNav } from "@/features/company-recruiting/CompanyRecruitingChrome";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <CompanyNav active="postings" />
      {children}
    </main>
  );
}
