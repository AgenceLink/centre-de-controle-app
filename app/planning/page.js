"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { agentTheme } from "@/lib/agentTheme";
import { parseCron } from "@/lib/schedule";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS = { 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi", 0: "dimanche" };
const DAY_SHORT = { 1: "lun", 2: "mar", 3: "mer", 4: "jeu", 5: "ven", 6: "sam", 0: "dim" };

export default function PlanningOverview() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/agents", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) { router.push("/login"); throw new Error("redirect"); }
        return r.json();
      })
      .then((j) => (j.ok ? setData(j) : setError(j.error || "erreur")))
      .catch((e) => { if (e.message !== "redirect") setError("réseau indisponible"); });
  }, [router]);

  const { events, hours, unscheduled } = useMemo(() => {
    if (!data) return { events: [], hours: [], unscheduled: [] };
    const evs = [];
    const noSchedule = [];
    data.agents.forEach((a) => {
      const parsed = parseCron(a.schedule_cron);
      if (!parsed.hours.length) { noSchedule.push(a); return; }
      const days = parsed.days === "*" ? DAY_ORDER : parsed.days;
      parsed.hours.forEach((h) => days.forEach((d) => evs.push({ agent: a, day: d, hour: h })));
    });
    const hrs = Array.from(new Set(evs.map((e) => e.hour))).sort((a, b) => a - b);
    return { events: evs, hours: hrs, unscheduled: noSchedule };
  }, [data]);

  const cellEvents = (day, hour) => events.filter((e) => e.day === day && e.hour === hour);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

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

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p style={{ color: "var(--texte)" }}>chargement…</p>}

      {data && (
        <>
          <div className="block-sub-title" style={{ marginBottom: 12 }}>📅 aperçu planning — semaine type</div>

          <div className="chip-row" style={{ marginBottom: 18 }}>
            {data.agents.map((a) => {
              const theme = agentTheme(a.agent_id);
              return (
                <span key={a.agent_id} className="stat-chip" style={{ background: `${theme.color}18`, color: theme.colorDark }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.color, display: "inline-block" }} />
                  {(a.name || a.agent_id).toLowerCase()}
                </span>
              );
            })}
          </div>

          {hours.length === 0 ? (
            <div className="card block"><p className="dim">aucun agent n'a de planning configuré pour l'instant.</p></div>
          ) : (
            <div className="card block" style={{ overflowX: "auto" }}>
              <table className="rpt-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th></th>
                    {DAY_ORDER.map((d) => <th key={d}>{DAY_SHORT[d]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {hours.map((h) => (
                    <tr key={h}>
                      <th style={{ background: "var(--fond)", color: "var(--gris)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}h</th>
                      {DAY_ORDER.map((d) => {
                        const cell = cellEvents(d, h);
                        const collision = cell.length > 1;
                        return (
                          <td key={d} style={collision ? { background: "rgba(214,69,69,0.06)" } : undefined}>
                            {cell.length === 0 ? (
                              <span className="dim">—</span>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {cell.map((e, i) => {
                                  const theme = agentTheme(e.agent.agent_id);
                                  return (
                                    <span
                                      key={i}
                                      title={`${DAY_LABELS[d]} ${h}h — ${(e.agent.name || e.agent.agent_id).toLowerCase()}`}
                                      style={{
                                        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
                                        background: `${theme.color}18`, color: theme.colorDark, borderRadius: 999, padding: "2px 8px",
                                      }}
                                    >
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.color, display: "inline-block" }} />
                                      {(e.agent.name || e.agent.agent_id).toLowerCase()}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dim" style={{ marginTop: 10, fontSize: 12 }}>fond rosé = plusieurs agents programmés au même créneau</p>
            </div>
          )}

          {unscheduled.length > 0 && (
            <p className="footer-note left" style={{ marginTop: 16 }}>
              sans planning : {unscheduled.map((a) => (a.name || a.agent_id).toLowerCase()).join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
