import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="app auth">
      <section className="auth-wrap">
        <div className="form-card">
          <span className="eyebrow">INIT</span>
          <h2>init</h2>
          <p className="lead">T1/M1 인증 플로우를 시작합니다.</p>
          <Link className="btn primary full lg" href="/login">
            로그인하기
          </Link>
          <Link className="btn full lg" href="/company/applications/postings">
            기업 채용 관리로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
