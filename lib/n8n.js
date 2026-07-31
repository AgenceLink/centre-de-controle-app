const BASE = "https://agencelink.app.n8n.cloud/webhook";

// Cache court des lectures (agents_list, agent_detail, instructions, runs, run_events,
// errors, agent_report, audit_log) : le dashboard interroge ces routes en polling toutes
// les 10 à 45 s depuis plusieurs onglets/utilisateurs en parallèle. Sans cache, chaque
// poll de chaque onglet déclenche une exécution n8n complète (la passerelle "API lecture"
// est un simple webhook — n8n facture une exécution par appel reçu, quel que soit son
// contenu). Ce cache mémoire, partagé par toutes les requêtes traitées par une même
// instance Vercel tant qu'elle reste "chaude", regroupe les appels identiques (même
// action + mêmes paramètres) survenant dans la même fenêtre de 20 s, et déduplique aussi
// les appels concurrents (plusieurs onglets qui pollent au même instant partagent la même
// promesse en vol au lieu de déclencher un appel n8n chacun).
// Limite connue : ce n'est pas un cache partagé garanti entre toutes les instances Vercel
// (Vercel peut démarrer plusieurs instances en cas de charge concurrente élevée) — pour un
// outil interne à quelques utilisateurs, l'essentiel du trafic passe par une poignée
// d'instances réutilisées, donc le gain reste réel, mais ce n'est pas un cache distribué
// garanti à 100 %. Si une réduction plus forte est nécessaire, l'étape suivante serait un
// cache partagé externe (ex. Vercel KV) plutôt que ce cache en mémoire.
const READ_CACHE_TTL_MS = 20000;
const readCache = new Map(); // clé JSON du corps de la requête -> { at, promise }

async function call(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cc-secret": process.env.CC_API_SECRET || "",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`n8n ${path} -> HTTP ${res.status}`);
  return res.json();
}

export function n8nRead(body) {
  const key = JSON.stringify(body);
  const now = Date.now();
  const cached = readCache.get(key);
  if (cached && now - cached.at < READ_CACHE_TTL_MS) {
    return cached.promise;
  }
  const promise = call("/cc-registre-x7Kd94mQvTz2LpWa8Rns", body).catch((err) => {
    // une erreur ne doit pas rester en cache — on la retire pour que le prochain appel réessaie
    readCache.delete(key);
    throw err;
  });
  readCache.set(key, { at: now, promise });
  return promise;
}

export async function n8nWrite(body) {
  const data = await call("/cc-ecriture-p2Wq7nJx4TkVe9RmB3sd", body);
  // une écriture peut changer n'importe quelle lecture déjà en cache (statut, planning,
  // instructions...) : on vide tout le cache de lecture par prudence plutôt que de risquer
  // d'afficher une donnée périmée juste après une action de l'utilisateur.
  readCache.clear();
  return data;
}

export const n8nAuth = (body) => call("/cc-auth-t6Yw3RqZk8LmPv2N", body);
