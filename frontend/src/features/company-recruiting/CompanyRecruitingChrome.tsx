"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { GnbAvatar, GnbLogoutButton } from "../auth/GnbAccountControls";
import { COMPANY_MYPAGE_ROUTE } from "../company-profile/routes";
import { companyAccountBillingNav, companyNavLabels } from "./company-nav-config";

type CompanyNavSection = "postings" | "accountBilling";

export function CompanyNav({ active }: { active?: CompanyNavSection }) {
  const pathname = usePathname();
  const current = active ?? (pathname?.startsWith(COMPANY_MYPAGE_ROUTE) ? "accountBilling" : "postings");

  return (
    <header className="gnb">
      <div className="gnb-inner">
        <Link className="brand" href="/company/recruitments">
          <Image src="/logo-init.png" alt="init" width={1010} height={375} priority />
        </Link>
        <nav className="gnb-menu" aria-label="기업 메뉴">
          <div className={`gnb-item ${current === "postings" ? "active" : ""}`}>
            <Link className="gnb-link" href="/company/recruitments" aria-current={current === "postings" ? "page" : undefined}>
              {companyNavLabels.postings}
            </Link>
          </div>
          <div className={`gnb-item ${current === "accountBilling" ? "active" : ""}`}>
            <Link
              className="gnb-link"
              href={COMPANY_MYPAGE_ROUTE}
              aria-current={current === "accountBilling" ? "page" : undefined}
              aria-haspopup="true"
            >
              {companyNavLabels.accountBilling}
              <span className="gnb-caret" aria-hidden="true">⌄</span>
            </Link>
            <div className="gnb-panel">
              {companyAccountBillingNav.map((item) => {
                if (!("href" in item)) {
                  return (
                    <span className="disabled" key={item.label} aria-disabled="true">
                      {item.label}
                    </span>
                  );
                }
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link className={isActive ? "active" : ""} href={item.href} key={item.href} aria-current={isActive ? "page" : undefined}>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
        <div className="gnb-right">
          <GnbLogoutButton />
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
          <GnbAvatar accountLabel="기업 계정" />
        </div>
      </div>
    </header>
  );
}

type CrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: CrumbItem[] }) {
  return (
    <nav className="crumb" aria-label="현재 위치">
      {items.map((item, index) => (
        <span className="crumb-segment" key={`${item.label}-${index}`}>
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
          {index < items.length - 1 ? (
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
          ) : null}
        </span>
      ))}
    </nav>
  );
}

const SUCCESS_STATUSES = new Set(["OPEN", "PASS", "COMPLETED", "DONE", "GENERATED", "SENT", "DELIVERED"]);
const WARNING_STATUSES = new Set(["CLOSING_SOON", "HOLD", "IN_PROGRESS", "GENERATING", "PENDING", "REQUESTED"]);
const DANGER_STATUSES = new Set(["FAIL", "CLOSED", "FAILED", "REJECTED"]);
const NEUTRAL_STATUSES = new Set(["DRAFT", "ARCHIVED", "UNDECIDED", "NONE_OR_GENERATING"]);

const STATUS_LABELS: Record<string, string> = {
  OPEN: "모집중",
  DRAFT: "작성중",
  CLOSING_SOON: "마감임박",
  CLOSED: "마감",
  ARCHIVED: "보관",
};

export function StatusBadge({ value }: { value: string }) {
  const tone = SUCCESS_STATUSES.has(value)
    ? "success"
    : DANGER_STATUSES.has(value)
      ? "danger"
      : WARNING_STATUSES.has(value)
        ? "warning"
        : NEUTRAL_STATUSES.has(value)
          ? "neutral"
          : "info";
  return <span className={`badge ${tone}`}>{STATUS_LABELS[value] ?? value}</span>;
}
