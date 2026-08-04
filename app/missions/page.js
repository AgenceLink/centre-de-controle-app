import { redirect } from "next/navigation";

// La liste des missions vit maintenant dans un onglet de la fiche agent
// (/agents/zizou → onglet "missions"), pas comme page indépendante.
export default function MissionsPage() {
  redirect("/agents/zizou");
}
