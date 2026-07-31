# Procédure — brancher agents.link.fr sur le centre de contrôle

*À faire avec la personne qui a les accès à l'hébergement/DNS de link.fr (Microsoft 365 / Azure DNS).*

## ⚠️ Avant de commencer : vérifier le nom exact

Le mail d'alerte Vercel mentionne **`agents.link.fr`** (avec un « s »). Avant toute manipulation, ouvrir le dashboard Vercel et confirmer le nom exact du domaine enregistré :

1. Aller sur [vercel.com](https://vercel.com) → se connecter → équipe **AGENTS LINK**
2. Ouvrir le projet **link-centre-de-controle**
3. Onglet **Settings** → **Domains**
4. Noter le nom exact affiché (avec ou sans « s ») — c'est CE nom qu'il faut utiliser dans toutes les étapes suivantes, pas un autre.

## Étape 1 — Voir ce que Vercel attend

Toujours dans **Settings → Domains** :

5. Cliquer sur le domaine en question (celui marqué « Invalid Configuration » ou similaire)
6. Vercel affiche l'enregistrement DNS exact attendu — normalement un **CNAME** pointant vers **`cname.vercel-dns.com`**
7. Noter cette valeur telle qu'affichée (elle peut varier légèrement selon la config du projet) — c'est elle qu'on utilisera à l'étape 2, pas une valeur générique copiée d'ailleurs.

## Étape 2 — Ajouter l'enregistrement DNS côté Microsoft

8. Se connecter au centre d'administration Microsoft 365 : [admin.microsoft.com](https://admin.microsoft.com)
9. Menu **Paramètres** → **Domaines**
10. Cliquer sur **link.fr**
11. Aller dans la gestion des enregistrements DNS (« Gérer le DNS » ou renvoi vers **Azure DNS** si la zone y est déléguée)
12. Ajouter un nouvel enregistrement :
    - **Type** : CNAME
    - **Nom / Hôte** : `agents` (juste le sous-domaine, sans « .link.fr » — à ajuster selon le nom exact confirmé à l'étape 0)
    - **Valeur / Pointe vers** : `cname.vercel-dns.com` (ou la valeur exacte notée à l'étape 1)
    - **TTL** : laisser la valeur par défaut (3600 ou 300, peu importe)
13. Enregistrer

## Étape 3 — Vérifier côté Vercel

14. Revenir sur Vercel → **Settings → Domains**
15. Cliquer sur **Refresh** / **Verify** à côté du domaine
16. Attendre — la propagation DNS prend en général quelques minutes, parfois jusqu'à 1-2h dans de rares cas
17. Le statut doit passer au vert (« Valid Configuration »), et Vercel génère automatiquement le certificat HTTPS (SSL) — rien à faire de plus pour ça

## Étape 4 — Tester

18. Ouvrir un navigateur (idéalement en navigation privée pour éviter le cache) et aller sur `https://agents.link.fr`
19. Vérifier que la page de connexion du centre de contrôle s'affiche correctement, avec le cadenas HTTPS actif

## Si ça reste bloqué sur « Failed To Generate Cert »

Le CNAME peut être correct (Vercel le confirme en le montrant comme configuré) mais l'émission du certificat HTTPS échoue quand même. Causes les plus courantes, à vérifier dans cet ordre :

1. **Patience d'abord** : si le CNAME vient d'être ajouté il y a moins de 30-60 min, relancer simplement (Vercel → domaine → Retry/Refresh). Beaucoup de cas se résolvent tout seuls une fois la propagation DNS complète.
2. **Enregistrement CAA bloquant** : certains DNS chez Microsoft ont un enregistrement CAA qui restreint les autorités de certification autorisées à émettre un certificat pour le domaine. Si celui-ci n'autorise pas **Let's Encrypt** et/ou **Sectigo** (les autorités utilisées par Vercel), la génération du certificat échoue en boucle. Solution : dans la même zone DNS (Microsoft/Azure), chercher un enregistrement de type **CAA** sur `link.fr` ou `agents.link.fr`, et soit le supprimer, soit ajouter des entrées autorisant `letsencrypt.org` et `sectigo.com`.
3. **Enregistrement `_acme-challenge` parasite** : vérifier qu'il n'existe pas déjà un enregistrement TXT `_acme-challenge.agents.link.fr` laissé par une tentative précédente ou un autre service — le supprimer s'il existe.
4. **Dernier recours** : dans Vercel, supprimer le domaine `agents.link.fr` du projet puis le rajouter — ça force une revalidation complète depuis zéro.

## Une fois que ça marche

- L'URL `link-centre-de-controle.vercel.app` continuera de fonctionner en parallèle (pas besoin de la couper)
- Possibilité optionnelle : définir `agents.link.fr` comme domaine principal dans Vercel (Settings → Domains → ⋯ → Set as Primary) pour que les liens partagés utilisent cette adresse par défaut
