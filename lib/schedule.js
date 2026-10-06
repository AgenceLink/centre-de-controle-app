const DAY_LABELS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const DAY_LABELS_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function parseCron(cron) {
  const parts = String(cron || "").trim().split(/\s+/);
  if (parts.length !== 5) return { hours: [], days: "*", valid: false };
  const [, hourField, , , dowField] = parts;
  const hours = hourField === "*"
    ? []
    : hourField.split(",").map((h) => parseInt(h, 10)).filter((h) => !isNaN(h)).sort((a, b) => a - b);
  const days = dowField === "*" ? "*" : dowField.split(",").map((d) => parseInt(d, 10)).filter((d) => !isNaN(d));
  return { hours, days, valid: hours.length > 0 };
}

export function buildCron({ hours, days }) {
  const sortedHours = [...new Set(hours)].sort((a, b) => a - b);
  if (sortedHours.length === 0) return { cron: "", label: "" };
  const hourField = sortedHours.join(",");
  const dowField = days === "*" || !days || days.length === 7 ? "*" : [...new Set(days)].sort().join(",");
  const cron = `0 ${hourField} * * ${dowField}`;

  const timesLabel = sortedHours.map((h) => `${h}h`).join(", ").replace(/,([^,]*)$/, " et$1");
  let daysLabel;
  if (dowField === "*") daysLabel = "tous les jours";
  else {
    const dayNums = dowField.split(",").map((d) => parseInt(d, 10));
    if (dayNums.length === 5 && [1, 2, 3, 4, 5].every((d) => dayNums.includes(d))) daysLabel = "en semaine (lun-ven)";
    else daysLabel = dayNums.map((d) => DAY_LABELS_LONG[d]).join(", ");
  }
  const label = `${daysLabel.charAt(0).toUpperCase()}${daysLabel.slice(1)} à ${timesLabel}`;
  return { cron, label };
}

export { DAY_LABELS, DAY_LABELS_LONG };

/* ---------- jours de planification des missions (colonne base_days du registre) ----------
   Même syntaxe que le dispatcher (« Decide Mission Run », API agent) :
   jour ISO 1 = lundi … 7 = dimanche · intervalle 1-5 · Nième jour du mois 1#1 (= 1er lundi du mois)
   · plusieurs jetons séparés par des virgules · vide, absent ou * = tous les jours.
   Un jeton illisible est ignoré ; si aucun n'est lisible, le dispatcher retombe sur « tous les jours »,
   et l'affichage fait de même. Les jours renvoyés sont au format JavaScript (0 = dimanche … 6 = samedi). */

const ORDINAL = { 1: "1er", 2: "2e", 3: "3e", 4: "4e", 5: "5e" };
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function parseBaseDays(spec) {
  const raw = String(spec ?? "").replace(/\s+/g, "");
  const all = { all: true, spec: raw, days: [...WEEK_ORDER], nth: {}, label: "tous les jours", short: "tous les jours" };
  if (!raw || raw === "*") return all;
  const plain = new Set();
  const nth = {};
  raw.split(",").forEach((tok) => {
    let m;
    if ((m = tok.match(/^([1-7])#([1-5])$/))) {
      const d = Number(m[1]) % 7;
      (nth[d] = nth[d] || []).push(Number(m[2]));
    } else if ((m = tok.match(/^([1-7])-([1-7])$/))) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a <= b) for (let i = a; i <= b; i++) plain.add(i % 7);
    } else if ((m = tok.match(/^([1-7])$/))) {
      plain.add(Number(m[1]) % 7);
    }
  });
  Object.keys(nth).forEach((d) => {
    if (plain.has(Number(d))) delete nth[d];
    else if (new Set(nth[d]).size === 5) { plain.add(Number(d)); delete nth[d]; } // les 5 occurrences = chaque semaine
  });
  const days = WEEK_ORDER.filter((d) => plain.has(d) || nth[d]);
  if (!days.length) return all;
  if (plain.size === 7) return all;

  const weekdays = [1, 2, 3, 4, 5].every((d) => plain.has(d)) && plain.size === 5 && !Object.keys(nth).length;
  let label;
  let short;
  if (weekdays) {
    label = "du lundi au vendredi";
    short = "lun-ven";
  } else {
    const parts = days.map((d) => {
      if (plain.has(d)) return { long: `le ${DAY_LABELS_LONG[d]}`, short: DAY_LABELS[d] };
      const set = [...new Set(nth[d])].sort((a, b) => a - b);
      if (set.length === 4) {
        // toutes les semaines sauf une (ex. « 1#2,1#3,1#4,1#5 » = chaque lundi sauf le 1er du mois)
        const sauf = ORDINAL[[1, 2, 3, 4, 5].find((r) => !set.includes(r))];
        return { long: `le ${DAY_LABELS_LONG[d]} sauf le ${sauf} du mois`, short: `${DAY_LABELS[d]} sauf ${sauf} du mois` };
      }
      const ranks = set.map((r) => ORDINAL[r]).join(" et ");
      return { long: `le ${ranks} ${DAY_LABELS_LONG[d]} du mois`, short: `${ranks} ${DAY_LABELS[d]} du mois` };
    });
    label = parts.map((p) => p.long).join(", ").replace(/,([^,]*)$/, " et$1");
    short = parts.map((p) => p.short).join(", ");
  }
  return { all: false, spec: raw, days, nth, label, short };
}

// Cases cochées (jours JavaScript 0-6) -> valeur base_days à enregistrer. Tous cochés = "" (tous les jours).
export function buildBaseDays(selected) {
  const iso = [...new Set(selected)].map((d) => (d === 0 ? 7 : d)).sort((a, b) => a - b);
  if (!iso.length || iso.length === 7) return "";
  const out = [];
  let start = iso[0];
  let prev = iso[0];
  for (let i = 1; i <= iso.length; i++) {
    const cur = iso[i];
    if (cur === prev + 1) { prev = cur; continue; }
    out.push(start === prev ? String(start) : prev === start + 1 ? `${start},${prev}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  return out.join(",");
}

// Agents dont le planning est porté par leurs missions (et non par un cron d'agent).
export const MISSION_AGENTS = ["zizou", "nino"];
export const isMissionAgent = (agentId) => MISSION_AGENTS.includes(agentId);
