import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-page">
      <section className="page-head">
        <div>
          <p className="eyebrow">COMPANY RECRUITING</p>
          <h1>기업 채용 흐름</h1>
          <p>공고 생성부터 지원자 등록까지 B 역할 최소 happy path를 확인합니다.</p>
        </div>
        <Link className="btn primary" href="/company/applications/postings">
          공고 목록
        </Link>
      </section>
    </main>
  );
}
