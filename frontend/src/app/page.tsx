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
        </div>
      </section>
    </main>
  );
}
