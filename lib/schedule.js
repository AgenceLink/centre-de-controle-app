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
