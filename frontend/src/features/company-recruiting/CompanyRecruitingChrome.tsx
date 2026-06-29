import Image from "next/image";
import Link from "next/link";

export function CompanyNav({ active }: { active: "dashboard" | "recruitments" }) {
  return (
    <header className="gnb">
      <Link className="brand" href="/company/recruitments">
        <Image src="/logo-init.png" alt="init" width={1010} height={375} priority />
      </Link>
      <nav>
        <Link className={active === "dashboard" ? "active" : ""} href="/company/recruitments">
          지원현황
        </Link>
        <Link className={active === "recruitments" ? "active" : ""} href="/company/recruitments">
          채용관리
        </Link>
      </nav>
    </header>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = value === "OPEN" ? "success" : value === "DRAFT" ? "neutral" : "warning";
  return <span className={`badge ${tone}`}>{value}</span>;
}
