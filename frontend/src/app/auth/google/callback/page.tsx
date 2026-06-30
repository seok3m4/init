"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDefaultEntryPath, refreshAuthSession } from "@/api/client";
import { useAuth } from "@/features/auth/AuthProvider";

export default function GoogleOAuthCallbackPage() {
  const router = useRouter();
  const { completeLogin } = useAuth();
  const startedRef = useRef(false);
  const [message, setMessage] = useState("Completing Google login...");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let canceled = false;

    async function completeGoogleLogin() {
      try {
        const session = await refreshAuthSession();
        if (canceled) return;
        completeLogin(session);
        router.replace(getDefaultEntryPath(session.user.userType));
      } catch {
        if (canceled) return;
        setMessage("Google login failed. Please try again.");
        router.replace("/login");
      }
    }

    void completeGoogleLogin();

    return () => {
      canceled = true;
    };
  }, [completeLogin, router]);

  return (
    <main className="app auth">
      <section className="auth-wrap">
        <div className="form-card">
          <span className="eyebrow">GOOGLE OAUTH</span>
          <h2>Completing login</h2>
          <p className="lead">{message}</p>
        </div>
      </section>
    </main>
  );
}
