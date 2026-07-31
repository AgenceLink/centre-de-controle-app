"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error === "invalid_credentials" ? "email ou mot de passe incorrect" : "connexion impossible, réessaie");
        setBusy(false);
        return;
      }
      router.push(json.must_change_password ? "/change-password" : "/");
    } catch {
      setError("réseau indisponible");
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-visual" />
      <div className="login-panel">
        <form className="login-box" onSubmit={submit}>
          <img src="/logo-link.png" alt="Link" />
          <div>
            <h2>centre de contrôle</h2>
            <p className="sub">pilotage des agents ia de l'agence</p>
          </div>
          <div className="field">
            <label htmlFor="email">email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">mot de passe</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? "connexion…" : "se connecter"}</button>
        </form>
      </div>
    </div>
  );
}
