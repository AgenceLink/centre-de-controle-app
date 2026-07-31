"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePassword() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (pwd1 !== pwd2) { setError("les deux mots de passe ne correspondent pas"); return; }
    if (pwd1.length < 10) { setError("10 caractères minimum"); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, newPassword: pwd1 }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error === "invalid_current_password" ? "mot de passe actuel incorrect" : "changement impossible, réessaie");
        setBusy(false);
        return;
      }
      router.push("/");
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
            <h2>nouveau mot de passe</h2>
            <p className="sub">choisis ton mot de passe personnel (10 caractères minimum)</p>
          </div>
          <div className="field">
            <label htmlFor="current">mot de passe provisoire</label>
            <input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pwd1">nouveau mot de passe</label>
            <input id="pwd1" type="password" value={pwd1} onChange={(e) => setPwd1(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pwd2">confirme-le</label>
            <input id="pwd2" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? "enregistrement…" : "valider"}</button>
        </form>
      </div>
    </div>
  );
}
