"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { agentTheme } from "@/lib/agentTheme";
import { PERMISSION_FIELDS, PERMISSION_LABELS } from "@/lib/permissions";

const ROLES = [
  { value: "admin", label: "admin" },
  { value: "operateur", label: "opérateur" },
  { value: "lecteur", label: "lecteur" },
];

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

function AgentAccessPanel({ u, agents, onSavePermissions }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(u.agent_permissions || {})));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const isOperateur = u.role === "operateur";

  const toggleAgent = (agentId) => {
    setMsg(null);
    setDraft((prev) => {
      const next = { ...prev };
      if (next[agentId]) {
        delete next[agentId];
      } else {
        next[agentId] = { status: true, schedule: true, run: true, instructions: true };
      }
      return next;
    });
  };

  const togglePerm = (agentId, field) => {
    setMsg(null);
    setDraft((prev) => ({ ...prev, [agentId]: { ...prev[agentId], [field]: !prev[agentId]?.[field] } }));
  };

  const save = async () => {
    setBusy(true);
    const ok = await onSavePermissions(u.email, draft);
    setBusy(false);
    setMsg(ok ? { ok: true, text: "accès mis à jour" } : { ok: false, text: "échec de la mise à jour" });
  };

  if (!agents.length) return <p className="dim" style={{ marginTop: 10 }}>chargement des agents…</p>;

  return (
    <div className="agent-access-panel">
      <p className="dim" style={{ marginBottom: 10, fontSize: 12.5 }}>
        {isOperateur
          ? "coche les agents attribués, puis les actions autorisées sur chacun."
          : "coche les agents que cette personne peut consulter (lecture seule)."}
      </p>
      <div className="agent-access-list">
        {agents.map((a) => {
          const theme = agentTheme(a.agent_id);
          const assigned = !!draft[a.agent_id];
          return (
            <div key={a.agent_id} className="agent-access-row">
              <label className="agent-access-check">
                <input type="checkbox" checked={assigned} onChange={() => toggleAgent(a.agent_id)} />
                <span className="agent-dot" style={{ background: theme.color }} />
                {(a.name || a.agent_id).toLowerCase()}
              </label>
              {assigned && isOperateur && (
                <div className="agent-perm-chips">
                  {PERMISSION_FIELDS.map((f) => (
                    <label key={f} className="perm-chip">
                      <input type="checkbox" checked={draft[a.agent_id]?.[f] === true} onChange={() => togglePerm(a.agent_id, f)} />
                      {PERMISSION_LABELS[f]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="modal-actions" style={{ marginTop: 12 }}>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "enregistrement…" : "enregistrer les accès"}</button>
      </div>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</p>}
    </div>
  );
}

function UserRow({ u, selfEmail, agents, onSave, onDelete, onSavePermissions, onResetPassword }) {
  const [role, setRole] = useState(u.role);
  const [confirmChange, setConfirmChange] = useState(null); // { role?, status? }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const isSelf = u.email === selfEmail;
  const assignedCount = Object.keys(u.agent_permissions || {}).length;

  const requestRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === u.role) return;
    setConfirmChange({ role: newRole });
  };

  const requestStatusToggle = () => {
    setConfirmChange({ status: u.status === "active" ? "disabled" : "active" });
  };

  const cancel = () => {
    setConfirmChange(null);
    setRole(u.role);
  };

  const confirm = async () => {
    setBusy(true);
    const ok = await onSave(u.email, confirmChange);
    setBusy(false);
    setConfirmChange(null);
    setMsg(ok ? { ok: true, text: "mis à jour" } : { ok: false, text: "échec de la mise à jour" });
  };

  const confirmDeletion = async () => {
    setBusy(true);
    const ok = await onDelete(u.email);
    setBusy(false);
    setConfirmDelete(false);
    if (!ok) setMsg({ ok: false, text: "échec de la suppression" });
  };

  const confirmReinit = async () => {
    setBusy(true);
    const res = await onResetPassword(u.email);
    setBusy(false);
    setConfirmReset(false);
    if (res?.ok) {
      setTempPassword(res.tempPassword);
      setMsg(null);
    } else {
      setMsg({ ok: false, text: "échec de la réinitialisation" });
    }
  };

  return (
    <div className="version-row">
      <div className="user-row">
        <div className="user-info">
          <div className="version-comment">{u.name || u.email}</div>
          <div className="version-sub">
            {u.email} · créé {formatDate(u.created_at)} · dernière connexion {u.last_login_at ? formatDate(u.last_login_at) : "jamais"}
            {u.must_change_password && " · changement de mot de passe requis"}
          </div>
        </div>
        <div className="user-controls">
          <select
            className="role-select"
            value={role}
            disabled={isSelf || busy}
            onChange={(e) => requestRoleChange(e.target.value)}
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button
            className="btn-ghost"
            disabled={isSelf || busy}
            onClick={requestStatusToggle}
          >
            {u.status === "active" ? "désactiver" : "réactiver"}
          </button>
          <button
            className="btn-ghost"
            disabled={isSelf || busy}
            onClick={() => setConfirmReset(true)}
          >
            réinitialiser le mot de passe
          </button>
          <button
            className="btn-danger btn-danger-ghost"
            disabled={isSelf || busy}
            onClick={() => setConfirmDelete(true)}
          >
            supprimer
          </button>
        </div>
      </div>
      {isSelf && <p className="dim">votre propre compte — rôle, statut et suppression non modifiables ici</p>}
      {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</p>}
      {tempPassword && (
        <div className="temp-password-box">
          <p className="form-ok">mot de passe réinitialisé. Nouveau mot de passe provisoire (à communiquer une seule fois, non stocké) :</p>
          <p className="mono temp-password">{tempPassword}</p>
        </div>
      )}

      {u.role === "admin" ? (
        <p className="dim" style={{ marginTop: 8, fontSize: 12.5 }}>accès à tous les agents (admin)</p>
      ) : (
        <>
          <button className="toggle" style={{ marginTop: 8 }} onClick={() => setAccessOpen((v) => !v)}>
            {accessOpen ? "masquer les agents attribués" : `agents attribués (${assignedCount})`}
          </button>
          {accessOpen && <AgentAccessPanel u={u} agents={agents} onSavePermissions={onSavePermissions} />}
        </>
      )}

      {confirmChange && (
        <ConfirmModal
          title={confirmChange.role ? "changer le rôle" : u.status === "active" ? "désactiver le compte" : "réactiver le compte"}
          message={
            confirmChange.role
              ? `Retape l'email (« ${u.email} ») pour donner le rôle « ${ROLES.find((r) => r.value === confirmChange.role)?.label}» à ce compte.`
              : `Retape l'email (« ${u.email} ») pour ${u.status === "active" ? "désactiver" : "réactiver"} ce compte.`
          }
          confirmWord={u.email}
          danger={!!confirmChange.status && u.status === "active"}
          busy={busy}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}

      {confirmReset && (
        <ConfirmModal
          title="réinitialiser le mot de passe"
          message={`Retape l'email (« ${u.email} ») pour générer un nouveau mot de passe provisoire. L'ancien mot de passe sera immédiatement invalidé et la personne devra le changer à sa prochaine connexion.`}
          confirmWord={u.email}
          busy={busy}
          onConfirm={confirmReinit}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="supprimer le compte définitivement"
          message={`Action irréversible. Retape l'email (« ${u.email} ») pour supprimer ce compte pour de bon — l'historique de connexion et le compte lui-même seront effacés. Si tu veux juste bloquer l'accès sans perdre la trace, utilise plutôt « désactiver ».`}
          confirmWord={u.email}
          danger
          busy={busy}
          onConfirm={confirmDeletion}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function NewUserForm({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("lecteur");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    setBusy(true);
    const res = await onCreate({ email: email.trim().toLowerCase(), name: name.trim(), role, createNew: true });
    setBusy(false);
    setResult(res);
    if (res?.ok) {
      setEmail("");
      setName("");
      setRole("lecteur");
    }
  };

  if (!open) {
    return <button className="btn-primary" onClick={() => setOpen(true)}>créer un utilisateur</button>;
  }

  return (
    <div className="card block">
      <div className="block-title">nouvel utilisateur</div>
      <div className="editor">
        <div className="field">
          <label>email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@link.fr" />
        </div>
        <div className="field">
          <label>nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" />
        </div>
        <div className="field">
          <label>rôle</label>
          <select className="role-select" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => { setOpen(false); setResult(null); }} disabled={busy}>annuler</button>
          <button className="btn-primary" onClick={submit} disabled={busy || !email.trim() || !name.trim()}>
            {busy ? "création…" : "créer le compte"}
          </button>
        </div>
        {result && !result.ok && <p className="form-error">échec — {result.error || "erreur"}</p>}
        {result?.ok && result.tempPassword && (
          <div className="temp-password-box">
            <p className="form-ok">compte créé. Mot de passe provisoire (à communiquer une seule fois, non stocké) :</p>
            <p className="mono temp-password">{result.tempPassword}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [viewer, setViewer] = useState(null);
  const [users, setUsers] = useState(null);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      if (json.ok) setViewer(json.viewer);
    } catch {
      /* ignore, users load will surface the error */
    }
  }, [router]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 403) { setForbidden(true); return; }
      setForbidden(false);
      const json = await res.json();
      if (json.ok) { setUsers(json.users); setError(null); } else setError(json.error || "erreur");
    } catch {
      setError("réseau indisponible");
    }
  }, [router]);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setAgents(json.agents || []);
    } catch {
      /* pas bloquant */
    }
  }, []);

  useEffect(() => {
    loadSession();
    loadUsers();
    loadAgents();
    let t = setInterval(loadUsers, 60000);
    const onVis = () => {
      clearInterval(t);
      if (document.visibilityState === "visible") { loadUsers(); t = setInterval(loadUsers, 60000); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [loadSession, loadUsers, loadAgents]);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  const saveChange = async (email, change) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...change }),
      });
      const json = await res.json();
      if (json.ok) { loadUsers(); return true; }
      return false;
    } catch {
      return false;
    }
  };

  const saveAgentPermissions = async (email, agent_permissions) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, agent_permissions }),
      });
      const json = await res.json();
      if (json.ok) { loadUsers(); return true; }
      return false;
    } catch {
      return false;
    }
  };

  const deleteUser = async (email) => {
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.ok) { loadUsers(); return true; }
      return false;
    } catch {
      return false;
    }
  };

  const resetPassword = async (email) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetPassword: true }),
      });
      const json = await res.json();
      if (json.ok) loadUsers();
      return json;
    } catch {
      return { ok: false, error: "réseau indisponible" };
    }
  };

  const createUser = async (payload) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) loadUsers();
      return json;
    } catch {
      return { ok: false, error: "réseau indisponible" };
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <Link href="/" className="brand">
          <img src="/logo-link.png" alt="Link" />
          <h1>centre de <span>contrôle</span></h1>
        </Link>
        <div className="viewer">
          {viewer && (
            <>
              <span>{viewer.name}</span>
              <span className="role-chip">{viewer.role}</span>
            </>
          )}
          <button className="btn-ghost" onClick={logout}>déconnexion</button>
        </div>
      </div>
      <div className="vague-strip" />

      <Link href="/" className="back-link">← vue d'ensemble</Link>

      <h2 className="users-title">gestion des utilisateurs</h2>

      {forbidden && <p className="form-error">accès réservé aux administrateurs.</p>}
      {error && <p className="form-error">{error}</p>}
      {!users && !forbidden && !error && <p style={{ color: "var(--texte)" }}>chargement…</p>}

      {users && (
        <>
          <div className="version-list users-list">
            {users.map((u) => (
              <UserRow
                key={u.email}
                u={u}
                selfEmail={viewer?.email}
                agents={agents}
                onSave={saveChange}
                onDelete={deleteUser}
                onSavePermissions={saveAgentPermissions}
                onResetPassword={resetPassword}
              />
            ))}
          </div>
          <div className="users-new">
            <NewUserForm onCreate={createUser} />
          </div>
        </>
      )}
    </div>
  );
}
