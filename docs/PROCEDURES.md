# Procédures internes — Centre de contrôle

Notes de procédure pour Claude (pas de contenu destiné à l'UI de l'app). À lire avant toute intervention du type décrit ci-dessous.

## Modification des workflows dispatcher Zizou (staging avant prod)

**Concerne** : tout changement sur les 3 workflows dispatcher de Zizou :
- "Centre de contrôle — API agent" (3m7fKfSCMARm9X4M)
- "Centre de contrôle — API lecture" (XrGd8SAVT8piiv5J)
- "Centre de contrôle — API écriture" (jfxGYukgJkzQFske)

**Origine** : deux bugs réels de câblage n8n ont été introduits par inadvertance lors de modifications de ces workflows le 2026-08-05 (une race condition sur la logique de déclenchement manuel, un index de switch node décalé après ajout d'une règle qui a aussi effacé `options.fallbackOutput`). Les deux ont été rattrapés par vigilance manuelle après coup — pas un filet fiable à terme (point 20 de l'étude Zizou du 2026-08-05, validé par Juliette).

**Procédure obligatoire, à partir de maintenant, avant tout changement sur un de ces 3 workflows** :

1. Dupliquer le workflow cible en copie `STAGING — {nom du workflow}` (`create_workflow_from_code` ou copie manuelle du JSON) si une copie n'existe pas déjà pour ce workflow.
2. Appliquer le changement d'abord sur la copie STAGING.
3. Valider avec `validate_workflow`, puis `test_workflow` avec des données simulées (pin data) couvrant précisément le scénario modifié (ex. priorité du déclenchement manuel, nouvelle règle de switch, etc.) — pas seulement un test générique.
4. Une fois le comportement confirmé correct en staging, porter EXACTEMENT le même changement sur le workflow de prod.
5. Republier (`publish_workflow` — une modification n'est jamais live sans ça) puis faire un test réel en direct sur la prod avant de considérer que c'est terminé.
6. Garder les copies STAGING (ne pas les archiver après usage comme les tests ponctuels jetables) : elles servent de base réutilisable pour les prochains changements du même workflow.

**Ne pas** : modifier directement le workflow de prod dispatcher sans passer par staging, même pour un changement qui semble trivial (les deux bugs du 2026-08-05 semblaient triviaux au moment de l'écriture).

**Précision de portée (ajoutée après la première application de cette règle, le 2026-08-05)** : l'outillage disponible ne permet pas de dupliquer un workflow existant à l'identique en un clic (pas d'outil "duplicate" — seule la création depuis du code SDK est possible, ce qui veut dire reconstruire à la main un workflow de 20+ nodes pour en faire une copie, avec un vrai risque de transcription). Le clonage complet en STAGING (étapes 1 à 6 ci-dessus) est donc réservé aux changements qui touchent la logique de branchement/routage (switch, conditions, ordre de priorité) — c'est précisément là que les deux bugs du 2026-08-05 se sont produits. Pour un ajout additif et linéaire (nouveau node de lecture en bout de chaîne, nouveau champ dans une réponse) qui ne touche à aucun switch ni aucune condition existante, le filet minimum est : modifier le brouillon, le tester (`test_workflow`/`execute_workflow` manuel) AVANT `publish_workflow`, vérifier le résultat, publier, puis refaire un test en direct sur la prod. Toujours signaler à Juliette quand ce filet allégé est utilisé plutôt que le clonage complet, pour que la règle reste honnête plutôt qu'un vœu pieux non appliqué.
