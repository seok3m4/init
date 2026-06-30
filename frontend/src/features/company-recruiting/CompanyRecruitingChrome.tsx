import Image from "next/image";
import Link from "next/link";

type CompanyNavSection = "postings" | "mypage";

export function CompanyNav({ active }: { active: CompanyNavSection }) {
  return (
    <header className="gnb">
      <div className="gnb-inner">
        <Link className="brand" href="/company/recruitments">
          <Image src="/logo-init.png" alt="init" width={1010} height={375} priority />
        </Link>
        <nav className="gnb-menu" aria-label="기업 메뉴">
          <div className={`gnb-item ${active === "postings" ? "active" : ""}`}>
            <Link className="gnb-link" href="/company/recruitments" aria-current={active === "postings" ? "page" : undefined}>
              공고 목록
            </Link>
          </div>
          <div className={`gnb-item ${active === "mypage" ? "active" : ""}`}>
            <span className="gnb-link gnb-soon" aria-disabled="true" title="준비 중">
              마이페이지
            </span>
          </div>
        </nav>
        <div className="gnb-right">
          <button className="icon-btn" type="button" aria-label="알림">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <div className="avatar" aria-label="기업 계정">
            김
          </div>
        </div>
      </div>
    </header>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = value === "OPEN" ? "success" : value === "DRAFT" ? "neutral" : "warning";
  return <span className={`badge ${tone}`}>{value}</span>;
}
