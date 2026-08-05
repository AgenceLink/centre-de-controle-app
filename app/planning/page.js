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
  const [zizouMissions, setZizouMissions] = useState(null);

  useEffect(() => {
    fetch("/api/agents", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) { router.push("/login"); throw new Error("redirect"); }
        return r.json();
      })
      .then((j) => (j.ok ? setData(j) : setError(j.error || "erreur")))
      .catch((e) => { if (e.message !== "redirect") setError("réseau indisponible"); });
  }, [router]);

  useEffect(() => {
    if (!data || !data.agents.some((a) => a.agent_id === "zizou")) return;
    fetch("/api/agents/zizou/missions", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setZizouMissions(j.ok ? j.missions : []))
      .catch(() => setZizouMissions([]));
  }, [data]);

  const { events, slots, unscheduled } = useMemo(() => {
    if (!data) return { events: [], slots: [], unscheduled: [] };
    const evs = [];
    const noSchedule = [];
    data.agents.forEach((a) => {
      if (a.agent_id === "zizou" && zizouMissions) {
        const active = zizouMissions.filter((m) => m.active && !m.reference_only && m.base_times);
        if (!active.length) { noSchedule.push(a); return; }
        active.forEach((m) => {
          String(m.base_times || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => {
            const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
            if (isNaN(hh)) return;
            const slot = hh + ((mm || 0) >= 30 ? 0.5 : 0);
            DAY_ORDER.forEach((d) => evs.push({ agent: a, day: d, slot, time: t, missionName: m.name || m.mission_key }));
          });
        });
        return;
      }
      if (a.agent_id === "zizou" && !zizouMissions) return; // en attente du chargement des missions
      const parsed = parseCron(a.schedule_cron);
      if (!parsed.hours.length) { noSchedule.push(a); return; }
      const days = parsed.days === "*" ? DAY_ORDER : parsed.days;
      parsed.hours.forEach((h) => days.forEach((d) => evs.push({ agent: a, day: d, slot: h, time: `${String(h).padStart(2, "0")}:00` })));
    });
    const sl = Array.from(new Set(evs.map((e) => e.slot))).sort((a, b) => a - b);
    return { events: evs, slots: sl, unscheduled: noSchedule };
  }, [data, zizouMissions]);

  const slotLabel = (s) => `${String(Math.floor(s)).padStart(2, "0")}:${s % 1 === 0 ? "00" : "30"}`;
  const cellEvents = (day, slot) => events.filter((e) => e.day === day && e.slot === slot);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="page" style={{ maxWidth: 1720 }}>
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

          {slots.length === 0 ? (
            <div className="card block"><p className="dim">aucun agent n'a de planning configuré pour l'instant.</p></div>
          ) : (
            <div className="card block" style={{ overflowX: "auto", padding: 20 }}>
              <table className="rpt-table" style={{ width: "100%", minWidth: 1660, tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 84 }}></th>
                    {DAY_ORDER.map((d) => <th key={d} style={{ fontSize: 16, padding: "16px 12px" }}>{DAY_LABELS[d]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s}>
                      <th style={{ background: "var(--fond)", color: "var(--gris)", fontWeight: 500, whiteSpace: "nowrap", verticalAlign: "top", padding: "18px 12px", fontSize: 14 }}>{slotLabel(s)}</th>
                      {DAY_ORDER.map((d) => {
                        const cell = cellEvents(d, s);
                        const collision = cell.length > 1;
                        return (
                          <td key={d} style={{ minWidth: 200, height: 72, verticalAlign: "top", padding: "14px 12px", ...(collision ? { background: "rgba(214,69,69,0.06)" } : {}) }}>
                            {cell.length === 0 ? (
                              <span className="dim">—</span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", flexWrap: "wrap", gap: 8 }}>
                                {cell.map((e, i) => {
                                  const theme = agentTheme(e.agent.agent_id);
                                  const agentLabel = (e.agent.name || e.agent.agent_id).toLowerCase();
                                  const label = e.missionName ? e.missionName.toLowerCase() : agentLabel;
                                  return (
                                    <span
                                      key={i}
                                      title={`${DAY_LABELS[d]} ${e.time} — ${agentLabel}${e.missionName ? " · " + e.missionName : ""}`}
                                      style={{
                                        display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2, fontSize: 13,
                                        background: `${theme.color}18`, color: theme.colorDark, borderRadius: 8, padding: "6px 11px",
                                      }}
                                    >
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: theme.color, display: "inline-block", flexShrink: 0 }} />
                                        {label}
                                      </span>
                                      <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 13 }}>{e.missionName ? `${agentLabel} · ${e.time}` : "planning agent"}</span>
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
              <p className="dim" style={{ marginTop: 12, fontSize: 12 }}>fond rosé = plusieurs agents/missions programmés au même créneau</p>
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
