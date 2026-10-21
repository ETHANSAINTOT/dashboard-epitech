# Documentation Complète — Service & Widget Gmail (Boîte de réception)

Ce document est la documentation technique et fonctionnelle dédiée exclusivement au service **Gmail** et à son widget.

---

## 1. Présentation du Service

Le service **Gmail** affiche, en lecture seule, les derniers emails de la boîte de réception d'un compte Google.

Chaque widget Gmail possède **sa propre connexion OAuth 2.0** : on peut afficher plusieurs adresses différentes sur le même dashboard (par exemple une carte pour `alice@gmail.com` et une autre pour `bob@gmail.com`).

* **Identifiant du service** : `gmail`
* **Souscription requise (`requires_subscription`)** : `true` (chaque widget doit être connecté à un compte Google via OAuth 2.0).
* **Scope Google demandé** : `https://www.googleapis.com/auth/gmail.readonly`. C'est de la lecture seule : l'application ne peut ni envoyer, ni modifier, ni supprimer d'email.
* **Fichiers sources dédiés** :
  * Backend :
    * [`backend/catalog/gmail.py`](../backend/catalog/gmail.py) : déclaration du widget et lecture de la boîte de réception
    * [`backend/google_oauth.py`](../backend/google_oauth.py) : échanges OAuth 2.0 avec Google (URL, jetons, adresse, révocation)
    * [`backend/routes/oauth.py`](../backend/routes/oauth.py) : routes de connexion et de déconnexion
    * [`backend/subscriptions.py`](../backend/subscriptions.py) : libération d'une connexion qui n'est plus utilisée
  * Backend partagé avec les autres widgets : [`backend/runner.py`](../backend/runner.py), [`backend/routes/widgets.py`](../backend/routes/widgets.py), [`backend/models.py`](../backend/models.py), [`backend/schemas.py`](../backend/schemas.py), [`backend/security.py`](../backend/security.py), [`backend/main.py`](../backend/main.py), [`backend/routes/users.py`](../backend/routes/users.py)
  * Frontend :
    * [`frontend/src/components/gmail-widget.tsx`](../frontend/src/components/gmail-widget.tsx) : carte du widget (connexion, états, actions) et liste de ses champs (`GMAIL_FIELDS`)
    * [`frontend/src/components/gmail-inbox.tsx`](../frontend/src/components/gmail-inbox.tsx) : liste des emails
    * [`frontend/src/components/widget-form.tsx`](../frontend/src/components/widget-form.tsx) : le formulaire commun, utilisé par la fenêtre d'ajout et par le panneau de réglages
    * [`frontend/src/components/settings-panel.tsx`](../frontend/src/components/settings-panel.tsx) : le panneau de réglages, commun à plusieurs cartes
    * [`frontend/src/use-widget-data.ts`](../frontend/src/use-widget-data.ts) : le chargement des données (dont l'état « non connecté »), commun à plusieurs cartes
    * [`frontend/src/use-auto-refresh.ts`](../frontend/src/use-auto-refresh.ts) : le minuteur de rafraîchissement
    * [`frontend/src/widget-types.ts`](../frontend/src/widget-types.ts) : entrée « Gmail » de la barre latérale
    * [`frontend/src/refresh.ts`](../frontend/src/refresh.ts) : bornes et lecture de l'intervalle de rafraîchissement saisi

---

## 2. Spécifications & Contrat d'API (`about.json`)

Le service expose un seul widget dans le catalogue :

```json
{
  "name": "gmail",
  "widgets": [
    {
      "name": "inbox",
      "description": "Latest emails from your Gmail inbox",
      "params": [{ "name": "number", "type": "integer" }]
    }
  ]
}
```

### 2.1. Widget : `inbox`
* **Description** : Affiche les derniers emails de la boîte de réception (expéditeur, objet, extrait, date, lu / non lu).
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `number` | `integer` | Non | `5` | Nombre d'emails affichés, de **1 à 10**, choisi dans une liste (§4.5). Toute autre valeur est refusée à l'enregistrement avec une `422` : `number must be one of: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10`. Pourquoi 10 au plus : chaque email coûte un appel à Gmail à chaque rafraîchissement (§3.7), et 10 lignes remplissent déjà la carte. À la lecture, la valeur est encore ramenée entre 1 et 10, pour une ligne enregistrée avant cette règle. |

* **Valeurs à l'ajout depuis la barre latérale** : `config = { "number": 5 }`, `refreshSeconds = 300`, proposées dans la fenêtre d'ajout et modifiables avant la création (§4.1).

* **Intervalle de rafraîchissement (`refreshSeconds`)** : réglable par l'utilisateur avec le bouton « Settings » de la carte (voir §4.5).
  | Champ | Type | Bornes | Précision | Défaut |
  |---|---|---|---|---|
  | `refreshSeconds` | Nombre à virgule, en secondes | `10` à `86400` (24 h) | 3 décimales au plus, donc la milliseconde : `12.5` = 12 s 500 ms | `300` |

* **Format des données retournées (`GET /api/widgets/{id}/data`)** :
```json
{
  "data": {
    "emails": [
      {
        "id": "19a3f2c1d4e5b6a7",
        "from": "Google",
        "subject": "Security alert",
        "snippet": "A new sign-in on Linux was detected...",
        "date": "2026-10-05T08:12:45.123000+00:00",
        "unread": true,
        "threadId": "19a3f2c1d4e5b6a7"
      }
    ]
  },
  "account": "alice@gmail.com",
  "fetchedAt": "2026-10-05T08:15:02.481516+00:00"
}
```

  | Champ | Description |
  |---|---|
  | `emails[].id` | Identifiant Gmail du message (sert de `key` React) |
  | `emails[].from` | Nom de l'expéditeur, ou son adresse s'il n'a pas de nom (`Google <no-reply@accounts.google.com>` → `Google`) |
  | `emails[].subject` | Objet, ou `(no subject)` s'il est vide |
  | `emails[].snippet` | Extrait fourni par Gmail, entités HTML décodées (`&#39;` → `'`) |
  | `emails[].date` | Date de réception (`internalDate` de Gmail), en ISO 8601 UTC |
  | `emails[].unread` | `true` si le message porte le label `UNREAD` |
  | `emails[].threadId` | Identifiant de la **conversation** du message, donné par l'API Gmail (l'identifiant du message s'il manquait). Il sert à ouvrir le mail dans Gmail (§4.3) |
  | `account` | Adresse Google lue par **ce** widget (`null` pour une connexion antérieure au multi-comptes) |
  | `fetchedAt` | Heure de la lecture côté serveur, en ISO 8601 UTC |

* **Réponses d'erreur** :
  | Situation | Code | `detail` | Affichage dans la carte |
  |---|---|---|---|
  | Widget pas encore connecté | `403` | `Connect this widget first` | Écran « Connect Gmail » |
  | Accès expiré ou retiré (Google refuse le rafraîchissement) | `403` | `Gmail access expired, connect again` | Écran « Connect Gmail » |
  | API Gmail en erreur ou injoignable | `502` | `gmail is unavailable` | Message d'erreur |
  | Widget inexistant ou appartenant à un autre utilisateur | `404` | `Widget not found` | Message d'erreur |

---

### 2.2. Routes OAuth (`/api/oauth/google`)

| Méthode | Route | Authentification | Rôle |
|---|---|---|---|
| `GET` | `/api/oauth/google/url?widget={id}` | Bearer (JWT) | Renvoie `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?…" }` pour connecter **ce** widget. Répond `404` si le widget n'appartient pas à l'utilisateur, `400` si ce n'est pas un widget Gmail. |
| `GET` | `/api/oauth/google/callback?code=…&state=…` | Publique (le `state` signé identifie l'utilisateur) | Appelée par Google après le consentement. Redirige vers `/dashboard?gmail=connected`, `denied` ou `error`. |
| `DELETE` | `/api/oauth/google?widget={id}` | Bearer (JWT) | Déconnecte **ce** widget (`204`). Les autres widgets gardent leur connexion. |

Les routes génériques des widgets s'appliquent aussi :
* `POST /api/widgets` : ajout ;
* `PATCH /api/widgets/{id}` : changer `number`, `refreshSeconds` ou la position. La réponse est le widget complet, mis à jour ;
* `DELETE /api/widgets/{id}` : suppression. Elle libère aussi la connexion si plus aucun widget ne l'utilise.

---

## 3. Architecture Backend

### 3.1. Lecture de la boîte de réception (`fetch_inbox` dans `backend/catalog/gmail.py`)
1. **Jeton à jour** : `google_oauth.ensure_fresh(credentials)` rafraîchit le jeton d'accès s'il expire dans moins de 60 s. Si Google refuse, `NotSubscribed` est levée : le serveur répond `403` et le front réaffiche « Connect Gmail ».
2. **Liste des messages** : `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults={number}&labelIds=INBOX`. Cette réponse ne contient que des identifiants.
3. **Détail en parallèle** : un `GET …/messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject` par email. Tous les appels partent en même temps avec `asyncio.gather`, soit 1 + N requêtes (N ≤ 10). Les paramètres sont passés en liste de tuples, car un dictionnaire ne peut pas contenir deux fois la clé `metadataHeaders`.
4. **Résumé** (`_summarise`) :
   * `parseaddr` extrait le nom de l'expéditeur ;
   * `html.unescape` nettoie l'extrait ;
   * `internalDate` (en millisecondes) devient une date ISO UTC ;
   * le label `UNREAD` donne le champ `unread`.

* **Pourquoi `format=metadata`** : seuls les en-têtes `From` et `Subject` et l'extrait sont téléchargés, jamais le corps des emails. C'est plus léger, et suffisant pour un aperçu.
* **Pas de stockage** : les emails sont lus à chaque affichage et ne sont jamais enregistrés en base.

---

### 3.2. Module OAuth 2.0 (`backend/google_oauth.py`)
| Fonction | Rôle |
|---|---|
| `authorize_url(state)` | Construit l'URL de connexion Google avec `scope=gmail.readonly`, `access_type=offline` (pour obtenir un refresh token), `prompt=select_account consent` (liste des comptes à chaque fois, et un refresh token à chaque connexion) et le `state` signé. |
| `exchange_code(code)` | Échange le `code` reçu au retour contre un `access_token` et un `refresh_token` (`POST https://oauth2.googleapis.com/token`). |
| `fetch_account_email(credentials)` | Lit l'adresse du compte via `GET https://gmail.googleapis.com/gmail/v1/users/me/profile` (champ `emailAddress`), mise en minuscules. Cet appel marche avec le scope `gmail.readonly` : pas besoin de demander en plus `openid` ou `email`. |
| `ensure_fresh(credentials)` | Rafraîchit le jeton d'accès 60 s avant son expiration. Google ne renvoie pas toujours le refresh token : on garde alors l'ancien. Le dictionnaire est modifié sur place ; le runner voit la différence et l'enregistre. |
| `revoke(credentials)` | Révoque l'accès chez Google (`POST https://oauth2.googleapis.com/revoke`). En « best effort » : une panne de Google n'empêche jamais une déconnexion. |

Les jetons sont stockés dans `subscriptions.credentials` (JSONB) sous cette forme :
```json
{ "access_token": "…", "refresh_token": "…", "expires_at": 1791190000 }
```
`expires_at` est un timestamp absolu, calculé à partir du `expires_in` relatif renvoyé par Google.

---

### 3.3. Flux de connexion (`backend/routes/oauth.py` et `backend/security.py`)

```
 GmailWidget (navigateur)          Backend (FastAPI)                 Google
          |                                |                              |
          |  GET /api/oauth/google/url?widget=12 (Bearer)                 |
          |------------------------------->|                              |
          |                                | owned_instance(12)           |
          |                                | + state signé                |
          |<----------- { url } -----------|                              |
          |  window.location = url -------------------------------------->|
          |                                |      choix du compte         |
          |                                |      + consentement          |
          |<------ 302 vers /api/oauth/google/callback?code=…&state=… ----|
          |  GET /callback?code&state ---->|                              |
          |                                | POST /token (code) --------->|
          |                                |<----- access + refresh ------|
          |                                | GET /users/me/profile ------>|
          |                                |<----- emailAddress ----------|
          |                                | ligne subscriptions          |
          |                                | de cette adresse             |
          |                                | widget.subscription_id ← id  |
          |<---- 302 /dashboard?gmail=connected                           |
```

* **Pourquoi un `state` signé** : Google renvoie le navigateur vers le callback **sans** l'en-tête `Authorization`. L'utilisateur et le widget voyagent donc dans le `state`, un JWT HS256 signé avec `JWT_SECRET` :
  | Champ | Contenu |
  |---|---|
  | `sub` | `client_id` (UUID) de l'utilisateur |
  | `wid` | Id du widget à connecter |
  | `provider` | `google` |
  | `aud` | `oauth-state` : empêche d'utiliser ce jeton comme jeton de session (et inversement) |
  | `exp` | 10 minutes |

  Un `state` modifié, expiré ou forgé est refusé. Le callback revérifie aussi que le widget existe encore et appartient bien à l'utilisateur.

* **Issues possibles du callback** (il redirige toujours vers le dashboard, sauf panne réseau, voir §8) :
  | Cas | Redirection |
  |---|---|
  | L'utilisateur refuse chez Google, ou `code` / `state` absents | `/dashboard?gmail=denied` |
  | `state` invalide ou expiré (plus de 10 min passées chez Google) | `/dashboard?gmail=error` |
  | Utilisateur ou widget supprimé entre-temps | `/dashboard?gmail=error` |
  | Google refuse l'échange du code ou la lecture de l'adresse | `/dashboard?gmail=error` |
  | Succès | `/dashboard?gmail=connected` |

---

### 3.4. Multi-adresses & cycle de vie des connexions

**Modèle de données** (`backend/models.py`) :

```
 +-------------+        +-----------------------------------------------+
 | users       | 1    N | subscriptions  (une ligne PAR ADRESSE Google) |
 |-------------|--------|-----------------------------------------------|
 | id          |        | id                                            |
 +-------------+        | user_id       -> users.id (ON DELETE CASCADE) |
        | 1             | service_name  = "gmail"                       |
        |               | account       = "alice@gmail.com"             |
        | N             | credentials   = { access_token, ... } (JSONB) |
 +------------------+   | UNIQUE (user_id, service_name, account)       |
 | widget_instances |   +-----------------------------------------------+
 |------------------|                         ^ 1
 | subscription_id  |-------------------------+
 |                  |  N   ON DELETE SET NULL
 +------------------+      (NULL = widget à connecter)
```

* **Un widget neuf** a `subscription_id = NULL`. Il répond donc `403` et affiche « Connect Gmail », même si l'utilisateur a déjà connecté d'autres adresses.
* **Connexion** : la ligne `subscriptions` est cherchée **par adresse**.
  * Nouvelle adresse : une nouvelle ligne est créée.
  * Adresse déjà connectée : ses jetons sont remplacés par les nouveaux, et tous les widgets de cette adresse en profitent.
  * Ensuite, seul **ce** widget est relié à la ligne.
* **Plusieurs widgets peuvent partager une adresse**, par exemple deux cartes `alice@gmail.com` avec un `number` différent.
* **Libération** (`release_if_unused` dans `backend/subscriptions.py`) : elle est appelée après un Disconnect, après la suppression d'un widget (×), et quand un widget se reconnecte avec une autre adresse.

```
  widget détaché / supprimé / relié à une autre adresse
                          |
                          v
          release_if_unused(ancienne ligne)
                          |
          d'autres widgets l'utilisent encore ?
               | oui                      | non
               v                          v
      on garde la ligne          revoke chez Google (best effort)
      (pas de revoke)            + suppression de la ligne
```

* **Pourquoi ne révoquer qu'en dernier** : la révocation Google retire l'accès de l'application à **tout** le compte Google, donc à tous les widgets de cette adresse.
* **Suppression du compte** (`DELETE /api/me`, `backend/routes/users.py`) : toutes les adresses de l'utilisateur sont révoquées chez Google, puis la cascade supprime les lignes.

---

### 3.5. Exécution & gestion des erreurs (`backend/runner.py`, `backend/routes/widgets.py`)
`run_widget` se déroule ainsi :
1. Si `subscription_id` est vide, il lève `NotSubscribed` (`403`).
2. Il charge la ligne `subscriptions` liée et vérifie qu'elle appartient bien à l'utilisateur.
3. Il passe une **copie** des jetons à `fetch_inbox`.
4. Toute erreur HTTP (réseau, réponse `4xx`/`5xx` de Gmail) devient `WidgetError`, donc une `502` et jamais une `500`.
5. Si `ensure_fresh` a rafraîchi les jetons, la copie diffère de l'original : elle est enregistrée. On réaffecte toute la colonne JSONB, car SQLAlchemy ne détecte pas une modification faite sur place.

La route `GET /api/widgets/{id}/data` ajoute ensuite `account` (l'adresse liée) à la réponse.

---

### 3.6. Migration des bases existantes (`backend/main.py`)
`create_all` ne modifie jamais une table qui existe déjà. En attendant Alembic, ces instructions sont rejouées à chaque démarrage, sans effet si elles sont déjà appliquées. Ainsi, une base créée avant le multi-comptes ou avant les intervalles à virgule continue de fonctionner :
```sql
ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS account VARCHAR(255);
-- ancienne règle « un seul Gmail par utilisateur »
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS uq_subscription_user_service;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_user_service_account ON subscriptions (user_id, service_name, account);
-- intervalle à la milliseconde : entier -> nombre à virgule (300 devient 300.0)
ALTER TABLE widget_instances ALTER COLUMN refresh_seconds TYPE DOUBLE PRECISION;
```
Une ancienne connexion (`account` à `NULL`) continue de fonctionner jusqu'à sa prochaine déconnexion.

---

### 3.7. Validation de l'intervalle de rafraîchissement (`backend/schemas.py`)
La colonne `widget_instances.refresh_seconds` est un nombre à virgule (`DOUBLE PRECISION`). Le type réutilisable `RefreshSeconds` (`Annotated` : un `float`, ses bornes et un validateur) est partagé par `WidgetCreate` (défaut `300.0`) et `WidgetUpdate` (champ facultatif). Une valeur incorrecte donne une `422` explicite, jamais une correction silencieuse :

| Valeur envoyée | Réponse | `msg` renvoyé par Pydantic |
|---|---|---|
| `12.5`, `10`, `86400`, `12.125` | `200` | — |
| `9.999` | `422` | `Input should be greater than or equal to 10` |
| `86400.001` | `422` | `Input should be less than or equal to 86400` |
| `12.1255` | `422` | `Value error, Value must have at most three decimal places` |
| `"abc"` | `422` | `Input should be a valid number, unable to parse string as a number` |

* **Pourquoi 10 s minimum** : un rafraîchissement coûte 5 unités de quota Gmail pour la liste, plus 20 par email. Google autorise 6 000 unités par minute et par adresse, partagées entre tous les widgets de cette adresse.
  | Intervalle | 5 emails (défaut) | 10 emails (maximum) |
  |---|---|---|
  | 1 s | 6 300 /min : dépasse le quota avec un seul widget | 12 300 /min |
  | 10 s | 630 /min | 1 230 /min (20 % du quota) |
  | 30 s | 210 /min | 410 /min |

  Au-delà du quota, Google répond `429` et le widget affiche « gmail is unavailable ».
* **Pourquoi 24 h maximum** : c'est largement assez, et cela reste très loin de la limite de `setTimeout` côté navigateur (environ 24,8 jours, au-delà il se déclenche immédiatement).

---

## 4. Architecture Frontend

### 4.1. Ajout depuis la barre latérale (`frontend/src/widget-types.ts`)
| Champ | Valeur |
|---|---|
| `label` | `Gmail` |
| `description` | `Latest emails` |
| `serviceName` / `widgetName` | `gmail` / `inbox` |
| `defaultConfig` | `{ number: 5 }` |
| `defaultRefreshSeconds` | `300` |
| `fields` | `GMAIL_FIELDS` (exporté par `gmail-widget.tsx`) : **Emails shown** |

* **« + Add » ouvre une fenêtre d'ajout** (« Add a Gmail widget »), comme pour les autres widgets. Elle demande les réglages **avant** la création :
  * **Emails shown** : une liste de 1 à 10, sur 5 par défaut ;
  * **Refresh every (seconds)** : `300` par défaut.
* **Les boutons** :
  | Bouton | Effet |
  |---|---|
  | **Add widget** (ou Entrée) | Vérifie les champs, puis `POST /api/widgets` avec les valeurs choisies. La fenêtre se ferme et la nouvelle carte apparaît |
  | **Default** | Remet 5 emails et 300 s dans les champs, et efface l'erreur affichée. Rien n'est envoyé |
  | **Cancel** (rouge) ou la croix × | Ferme la fenêtre sans rien créer. Échap et un clic sur le fond ne la ferment pas, pour ne pas perdre la saisie par erreur |
* **Réglages d'abord, compte ensuite** : le widget est créé avec ses réglages, mais **sans compte Google**. La nouvelle carte arrive donc sur l'écran « Connect Gmail », et l'utilisateur se connecte quand il veut.
* **La connexion ne touche pas aux réglages** : le retour de Google (`/api/oauth/google/callback`) ne modifie que `subscription_id`, jamais la config ni l'intervalle. Une fois connectée, la carte affiche directement le nombre d'emails choisi, au rythme choisi.
* **Les mêmes champs que Settings** : la fenêtre d'ajout et le panneau Settings de la carte (§4.5) affichent le même formulaire (`frontend/src/components/widget-form.tsx`), avec la même liste de champs (`GMAIL_FIELDS`). Settings n'apparaît qu'une fois la carte connectée.
* **Chaque ouverture repart de 5 emails et 300 s** : les réglages d'une autre carte Gmail ne sont jamais repris.

---

### 4.2. Le composant `<GmailWidget />` (`frontend/src/components/gmail-widget.tsx`)
La carte ne fait qu'**afficher** et gérer la connexion. Le chargement (états, rechargement après un réglage, minuteur, bouton Refresh) est dans le hook commun `useWidgetData` (`frontend/src/use-widget-data.ts`), partagé avec les autres cartes. Ce hook reconnaît la réponse `403` et passe alors à l'état `disconnected` : c'est le seul widget qui en a besoin, mais la règle est générale (un widget sans compte connecté).

| État | Quand | Affichage | Boutons dans l'en-tête |
|---|---|---|---|
| `loading` | Au montage, et après un réglage enregistré (jamais pendant les rafraîchissements, automatiques ou manuels) | « Loading... » | ⠿, Dupliquer, × |
| `disconnected` | `/data` répond `403` | « Connect a Google account to view its inbox. » + bouton **Connect Gmail** | ⠿, Dupliquer, × |
| `ready` | `/data` répond `200` | Adresse du compte + liste des emails (+ panneau de réglages s'il est ouvert) | ⠿, **Settings**, **Refresh**, **Disconnect**, Dupliquer, × |
| `error` | Toute autre erreur | Le message d'erreur (le minuteur réessaie tout seul) | ⠿, **Settings**, **Refresh**, **Disconnect**, Dupliquer, × |

La poignée ⠿ (déplacement), le bouton Dupliquer (icône de deux carrés) et le × (suppression) viennent du cadre commun `WidgetFrame` et sont toujours présents.

* **Dupliquer** crée une nouvelle carte Gmail avec les **mêmes réglages** (nombre d'emails, rafraîchissement, zoom), placée au premier emplacement libre. La copie **n'est pas connectée** : le compte Google n'est pas un réglage, c'est une autorisation donnée à une carte. La copie arrive donc sur « Connect Gmail », et l'utilisateur choisit le compte à y connecter (le même ou un autre).

* **Connect Gmail** : demande l'URL à `GET /api/oauth/google/url?widget={id}`, puis fait `window.location.href = url`. Toute la page part chez Google et revient sur `/dashboard?gmail=…`, ce qui recharge le dashboard. Si cette demande échoue, l'erreur s'affiche sous le bouton.
* **Disconnect** : appelle `DELETE /api/oauth/google?widget={id}`, puis relit la carte. Le serveur répond alors `403`, et la carte repasse d'elle-même sur « Connect Gmail ». Les autres cartes ne sont pas touchées.
* **Settings** : ouvre ou ferme le panneau de réglages (voir §4.5). Le bouton devient « Close » quand le panneau est ouvert.
* **Refresh** : relit tout de suite `GET /api/widgets/{id}/data`. La liste reste affichée pendant ce temps, et le bouton devient « Refreshing... » sans pouvoir être cliqué. Si la lecture échoue, l'erreur s'affiche : c'est l'utilisateur qui a demandé.
* **En erreur, les boutons restent** : avec « gmail is unavailable », on peut réessayer tout de suite, changer les réglages ou se déconnecter.
* **Adresse affichée** : une petite ligne grise au-dessus des emails (`gmailAccountStyle`) permet de distinguer deux cartes Gmail. Le titre de la carte reste « Gmail », car une adresse complète n'y tiendrait pas à côté des boutons.

---

### 4.3. La liste des emails (`frontend/src/components/gmail-inbox.tsx`)
* Une ligne par email : l'expéditeur et la date courte (`5 Oct`, format `en-GB`), puis `objet — extrait`.
* L'expéditeur et l'objet sont en **gras** si l'email n'est pas lu.
* Les textes trop longs sont coupés sur une ligne avec « … ».
* Si la boîte est vide : « Your inbox is empty. »
* **Une vraie liste** (`<ul>` / `<li>`) : un lecteur d'écran annonce « liste, 5 éléments ».

#### Cliquer sur un mail l'ouvre dans Gmail
* **Chaque ligne est un lien** (`<a>`), pas un `<div>` : un lien sert à ouvrir une page, et il marche au clavier (Tab, puis Entrée) sans rien ajouter.
* **Le lien** est construit par `gmailUrl(account, threadId)`, sans appel au serveur :
  ```
  https://mail.google.com/mail/?authuser=alice%40gmail.com#all/19a3f2c1d4e5b6a7
                               └─ ce compte-là ─────────┘└─ cette conversation ─┘
  ```
  | Morceau | Rôle |
  |---|---|
  | `?authuser=<adresse>` | Ouvre **l'adresse de la carte**, même si le navigateur est connecté à plusieurs comptes Google. Sans lui, Gmail ouvrirait le 1er compte du navigateur, peut-être pas le bon. L'adresse est encodée (`@` → `%40`, `+` → `%2B`) |
  | `#all/<threadId>` | La conversation, retrouvée même si elle a été archivée depuis (`#all` = tous les messages, pas seulement la boîte de réception) |
  * Si la carte n'a pas d'adresse (connexion antérieure au multi-comptes), le lien ouvre le compte par défaut du navigateur.
  * Si le navigateur n'est pas connecté à cette adresse, Google demande simplement de s'y connecter.
* **Nouvel onglet** (`target="_blank"`) avec `rel="noreferrer"` : Gmail ne reçoit pas l'adresse du dashboard, et l'onglet ouvert ne peut pas agir sur celui du dashboard. Un texte invisible, « (opens in a new tab) », prévient les lecteurs d'écran.
* **Survol et clavier** (classe `.gmail-row` dans `frontend/src/index.css`, car un style inline ne peut pas faire `:hover` ni `:focus-visible`) : fond vert clair au survol, contour vert autour de la ligne atteinte au clavier. Le texte garde sa couleur, sans soulignement bleu.

#### Le bouton « Open Gmail » (`frontend/src/components/gmail-widget.tsx`)
* **En bas de la carte**, sous la liste, sur toute la largeur : il ouvre **toute la boîte de réception** de l'adresse de la carte, `gmailUrl(account)` → `https://mail.google.com/mail/?authuser=…#inbox`, dans un nouvel onglet (`rel="noreferrer"`).
* **Présent même quand la boîte est vide** : c'est justement là qu'on peut avoir envie d'aller voir.
* **C'est un lien qui ressemble à un bouton** (`gmailOpenStyle`) : il ouvre une page, donc c'est un `<a>` et pas un `<button>`. Mêmes signes que les lignes au survol et au clavier (classe `.gmail-open`).
* **Seulement sur une carte connectée** (état `ready`) : sans compte, il n'y a pas d'adresse à ouvrir.

---

### 4.4. Rafraîchissement automatique (`useWidgetData` + `useAutoRefresh`)
Chaque carte connectée relit sa boîte de réception toutes les `refreshSeconds` secondes. Le minuteur est le hook commun `useAutoRefresh` (`frontend/src/use-auto-refresh.ts`), appelé par `useWidgetData` : la carte Gmail n'a plus sa propre copie du minuteur.

```
   montage de la carte, ou nouvel intervalle enregistré
                          |
                          v
       attendre refreshSeconds (setTimeout)  <-------------+
                          |                                |
                          v                                |
                   onglet caché ?                          |
              | non                | oui                   |
              v                    v                       |
     lecture silencieuse      tour sauté,                  |
     (GET /data, sans         aucun appel                  |
     « Loading... »)          à Gmail                      |
              |                    |                       |
              +---------+----------+                       |
                        v                                  |
        minuteur arrêté pendant la lecture ? ---- non -----+
                        | oui
                        v
          fin (un nouveau minuteur a pris le relais, ou la carte a disparu)
```

* **Délai** : `refreshSeconds × 1000` ms, jamais en dessous de 10 s, même si une valeur incorrecte arrivait. Un délai de 0 ferait tourner les appels à Gmail en boucle.
* **Une chaîne de `setTimeout` et pas un `setInterval`** : le tour suivant n'est planifié qu'une fois la réponse reçue. Deux lectures ne se chevauchent donc jamais, même si Gmail met plus de temps à répondre que l'intervalle.
* **Lecture silencieuse** : la liste reste affichée pendant le rechargement, sans écran « Loading... » qui clignoterait.
  * Une `403` (accès retiré) affiche l'écran « Connect Gmail » et arrête le minuteur.
  * Une autre erreur garde les emails à l'écran, et le tour suivant réessaie.
* **Redémarrage propre** : le minuteur dépend du délai et d'un drapeau « actif », qui vaut `status !== "disconnected"`.
  * Quand un nouvel intervalle est enregistré, l'ancien minuteur est arrêté et un nouveau démarre.
  * Le drapeau `cancelled` empêche une lecture encore en cours de replanifier l'ancien minuteur, ce qui ferait tourner deux minuteurs à la fois.
* **Pas de minuteur** sur une carte qui affiche « Connect Gmail ».
* **Onglet caché** (`document.hidden`) : le tour est sauté, aucun quota n'est consommé pour personne.

---

### 4.5. Les réglages (bouton « Settings », `frontend/src/components/settings-panel.tsx`)
* **Le panneau commun** à plusieurs cartes s'ouvre en haut de la carte. La carte Gmail lui donne un champ (`GMAIL_FIELDS`, la même liste que la fenêtre d'ajout), et le panneau ajoute lui-même l'intervalle :
  * **Emails shown** : une liste déroulante de 1 à 10, préremplie avec la valeur actuelle. Une liste plutôt qu'un champ texte : le serveur n'accepte que ces 10 valeurs, il n'y a rien à mal taper ;
  * **Refresh every (seconds)**, prérempli avec la valeur actuelle (`300`, `12.5`...), avec une aide.
  * Les boutons **Save** (ou la touche Entrée) et **Cancel**.
* Les ids des champs sont uniques (`number-{id du widget}`, `refresh-{id du widget}`), car plusieurs cartes Gmail peuvent être ouvertes en même temps.
* **Format accepté** (`parseSeconds` dans `frontend/src/refresh.ts`) : des chiffres, puis éventuellement **un point** et 1 à 3 chiffres. Les espaces autour sont ignorés.
  | Saisie | Résultat |
  |---|---|
  | `12.5`, `10`, ` 10 `, `12.125` | Accepté |
  | `12,5`, `abc`, `.5`, `5.`, `12.5555`, champ vide | « Use a number with a dot, e.g. 12.5 » |
  | `9.999`, `86400.001` | « Between 10 and 86400 seconds » |
* **Pourquoi un format strict** : `parseFloat("12,5")` donne `12` et `parseFloat("12abc")` donne `12`, sans aucune erreur. Le motif refuse ces saisies au lieu de les mal lire.
* **Pourquoi un champ texte** : avec `type="number"`, le navigateur suit la langue du système et attend une virgule en français. Avec `inputMode="decimal"`, un clavier de téléphone en français n'affiche souvent qu'une virgule.
* **Enregistrement** :
  1. **Save** envoie **un seul** `PATCH /api/widgets/{id}` avec `{ "config": { "number": "3" }, "refreshSeconds": 12.5 }`. Le nombre part en texte (c'est la valeur de la liste), et le serveur le convertit en entier (`3`).
  2. La réponse est le widget complet.
  3. La carte le passe au dashboard (`onUpdate(updated)`), qui remplace l'instance dans sa liste.
  4. Le nouveau délai relance le minuteur, et une nouvelle config recharge la carte.
  
  Une erreur, locale ou du serveur (`422`), s'affiche dans le panneau.
* **Contrat `onUpdate`** (`frontend/src/components/widget-frame.tsx`) : chaque widget renvoie au dashboard **la réponse du serveur** à son `PATCH`. Toutes les cartes à réglages passent par le même panneau, donc par le même contrat. Le serveur fait foi, et le dashboard n'a rien à fusionner à la main.

---

## 5. Configuration (`.env` & Google Cloud)

### 5.1. Variables d'environnement
| Variable | Exemple | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | ID du client OAuth de type « Application Web » |
| `GOOGLE_CLIENT_SECRET` | *(secret)* | Uniquement dans `.env` (ignoré par Git), jamais dans `.env.example` |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8080/api/oauth/google/callback` | Doit être **identique** à l'URI déclarée dans la console Google |
| `APP_BASE_URL` | `http://localhost:8080` | Adresse vers laquelle le callback redirige (`/dashboard?gmail=…`) |

L'URI de redirection est en `localhost:8080`, car Google passe par le serveur Vite, qui relaie `/api` vers le backend.

---

### 5.2. Console Google Cloud (projet `epitech-dashboard` → Google Auth Platform)
* **Audience** : type d'utilisateur **Externe**, état de publication **En production**. La liste des utilisateurs tests ne sert plus.
* **Branding** :
  * nom : « Epitech Dashboard » ;
  * **pas de logo**, car un logo imposerait une validation par Google ;
  * domaine autorisé : `ethansaintot.github.io` ;
  * les trois pages publiques exigées pour la production :
    * Accueil : https://ethansaintot.github.io/dashboard-legal/
    * Règles de confidentialité : https://ethansaintot.github.io/dashboard-legal/privacy.html
    * Conditions d'utilisation : https://ethansaintot.github.io/dashboard-legal/terms.html
* **Clients** : un client « Application Web », avec l'URI de redirection `http://localhost:8080/api/oauth/google/callback`.
* **Application non validée** : `gmail.readonly` est un scope **restreint** chez Google, et une validation complète demanderait un audit de sécurité payant. L'application reste donc non validée, avec deux conséquences :
  * à la connexion, Google affiche « Google n'a pas validé cette application ». Il faut cliquer sur **Paramètres avancés**, puis **Accéder à Epitech Dashboard (non sécurisé)** ;
  * l'application est limitée à **100 utilisateurs** au total.

---

## 6. Cycle de Vie des Données (Flux complet)

```text
1. Ajout d'un widget Gmail :
   Dashboard   -> « + Add » -> fenêtre « Add a Gmail widget » (5 emails, 300 s) -> l'utilisateur choisit 3 emails, 600 s -> Add widget
   Dashboard   -> POST /api/widgets { serviceName: "gmail", widgetName: "inbox", config: { number: "3" }, refreshSeconds: 600, x, y }
   Backend     -> Valide la config via catalog.validate_config (number parmi 1 à 10, enregistré en entier : 3)
   Backend     -> Enregistre l'instance (table widget_instances, subscription_id = NULL), HTTP 201
   GmailWidget -> GET /api/widgets/{id}/data -> 403 -> écran « Connect Gmail »

2. Connexion :
   GmailWidget -> GET /api/oauth/google/url?widget={id} -> redirection vers Google
   Google      -> Choix du compte + consentement -> GET /api/oauth/google/callback?code=…&state=…
   Backend     -> Jetons + adresse -> ligne subscriptions de cette adresse -> widget.subscription_id
   Backend     -> 302 vers /dashboard?gmail=connected

3. Chargement des données :
   GmailWidget -> GET /api/widgets/{id}/data
   Backend     -> run_widget -> fetch_inbox (1 liste + N détails en parallèle)
   GmailWidget -> Affiche l'adresse et les emails

4. Rafraîchissement automatique :
   GmailWidget -> toutes les refreshSeconds (300 par défaut), relit GET /api/widgets/{id}/data en silence
   GmailWidget -> onglet caché : tour sauté ; 403 : écran « Connect Gmail » et arrêt du minuteur

5. Réglages :
   GmailWidget -> Settings -> 3 emails, "12.5" -> PATCH /api/widgets/{id} { config: { number: "3" }, refreshSeconds: 12.5 }
   Backend     -> Valide (number parmi 1 à 10, intervalle de 10 à 86400 avec 3 décimales max) -> enregistre number = 3 -> renvoie le widget complet
   Dashboard   -> Remplace l'instance -> la carte se recharge avec 3 emails, le minuteur repart avec 12,5 s

6. Expiration du jeton d'accès (environ 1 h) :
   Backend     -> ensure_fresh le rafraîchit grâce au refresh token, le runner l'enregistre
   Si Google refuse (accès retiré, mot de passe changé, 6 mois sans utilisation...) -> 403 -> « Connect Gmail »

7. Déconnexion :
   GmailWidget -> DELETE /api/oauth/google?widget={id}
   Backend     -> Détache CE widget -> release_if_unused (revoke si plus aucun widget n'utilise l'adresse)

8. Suppression du widget :
   Dashboard   -> DELETE /api/widgets/{id}
   Backend     -> Supprime la ligne widget_instances -> release_if_unused

9. Suppression du compte :
   Dashboard   -> DELETE /api/me
   Backend     -> Révoque chaque adresse chez Google -> la cascade supprime widgets et connexions
```

---

## 7. Sécurité & Données Personnelles
* **Lecture seule** : le scope `gmail.readonly` ne permet ni d'envoyer, ni de modifier, ni de supprimer un email.
* **Aucun email stocké** : seuls les jetons OAuth et l'adresse du compte sont enregistrés en base.
* **Cloisonnement** :
  * le widget d'un autre utilisateur répond `404` et non `403`, qui confirmerait son existence ;
  * le runner vérifie aussi que la connexion liée appartient bien à l'utilisateur.
* **`state` signé et limité dans le temps** : impossible de rattacher un compte Google au widget de quelqu'un d'autre.
* **Révocation** : elle a lieu quand le dernier widget d'une adresse se déconnecte, et quand on supprime son compte. L'utilisateur peut aussi retirer l'accès lui-même sur https://myaccount.google.com/permissions.
* **Jetons non chiffrés** : ils sont stockés en clair dans la colonne JSONB `credentials`, comme l'indique la politique de confidentialité.
* **Ouvrir un mail ou la boîte ne passe pas par le serveur** : ce sont de simples liens vers Gmail, ouverts dans un nouvel onglet avec `rel="noreferrer"`. Aucun contenu de mail n'est récupéré pour ça, et rien de plus n'est stocké.

---

## 8. Limites Connues & Pistes
* **`?gmail=connected|denied|error`** : ce paramètre est ajouté à l'URL au retour de Google, mais le front ne le lit pas encore (aucun message affiché).
* **Erreur réseau pendant le callback** : si Google est injoignable au moment de l'échange du code, l'erreur réseau n'est pas interceptée. Le navigateur affiche alors une erreur `500` au lieu d'être redirigé vers `?gmail=error`.
* **Même adresse sur deux comptes du dashboard** : la révocation chez l'un coupe aussi l'accès chez l'autre, car Google révoque par compte Google.
* **Jetons à chiffrer** avant leur enregistrement, par exemple avec un chiffrement symétrique.
* **Application non validée par Google** : écran d'avertissement à la connexion et limite de 100 utilisateurs.
* **Un mail ouvert reste en gras dans la carte** jusqu'à sa prochaine lecture (Refresh ou minuteur) : Gmail le marque comme lu de son côté, mais la carte ne le sait qu'en relisant. Piste : relire la carte quand l'utilisateur revient sur l'onglet du dashboard (événement `visibilitychange`).

---

Retour à la [documentation principale](../README.md).
