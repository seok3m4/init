import Image from "next/image";
import Link from "next/link";

type CompanyNavSection = "postings" | "recruitments" | "applicants" | "evaluation";

export function CompanyNav({ active }: { active: CompanyNavSection }) {
  const statusActive = active === "postings" || active === "applicants" || active === "evaluation";

  return (
    <header className="gnb">
      <Link className="brand" href="/company/applications/dashboard">
        <Image src="/logo-init.png" alt="init" width={1010} height={375} priority />
        <span className="brand-sub">기업 채용 콘솔</span>
      </Link>
      <nav className="gnb-menu" aria-label="기업 메뉴">
        <div className={`gnb-item ${statusActive ? "active" : ""}`}>
          <Link className="gnb-link" href="/company/applications/dashboard" aria-current={statusActive ? "page" : undefined}>
            지원현황
          </Link>
          <div className="gnb-panel">
            <Link className={active === "postings" ? "active" : ""} href="/company/applications/dashboard">
              공고 관리
            </Link>
          </div>
        </div>
        <div className={`gnb-item ${active === "recruitments" ? "active" : ""}`}>
          <Link
            className="gnb-link"
            href="/company/recruitments"
            aria-current={active === "recruitments" ? "page" : undefined}
          >
            채용관리
          </Link>
          <div className="gnb-panel">
            <Link className={active === "recruitments" ? "active" : ""} href="/company/recruitments">
              채용 공고 관리
            </Link>
            {/* 면접 관리: C 담당 범위. 전용 route 미구현 상태이므로 안전한 placeholder 유지 */}
            <span className="gnb-soon" aria-disabled="true" title="준비 중">
              면접 관리
            </span>
          </div>
        </div>
        <div className="gnb-item">
          {/* 마이페이지: 기능 정의서상 기업 상세 경로 미확정. placeholder 유지 */}
          <span className="gnb-link gnb-soon" aria-disabled="true" title="준비 중">
            마이페이지
          </span>
        </div>
      </nav>
      <div className="gnb-right">
        <span className="gnb-right-label">계정</span>
        <button className="gnb-chip" type="button">
          알림
        </button>
        <div className="avatar" aria-label="기업 계정">
          김
        </div>
      </div>
    </header>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = value === "OPEN" ? "success" : value === "DRAFT" ? "neutral" : "warning";
  return <span className={`badge ${tone}`}>{value}</span>;
}
