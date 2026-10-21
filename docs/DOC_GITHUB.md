# Documentation Complète — Service & Widget GitHub (Profil et Dépôts)

Ce document est la documentation technique et fonctionnelle dédiée exclusivement au service **GitHub** et à son widget.

---

## 1. Présentation du Service

Le service **GitHub** affiche, en lecture seule, le profil public d'un compte GitHub ainsi que ses **derniers dépôts publics mis à jour** :
* le profil : avatar rond, nom cliquable ouvrant le profil GitHub, biographie et badge `@login` ;
* pour chaque dépôt :
  * le nom du dépôt, cliquable, qui ouvre la page GitHub dans un nouvel onglet ;
  * le nombre d'étoiles (« ★ 12 ») ;
  * le langage principal avec la pastille colorée officielle fournie par GitHub (« ● TypeScript »).

Chaque widget GitHub possède **sa propre connexion OAuth 2.0** : on peut afficher plusieurs comptes distincts sur le même dashboard (par exemple une carte pour `@alice` et une autre pour `@bob`, ou deux cartes pour le même compte avec un nombre différent de dépôts).

* **Identifiant du service** : `github`
* **Souscription requise (`requires_subscription`)** : `true`, chaque carte doit être connectée à un compte GitHub.
* **Scope GitHub demandé** : **aucun** (`scope=""` implicite). C'est le principe du moindre privilège : seules les données publiques du profil et les dépôts publics dont l'utilisateur est propriétaire sont accessibles. L'application ne peut pas accéder aux dépôts privés, aux organisations restreintes, ni effectuer d'écriture.
* **Fichiers sources dédiés** :
  * Backend :
    * [`backend/catalog/github.py`](../backend/catalog/github.py) : déclaration du widget, requête GraphQL et mise en forme du profil et des dépôts
    * [`backend/github_oauth.py`](../backend/github_oauth.py) : échanges OAuth 2.0 avec GitHub (URL d'autorisation, échange de code, lecture du login, révocation)
    * [`backend/routes/github_connect.py`](../backend/routes/github_connect.py) : routes de connexion, callback et déconnexion
    * [`backend/subscriptions.py`](../backend/subscriptions.py) : gestion multi-comptes et libération d'une connexion non utilisée
  * Backend partagé avec les autres widgets : [`backend/catalog/__init__.py`](../backend/catalog/__init__.py) (`validate_config`), [`backend/runner.py`](../backend/runner.py), [`backend/routes/widgets.py`](../backend/routes/widgets.py), [`backend/schemas.py`](../backend/schemas.py) (bornes de `refreshSeconds`), [`backend/security.py`](../backend/security.py) (state signé), [`backend/routes/users.py`](../backend/routes/users.py) (suppression de compte)
  * Frontend :
    * [`frontend/src/components/github-widget.tsx`](../frontend/src/components/github-widget.tsx) : la carte, ses états et ses actions
    * [`frontend/src/components/widget-form.tsx`](../frontend/src/components/widget-form.tsx) : le formulaire commun, utilisé par la fenêtre d'ajout et par le panneau de réglages
    * [`frontend/src/components/settings-panel.tsx`](../frontend/src/components/settings-panel.tsx) : le panneau de réglages, commun à plusieurs cartes
    * [`frontend/src/use-widget-data.ts`](../frontend/src/use-widget-data.ts) : le chargement des données (dont l'état déconnecté), commun à plusieurs cartes
    * [`frontend/src/use-auto-refresh.ts`](../frontend/src/use-auto-refresh.ts) : le minuteur de rafraîchissement
    * [`frontend/src/refresh.ts`](../frontend/src/refresh.ts) : lecture et bornes de l'intervalle saisi
    * [`frontend/src/widget-types.ts`](../frontend/src/widget-types.ts) : entrée « GitHub » de la barre latérale
    * [`frontend/src/styles.ts`](../frontend/src/styles.ts) : styles typographiques et de liste réutilisés

---

## 2. Spécifications & Contrat d'API (`about.json`)

Le service expose un seul widget dans le catalogue :

```json
{
  "name": "github",
  "widgets": [
    {
      "name": "repo_list",
      "description": "Profile and latest updated public repositories of the connected GitHub account",
      "params": [
        { "name": "number", "type": "integer" }
      ]
    }
  ]
}
```

### 2.1. Widget : `repo_list`
* **Description** : Affiche le profil de l'utilisateur connecté et ses derniers dépôts publics mis à jour.
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `number` | `integer` | Non | `5` | Nombre de dépôts affichés, de **1 à 10**, sélectionné dans une liste (§4.4). Toute autre valeur est refusée à l'enregistrement (`422` : `number must be one of: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10`). À la lecture, la valeur est de plus bornée entre 1 et 10 |

* **Valeurs à l'ajout depuis la barre latérale** : `config = { "number": 5 }`, `refreshSeconds = 600`.
* **`refreshSeconds`** : réglable par l'utilisateur, de `10` à `86400` secondes, avec 3 décimales au plus (`12.5` = 12 s 500 ms). Pourquoi 600 par défaut : l'activité sur les dépôts GitHub évolue au fil de la journée. 10 minutes assure une information fraîche tout en restant très loin du quota GraphQL de GitHub (5 000 requêtes/heure par compte).

* **Format des données retournées (`GET /api/widgets/{id}/data`)** :
```json
{
  "data": {
    "name": "Ethan Saintot",
    "login": "ethansaintot",
    "avatarUrl": "https://avatars.githubusercontent.com/u/1234567?v=4",
    "bio": "Software developer & student",
    "url": "https://github.com/ethansaintot",
    "repos": [
      {
        "name": "dashboard",
        "url": "https://github.com/ethansaintot/dashboard",
        "stars": 12,
        "language": "TypeScript",
        "languageColor": "#3178c6"
      }
    ]
  },
  "account": "ethansaintot",
  "fetchedAt": "2026-10-11T01:00:00.000000+00:00"
}
```

  | Champ | Description |
  |---|---|
  | `name` | Nom complet public du profil GitHub, ou son login s'il n'a pas renseigné de nom |
  | `login` | Identifiant GitHub unique |
  | `avatarUrl` | URL directe vers l'image d'avatar hébergée sur GitHub |
  | `bio` | Biographie de l'utilisateur (`""` si non renseignée) |
  | `url` | Lien vers la page de profil GitHub (`https://github.com/{login}`) |
  | `repos[].name` | Nom du dépôt public |
  | `repos[].url` | Lien direct vers le dépôt GitHub (sert aussi de `key` React) |
  | `repos[].stars` | Nombre d'étoiles (`stargazerCount`) |
  | `repos[].language` | Langage principal détecté par GitHub (`""` si aucun) |
  | `repos[].languageColor` | Couleur officielle hexadécimale du langage (`"#999999"` par défaut) |
  | `account` | Identifiant du compte connecté à cette carte (`null` si non connecté) |
  | `fetchedAt` | Heure de lecture côté serveur (ISO 8601 UTC). La carte l'affiche dans « Updated 01:00 » |

* **Réponses d'erreur** :
  | Situation | Code | Message / `detail` | Affichage dans la carte |
  |---|---|---|---|
  | Widget non connecté à un compte GitHub | `403` | `Connect this widget first` | Écran « Connect GitHub » |
  | Jeton révoqué ou expiré (GitHub répond 401) | `403` | `GitHub access expired, connect again` | Écran « Connect GitHub » |
  | GitHub injoignable ou en erreur réseau | `502` | `github is unavailable` | Message d'erreur |
  | Widget inexistant ou appartenant à un autre utilisateur | `404` | `Widget not found` | Message d'erreur |
  | Configuration du serveur GitHub OAuth absente | `503` | `GitHub login is not configured on the server` | Erreur sous le bouton Connect |

* **Erreurs à l'enregistrement des réglages** (`PATCH /api/widgets/{id}`, code `422`) :
  | Situation | Message |
  |---|---|
  | `number` hors de 1 à 10 | `number must be one of: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10` |
  | `number` non entier | `number must be an integer` |
  | Intervalle sous 10 s ou au-dessus de 86 400 s | `Input should be greater than or equal to 10` / `… less than or equal to 86400` |
  | Plus de 3 décimales | `Value error, Value must have at most three decimal places` |

---

## 3. Architecture Backend

### 3.1. Appel unique GraphQL (`fetch_repos` dans `backend/catalog/github.py`)
Le service interroge l'API GraphQL v4 de GitHub (`POST https://api.github.com/graphql`) en une seule requête réseau :
```graphql
query($number: Int!) {
  viewer {
    name
    login
    avatarUrl
    bio
    url
    repositories(first: $number, orderBy: {field: UPDATED_AT, direction: DESC}, privacy: PUBLIC, ownerAffiliations: OWNER) {
      nodes { name url stargazerCount primaryLanguage { name color } }
    }
  }
}
```

* **`viewer`** : cible automatiquement le compte authentifié par le token OAuth personnel, sans paramètre d'URL à forger.
* **Filtres précis** :
  * `privacy: PUBLIC` : uniquement les dépôts publics ;
  * `ownerAffiliations: OWNER` : uniquement les dépôts dont l'utilisateur est le propriétaire (pas de dépôts d'autres organisations) ;
  * `orderBy: {field: UPDATED_AT, direction: DESC}` : les derniers dépôts modifiés en premier ;
  * `$number` : passé comme variable GraphQL typée (`{"number": number}`), sans risque d'injection.
* **Couleur du langage** : `primaryLanguage.color` donne la couleur hexadécimale officielle maintenue par GitHub (ou `#999999` si absente).
* **Quotas** : GitHub alloue 5 000 points/heure par compte connecté. Cette requête ne consomme qu'1 seul point.

### 3.2. Authentification OAuth 2.0 (`backend/github_oauth.py`)
* `authorize_url(state)` : génère l'URL `https://github.com/login/oauth/authorize` avec `client_id`, `redirect_uri`, `state` et `allow_signup=false`.
* `exchange_code(code)` : échange le code temporaire via `POST https://github.com/login/oauth/access_token` (`Accept: application/json`).
  * Particularité GitHub : l'API renvoie un code HTTP 200 même si le code est invalide ; la fonction vérifie la clé `access_token` dans le JSON reçu.
* `fetch_login(credentials)` : lit l'identifiant du compte via `GET https://api.github.com/user` et le convertit en minuscules (`.lower()`) pour éviter les doublons de casse en base.
* `revoke(credentials)` : révoque le jeton auprès de GitHub (`DELETE https://api.github.com/applications/{client_id}/token`) en authentification Basic. Appel en « best effort » pour ne jamais bloquer la déconnexion locale.

### 3.3. Sécurisation du `state` (`backend/security.py`)
GitHub renvoie le navigateur vers le callback sans en-tête d'authentification. L'identité de l'utilisateur et du widget voyagent dans le `state`, signé par un JWT HS256 (`JWT_SECRET`) :
* `sub` : UUID de l'utilisateur connecté ;
* `wid` : ID de l'instance du widget à relier ;
* `provider` : `"github"` ;
* `aud` : `"oauth-state"` ;
* Durée de validité : 10 minutes.

### 3.4. Multi-comptes et libération (`backend/subscriptions.py`)
* Chaque widget neuf commence avec `subscription_id = NULL` (état déconnecté).
* Les jetons sont enregistrés dans la table `subscriptions` avec la contrainte unique `(user_id, service_name, account)`. Deux widgets reliés au même compte partagent la même ligne.
* Quand une carte est déconnectée ou supprimée, `release_if_unused` compte si d'autres cartes utilisent encore ce compte. Si le compteur tombe à 0, le jeton est révoqué auprès de GitHub et la ligne est supprimée de la base.

---

## 4. Architecture Frontend

### 4.1. Ajout depuis la barre latérale (`frontend/src/widget-types.ts`)
* Cliquer sur « + Add » ouvre la fenêtre modale « Add a GitHub widget » avec deux champs préremplis :
  * **Repositories shown** : liste déroulante de 1 à 10 (défaut `5`) ;
  * **Refresh every (seconds)** : champ texte (défaut `600`).
* La carte est créée avec ses réglages mais sans compte relié. Elle apparaît directement sur le dashboard avec l'écran « Connect GitHub ».

### 4.2. La carte (`frontend/src/components/github-widget.tsx`)
* **Titre** : « GitHub », précédé du badge `@{account}` si le compte est connecté.
* **Boutons** :
  * Déconnecté : Déplacer ⠿, Dupliquer, Supprimer ×.
  * Connecté : **Settings**, **Refresh**, **Disconnect**, Déplacer ⠿, Dupliquer, Supprimer ×.
* **États** :
  | État | Affichage |
  |---|---|
  | Chargement | « Loading... » |
  | Déconnecté (`403`) | Message d'invitation + bouton vert **Connect GitHub** |
  | Erreur | Message d'erreur (ex. « github is unavailable »), les boutons restent accessibles |
  | Prêt | Avatar + profil + liste des dépôts + « Updated HH:MM » |

* **Dupliquer** : crée une copie avec les mêmes réglages (nombre de dépôts, intervalle, zoom) mais **déconnectée**, pour permettre de brancher un autre compte si souhaité.

### 4.3. Affichage du profil et des dépôts
* **Profil** : avatar rond de 48 × 48 px (`loading="lazy"`), nom cliquable ouvrant le profil GitHub, biographie tronquée à 2 lignes.
* **Dépôt** : nom cliquable, compteur d'étoiles « ★ X », puce colorée officielle « ● Langage ».
* **Liens externes** : tous les liens utilisent `target="_blank"` et `rel="noreferrer"` pour protéger la session du dashboard.

### 4.4. Le panneau Settings (`frontend/src/components/settings-panel.tsx`)
* **Les champs** :
  * **Repositories shown** : liste déroulante de 1 à 10 ;
  * **Refresh every (seconds)** : saisie validée par `parseSeconds` (10 à 86 400 s, max 3 décimales).
* **Enregistrement** : un seul `PATCH /api/widgets/{id}` avec `{ "config": { "number": "8" }, "refreshSeconds": 300 }`.
* La réponse serveur met à jour le dashboard via `onUpdate(updated)`, relance le minuteur et recharge les données.

### 4.5. Le rafraîchissement automatique (`frontend/src/use-auto-refresh.ts`)
* Dans `useWidgetData`, `useAutoRefresh` relit les données toutes les `refreshSeconds` secondes en silence.
* **Chaîne de `setTimeout`** : la lecture suivante n'est planifiée qu'après la réponse, évitant tout chevauchement.
* **Onglet caché** : tour sauté si `document.hidden` est actif.
* **Arrêt automatique** : si le serveur répond `403` (jeton révoqué), la carte bascule sur « Connect GitHub » et le minuteur s'arrête.

---

## 5. Configuration

### 5.1. Variables d'environnement (`.env`)
| Variable | Exemple | Description |
|---|---|---|
| `GITHUB_CLIENT_ID` | `Iv1.xxxxxxxxxxxxxxxx` | Client ID de l'application OAuth GitHub |
| `GITHUB_CLIENT_SECRET` | *(secret)* | Client Secret, uniquement dans `.env` (ignoré par Git) |
| `GITHUB_REDIRECT_URI` | `http://localhost:8080/api/oauth/github/callback` | Doit correspondre à l'URI déclarée sur GitHub |
| `APP_BASE_URL` | `http://localhost:8080` | URL racine du dashboard pour la redirection post-callback |

### 5.2. Configuration sur GitHub
1. Aller sur GitHub dans **Settings > Developer settings > OAuth Apps > New OAuth App**.
2. Renseigner :
   * **Application name** : « Epitech Dashboard »
   * **Homepage URL** : `http://localhost:8080`
   * **Authorization callback URL** : `http://localhost:8080/api/oauth/github/callback`
3. Copier le Client ID et générer un Client Secret à reporter dans `.env`.

---

## 6. Cycle de Vie des Données (Flux complet)

```text
1. Ajout d'une carte « GitHub » :
   Dashboard    -> POST /api/widgets { serviceName: "github", widgetName: "repo_list", config: { number: 5 }, refreshSeconds: 600, x, y }
   Backend      -> validate_config (number parmi 1 à 10) -> ligne widget_instances (subscription_id = NULL), HTTP 201
   GithubWidget -> GET /api/widgets/{id}/data -> 403 -> écran « Connect GitHub »

2. Connexion OAuth 2.0 :
   GithubWidget -> Clic sur « Connect GitHub » -> GET /api/oauth/github/url?widget={id} -> redirection vers GitHub
   GitHub       -> Consentement utilisateur -> GET /api/oauth/github/callback?code=…&state=…
   Backend      -> Échange du code contre token -> GET /user pour le login -> ligne subscriptions
   Backend      -> Associe instance.subscription_id -> 302 vers /dashboard?github=connected

3. Chargement des données :
   GithubWidget -> GET /api/widgets/{id}/data
   Backend      -> run_widget -> fetch_repos (1 requête GraphQL viewer + repositories)
   GithubWidget -> Affiche le profil, les dépôts et « Updated 01:00 »

4. Rafraîchissement automatique :
   GithubWidget -> toutes les refreshSeconds (600 par défaut), relit GET /data en silence (sauté si l'onglet est caché)

5. Réglages :
   GithubWidget -> Settings -> « 8 », 300
                -> PATCH /api/widgets/{id} { config: { number: "8" }, refreshSeconds: 300 }
   Dashboard    -> Remplace l'instance -> la carte se recharge, le minuteur repart à 300 s

6. Déconnexion ou révocation :
   GithubWidget -> Clic sur Disconnect -> DELETE /api/oauth/github?widget={id}
   Backend      -> Détache ce widget -> release_if_unused (révoque chez GitHub si plus aucun widget n'utilise le compte)
   GithubWidget -> Relit GET /data -> 403 -> écran « Connect GitHub »

7. Suppression :
   Dashboard    -> DELETE /api/widgets/{id} -> ligne widget_instances supprimée -> release_if_unused
```

---

## 7. Sécurité & Données Personnelles
* **Principe du moindre privilège** : aucun scope demandé (`scope=""`), lecture des données publiques uniquement.
* **Aucun dépôt stocké en base** : seuls les jetons OAuth et le login du compte sont conservés en base locale. Les dépôts et le profil sont lus à la volée.
* **Protection CSRF** : le paramètre `state` est un JWT signé HS256 avec une durée de 10 minutes, rattaché à l'utilisateur et au widget exact.
* **Cloisonnement** : le widget d'un autre utilisateur répond `404` (et non `403`).
* **Révocation effective** : lors du détachement du dernier widget ou de la suppression du compte, le jeton est formellement révoqué auprès de GitHub.
* **Liens externes sécurisés** : `target="_blank"` et `rel="noreferrer"` sur tous les liens du profil et des dépôts.

---

## 8. Limites Connues & Pistes
* **Quotas GitHub GraphQL** : chaque compte bénéficie de 5 000 requêtes par heure. À 600 s d'intervalle (6 requêtes/h), l'impact est de 0,1 % du quota :
  | Intervalle | Requêtes / heure | Consommation quota |
  |---|---|---|
  | 10 s (minimum) | 360 / h | 7,2 % du quota |
  | 60 s | 60 / h | 1,2 % du quota |
  | 600 s (défaut) | 6 / h | 0,1 % du quota |
* **Dépôts publics uniquement** : les dépôts privés ne sont pas affichés sans demander un scope étendu (`repo`).
* **Tri imposé par date de modification** : les dépôts sont toujours triés par `UPDATED_AT DESC`. Piste : permettre de choisir le tri (étoiles, alphabétique).
* **Plafond à 10 dépôts** : suffisant pour une carte de tableau de bord, mais sans pagination au-delà.
* **Paramètres de retour URL** : les paramètres `?github=connected|denied|error` ne sont pas encore exploités sous forme de notifications toast.

---

Retour à la [documentation principale](../README.md).
