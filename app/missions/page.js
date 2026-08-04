"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { agentTheme } from "@/lib/agentTheme";
import { IconArrowRight, IconClock, IconBolt } from "@/lib/icons";

function timeAgo(iso) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (isNaN(s)) return "—";
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

function MissionCard({ m }) {
  const theme = agentTheme(m.agent_id);
  const running = m.is_running;
  const last = m.last_run;
  const statusStyle = running
    ? { background: `${theme.color}18`, color: theme.colorDark }
    : last?.status === "success"
    ? { background: "rgba(46, 158, 91, 0.1)", color: "#2E9E5B" }
    : last?.status === "error"
    ? { background: "rgba(214,69,69,0.08)", color: "#D64545" }
    : { background: "rgba(146, 146, 146, 0.14)", color: "#5E5E5E" };
  const statusLabel = running ? "en cours d'exécution" : last?.status === "success" ? "dernier run réussi" : last?.status === "error" ? "dernier run en échec" : "aucun run";

  return (
    <Link href={`/missions/${m.mission_key}`} className="card agent-card">
      <div className="agent-card-head">
        <div className="mascot-wrap">
          <div className="mascot-ring" style={{ width: 48, height: 48, border: `2.5px solid ${theme.color}` }}>
            <span style={{ fontSize: 20 }}>🎯</span>
          </div>
        </div>
        <div>
          <div className="agent-card-name">{m.name || m.mission_key}</div>
          <div className="agent-card-role">{m.reference_only ? "mission de référence" : `mission ${theme.number ? "n°" + theme.number : ""} · ${m.agent_id}`}</div>
        </div>
      </div>

      <span className="status-pill" style={statusStyle}>
        {running ? <IconBolt size={11} /> : <span className="dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />}
        {statusLabel}
      </span>

      <div className="chip-row">
        <span className="stat-chip"><IconClock size={12} />{m.reference_only ? "pas de planning" : (m.base_times || "—")}</span>
        <span className="stat-chip">{last ? timeAgo(last.started_at) : "jamais exécutée"}</span>
        <span className="stat-chip mono">v{m.instructions_version ?? "—"}</span>
      </div>

      <button className="btn-primary" style={{ background: theme.color, border: "none", color: "#fff", width: "100%" }} tabIndex={-1}>
        voir la mission <IconArrowRight size={14} />
      </button>
    </Link>
  );
}

export default function MissionsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      if (json.ok) { setData(json); setError(null); } else setError(json.error || "erreur");
    } catch {
      setError("réseau indisponible");
    }
  }, [router]);

  useEffect(() => {
    load();
    let t = setInterval(load, 45000);
    const onVis = () => {
      clearInterval(t);
      if (document.visibilityState === "visible") { load(); t = setInterval(load, 45000); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  const terrain = data ? data.missions.filter((m) => !m.reference_only) : [];
  const reference = data ? data.missions.filter((m) => m.reference_only) : [];

  return (
    <div className="page">
      <div className="topbar">
        <Link href="/" className="brand">
          <img src="/logo-link.png" alt="Link" />
          <h1>centre de <span>contrôle</span></h1>
        </Link>
        <div className="viewer">
          {data?.viewer && (
            <>
              <span>{data.viewer.name}</span>
              <span className="role-chip">{data.viewer.role}</span>
              <Link href="/planning" className="btn-ghost admin-link">📅 planning</Link>
              {data.viewer.role === "admin" && (
                <Link href="/users" className="btn-ghost admin-link">👥 utilisateurs</Link>
              )}
            </>
          )}
          <button className="btn-ghost" onClick={logout}>déconnexion</button>
        </div>
      </div>
      <div className="vague-strip" />

      <Link href="/" className="back-link">← vue d'ensemble</Link>

      {error && <p className="form-error">{error} — nouvelle tentative dans 15 s</p>}
      {!data && !error && <p style={{ color: "var(--texte)" }}>chargement…</p>}

      {data && (
        <>
          <div className="block-sub-title" style={{ marginBottom: 12 }}>🎯 missions de zizou</div>

          {terrain.length === 0 ? (
            <p className="no-results">
              {data.missions.length === 0
                ? "aucune mission ne vous est accessible pour l'instant — contactez un administrateur."
                : "aucune mission terrain trouvée"}
            </p>
          ) : (
            <div className="grid">
              {terrain.map((m) => <MissionCard key={m.mission_key} m={m} />)}
            </div>
          )}

          {reference.length > 0 && (
            <>
              <div className="block-sub-title" style={{ marginTop: 28, marginBottom: 12 }}>📖 missions de référence</div>
              <div className="grid">
                {reference.map((m) => <MissionCard key={m.mission_key} m={m} />)}
              </div>
            </>
          )}
        </>
      )}

      <p className="footer-note">actualisation automatique toutes les 45 secondes · données servies par le registre n8n</p>
    </div>
  );
}
