import { SignupChoice } from "@/features/auth/AuthForms";

export default function SignupPage() {
  return (
    <main className="app auth">
      <section className="auth-wrap">
        <SignupChoice />
      </section>
    </main>
  );
}
