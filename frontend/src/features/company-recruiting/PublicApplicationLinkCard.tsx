"use client";

import { useEffect, useState } from "react";

import { getPublicApplicationLinkState } from "./public-application-link";
import type { Recruitment } from "./types";

type PublicApplicationLinkCardProps = {
  recruitment: Recruitment;
};

export function PublicApplicationLinkCard({ recruitment }: PublicApplicationLinkCardProps) {
  const [origin, setOrigin] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const state = getPublicApplicationLinkState(recruitment, origin);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function handleCopy() {
    setCopyMessage("");
    if (!state.isAvailable) {
      setCopyMessage("OPEN 공고만 복사할 수 있습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(state.url);
      setCopyMessage("공개 지원 링크가 복사되었습니다.");
    } catch {
      setCopyMessage("브라우저에서 복사를 허용하지 않았습니다. 링크를 직접 선택해 복사해주세요.");
    }
  }

  return (
    <section className="panel public-link-panel">
      <div className="panel-head">
        <div>
          <h2>공개 지원 링크</h2>
          <p>외부 채용사이트에는 이 공개 링크를 게시하고, 이메일 인증 magic link는 후속 연동합니다.</p>
        </div>
        <span className={state.isAvailable ? "public-link-status is-open" : "public-link-status"}>
          {state.statusLabel}
        </span>
      </div>

      <div className="public-link-box">
        <input aria-label="공개 지원 링크" readOnly value={state.url} />
        <div className="public-link-actions">
          <button className="btn primary" type="button" disabled={!state.isAvailable} onClick={() => void handleCopy()}>
            링크 복사
          </button>
        </div>
      </div>

      <p className="public-link-helper">{copyMessage || state.helperText}</p>
    </section>
  );
}
