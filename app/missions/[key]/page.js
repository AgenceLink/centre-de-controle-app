"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { agentTheme } from "@/lib/agentTheme";
import { IconCheck, IconX, IconRefresh, IconClock, IconPlus } from "@/lib/icons";

function timeAgo(iso) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (isNaN(s)) return "—";
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusMeta(status) {
  if (status === "success") return { label: "réussi", cls: "ok-badge", icon: <IconCheck size={12} /> };
  if (status === "error") return { label: "échec", cls: "err-badge", icon: <IconX size={12} /> };
  if (status === "running") return { label: "en cours", cls: "", icon: <IconRefresh size={12} /> };
  return { label: status || "—", cls: "", icon: null };
}

function triggerLabel(t) {
  if (t === "schedule") return "planifié";
  if (t === "manual") return "manuel";
  return t || "—";
}

function diffParagraphs(oldText, newText) {
  const a = (oldText || "").split("\n\n");
  const b = (newText || "").split("\n\n");
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "del", text: a[i] }); i++; }
    else { out.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < n) { out.push({ type: "del", text: a[i] }); i++; }
  while (j < m) { out.push({ type: "add", text: b[j] }); j++; }
  return out;
}

function ConfirmModal({ title, message, confirmWord, danger, busy, onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="block-desc">{message}</p>
        <p className="dim">Tape <strong>{confirmWord}</strong> pour confirmer :</p>
        <input className="confirm-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>annuler</button>
          <button
            className={danger ? "btn-danger" : "btn-primary"}
            disabled={typed !== confirmWord || busy}
            onClick={onConfirm}
          >
            {busy ? "en cours…" : "confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- onglet vue d'ensemble ---------- */
function OverviewTab({ mission, theme }) {
  const running = mission.is_running;
  const last = mission.last_run;
  return (
    <div className="card block">
      <div className="block-title">🪪 résumé</div>
      <div className="int-grid">
        <div className="int-card"><div className="l">statut</div><div className="v">{running ? "en cours d'exécution" : "au repos"}</div></div>
        <div className="int-card"><div className="l">agent</div><div className="v">{mission.agent_id}</div></div>
        <div className="int-card"><div className="l">type</div><div className="v">{mission.reference_only ? "mission de référence" : "mission terrain"}</div></div>
        <div className="int-card"><div className="l">version instructions</div><div className="v">v{mission.instructions_version ?? "—"}</div></div>
      </div>
      {running && mission.current_run ? (
        <div className="mini-progress" style={{ marginTop: 14 }}>
          <div
            className="mini-progress-fill"
            style={{
              background: theme.color,
              width: mission.current_run.steps_total > 0 ? `${Math.round((mission.current_run.steps_done / mission.current_run.steps_total) * 100)}%` : "20%",
            }}
          />
        </div>
      ) : last ? (
        <p className="block-sub-title" style={{ marginTop: 14 }}>
          dernier run {statusMeta(last.status).label} · {timeAgo(last.started_at)} · {triggerLabel(last.trigger_type)}
        </p>
      ) : (
        <p className="dim" style={{ marginTop: 14 }}>cette mission n'a encore jamais tourné.</p>
      )}
      {last?.summary && <p className="block-desc" style={{ marginTop: 8 }}>{last.summary}</p>}
    </div>
  );
}

/* ---------- onglet planification ---------- */
function parseTimes(baseTimes) {
  return String(baseTimes || "").split(",").map((t) => t.trim()).filter(Boolean);
}
const MINUTE_OPTIONS = ["00", "15", "30", "45"];
const HOUR_OPTIONS_M = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function MissionPlanningPreview({ mission }) {
  const times = parseTimes(mission.base_times);
  if (mission.reference_only) return <p className="dim">mission de référence — pas de planning propre, jamais déclenchée directement.</p>;
  if (!times.length) return <p className="dim">aucun horaire configuré</p>;
  return (
    <div>
      <div className="chip-row">
        {times.map((t) => <span key={t} className="chip selected" style={{ cursor: "default" }}>{t}</span>)}
      </div>
      <div className="schedule-preview" style={{ marginTop: 12 }}>
        🔁 retry {mission.retry_interval_minutes || "—"} min jusqu'à {mission.retry_cutoff || "—"}
      </div>
    </div>
  );
}

function PlanningTab({ mission, missionName, canWrite, onAction }) {
  const [editing, setEditing] = useState(false);
  const [times, setTimes] = useState([]);
  const [addHour, setAddHour] = useState("07");
  const [addMinute, setAddMinute] = useState("00");
  const [retryInterval, setRetryInterval] = useState(60);
  const [retryCutoff, setRetryCutoff] = useState("17:00");
  const [confirmSave, setConfirmSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const startEdit = () => {
    setTimes(parseTimes(mission.base_times));
    setRetryInterval(mission.retry_interval_minutes || 60);
    setRetryCutoff(mission.retry_cutoff || "17:00");
    setEditing(true);
  };

  const addTime = () => {
    const t = `${addHour}:${addMinute}`;
    if (!times.includes(t)) setTimes([...times, t].sort());
  };
  const removeTime = (t) => setTimes(times.filter((x) => x !== t));

  const save = async () => {
    setBusy(true);
    const ok = await onAction("set_mission_schedule", { base_times: times.join(","), retry_interval_minutes: Number(retryInterval), retry_cutoff: retryCutoff });
    setBusy(false);
    setConfirmSave(false);
    if (ok) { setEditing(false); setMsg({ ok: true, text: "déclencheurs mis à jour" }); }
    else setMsg({ ok: false, text: "échec de l'enregistrement" });
  };

  if (mission.reference_only && !editing) {
    return (
      <div className="card block">
        <div className="block-title">🕒 déclencheurs</div>
        <p className="dim">mission de référence — pas de planning propre, jamais déclenchée directement par le dispatcher.</p>
      </div>
    );
  }

  return (
    <div className="card block">
      <div className="block-title">
        🕒 déclencheurs
        {canWrite && !editing && (
          <button className="btn-ghost btn-inline" onClick={startEdit}>modifier</button>
        )}
      </div>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</p>}

      {editing ? (
        <div className="editor">
          <div className="field">
            <label>horaires de déclenchement</label>
            <div className="chip-row">
              {times.length === 0 && <span className="dim" style={{ fontSize: 13 }}>aucun horaire — ajoute au moins un créneau</span>}
              {times.map((t) => (
                <span key={t} className="chip selected">
                  {t}
                  <button type="button" className="chip-remove" onClick={() => removeTime(t)} aria-label={`retirer ${t}`}>
                    <IconX size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="hour-picker" style={{ marginTop: 8 }}>
              <select value={addHour} onChange={(e) => setAddHour(e.target.value)}>
                {HOUR_OPTIONS_M.map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
              <select value={addMinute} onChange={(e) => setAddMinute(e.target.value)}>
                {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="button" className="btn-ghost" onClick={addTime}><IconPlus size={13} />ajouter</button>
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>retry en cas d'échec</label>
            <div className="chip-row">
              <select value={retryInterval} onChange={(e) => setRetryInterval(e.target.value)}>
                {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>toutes les {m} min</option>)}
              </select>
              <span className="dim" style={{ fontSize: 13, alignSelf: "center" }}>jusqu'à</span>
              <input
                type="text"
                className="confirm-input"
                style={{ width: 90 }}
                value={retryCutoff}
                onChange={(e) => setRetryCutoff(e.target.value)}
                placeholder="17:00"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>annuler</button>
            <button className="btn-primary" onClick={() => setConfirmSave(true)} disabled={times.length === 0 || busy}>enregistrer</button>
          </div>
        </div>
      ) : (
        <MissionPlanningPreview mission={mission} />
      )}

      {confirmSave && (
        <ConfirmModal
          title="modifier les déclencheurs"
          message={`Retape le nom de la mission (« ${missionName} ») pour appliquer le nouveau planning. Une notification sera envoyée sur le canal Slack de l'agent.`}
          confirmWord={missionName}
          busy={busy}
          onConfirm={save}
          onCancel={() => setConfirmSave(false)}
        />
      )}
    </div>
  );
}

/* ---------- onglet instructions (diff/rollback, même principe que ZZ) ---------- */
function InstructionsTab({ missionKey, missionName, currentVersion, canWrite, onAction }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState(null);
  const [openVersion, setOpenVersion] = useState(null);
  const [content, setContent] = useState({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [comment, setComment] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reloadVersions = useCallback(() => {
    fetch(`/api/missions/${missionKey}/instructions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setVersions(j.versions) : setError(j.error)))
      .catch(() => setError("réseau indisponible"));
  }, [missionKey]);

  useEffect(() => { reloadVersions(); }, [reloadVersions]);

  const fetchVersionContent = async (v) => {
    if (content[v]) return content[v];
    const res = await fetch(`/api/missions/${missionKey}/instructions?version=${v}`, { cache: "no-store" });
    const j = await res.json();
    if (j.ok) { setContent((c) => ({ ...c, [v]: j.instructions })); return j.instructions; }
    return null;
  };

  const toggleVersion = async (v) => {
    if (openVersion === v) { setOpenVersion(null); return; }
    setOpenVersion(v);
    fetchVersionContent(v);
  };

  useEffect(() => {
    if (versions && versions.length > 0 && openVersion === null) {
      const cur = versions.find((v) => v.is_current);
      if (cur) {
        setOpenVersion(cur.version);
        fetchVersionContent(cur.version);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions]);

  const startEdit = async () => {
    const cur = versions.find((v) => v.is_current);
    const c = cur ? await fetchVersionContent(cur.version) : null;
    setDraft(c ? c.content : "");
    setComment("");
    setShowDiff(false);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    const ok = await onAction("edit_mission_instructions", { content: draft, comment });
    setBusy(false);
    setConfirmSave(false);
    if (ok) { setEditing(false); reloadVersions(); setContent({}); setMsg({ ok: true, text: "nouvelle version enregistrée" }); }
    else setMsg({ ok: false, text: "échec de l'enregistrement" });
  };

  const rollback = async (v) => {
    setBusy(true);
    const ok = await onAction("set_current_mission_version", { version: v });
    setBusy(false);
    setConfirmRollback(null);
    if (ok) { reloadVersions(); setMsg({ ok: true, text: `retour à la version v${v} effectué` }); }
    else setMsg({ ok: false, text: "échec du rollback" });
  };

  const currentVersionMeta = versions?.find((v) => v.is_current);
  const currentContentText = currentVersionMeta ? content[currentVersionMeta.version]?.content : undefined;

  return (
    <div className="card block">
      <div className="block-title">
        📝 instructions <span className="block-sub">version courante v{currentVersion ?? "—"}</span>
        {canWrite && !editing && (
          <button className="btn-ghost btn-inline" onClick={startEdit}>éditer</button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</p>}

      {editing ? (
        <div className="editor">
          <textarea className="instr-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} />
          <input
            className="confirm-input"
            placeholder="commentaire de version (optionnel)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>annuler</button>
            <button className="btn-ghost" onClick={() => setShowDiff((s) => !s)}>
              {showDiff ? "masquer le diff" : "voir les changements"}
            </button>
            <button className="btn-primary" onClick={() => setConfirmSave(true)} disabled={!draft.trim() || busy}>
              enregistrer une nouvelle version
            </button>
          </div>
          {showDiff && (
            <div className="diff-view">
              {currentContentText === undefined ? (
                <p className="dim">chargement du contenu actuel…</p>
              ) : (
                diffParagraphs(currentContentText, draft).map((p, i) => (
                  <p key={i} className={`diff-${p.type}`}>{p.text}</p>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {!versions && !error && <p className="dim">chargement…</p>}
          {versions && versions.length === 0 && <p className="dim">aucune version enregistrée</p>}
          {versions && versions.length > 0 && (
            <div className="version-list">
              {versions.map((v) => (
                <div key={v.version} className="version-row">
                  <button className="version-head" onClick={() => toggleVersion(v.version)}>
                    <span className="version-badge">v{v.version}</span>
                    <span className="version-info">
                      <span className="version-comment">{v.comment || "—"}</span>
                      <span className="version-sub">{v.author || "auteur inconnu"} · {formatDate(v.created_at)} · {v.total_parts} partie{v.total_parts > 1 ? "s" : ""}</span>
                    </span>
                    {v.is_current && <span className="role-chip">actuelle</span>}
                  </button>
                  {openVersion === v.version && (
                    <>
                      <pre className="version-content">
                        {content[v.version] ? content[v.version].content : "chargement…"}
                      </pre>
                      {canWrite && !v.is_current && (
                        <div className="version-restore">
                          <button className="btn-ghost" onClick={() => setConfirmRollback(v.version)}>restaurer cette version</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {confirmSave && (
        <ConfirmModal
          title="enregistrer une nouvelle version"
          message={`Retape le nom de la mission (« ${missionName} ») pour publier cette nouvelle version des instructions. Une notification sera envoyée sur le canal Slack de l'agent.`}
          confirmWord={missionName}
          busy={busy}
          onConfirm={save}
          onCancel={() => setConfirmSave(false)}
        />
      )}
      {confirmRollback !== null && (
        <ConfirmModal
          title="restaurer une version antérieure"
          message={`Retape le nom de la mission (« ${missionName} ») pour revenir à la version v${confirmRollback}. Cette version sera utilisée dès le prochain run.`}
          confirmWord={missionName}
          danger
          busy={busy}
          onConfirm={() => rollback(confirmRollback)}
          onCancel={() => setConfirmRollback(null)}
        />
      )}
    </div>
  );
}

/* ---------- onglet intégrations ---------- */
function IntegrationsTab({ mission }) {
  return (
    <div className="card block">
      <div className="block-title">🔌 intégrations</div>
      <div className="int-grid">
        <div className="int-card"><div className="l">agent propriétaire</div><div className="v"><Link href={`/agents/${mission.agent_id}`} className="dim">{mission.agent_id} →</Link></div></div>
        <div className="int-card"><div className="l">clé technique</div><div className="v mono">{mission.mission_key}</div></div>
        <div className="int-card"><div className="l">table instructions</div><div className="v mono">mission_instructions</div></div>
        <div className="int-card"><div className="l">table runs</div><div className="v mono">mission_runs / mission_run_events</div></div>
      </div>
      <p className="block-desc" style={{ marginTop: 12 }}>
        Les outils et passerelles réellement utilisés par cette mission (Monday, plateformes publicitaires, Slack…) sont ceux de l'agent {mission.agent_id} — voir son onglet intégrations.
      </p>
    </div>
  );
}

/* ---------- onglet historique (runs + événements) ---------- */
function HistoryTab({ mission }) {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const [openRun, setOpenRun] = useState(null);
  const [events, setEvents] = useState({});

  useEffect(() => {
    fetch(`/api/missions/${mission.mission_key}/runs`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setRuns(j.runs) : setError(j.error)))
      .catch(() => setError("réseau indisponible"));
  }, [mission.mission_key]);

  const toggleRun = async (r) => {
    if (openRun === r.run_id) { setOpenRun(null); return; }
    setOpenRun(r.run_id);
    if (events[r.run_id]) return;
    const res = await fetch(`/api/missions/${mission.mission_key}/run-events?run_id=${encodeURIComponent(r.run_id)}`, { cache: "no-store" });
    const j = await res.json();
    if (j.ok) setEvents((e) => ({ ...e, [r.run_id]: j.events }));
  };

  return (
    <div className="card block">
      <div className="block-title">🕓 derniers runs</div>
      {error && <p className="form-error">{error}</p>}
      {!runs && !error && <p className="dim">chargement…</p>}
      {runs && runs.length === 0 && <p className="dim">aucun run enregistré pour cette mission</p>}
      {runs && runs.length > 0 && (
        <div className="version-list">
          {runs.slice(0, 20).map((r) => {
            const meta = statusMeta(r.status);
            return (
              <div key={r.run_id} className="version-row">
                <button className="version-head" onClick={() => toggleRun(r)}>
                  <span className={`version-badge ${meta.cls}`}>{meta.icon} {meta.label}</span>
                  <span className="version-info">
                    <span className="version-comment">{formatDate(r.started_at)} · {triggerLabel(r.trigger_type)}{r.attempt_number > 1 ? ` · tentative ${r.attempt_number}` : ""}</span>
                    <span className="version-sub">{r.summary || "pas de résumé"}</span>
                  </span>
                </button>
                {openRun === r.run_id && (
                  <pre className="version-content">
                    {!events[r.run_id] ? "chargement…" : events[r.run_id].length === 0 ? "aucun événement" : events[r.run_id].map((e, i) => `${formatDate(e.timestamp)} — ${e.event_type}${e.details ? " : " + e.details : ""}`).join("\n")}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "overview", label: "🪪 vue d'ensemble" },
  { id: "planning", label: "🕒 planification" },
  { id: "instructions", label: "📝 instructions" },
  { id: "integrations", label: "🔌 intégrations" },
  { id: "history", label: "🕓 historique" },
];

export default function MissionDetail() {
  const router = useRouter();
  const params = useParams();
  const missionKey = params.key;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState("overview");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/missions/${missionKey}`, { cache: "no-store" });
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 404) { setError("mission introuvable"); return; }
      if (res.status === 403) { setError("vous n'avez pas accès à cette mission — contactez un administrateur."); return; }
      const json = await res.json();
      if (json.ok) { setData(json); setError(null); } else setError(json.error || "erreur");
    } catch {
      setError("réseau indisponible");
    }
  }, [missionKey, router]);

  useEffect(() => {
    load();
    let t = setInterval(load, 30000);
    const onVis = () => {
      clearInterval(t);
      if (document.visibilityState === "visible") { load(); t = setInterval(load, 30000); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const runAction = async (action, extra) => {
    try {
      const res = await fetch(`/api/missions/${missionKey}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (json.ok) { setMsg({ ok: true, text: "action effectuée" }); load(); return true; }
      setMsg({ ok: false, text: `échec — ${json.error || "erreur"}` });
      return false;
    } catch {
      setMsg({ ok: false, text: "réseau indisponible" });
      return false;
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  const isAdmin = data?.viewer?.role === "admin";
  const perms = data?.viewer?.permissions;
  const canInstructions = isAdmin || perms?.instructions === true;
  const canSchedule = isAdmin || perms?.schedule === true;
  const theme = data ? agentTheme(data.mission.agent_id) : null;
  const missionName = data ? (data.mission.name || data.mission.mission_key) : "";

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

      {data && <Link href={`/agents/${data.mission.agent_id}`} className="back-link">← {data.mission.agent_id}</Link>}
      {!data && <Link href="/" className="back-link">← vue d'ensemble</Link>}

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p style={{ color: "var(--texte)" }}>chargement…</p>}

      {data && (
        <>
          <div className="card block" style={{ borderColor: theme.color }}>
            <div className="block-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🎯</span>
              {missionName}
              {data.mission.reference_only && <span className="role-chip">référence</span>}
            </div>
            {msg && <p className={msg.ok ? "form-ok" : "form-error"} style={{ marginTop: 8 }}>{msg.text}</p>}
          </div>

          <div className="tab-bar" style={{ marginTop: 20 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab-btn ${tab === t.id ? "active" : ""}`}
                style={tab === t.id ? { borderColor: theme.color } : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="tab-panel">
            {tab === "overview" && <OverviewTab mission={data.mission} theme={theme} />}
            {tab === "planning" && (
              <PlanningTab mission={data.mission} missionName={missionName} canWrite={canSchedule} onAction={runAction} />
            )}
            {tab === "instructions" && (
              <InstructionsTab
                missionKey={missionKey}
                missionName={missionName}
                currentVersion={data.mission.instructions_version}
                canWrite={canInstructions}
                onAction={runAction}
              />
            )}
            {tab === "integrations" && <IntegrationsTab mission={data.mission} />}
            {tab === "history" && <HistoryTab mission={data.mission} />}
          </div>
        </>
      )}
    </div>
  );
}
