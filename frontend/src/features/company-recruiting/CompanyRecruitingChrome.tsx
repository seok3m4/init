import Image from "next/image";
import Link from "next/link";

type CompanyNavSection = "postings" | "mypage";
export type CompanyFlowStep = "list" | "create" | "dashboard" | "settings" | "applicants" | "evaluation";

const flowSteps: Array<{ key: CompanyFlowStep; label: string; description: string }> = [
  { key: "list", label: "공고 목록", description: "공고 선택" },
  { key: "create", label: "공고 생성", description: "JD 등록" },
  { key: "dashboard", label: "대시보드", description: "운영 현황" },
  { key: "settings", label: "공고 설정", description: "정보 수정" },
  { key: "applicants", label: "지원자 관리", description: "등록/초대" },
  { key: "evaluation", label: "평가 상세", description: "리포트 확인" },
];

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

export function CompanyFlowSteps({ current }: { current: CompanyFlowStep }) {
  const currentIndex = flowSteps.findIndex((step) => step.key === current);

  return (
    <nav className="flow-steps" aria-label="기업 채용 흐름">
      {flowSteps.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <div className={`flow-step ${state}`} key={step.key} aria-current={state === "current" ? "step" : undefined}>
            <span className="flow-step-number">{index + 1}</span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </span>
          </div>
        );
      })}
    </nav>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = value === "OPEN" ? "success" : value === "DRAFT" ? "neutral" : "warning";
  return <span className={`badge ${tone}`}>{value}</span>;
}
