"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, setAccessToken, UserType } from "../../api/client";

const nextPath = {
  COMPANY: "/company/applications/dashboard",
  CANDIDATE: "/candidate/mock-interview/start",
} as const;

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="inline">
        <input
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
        />
        <button type="button" className="pw-toggle" onClick={() => setVisible((prev) => !prev)}>
          {visible ? "숨기기" : "보기"}
        </button>
      </div>
    </div>
  );
}

function StatusMessage({ message, ok }: { message: string; ok?: boolean }) {
  return message ? <p className={`message ${ok ? "success" : ""}`}>{message}</p> : null;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>("COMPANY");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const result = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ userType, email, password }),
      });
      setAccessToken(result.accessToken);
      router.push(nextPath[userType]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    }
  }

  async function googleLogin() {
    setMessage("");
    try {
      const result = await apiFetch<{ authorizationUrl: string }>(`/auth/google?userType=${userType}`);
      window.location.href = result.authorizationUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google 로그인을 시작할 수 없습니다.");
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <span className="eyebrow">WELCOME BACK</span>
      <h2>init 로그인</h2>
      <p className="lead">계정 유형을 선택하고 로그인하세요.</p>

      <div className="field">
        <span className="label">로그인 사용자 유형</span>
        <div className="segment" aria-label="로그인 사용자 유형">
          <button type="button" className={userType === "COMPANY" ? "active" : ""} onClick={() => setUserType("COMPANY")}>
            기업
          </button>
          <button type="button" className={userType === "CANDIDATE" ? "active" : ""} onClick={() => setUserType("CANDIDATE")}>
            지원자
          </button>
        </div>
      </div>

      <label className="field">
        <span className="label">이메일</span>
        <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
      </label>
      <PasswordField label="비밀번호" value={password} onChange={setPassword} autoComplete="current-password" />

      <div className="link-row">
        <button type="button" onClick={() => router.push("/password/reset")}>
          ID / 비밀번호 찾기
        </button>
        <button type="button" onClick={() => router.push("/signup")}>
          회원가입
        </button>
      </div>

      <StatusMessage message={message} />
      <button className="btn primary full lg" type="submit">
        로그인
      </button>

      {userType === "CANDIDATE" ? (
        <>
          <div className="divider">또는</div>
          <button className="btn full lg" type="button" onClick={googleLogin}>
            <GoogleIcon /> Google로 로그인
          </button>
        </>
      ) : null}

      <div className="note">기업 로그인 → 지원현황 · 지원자 로그인 → AI 모의면접</div>
    </form>
  );
}

export function SignupChoice() {
  const router = useRouter();
  const [selected, setSelected] = useState<UserType>("COMPANY");

  return (
    <section className="form-card wide">
      <span className="eyebrow">JOIN INIT</span>
      <h2>회원가입</h2>
      <p className="lead">어떤 유형으로 가입하시나요?</p>

      <div className="choice-grid" aria-label="회원가입 유형 선택">
        <button type="button" className={`choice ${selected === "COMPANY" ? "sel" : ""}`} onClick={() => setSelected("COMPANY")}>
          <span className="ck">✓</span>
          <span className="ico" aria-hidden="true">
            □
          </span>
          <h4>기업 회원가입</h4>
          <p>채용 프로젝트 운영, 지원자 초대 및 평가 리포트 확인</p>
        </button>
        <button type="button" className={`choice ${selected === "CANDIDATE" ? "sel" : ""}`} onClick={() => setSelected("CANDIDATE")}>
          <span className="ck">✓</span>
          <span className="ico" aria-hidden="true">
            ○
          </span>
          <h4>지원자 회원가입</h4>
          <p>AI 모의면접 연습, 채용 AI 면접 응시</p>
        </button>
      </div>

      <button className="btn primary full lg" type="button" onClick={() => router.push(selected === "COMPANY" ? "/signup/company" : "/signup/candidate")}>
        다음
      </button>
    </section>
  );
}

export function SignupForm({ userType }: { userType: UserType }) {
  const router = useRouter();
  const isCompany = userType === "COMPANY";
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    email: "",
    code: "",
    password: "",
    passwordConfirm: "",
    termsAgreed: false,
  });
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  function update(name: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function sendCode() {
    setMessage("");
    try {
      await apiFetch("/auth/email/send-code", { method: "POST", body: JSON.stringify({ email: form.email }) });
      setOk(true);
      setMessage("인증 코드를 발송했습니다.");
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "인증 코드 발송에 실패했습니다.");
    }
  }

  async function verifyCode() {
    setMessage("");
    try {
      await apiFetch("/auth/email/verify-code", { method: "POST", body: JSON.stringify({ email: form.email, code: form.code }) });
      setOk(true);
      setMessage("이메일 인증이 완료되었습니다.");
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "인증 확인에 실패했습니다.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await apiFetch(isCompany ? "/auth/signup/company" : "/auth/signup/candidate", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push("/login");
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "가입에 실패했습니다.");
    }
  }

  return (
    <form className="form-card wide" onSubmit={submit}>
      <span className="eyebrow">{isCompany ? "COMPANY" : "CANDIDATE"}</span>
      <h2>{isCompany ? "기업 회원가입" : "지원자 회원가입"}</h2>
      <p className="lead">{isCompany ? "담당자 정보와 회사명을 입력하세요." : "이메일 인증 후 비밀번호를 설정하세요."}</p>

      <div className={isCompany ? "grid-2" : undefined}>
        <label className="field">
          <span className="label">{isCompany ? "담당자 이름" : "이름"}</span>
          <input
            className="input"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            autoComplete="name"
            placeholder={isCompany ? "담당자 이름 입력" : "이름 입력"}
            required
          />
        </label>
        {isCompany ? (
          <label className="field">
            <span className="label">회사명</span>
            <input className="input" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="회사명 입력" required />
          </label>
        ) : null}
      </div>

      <div className="field">
        <span className="label">이메일</span>
        <div className="inline">
          <input
            className="input"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            type="email"
            autoComplete="email"
            placeholder={isCompany ? "company@example.com" : "email@example.com"}
            required
          />
          <button type="button" className="btn" onClick={sendCode}>
            인증 메일 발송
          </button>
        </div>
      </div>

      <div className="field">
        <span className="label">인증 코드</span>
        <div className="inline">
          <input className="input" value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="인증 코드 입력" required />
          <button type="button" className="btn" onClick={verifyCode}>
            인증 확인
          </button>
        </div>
      </div>

      <div className="grid-2">
        <PasswordField label="비밀번호" value={form.password} onChange={(value) => update("password", value)} autoComplete="new-password" />
        <PasswordField
          label="비밀번호 확인"
          value={form.passwordConfirm}
          onChange={(value) => update("passwordConfirm", value)}
          autoComplete="new-password"
        />
      </div>

      <div className="field">
        <label className="tag">
          <input type="checkbox" checked={form.termsAgreed} onChange={(event) => update("termsAgreed", event.target.checked)} required />
          필수 약관에 모두 동의합니다
        </label>
      </div>

      <StatusMessage message={message} ok={ok} />
      <button className="btn primary full lg" type="submit">
        가입하기
      </button>
    </form>
  );
}

export function PasswordResetForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", code: "", password: "", passwordConfirm: "" });
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  function update(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function sendCode() {
    setMessage("");
    try {
      await apiFetch("/auth/password/send-code", { method: "POST", body: JSON.stringify({ email: form.email }) });
      setOk(true);
      setMessage("인증 코드를 발송했습니다.");
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "인증 코드 발송에 실패했습니다.");
    }
  }

  async function verifyCode() {
    setMessage("");
    try {
      await apiFetch("/auth/password/verify-code", { method: "POST", body: JSON.stringify({ email: form.email, code: form.code }) });
      setOk(true);
      setMessage("인증이 완료되었습니다.");
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "인증 확인에 실패했습니다.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await apiFetch("/auth/password/reset", { method: "POST", body: JSON.stringify(form) });
      router.push("/login");
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "비밀번호 재설정에 실패했습니다.");
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <span className="eyebrow">RESET PASSWORD</span>
      <h2>비밀번호 재설정</h2>
      <p className="lead">가입 이메일로 인증 후 새 비밀번호를 설정합니다.</p>

      <div className="field">
        <span className="label">가입 이메일</span>
        <div className="inline">
          <input className="input" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" autoComplete="email" placeholder="email@example.com" required />
          <button type="button" className="btn" onClick={sendCode}>
            코드 발송
          </button>
        </div>
      </div>

      <div className="field">
        <span className="label">인증 코드</span>
        <div className="inline">
          <input className="input" value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="인증 코드 입력" required />
          <button type="button" className="btn" onClick={verifyCode}>
            인증 확인
          </button>
        </div>
      </div>

      <PasswordField label="새 비밀번호" value={form.password} onChange={(value) => update("password", value)} autoComplete="new-password" />
      <PasswordField
        label="새 비밀번호 확인"
        value={form.passwordConfirm}
        onChange={(value) => update("passwordConfirm", value)}
        autoComplete="new-password"
      />

      <div className="note">보기를 누르면 가려진 비밀번호 입력값을 잠깐 확인할 수 있습니다.</div>
      <StatusMessage message={message} ok={ok} />
      <button className="btn primary full lg reset-submit" type="submit">
        비밀번호 재설정
      </button>
    </form>
  );
}
