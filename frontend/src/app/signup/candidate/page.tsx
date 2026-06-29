import { SignupForm } from "../../../features/auth/AuthForms";

export default function CandidateSignupPage() {
  return (
    <main className="app auth">
      <section className="auth-wrap">
        <SignupForm userType="CANDIDATE" />
      </section>
    </main>
  );
}
