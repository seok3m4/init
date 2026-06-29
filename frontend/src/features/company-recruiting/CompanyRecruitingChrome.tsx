import Image from "next/image";
import Link from "next/link";

type CompanyNavSection = "postings" | "recruitments" | "applicants" | "evaluation";

export function CompanyNav({ active }: { active: CompanyNavSection }) {
  const statusActive = active === "postings" || active === "applicants" || active === "evaluation";

  return (
    <header className="gnb">
      <div className="gnb-left">
        <Link className="brand" href="/company/applications/postings">
          <Image src="/logo-init.png" alt="init" width={1010} height={375} priority />
        </Link>
        <nav className="gnb-menu" aria-label="기업 메뉴">
          <div className={`gnb-item ${statusActive ? "active" : ""}`}>
            <Link className="gnb-link" href="/company/applications/postings" aria-current={statusActive ? "page" : undefined}>
              지원현황
            </Link>
            <div className="gnb-panel">
              <Link className={active === "postings" ? "active" : ""} href="/company/applications/postings">
                공고관리
              </Link>
              <Link className={active === "applicants" ? "active" : ""} href="/company/applications/postings">
                지원자 관리
              </Link>
              <Link className={active === "evaluation" ? "active" : ""} href="/company/applications/postings">
                평가 리포트
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
              <Link href="/company/recruitments">면접 관리</Link>
            </div>
          </div>
          <div className="gnb-item">
            <Link className="gnb-link" href="/company/applications/postings">
              마이페이지
            </Link>
          </div>
        </nav>
      </div>
      <div className="gnb-right">
        <button className="btn secondary compact" type="button">
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
