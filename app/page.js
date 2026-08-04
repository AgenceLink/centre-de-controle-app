"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { agentTheme } from "@/lib/agentTheme";
import { IconArrowRight, IconClock, IconChartBar, IconBolt } from "@/lib/icons";

function timeAgo(iso) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (isNaN(s)) return "—";
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

function AgentCard({ a }) {
  const theme = agentTheme(a.agent_id);
  const running = a.is_running;
  const hasErrors = a.errors_24h > 0;
  const statusStyle = running
    ? { background: `${theme.color}18`, color: theme.colorDark }
    : a.status === "active"
    ? { background: "rgba(46, 158, 91, 0.1)", color: "#2E9E5B" }
    : { background: "rgba(146, 146, 146, 0.14)", color: "#5E5E5E" };
  const statusLabel = running ? "en cours d'exécution" : a.status === "active" ? "actif" : "en pause";
  const last = a.last_run;
  const Icon = theme.Icon;

  return (
    <Link href={`/agents/${a.agent_id}`} className="card agent-card">
      <div className="agent-card-head">
        <div className="mascot-wrap">
          <div className="mascot-ring" style={{ width: 56, height: 56, border: `2.5px solid ${theme.color}` }}>
            {theme.mascot ? (
              <img src={theme.mascot} alt="" />
            ) : (
              <span style={{ fontSize: 22 }}>🤖</span>
            )}
          </div>
          <div className="mascot-badge" style={{ width: 20, height: 20, borderColor: theme.color, color: theme.color }}>
            <Icon size={11} />
          </div>
          {hasErrors && (
            <span className="alert-badge" title={`${a.errors_24h} erreur${a.errors_24h > 1 ? "s" : ""} sur 24 h`}>!</span>
          )}
        </div>
        <div>
          <div className="agent-card-name">{(a.name || a.agent_id).toLowerCase()}</div>
          <div className="agent-card-role">n°{theme.number} · {a.role || ""}</div>
        </div>
      </div>

      <span className="status-pill" style={statusStyle}>
        {running ? <IconBolt size={11} /> : <span className="dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />}
        {statusLabel}
      </span>

      {running && a.current_run && (
        <div className="mini-progress">
          <div
            className="mini-progress-fill"
            style={{
              background: theme.color,
              width: a.current_run.steps_total > 0 ? `${Math.round((a.current_run.steps_done / a.current_run.steps_total) * 100)}%` : "20%",
            }}
          />
        </div>
      )}

      <div className="chip-row">
        <span className="stat-chip"><IconClock size={12} />{last ? `${timeAgo(last.started_at)} · ${last.status === "success" ? "réussi" : last.status === "error" ? "échec" : last.status}` : "aucun run"}</span>
        <span className="stat-chip" style={hasErrors ? { background: "rgba(214,69,69,0.08)", color: "#D64545" } : undefined}>{hasErrors ? `⚠️ ${a.errors_24h} erreur${a.errors_24h > 1 ? "s" : ""}` : "✅ 0 erreur"}</span>
        <span className="stat-chip mono">v{a.instructions_version ?? "—"}</span>
      </div>

      <button className="btn-primary" style={{ background: theme.color, border: "none", color: "#fff", width: "100%" }} tabIndex={-1}>
        voir la fiche <IconArrowRight size={14} />
      </button>
    </Link>
  );
}

const FILTERS = [
  { id: "tous", label: "tous" },
  { id: "actif", label: "actifs" },
  { id: "pause", label: "en pause" },
  { id: "encours", label: "en cours" },
  { id: "erreur", label: "en erreur" },
];

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("tous");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
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

  const filteredAgents = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.agents.filter((a) => {
      if (q) {
        const hay = `${a.name || a.agent_id} ${a.role || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "actif") return a.status === "active" && !a.is_running;
      if (filter === "pause") return a.status !== "active";
      if (filter === "encours") return !!a.is_running;
      if (filter === "erreur") return a.errors_24h > 0;
      return true;
    });
  }, [data, search, filter]);

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

      {error && <p className="form-error">{error} — nouvelle tentative dans 15 s</p>}
      {!data && !error && <p style={{ color: "var(--texte)" }}>chargement…</p>}

      {data && (
        <>
          <div className="block-sub-title" style={{ marginBottom: 12 }}>🤖 votre équipe virtuelle</div>

          <div className="filter-bar">
            <input
              className="search-input"
              type="text"
              placeholder="🔍 rechercher un agent…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filter-chip-row">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`filter-chip ${filter === f.id ? "selected" : ""}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredAgents.length === 0 ? (
            <p className="no-results">
              {data.agents.length === 0
                ? "aucun agent ne vous est attribué pour l'instant — contactez un administrateur."
                : "aucun agent ne correspond à cette recherche"}
            </p>
          ) : (
            <div className="grid">
              {filteredAgents.map((a) => <AgentCard key={a.agent_id} a={a} />)}
            </div>
          )}
        </>
      )}

      <p className="footer-note">actualisation automatique toutes les 15 secondes · données servies par le registre n8n</p>
    </div>
  );
}
