import { LoginForm } from "@/features/auth/AuthForms";

export default function LoginPage() {
  return (
    <main className="app auth">
      <section className="auth-wrap">
        <LoginForm />
      </section>
    </main>
  );
}
