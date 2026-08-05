"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { agentTheme } from "@/lib/agentTheme";
import { parseCron, buildCron } from "@/lib/schedule";
import {
  IconPlay, IconPause, IconRefresh, IconCheck, IconClock, IconPlus, IconX,
} from "@/lib/icons";

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

function formatDuration(sec) {
  if (!sec && sec !== 0) return "—";
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m} min ${s}s`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60}`;
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
  if (t === "test") return "test";
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

/* ---------- confirmation typée ---------- */
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

/* ---------- en-tête agent (toujours visible) ---------- */
function AgentHeader({ agent, canToggle, canRun, onAction, msg, onGoOverview }) {
  const theme = agentTheme(agent.agent_id);
  const Icon = theme.Icon;
  const running = agent.is_running;
  const active = agent.status === "active";
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const displayName = (agent.name || agent.agent_id).toLowerCase();

  const toggleStatus = async () => {
    setBusy(true);
    await onAction("set_status", { status: active ? "paused" : "active" });
    setBusy(false);
    setConfirmToggle(false);
  };

  const runNow = async () => {
    setBusy(true);
    await onAction("run_now", {});
    setBusy(false);
    setConfirmRun(false);
  };

  return (
    <div className="card block">
      <div className="agent-card-head">
        <div className="mascot-wrap">
          <div className="mascot-ring" style={{ width: 64, height: 64, border: `3px solid ${theme.color}` }}>
            {theme.mascot ? <img src={theme.mascot} alt="" /> : <span style={{ fontSize: 26 }}>🤖</span>}
          </div>
          <div className="mascot-badge" style={{ width: 22, height: 22, borderColor: theme.color, color: theme.color }}>
            <Icon size={12} />
          </div>
        </div>
        <div>
          <div className="agent-name">{displayName}</div>
          <div className="agent-role">n°{theme.number} · {agent.role || ""}</div>
        </div>
      </div>

      {agent.description && <p className="block-desc" style={{ marginTop: 12 }}>{agent.description}</p>}

      <div className="toggle-row" style={{ marginTop: 14 }}>
        <button
          className={`toggle-switch ${active ? "on" : "off"}`}
          disabled={!canToggle || busy}
          onClick={() => setConfirmToggle(true)}
          aria-label={active ? "passer en pause" : "activer"}
        >
          <span className="toggle-knob" style={{ color: active ? "#2E9E5B" : "#929292" }}>
            {active ? <IconPlay size={12} /> : <IconPause size={12} />}
          </span>
        </button>
        <div>
          <div className="toggle-label">{active ? "actif" : "en pause"}</div>
          {running && <div className="toggle-sub">🔄 run en cours</div>}
        </div>
      </div>

      <div className="action-row" style={{ marginTop: 14 }}>
        {canRun && (
          <button className="btn-primary" style={{ background: theme.color, border: "none" }} onClick={() => setConfirmRun(true)} disabled={running}>
            <IconPlay size={14} />lancer un run
          </button>
        )}
        <button className="btn-ghost" onClick={onGoOverview}>
          <IconClock size={14} />voir les runs
        </button>
      </div>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} style={{ marginTop: 8 }}>{msg.text}</p>}

      {confirmToggle && (
        <ConfirmModal
          title={active ? "mettre en pause" : "relancer l'agent"}
          message={`Retape le nom de l'agent (« ${displayName} ») pour ${active ? "le mettre en pause" : "le relancer"}. Une notification sera envoyée sur ${agent.slack_channel || "son canal Slack"}.`}
          confirmWord={displayName}
          danger={active}
          busy={busy}
          onConfirm={toggleStatus}
          onCancel={() => setConfirmToggle(false)}
        />
      )}
      {confirmRun && (
        <ConfirmModal
          title="lancer un run maintenant"
          message={`Retape le nom de l'agent (« ${displayName} ») pour lancer un run manuel immédiat. Une notification sera envoyée sur ${agent.slack_channel || "son canal Slack"}.`}
          confirmWord={displayName}
          busy={busy}
          onConfirm={runNow}
          onCancel={() => setConfirmRun(false)}
        />
      )}
    </div>
  );
}

/* ---------- onglet vue d'ensemble : run en cours + runs/erreurs récents ---------- */
function LiveSteps({ agentId, runId, stepsTotal, theme }) {
  const [events, setEvents] = useState([]);
  const load = useCallback(() => {
    fetch(`/api/agents/${agentId}/run-events?run_id=${encodeURIComponent(runId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setEvents(j.events); })
      .catch(() => {});
  }, [agentId, runId]);
  useEffect(() => {
    load();
    let t = setInterval(load, 10000);
    const onVis = () => {
      clearInterval(t);
      if (document.visibilityState === "visible") { load(); t = setInterval(load, 10000); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const total = stepsTotal && stepsTotal > 0 ? stepsTotal : Math.max(events.length, 1);
  const currentIndex = Math.min(events.length > 0 ? events.length - 1 : 0, total - 1);

  const items = [];
  for (let i = 0; i < total; i++) {
    const ev = events[i];
    const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
    items.push(
      <div className="step" key={`s${i}`}>
        <div
          className={`step-icon ${state}`}
          style={state === "done" ? { background: theme.color } : state === "current" ? { borderColor: theme.color, color: theme.color } : undefined}
        >
          {state === "done" ? <IconCheck size={15} /> : state === "current" ? <IconRefresh size={15} /> : <IconClock size={13} />}
        </div>
        <div className={`step-label ${state}`}>{ev?.label || `étape ${i + 1}`}</div>
      </div>
    );
    if (i < total - 1) {
      items.push(<div className="step-connector" key={`c${i}`} style={{ background: i < currentIndex ? theme.color : "var(--gris-clair)" }} />);
    }
  }

  return (
    <div className="live-steps">
      <div className="live-head" style={{ color: theme.color }}>
        <span className="dot pulse" style={{ background: theme.color }} /> run en cours{stepsTotal ? ` · étape ${Math.min(events.length, stepsTotal)}/${stepsTotal}` : ""}
      </div>
      <div className="stepper">{items}</div>
      {events[currentIndex]?.detail && <div className="stepper-caption">{events[currentIndex].detail}</div>}
    </div>
  );
}

function OverviewTab({ agent, agentId, canAck, onAction }) {
  const theme = agentTheme(agentId);
  const [runs, setRuns] = useState(null);
  const [errors, setErrors] = useState(null);
  const [ackBusy, setAckBusy] = useState(false);

  const reload = useCallback(() => {
    fetch(`/api/agents/${agentId}/runs`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setRuns(j.runs));
    fetch(`/api/agents/${agentId}/errors`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setErrors(j.errors));
  }, [agentId]);

  const ackErrors = async () => {
    setAckBusy(true);
    const ok = await onAction("acknowledge_errors", {});
    if (ok) reload();
    setAckBusy(false);
  };

  useEffect(() => {
    reload();
    let t = setInterval(reload, 30000);
    const onVis = () => {
      clearInterval(t);
      if (document.visibilityState === "visible") { reload(); t = setInterval(reload, 30000); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [reload]);

  return (
    <div className="card block">
      <div className="block-title">📊 rapports &amp; santé</div>

      <div className="meta">
        <div className="meta-row">
          <span className="k">erreurs 24 h</span>
          <span className={`v ${agent.errors_24h > 0 ? "err-badge" : "ok-badge"}`}>{agent.errors_24h > 0 ? `⚠️ ${agent.errors_24h}` : "✅ aucune"}</span>
        </div>
      </div>

      {canAck && agent.errors_24h > 0 && (
        <button className="btn-ghost" style={{ marginTop: 10 }} onClick={ackErrors} disabled={ackBusy}>
          <IconCheck size={14} />{ackBusy ? "…" : "ok, j'ai traité"}
        </button>
      )}

      {agent.is_running && agent.current_run && (
        <LiveSteps agentId={agentId} runId={agent.current_run.run_id} stepsTotal={agent.current_run.steps_total} theme={theme} />
      )}

      <div className="block-sub-title">runs récents</div>
      {!runs && <p className="dim">chargement…</p>}
      {runs && runs.length === 0 && <p className="dim">aucun run enregistré</p>}
      {runs && runs.length > 0 && (
        <div className="run-list">
          {runs.slice(0, 10).map((r) => {
            const sm = statusMeta(r.status);
            return (
              <div key={r.run_id} className="run-row">
                <div className="run-row-head">
                  <span className={`v ${sm.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{sm.icon}{sm.label}</span>
                  <span className="dim">{triggerLabel(r.trigger_type)} · {timeAgo(r.started_at)} · {formatDuration(r.duration_seconds)}</span>
                </div>
                {r.summary && <div className="run-summary">{r.summary}</div>}
              </div>
            );
          })}
        </div>
      )}

      {errors && errors.length > 0 && (
        <>
          <div className="block-sub-title">erreurs récentes</div>
          <div className="run-list">
            {errors.slice(0, 5).map((e, i) => {
              const acked = e.acknowledged === true || e.acknowledged === "true";
              return (
                <div key={i} className="run-row" style={acked ? { opacity: 0.55 } : undefined}>
                  <div className="run-row-head">
                    <span className="v err-badge">{e.source || "erreur"}</span>
                    {acked && <span className="v ok-badge">✅ traité</span>}
                    <span className="dim">{timeAgo(e.occurred_at)}</span>
                  </div>
                  <div className="run-summary">{e.error_message}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- onglet instructions ---------- */
function InstructionsTab({ agentId, agentName, currentVersion, canWrite, onAction }) {
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
    fetch(`/api/agents/${agentId}/instructions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setVersions(j.versions) : setError(j.error)))
      .catch(() => setError("réseau indisponible"));
  }, [agentId]);

  useEffect(() => { reloadVersions(); }, [reloadVersions]);

  const fetchVersionContent = async (v) => {
    if (content[v]) return content[v];
    const res = await fetch(`/api/agents/${agentId}/instructions?version=${v}`, { cache: "no-store" });
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
    const ok = await onAction("edit_instructions", { content: draft, comment });
    setBusy(false);
    setConfirmSave(false);
    if (ok) { setEditing(false); reloadVersions(); setContent({}); setMsg({ ok: true, text: "nouvelle version enregistrée" }); }
    else setMsg({ ok: false, text: "échec de l'enregistrement" });
  };

  const rollback = async (v) => {
    setBusy(true);
    const ok = await onAction("set_current_version", { version: v });
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
        instructions <span className="block-sub">version courante v{currentVersion ?? "—"}</span>
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
          message={`Retape le nom de l'agent (« ${agentName} ») pour publier cette nouvelle version des instructions. Une notification sera envoyée sur son canal Slack.`}
          confirmWord={agentName}
          busy={busy}
          onConfirm={save}
          onCancel={() => setConfirmSave(false)}
        />
      )}
      {confirmRollback !== null && (
        <ConfirmModal
          title="restaurer une version antérieure"
          message={`Retape le nom de l'agent (« ${agentName} ») pour revenir à la version v${confirmRollback}. Une notification sera envoyée sur son canal Slack.`}
          confirmWord={agentName}
          danger
          busy={busy}
          onConfirm={() => rollback(confirmRollback)}
          onCancel={() => setConfirmRollback(null)}
        />
      )}
    </div>
  );
}

/* ---------- onglet planification (menu horaire) ---------- */
const DAY_CHIPS = [
  { d: 1, l: "L" }, { d: 2, l: "M" }, { d: 3, l: "M" }, { d: 4, l: "J" },
  { d: 5, l: "V" }, { d: 6, l: "S" }, { d: 0, l: "D" },
];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function PlanningPreview({ agent }) {
  const parsed = useMemo(() => parseCron(agent.schedule_cron), [agent.schedule_cron]);
  const isDaySelected = (d) => parsed.days === "*" || (Array.isArray(parsed.days) && parsed.days.includes(d));

  if (!agent.schedule_cron) {
    return <p className="dim">aucun planning configuré</p>;
  }

  return (
    <div>
      <div className="chip-row">
        {DAY_CHIPS.map((c) => (
          <span key={c.d} className={`chip day ${isDaySelected(c.d) ? "selected" : ""}`} style={{ cursor: "default" }}>
            {c.l}
          </span>
        ))}
      </div>
      <div className="chip-row" style={{ marginTop: 8 }}>
        {parsed.hours.length === 0 && <span className="dim" style={{ fontSize: 13 }}>aucun horaire</span>}
        {parsed.hours.map((h) => (
          <span key={h} className="chip selected" style={{ cursor: "default" }}>{h}h</span>
        ))}
      </div>
      <div className="schedule-preview" style={{ marginTop: 12 }}>
        📅 {agent.schedule_label || "—"} <span className="mono dim">· {agent.schedule_cron}</span>
      </div>
    </div>
  );
}

function PlanningTab({ agent, canWrite, onAction }) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState([]);
  const [days, setDays] = useState("*");
  const [addHour, setAddHour] = useState("07");
  const [confirmSave, setConfirmSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const displayName = (agent.name || agent.agent_id).toLowerCase();

  const startEdit = () => {
    const parsed = parseCron(agent.schedule_cron);
    setHours(parsed.hours);
    setDays(parsed.days);
    setEditing(true);
  };

  const isDaySelected = (d) => days === "*" || (Array.isArray(days) && days.includes(d));
  const toggleDay = (d) => {
    setDays((cur) => {
      const base = cur === "*" ? DAY_CHIPS.map((c) => c.d) : cur;
      const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d];
      return next.length === 7 ? "*" : next;
    });
  };

  const addHourChip = () => {
    const h = parseInt(addHour, 10);
    if (!hours.includes(h)) setHours([...hours, h].sort((a, b) => a - b));
  };
  const removeHour = (h) => setHours(hours.filter((x) => x !== h));

  const { cron, label } = buildCron({ hours, days });

  const save = async () => {
    setBusy(true);
    const ok = await onAction("set_schedule", { cron, label });
    setBusy(false);
    setConfirmSave(false);
    if (ok) { setEditing(false); setMsg({ ok: true, text: "planning mis à jour" }); }
    else setMsg({ ok: false, text: "échec de l'enregistrement" });
  };

  return (
    <div className="card block">
      <div className="block-title">
        🕒 déclencheurs
        {canWrite && !editing && (
          <button className="btn-ghost btn-inline" onClick={startEdit}>modifier le planning</button>
        )}
      </div>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</p>}

      {editing ? (
        <div className="editor">
          <div className="field">
            <label>jours</label>
            <div className="chip-row">
              {DAY_CHIPS.map((c) => (
                <button key={c.d} type="button" className={`chip day ${isDaySelected(c.d) ? "selected" : ""}`} onClick={() => toggleDay(c.d)}>
                  {c.l}
                </button>
              ))}
            </div>
            <div className="chip-row" style={{ marginTop: 6 }}>
              <button type="button" className={`chip ${days === "*" ? "selected" : ""}`} onClick={() => setDays("*")}>tous les jours</button>
              <button type="button" className="chip" onClick={() => setDays([1, 2, 3, 4, 5])}>en semaine</button>
            </div>
          </div>

          <div className="field">
            <label>horaires de déclenchement</label>
            <div className="chip-row">
              {hours.length === 0 && <span className="dim" style={{ fontSize: 13 }}>aucun horaire — ajoute au moins une heure</span>}
              {hours.map((h) => (
                <span key={h} className="chip selected">
                  {h}h
                  <button type="button" className="chip-remove" onClick={() => removeHour(h)} aria-label={`retirer ${h}h`}>
                    <IconX size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="hour-picker" style={{ marginTop: 8 }}>
              <select value={addHour} onChange={(e) => setAddHour(e.target.value)}>
                {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}h00</option>)}
              </select>
              <button type="button" className="btn-ghost" onClick={addHourChip}><IconPlus size={13} />ajouter</button>
            </div>
          </div>

          {hours.length > 0 && (
            <div className="schedule-preview">📅 {label} <span className="mono dim">· {cron}</span></div>
          )}

          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>annuler</button>
            <button className="btn-primary" onClick={() => setConfirmSave(true)} disabled={hours.length === 0 || busy}>enregistrer</button>
          </div>
        </div>
      ) : (
        <PlanningPreview agent={agent} />
      )}

      {confirmSave && (
        <ConfirmModal
          title="modifier le planning"
          message={`Retape le nom de l'agent (« ${displayName} ») pour appliquer le nouveau planning. Une notification sera envoyée sur son canal Slack.`}
          confirmWord={displayName}
          busy={busy}
          onConfirm={save}
          onCancel={() => setConfirmSave(false)}
        />
      )}
    </div>
  );
}

/* ---------- onglet intégrations ---------- */
function IntegrationsTab({ agent }) {
  let tools = [];
  try { tools = JSON.parse(agent.tools || "[]"); } catch { tools = []; }
  return (
    <div className="card block">
      <div className="block-title">🔌 intégrations</div>
      <div className="int-grid">
        <div className="int-card"><div className="l">responsable</div><div className="v">{agent.owner || "—"}</div></div>
        <div className="int-card"><div className="l">canal slack</div><div className="v">{agent.slack_channel || "—"}</div></div>
        <div className="int-card"><div className="l">cerveau</div><div className="v">{agent.brain ? `${agent.brain}${agent.brain_ref ? " · " + agent.brain_ref : ""}` : "—"}</div></div>
        <div className="int-card"><div className="l">boards monday</div><div className="v">{agent.boards || "—"}</div></div>
        <div className="int-card"><div className="l">data tables</div><div className="v">{agent.data_tables || "—"}</div></div>
        <div className="int-card"><div className="l">credentials</div><div className="v">{agent.credentials_ref || "—"}</div></div>
        <div className="int-card"><div className="l">rapports</div><div className="v">{agent.report_links || "—"}</div></div>
      </div>
      {tools.length > 0 && (
        <>
          <div className="block-sub-title">outils connectés ({tools.length})</div>
          <ul className="tool-list">
            {tools.map((t) => <li key={t.workflow_id}>{t.name}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------- onglet historique (admin) ---------- */
function HistoryTab({ agentId }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/audit`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setEntries(j.entries) : setError(j.error)))
      .catch(() => setError("réseau indisponible"));
  }, [agentId]);

  const label = (action) => ({
    set_status: "changement de statut", set_schedule: "planning modifié", run_now: "run manuel demandé",
    edit_instructions: "instructions modifiées", set_current_version: "rollback instructions",
  }[action] || action);

  return (
    <div className="card block">
      <div className="block-title">🕓 historique (admin)</div>
      {error && <p className="form-error">{error}</p>}
      {!entries && !error && <p className="dim">chargement…</p>}
      {entries && entries.length === 0 && <p className="dim">aucune action enregistrée</p>}
      {entries && entries.length > 0 && (
        <div>
          {entries.map((e, i) => {
            let details = {};
            try { details = JSON.parse(e.details || "{}"); } catch { details = {}; }
            return (
              <div key={i} className="hist-row">
                <div>
                  <div>{label(e.action)}</div>
                  {details.status && <div className="hist-actor">{details.previous || "?"} → {details.status}</div>}
                  {details.cron && <div className="hist-actor">{details.label || details.cron}</div>}
                  {details.new_version && <div className="hist-actor">nouvelle version v{details.new_version}</div>}
                  {details.set_current && <div className="hist-actor">retour à v{details.set_current}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="hist-actor">{e.actor}</div>
                  <div className="dim">{formatDate(e.ts)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- onglet rapport (Zizou) ---------- */
const MISSIONS = [
  ["verif_parametrage", "vérif paramétrage"], ["diffusion", "diffusion"], ["qualite_tm", "qualité TM"],
  ["placements", "placements"], ["atterrissages", "atterrissages"], ["bilan_objectifs", "bilan objectifs"],
];
const MOD_WORDS = ["modif", "corrig", "fait", "chang", "ajust", "refait", "rectif"];
const VOL_WORDS = ["volont", "assum", "expres", "voulu", "normal"];
const ANOMALIES = new Set(["À reprendre", "Introuvable"]);

function catOf(r) {
  const c = (r.ctm || "").toLowerCase();
  if (c && MOD_WORDS.some((w) => c.includes(w))) return "corrige";
  if (c && VOL_WORDS.some((w) => c.includes(w))) return "volontaire";
  return "a_confirmer";
}
function missionRows(R, m) {
  if (m === "verif_parametrage") return R.filter((r) => r.vz);
  if (m === "diffusion") return R.filter((r) => r.cd);
  if (m === "qualite_tm") return R.filter((r) => r.tm === "Vérifié OK");
  if (m === "placements") return R.filter((r) => (r.cz || "").indexOf("📊") >= 0);
  if (m === "atterrissages") return R.filter((r) => (r.cz || "").indexOf("💸") >= 0 || (r.cz || "").indexOf("📉") >= 0);
  if (m === "bilan_objectifs") return R.filter((r) => r.oz);
  return [];
}
function missionSummary(R, m) {
  const rows = missionRows(R, m);
  let primary = rows.length, chips = [];
  if (m === "verif_parametrage") chips = [[rows.filter((r) => r.vz === "À reprendre").length, "à reprendre", "bad"], [rows.filter((r) => r.vz === "Vérif OK").length, "OK", "ok"]];
  else if (m === "diffusion") { primary = rows.filter((r) => r.cd === "OK").length; chips = [[rows.filter((r) => r.cd === "Pas de diff").length, "pas de diff", "bad"]]; }
  else if (m === "qualite_tm") chips = [[rows.filter((r) => r.vz && r.vz !== "Vérif OK" && catOf(r) === "a_confirmer").length, "à confirmer", "neu"]];
  else if (m === "placements") chips = [["déséquilibres", ""]];
  else if (m === "atterrissages") chips = [[rows.filter((r) => (r.cz || "").indexOf("💸") >= 0).length, "budget", "bad"], [rows.filter((r) => (r.cz || "").indexOf("📉") >= 0).length, "objectif", "bad"]];
  else if (m === "bilan_objectifs") chips = [[rows.filter((r) => r.oz === "Non atteints").length, "non atteints", "bad"], [rows.filter((r) => r.oz === "OK").length, "OK", "ok"]];
  return { primary, chips };
}
function VerdictPill({ v }) {
  let cls = "neu";
  if (ANOMALIES.has(v)) cls = "bad";
  else if (v === "Vérif OK" || v === "OK") cls = "ok";
  else if (v === "Pas de diff" || v === "Non atteints") cls = "bad";
  return <span className={`rpt-pill ${cls}`}>{v || "—"}</span>;
}
function CatPill({ r }) {
  const x = catOf(r);
  if (x === "corrige") return <span className="rpt-pill ok">corrigé</span>;
  if (x === "volontaire") return <span className="rpt-pill warn">volontaire</span>;
  return <span className="rpt-pill neu">à confirmer</span>;
}
function NameCell({ r }) {
  return <a href={r.url} target="_blank" rel="noopener noreferrer">{r.name}</a>;
}
function lineWith(r, emojis) {
  const l = (r.cz || "").split("\n").find((x) => emojis.some((e) => x.indexOf(e) >= 0)) || "";
  return l.slice(0, 150);
}

function ReportTable({ rows, cols }) {
  return (
    <div className="rpt-table-wrap">
      <table className="rpt-table">
        <thead><tr>{cols.map((c) => <th key={c[0]}>{c[0]}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>{cols.map((c) => <td key={c[0]}>{c[1](r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportTab({ agentId, theme }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [plat, setPlat] = useState("");
  const [verdict, setVerdict] = useState("");
  const [dateMin, setDateMin] = useState("");
  const [dateMax, setDateMax] = useState("");
  const [curMission, setCurMission] = useState(null);
  const [showQDetail, setShowQDetail] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/report`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setRecords(j.records) : setError(j.error)))
      .catch(() => setError("réseau indisponible"));
  }, [agentId]);

  const filtered = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (plat && r.plat !== plat) return false;
      if (verdict && r.vz !== verdict) return false;
      if (dateMin && !(r.fin && r.fin >= dateMin)) return false;
      if (dateMax && !(r.fin && r.fin <= dateMax)) return false;
      return true;
    });
  }, [records, plat, verdict, dateMin, dateMax]);

  const plats = useMemo(() => Array.from(new Set((records || []).map((r) => r.plat))).filter(Boolean).sort(), [records]);
  const verdicts = useMemo(() => Array.from(new Set((records || []).map((r) => r.vz))).filter(Boolean).sort(), [records]);

  const vzCounts = useMemo(() => {
    const o = {};
    filtered.forEach((r) => { if (r.vz) o[r.vz] = (o[r.vz] || 0) + 1; });
    return o;
  }, [filtered]);

  const kpis = [
    ["à reprendre", vzCounts["À reprendre"] || 0, true],
    ["vérif OK", vzCounts["Vérif OK"] || 0, false],
    ["pas accès page fb", vzCounts["Pas accès page Fb"] || 0, false],
    ["pas de brief", vzCounts["Pas de brief"] || 0, false],
    ["à vérif. manuel", vzCounts["À vérifier manuellement"] || 0, false],
    ["introuvable", vzCounts["Introuvable"] || 0, false],
  ];

  const tmOK = useMemo(() => filtered.filter((r) => r.tm === "Vérifié OK"), [filtered]);
  const flagged = useMemo(() => tmOK.filter((r) => r.vz && r.vz !== "Vérif OK"), [tmOK]);
  const { corr, vol, conf } = useMemo(() => {
    let corr = 0, vol = 0, conf = 0;
    flagged.forEach((r) => { const x = catOf(r); if (x === "corrige") corr++; else if (x === "volontaire") vol++; else conf++; });
    return { corr, vol, conf };
  }, [flagged]);

  const recos = useMemo(() => {
    const list = [];
    if (conf > 0) list.push(`${conf} anomalies validées OK par un TM sans commentaire : impossible de savoir si c'était un vrai écart corrigé ou un choix volontaire. Remplir le commentaire TM est le levier n°1 pour mesurer les vrais faux positifs.`);
    const types = {};
    filtered.forEach((r) => {
      if (!ANOMALIES.has(r.vz)) return;
      (r.cz || "").split("\n").forEach((l) => {
        const idx = l.indexOf("❌");
        if (idx < 0) return;
        const p = l.slice(idx + 1).split(":")[0].split("→")[0].split("—")[0].trim();
        if (p.length > 2 && p.length < 32) types[p] = (types[p] || 0) + 1;
      });
    });
    const top = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    if (top) list.push(`Type d'anomalie le plus fréquent : ${top[0]} (${top[1]}). À croiser avec les validations TM.`);
    const pf = vzCounts["Pas accès page Fb"] || 0;
    if (pf > 0) list.push(`${pf} campagnes « pas accès page fb » : relancer les clients pour l'accès aux pages Facebook.`);
    const pb = vzCounts["Pas de brief"] || 0;
    if (pb > 0) list.push(`${pb} campagnes sans brief exploitable : à cadrer avant lancement.`);
    list.push("Rappel : Zizou continue de tout signaler, même les écarts justifiés — ce rapport nuance l'analyse, il ne modifie jamais la vérif.");
    return list;
  }, [conf, filtered, vzCounts]);

  const exportCSV = () => {
    const cols = [
      ["campagne", (r) => r.name],
      ["plateforme", (r) => r.plat],
      ["etat", (r) => r.etat],
      ["verdict_zizou", (r) => r.vz],
      ["verif_tm", (r) => r.tm],
      ["commentaire_tm", (r) => r.ctm],
      ["fin", (r) => r.fin],
    ];
    const esc = (v) => {
      const s = String(v == null ? "" : v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = cols.map((c) => c[0]).join(",");
    const rows = filtered.map((r) => cols.map((c) => esc(c[1](r))).join(","));
    const csv = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${agentId}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const missionCols = (m) => {
    if (m === "verif_parametrage") return [["campagne", (r) => <NameCell r={r} />], ["plateforme", (r) => r.plat], ["état", (r) => r.etat], ["verdict zizou", (r) => <VerdictPill v={r.vz} />], ["vérif TM", (r) => r.tm || "—"]];
    if (m === "diffusion") return [["campagne", (r) => <NameCell r={r} />], ["plateforme", (r) => r.plat], ["diffusion", (r) => <VerdictPill v={r.cd} />]];
    if (m === "qualite_tm") return [["campagne", (r) => <NameCell r={r} />], ["plateforme", (r) => r.plat], ["verdict zizou", (r) => <VerdictPill v={r.vz} />], ["catégorie", (r) => <CatPill r={r} />], ["commentaire TM", (r) => r.ctm || "—"]];
    if (m === "placements") return [["campagne", (r) => <NameCell r={r} />], ["plateforme", (r) => r.plat], ["ligne placements", (r) => lineWith(r, ["📊"])]];
    if (m === "atterrissages") return [["campagne", (r) => <NameCell r={r} />], ["plateforme", (r) => r.plat], ["alerte", (r) => lineWith(r, ["💸", "📉"])]];
    if (m === "bilan_objectifs") return [["campagne", (r) => <NameCell r={r} />], ["plateforme", (r) => r.plat], ["objectifs zizou", (r) => <VerdictPill v={r.oz} />]];
    return [];
  };

  if (error === "not_configured" || error === "no_board_configured" || error === "agent_not_found" || error === "no_report_configured") {
    return <div className="card block"><div className="block-title">📊 rapport</div><p className="dim">aucun rapport n'est encore configuré pour cet agent.</p></div>;
  }

  return (
    <div className="card block">
      <div className="block-title">
        📊 rapport — contrôle qualité des campagnes
        {records && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }} className="no-print">
            <button className="btn-ghost" onClick={exportCSV}>⬇️ CSV</button>
            <button className="btn-ghost" onClick={() => window.print()}>🖨️ PDF</button>
          </span>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      {!records && !error && <p className="dim">chargement des données Monday…</p>}

      {records && (
        <>
          <div className="rpt-filters">
            <div className="field">
              <label>plateforme</label>
              <select value={plat} onChange={(e) => setPlat(e.target.value)}>
                <option value="">toutes</option>
                {plats.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>verdict zizou</label>
              <select value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                <option value="">tous</option>
                {verdicts.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label>fin ≥</label>
              <input type="date" value={dateMin} onChange={(e) => setDateMin(e.target.value)} />
            </div>
            <div className="field">
              <label>fin ≤</label>
              <input type="date" value={dateMax} onChange={(e) => setDateMax(e.target.value)} />
            </div>
            <span className="dim" style={{ marginLeft: "auto" }}>{filtered.length} campagnes</span>
          </div>

          <div className="block-sub-title">vue d'ensemble</div>
          <div className="rpt-kpis">
            {kpis.map((k) => (
              <div className={`rpt-kpi ${k[2] ? "hot" : ""}`} key={k[0]}>
                <div className="l">{k[0]}</div>
                <div className="v">{k[1]}</div>
              </div>
            ))}
          </div>

          <div className="block-sub-title">conclusions &amp; recommandations</div>
          <ul className="rpt-reco">
            {recos.map((r, i) => <li key={i}>{r}</li>)}
          </ul>

          <div className="block-sub-title">qualité — zizou vs TM</div>
          <p className="dim" style={{ fontSize: 13 }}>Campagnes validées « Vérifié OK » par un TM. Distingue écarts corrigés, volontaires, et à confirmer.</p>
          <div className="rpt-qrow">
            <div className="rpt-qt tot"><div className="v">{tmOK.length}</div><div className="t">validées par un TM</div></div>
            <div className="rpt-qt ok"><div className="v">{corr}</div><div className="t">corrigées — zizou avait raison</div></div>
            <div className="rpt-qt vol"><div className="v">{vol}</div><div className="t">volontaires — assumées</div></div>
            <div className="rpt-qt conf"><div className="v">{conf}</div><div className="t">à confirmer — pas de comm. TM</div></div>
          </div>
          <button className="toggle" style={{ marginTop: 10 }} onClick={() => setShowQDetail((s) => !s)}>
            {showQDetail ? "masquer le détail ▴" : "voir le détail des campagnes ▾"}
          </button>
          {showQDetail && (
            flagged.length ? (
              <ReportTable rows={flagged} cols={[["campagne", (r) => <NameCell r={r} />], ["plateforme", (r) => r.plat], ["verdict zizou", (r) => r.vz], ["catégorie", (r) => <CatPill r={r} />], ["commentaire TM", (r) => r.ctm || "—"]]} />
            ) : <p className="dim">aucune campagne validée par un TM dans ce filtre.</p>
          )}

          <div className="block-sub-title">résumé par mission</div>
          <div className="rpt-mgrid">
            {MISSIONS.map(([id, label]) => {
              const s = missionSummary(filtered, id);
              const on = curMission === id;
              return (
                <div key={id} className={`rpt-mcard ${on ? "on" : ""}`} onClick={() => setCurMission(on ? null : id)}>
                  <div className="mt">{label} <span>{on ? "masquer ▴" : "détail →"}</span></div>
                  <div className="mv">{s.primary}</div>
                  <div className="chip-row" style={{ marginTop: 8 }}>
                    {s.chips.map((c, i) => (
                      <span key={i} className={`rpt-pill ${c[2] || "neu"}`}>{typeof c[0] === "number" ? `${c[0]} ` : ""}{c[1]}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {curMission && (
            missionRows(filtered, curMission).length ? (
              <ReportTable rows={missionRows(filtered, curMission)} cols={missionCols(curMission)} />
            ) : <p className="dim">aucune campagne pour cette mission dans le filtre courant.</p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- page principale ---------- */
/* ---------- onglet missions ---------- */
function MissionCard({ m, theme }) {
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
          <div className="agent-card-role">{m.reference_only ? "mission de référence" : "mission terrain"}</div>
        </div>
      </div>
      <span className="status-pill" style={statusStyle}>
        {running ? <IconRefresh size={11} /> : <span className="dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />}
        {statusLabel}
      </span>
      <div className="chip-row">
        <span className="stat-chip"><IconClock size={12} />{m.reference_only ? "pas de planning" : (m.base_times || "—")}</span>
        <span className="stat-chip">{last ? timeAgo(last.started_at) : "jamais exécutée"}</span>
        <span className="stat-chip mono">v{m.instructions_version ?? "—"}</span>
      </div>
    </Link>
  );
}

function MissionsScheduleOverview({ missions, theme }) {
  const slots = useMemo(() => {
    const scheduled = missions.filter((m) => !m.reference_only && m.active && m.base_times);
    const byTime = {};
    scheduled.forEach((m) => {
      String(m.base_times || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => {
        if (!byTime[t]) byTime[t] = [];
        byTime[t].push(m);
      });
    });
    return Object.entries(byTime).sort((a, b) => a[0].localeCompare(b[0]));
  }, [missions]);

  if (!slots.length) return null;

  return (
    <div className="card block" style={{ marginBottom: 18 }}>
      <div className="block-title">🕒 planning des missions</div>
      <p className="dim" style={{ fontSize: 12, marginBottom: 12 }}>chaque mission se déclenche tous les jours aux horaires ci-dessous (+ relances en cas d'échec, jusqu'à l'heure de cutoff propre à chaque mission).</p>
      <div className="chip-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        {slots.map(([time, ms]) => (
          <div key={time} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontWeight: 600, minWidth: 48, color: theme.colorDark }}>{time}</span>
            {ms.map((m) => (
              <Link key={m.mission_key} href={`/missions/${m.mission_key}`} className="stat-chip" style={{ background: `${theme.color}18`, color: theme.colorDark }}>
                {m.name || m.mission_key}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionsTab({ agentId, theme }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/missions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setData(j.missions) : setError(j.error)))
      .catch(() => setError("réseau indisponible"));
  }, [agentId]);

  if (error) return <div className="card block"><p className="form-error">{error}</p></div>;
  if (!data) return <div className="card block"><p className="dim">chargement…</p></div>;

  const terrain = data.filter((m) => !m.reference_only);
  const reference = data.filter((m) => m.reference_only);

  return (
    <div>
      {data.length === 0 ? (
        <div className="card block"><p className="dim">aucune mission configurée pour cet agent.</p></div>
      ) : (
        <>
          <MissionsScheduleOverview missions={data} theme={theme} />
          <div className="grid">
            {terrain.map((m) => <MissionCard key={m.mission_key} m={m} theme={theme} />)}
          </div>
          {reference.length > 0 && (
            <>
              <div className="block-sub-title" style={{ marginTop: 20, marginBottom: 12 }}>📖 missions de référence</div>
              <div className="grid">
                {reference.map((m) => <MissionCard key={m.mission_key} m={m} theme={theme} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const TABS = [
  { id: "overview", label: "🪪 vue d'ensemble" },
  { id: "missions", label: "🎯 missions" },
  { id: "report", label: "📊 rapport" },
  { id: "planning", label: "🕒 planification" },
  { id: "instructions", label: "📝 instructions" },
  { id: "integrations", label: "🔌 intégrations" },
  { id: "history", label: "🕓 historique", adminOnly: true },
];

export default function AgentDetail() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [identMsg, setIdentMsg] = useState(null);
  const [tab, setTab] = useState("overview");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, { cache: "no-store" });
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 404) { setError("agent introuvable"); return; }
      if (res.status === 403) { setError("vous n'avez pas accès à cet agent — contactez un administrateur."); return; }
      const json = await res.json();
      if (json.ok) { setData(json); setError(null); } else setError(json.error || "erreur");
    } catch {
      setError("réseau indisponible");
    }
  }, [agentId, router]);

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
      const res = await fetch(`/api/agents/${agentId}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (json.ok) {
        setIdentMsg({ ok: true, text: "action effectuée" });
        load();
        return true;
      }
      setIdentMsg({ ok: false, text: `échec — ${json.error || "erreur"}` });
      return false;
    } catch {
      setIdentMsg({ ok: false, text: "réseau indisponible" });
      return false;
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  const isAdmin = data?.viewer?.role === "admin";
  const perms = data?.viewer?.permissions; // null = admin (accès complet)
  const canToggle = isAdmin || perms?.status === true;
  const canRun = isAdmin || perms?.run === true;
  const canSchedule = isAdmin || perms?.schedule === true;
  const canInstructions = isAdmin || perms?.instructions === true;
  const theme = data ? agentTheme(agentId) : null;
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

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

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p style={{ color: "var(--texte)" }}>chargement…</p>}

      {data && (
        <>
          <AgentHeader agent={data.agent} canToggle={canToggle} canRun={canRun} onAction={runAction} msg={identMsg} onGoOverview={() => setTab("overview")} />

          <div className="tab-bar" style={{ marginTop: 20 }}>
            {visibleTabs.map((t) => (
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
            {tab === "overview" && <OverviewTab agent={data.agent} agentId={agentId} canAck={isAdmin || data?.viewer?.role === "operateur"} onAction={runAction} />}
            {tab === "missions" && <MissionsTab agentId={agentId} theme={theme} />}
            {tab === "report" && <ReportTab agentId={agentId} theme={theme} />}
            {tab === "planning" && <PlanningTab agent={data.agent} canWrite={canSchedule} onAction={runAction} />}
            {tab === "instructions" && (
              <InstructionsTab
                agentId={agentId}
                agentName={(data.agent.name || data.agent.agent_id).toLowerCase()}
                currentVersion={data.agent.instructions_version}
                canWrite={canInstructions}
                onAction={runAction}
              />
            )}
            {tab === "integrations" && <IntegrationsTab agent={data.agent} />}
            {tab === "history" && isAdmin && <HistoryTab agentId={agentId} />}
          </div>
        </>
      )}
    </div>
  );
}
