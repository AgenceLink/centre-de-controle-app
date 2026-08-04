// Permissions granulaires par agent pour le rôle "operateur".
// Forme stockée (colonne agent_permissions de cc_users, JSON stringifié) :
// { "zizou": { "status": true, "schedule": true, "run": true, "instructions": false }, ... }
// La simple présence d'une clé agent = agent attribué (utilisé aussi pour le rôle "lecteur").

export const PERMISSION_FIELDS = ["status", "schedule", "run", "instructions"];

export const PERMISSION_LABELS = {
  status: "activer / désactiver",
  schedule: "modifier le planning",
  run: "lancer un run",
  instructions: "modifier les instructions",
};

// mapping action d'écriture -> clé de permission
const ACTION_TO_FIELD = {
  set_status: "status",
  set_schedule: "schedule",
  run_now: "run",
  edit_instructions: "instructions",
  set_current_version: "instructions",
  edit_mission_instructions: "instructions",
  set_current_mission_version: "instructions",
  set_mission_schedule: "schedule",
};

export function parsePermissions(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isAssigned(session, agentId) {
  if (!session) return false;
  if (session.role === "admin") return true;
  const perms = session.agent_permissions || {};
  return Object.prototype.hasOwnProperty.call(perms, agentId);
}

export function canDo(session, agentId, action) {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (session.role !== "operateur") return false;
  if (action === "acknowledge_errors") {
    const perms = session.agent_permissions || {};
    return Object.prototype.hasOwnProperty.call(perms, agentId);
  }
  const field = ACTION_TO_FIELD[action];
  if (!field) return false;
  const perms = session.agent_permissions || {};
  const agentPerms = perms[agentId];
  return !!agentPerms && agentPerms[field] === true;
}

export function assignedAgentIds(session) {
  if (!session) return [];
  const perms = session.agent_permissions || {};
  return Object.keys(perms);
}

// permissions du viewer sur un agent donné, pour renvoyer au front (null = accès complet, admin)
export function viewerAgentPermissions(session, agentId) {
  if (!session) return null;
  if (session.role === "admin") return null;
  const perms = session.agent_permissions || {};
  const agentPerms = perms[agentId];
  if (!agentPerms) return { status: false, schedule: false, run: false, instructions: false };
  if (session.role === "lecteur") return { status: false, schedule: false, run: false, instructions: false };
  return {
    status: agentPerms.status === true,
    schedule: agentPerms.schedule === true,
    run: agentPerms.run === true,
    instructions: agentPerms.instructions === true,
  };
}
