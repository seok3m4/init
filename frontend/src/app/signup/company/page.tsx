import { SignupForm } from "@/features/auth/AuthForms";

export default function CompanySignupPage() {
  return (
    <main className="app auth">
      <section className="auth-wrap">
        <SignupForm userType="COMPANY" />
      </section>
    </main>
  );
}
