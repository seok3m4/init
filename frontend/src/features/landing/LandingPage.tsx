import Image from "next/image";
import Link from "next/link";

const featureCards = [
  {
    title: "더 많은 기회",
    description: "면접 자원의 한계 없이 더 많은 지원자에게 면접 기회를 제공합니다.",
    icon: (
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
  {
    title: "1차 검증 자동화",
    description: "서류와 면접을 기반으로 1차 검증을 자동화해 채용 운영 시간을 줄입니다.",
    icon: (
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4 12 14.01l-3-3" />
      </svg>
    ),
  },
  {
    title: "근거 기반 리포트",
    description: "점수마다 답변과 서류 근거를 함께 제시하는 AI 평가 리포트를 제공합니다.",
    icon: (
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 15l2 2 4-4" />
      </svg>
    ),
  },
];

const reportBars = [
  { label: "문제 해결", score: "92%", width: "92%" },
  { label: "기술 깊이", score: "84%", width: "84%" },
  { label: "커뮤니케이션", score: "76%", width: "76%" },
  { label: "협업 태도", score: "88%", width: "88%" },
];

export function LandingPage() {
  return (
    <main className="app auth landing-page">
      <div className="landing-glow landing-glow-a" />
      <div className="landing-glow landing-glow-b" />
      <div className="landing-glow landing-glow-c" />

      <nav aria-label="랜딩 내비게이션" className="landing-nav">
        <Link aria-label="init 홈" className="landing-logo" href="/">
          <Image alt="init" height={32} priority src="/logo-init.png" width={86} />
        </Link>
        <div className="landing-links">
          <a href="#service">서비스 소개</a>
          <a href="#features">핵심 기능</a>
          <Link className="landing-btn landing-btn-dark" href="/login">
            로그인
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <span className="landing-eyebrow">AI INTERVIEW PLATFORM</span>
        <h1>
          <em>init</em>
        </h1>
        <p>인터뷰를 잇다.</p>
        <div className="landing-cta">
          <Link className="landing-btn landing-btn-dark landing-btn-lg" href="/login">
            로그인하기
          </Link>
          <a className="landing-btn landing-btn-pill landing-btn-lg" href="#service">
            서비스 둘러보기
          </a>
        </div>
      </section>


      <section className="landing-section" id="service">
        <h2>init은 무엇을 하나요</h2>
        <div className="landing-mini-grid">
          <article className="landing-mini">
            <p className="landing-mini-caption">AI INTERVIEW</p>
            <div className="landing-mini-inner">
              <div className="landing-bubble landing-bubble-ai">최근 프로젝트에서 가장 어려웠던 기술적 문제는 무엇이었나요?</div>
              <div className="landing-bubble landing-bubble-user">Redis Queue로 비동기 리포트 파이프라인을 설계했고...</div>
              <p className="landing-recording">
                <span />
                답변 녹화 중 · 01:24
              </p>
            </div>
          </article>

          <article className="landing-mini">
            <p className="landing-mini-caption">AI REPORT</p>
            <div className="landing-mini-inner landing-report">
              {reportBars.map((bar) => (
                <div className="landing-bar-row" key={bar.label}>
                  <span className="landing-bar-name">{bar.label}</span>
                  <span className="landing-bar-track">
                    <span style={{ width: bar.width }} />
                  </span>
                  <strong>{bar.score}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="landing-section landing-feature-section" id="features">
        <h2>채용 경험을 더 선명하게</h2>
        <div className="landing-feature-grid">
          {featureCards.map((feature) => (
            <article className="landing-feature" key={feature.title}>
              <div className="landing-feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-closing">
        <h2>지금 init에서 첫 면접을 시작하세요</h2>
        <Link className="landing-btn landing-btn-pill landing-btn-lg" href="/login">
          로그인하기
        </Link>
      </section>
    </main>
  );
}
