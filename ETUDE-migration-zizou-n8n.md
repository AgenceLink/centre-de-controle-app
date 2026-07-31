# Étude — migrer le moteur de Zizou vers n8n (déclenchement instantané)

*Préparée pour Juliette (agence Link) — 21/07/2026*

## Résumé exécutif

Aujourd'hui, le "cerveau" de Zizou (l'analyse réelle des campagnes) tourne comme une **tâche planifiée Claude** (scheduled task Cowork), pas comme un workflow n8n. C'est pour ça que le bouton "lancer un run" du centre de contrôle ne peut que poser un indicateur, jamais réveiller Zizou instantanément : il n'y a pas de webhook public vers ce processus.

La solution 3 (tout migrer vers un workflow n8n déclenchable par webhook) est **techniquement possible mais lourde** : ce n'est pas un ajustement, c'est une reconstruction du moteur d'exécution de Zizou. Le point dur n'est pas l'IA elle-même (n8n sait faire de l'agentique), c'est que **les runs de Zizou durent 9 à 33 minutes**, et le nœud "AI Agent" de n8n a un timeout technique de 5 minutes qui casse dès qu'un run est un peu long — sauf à passer en n8n auto-hébergé avec du "queue mode", ce qui change complètement l'ampleur du projet (infra à gérer, pas juste un abonnement).

**Recommandation courte** : ce chantier a du sens à moyen terme (fiabilité 24/7, déclenchement instantané), mais c'est un projet à part entière, pas une brique. Pour le besoin immédiat ("le bouton doit réagir vite"), l'option 1 déjà proposée (réduire l'intervalle de réveil à 5 min) reste largement plus rentable en effort/résultat.

---

## 1. Ce qui existe aujourd'hui

- **Le déclencheur** : une tâche planifiée Claude (`zizou-verif-campagnes`), cron `*/30 * * * *`, qui ne tourne que si l'app Claude reste ouverte quelque part.
- **La coquille** (`SKILL.md`) : à chaque réveil, elle appelle le workflow n8n *API agent* (`should_i_run`), et si `decision=run`, elle exécute le "texte métier" complet reçu en réponse.
- **Les instructions métier** : stockées dans le centre de contrôle, versionnées. La version courante fait **6 parties de ~15 000 caractères, donc jusqu'à ~90 Ko de texte** — c'est un prompt massif et très détaillé (sélection des campagnes, vérification par plateforme, check de diffusion, atterrissages budget, répartition des placements, campagnes fantômes, bilan d'objectifs, écritures Monday, récap Slack, logique "anti-bruit" par comparaison à la mémoire des verdicts précédents...).
- **Les outils déjà en n8n** (bonne nouvelle, réutilisables tels quels) : les passerelles de lecture par plateforme (META, Google Ads, LinkedIn, Snapchat, Spotify, TikTok Check), Stats Check, Inventaire, Bilan Check, la Mémoire des verdicts (Zizou Mémoire), et bien sûr l'API agent (should_i_run / run_start / run_event / run_end) déjà utilisée pour le suivi live sur le site.
- **La durée réelle des runs observés aujourd'hui** : entre 542 s (~9 min) et 1988 s (~33 min), avec plusieurs dizaines d'appels d'outils par run.

## 2. Ce qu'il faudrait reconstruire

1. **Un nœud "AI Agent" n8n** (Claude via credential Anthropic API dédié) qui remplace le rôle de "coquille + Claude" — nouveau credential à créer, séparé de l'abonnement Claude actuel.
2. **Portage du prompt métier (~90 Ko)** dans le system prompt de ce nœud, avec vérification ligne à ligne qu'aucune nuance ne se perd (la logique "anti-bruit", les seuils, les comparaisons mémoire sont écrits en langage naturel, pas en règles rigides).
3. **Câblage des outils** : connecter chaque passerelle n8n existante comme "Tool" du nœud AI Agent (faisable, la plupart existent déjà) + construire les outils manquants pour l'écriture (Monday write, Slack) si équivalents n'existent pas déjà sous forme d'outil appelable.
4. **Double déclencheur** : un Schedule Trigger (remplace le cron Claude) + un Webhook Trigger (pour le bouton "lancer un run"), les deux repassant par la logique `should_i_run` (anti-chevauchement, anti-doublon) déjà écrite — récupérable presque telle quelle.
5. **Le bouton du site** : modifier `/api/agents/[id]/write` (action `run_now`) pour appeler ce nouveau webhook n8n en plus (ou à la place) de la simple pose d'indicateur.
6. **Une bascule progressive testée** : faire tourner l'ancien et le nouveau moteur en parallèle un moment, comparer les verdicts produits sur les mêmes campagnes, avant de couper l'ancien.

## 3. Problèmes et risques

- **Timeout technique du nœud AI Agent n8n : 5 minutes, en dur.** Les runs de Zizou durent jusqu'à 33 minutes. Ce nœud casse aujourd'hui sur des tâches longues avec beaucoup d'appels d'outils, sauf à passer en **n8n auto-hébergé avec "queue mode"** (mode file d'attente, workers séparés) — ce n'est plus un simple changement de plan payant, c'est un serveur à gérer. C'est le risque le plus sérieux de ce projet.
- **Fidélité du portage.** Reproduire fidèlement 90 Ko de logique métier nuancée dans un contexte technique différent (n8n AI Agent vs agent conversationnel Claude natif) comporte un vrai risque de régression sur un processus qui touche à des dépenses publicitaires réelles et à la conformité des campagnes — les erreurs coûtent de l'argent ou de la crédibilité client.
- **Comportement agentique différent.** Le nœud AI Agent de n8n ne gère pas forcément les boucles d'appels d'outils, les retries et la gestion d'erreur exactement comme Claude en environnement natif — des différences de comportement peuvent apparaître seulement à l'usage, sur des cas limites.
- **Nouveau poste de coût variable** (voir §5) au lieu d'un usage aujourd'hui inclus dans un abonnement Claude à prix fixe.
- **Maintenabilité.** Aujourd'hui, faire évoluer les instructions de Zizou = éditer un texte versionné dans le centre de contrôle (déjà en place, simple). Demain, une partie de la logique serait aussi dans la configuration du workflow n8n (JSON) — plus technique à modifier, moins accessible.
- **Effort de test conséquent avant bascule**, incompressible vu l'enjeu financier du processus.

## 4. Avantages

- **Déclenchement vraiment instantané** depuis le bouton du site (c'est la demande initiale).
- **Indépendance vis-à-vis de l'app Claude.** Aujourd'hui, si l'app Claude qui héberge la tâche planifiée n'est pas ouverte, Zizou ne se réveille pas du tout — un vrai risque de fiabilité indépendant du sujet "bouton instantané". Un workflow n8n Cloud tourne en continu côté serveur, sans dépendre d'un poste de travail.
- **Tout au même endroit.** Le reste du centre de contrôle (planning, permissions, audit) vit déjà dans n8n — consolider l'exécution de Zizou au même endroit simplifie la supervision (historique d'exécutions consultable directement).

## 5. Coûts estimés

### n8n
Plans Cloud actuels : Starter ≈ 24 €/mois (2 500 exécutions), Pro ≈ 60 €/mois (10 000 exécutions), Business ≈ 800 €/mois (40 000 exécutions). Les timeouts d'exécution varient selon le plan (de l'ordre de quelques minutes sur les plans d'entrée de gamme) — **à vérifier précisément avec n8n avant tout engagement**, les chiffres trouvés en recherche publique sont peu cohérents d'une source à l'autre.

Vu la contrainte des runs longs (jusqu'à 33 min) et le timeout dur de 5 min sur le nœud AI Agent, il est probable qu'**aucun plan Cloud standard ne suffise tel quel** — un passage en n8n auto-hébergé (serveur dédié + mode "queue") serait vraisemblablement nécessaire, ce qui ajoute un coût d'infrastructure et de maintenance serveur non chiffré ici (variable selon hébergeur).

### Anthropic (API, si le nœud AI Agent appelle Claude directement)
Tarifs actuels : environ 3 $ / million de tokens en entrée, 15 $ / million de tokens en sortie (Claude Sonnet). Un run de Zizou (90 Ko de prompt métier renvoyé à chaque étape d'une boucle agentique de plusieurs dizaines d'appels d'outils, sur 50 à 90 campagnes) peut représenter **plusieurs centaines de milliers de tokens d'entrée cumulés par run** — l'ordre de grandeur exact n'est pas mesurable sans les vrais logs de consommation, à vérifier auprès du fournisseur de l'abonnement Claude actuel avant d'aller plus loin. Sans cette donnée réelle, toute estimation en euros/mois serait trop approximative pour être fiable.

Point important : cet usage est **aujourd'hui probablement inclus dans un abonnement Claude à prix fixe**. Le migrer vers l'API Anthropic directe change de modèle : facturation à l'usage, donc un coût qui peut varier (et grimper) selon le volume réel de campagnes traitées.

### Effort de développement
Non chiffrable en euros ici puisque c'est un travail que je ferais, mais à noter clairement : ce n'est pas une "brique" comme celles livrées jusqu'ici (quelques heures) — c'est un chantier de portage + tests approfondis sur un processus à enjeu financier, largement plus conséquent.

## 6. Alternative déjà sur la table

Pour rappel, l'option 1 (réduire l'intervalle de réveil de la tâche planifiée Claude de 30 min à 5 min) reste disponible, gratuite, réversible en un clic, et réduit déjà le délai maximal d'environ 40 min à environ 10-15 min — sans toucher à l'architecture ni au budget.

## 7. Recommandation

Le passage à n8n (option 3) est **cohérent comme évolution de fond** — surtout pour l'indépendance vis-à-vis de l'app Claude ouverte, qui est un vrai sujet de fiabilité au-delà du confort d'un bouton instantané. Mais ce n'est pas une décision à prendre sur ce seul critère : elle mérite d'être posée avec (a) une vérification concrète des limites de timeout n8n applicables, (b) une estimation réelle de la consommation de tokens à partir des logs existants, et (c) un arbitrage sur le budget infra si un passage en auto-hébergé s'avère nécessaire.

En attendant cette décision, appliquer l'option 1 comme mesure immédiate est ce que je recommande.

---

*Sources utilisées pour les tarifs (recherche web, à recouper avec les interlocuteurs commerciaux avant engagement) : pages de tarification n8n Cloud et Anthropic API consultées le 21/07/2026.*
