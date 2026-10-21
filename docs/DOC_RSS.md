# Documentation Complète — Service & Widget RSS (Actualités)

Ce document est la documentation technique et fonctionnelle dédiée exclusivement au service **RSS** et à son widget « News ».

---

## 1. Présentation du Service

Le service **RSS** affiche les **derniers articles** d'un flux d'actualités, choisi par l'utilisateur. Pour chaque article :
* le titre, cliquable, qui ouvre l'article dans un nouvel onglet ;
* une courte description (2 lignes au plus) ;
* la date et l'heure de publication (« 06/10 · 17:42 »).

Le flux par défaut est celui de **franceinfo** (`https://www.franceinfo.fr/titres.rss`), mais n'importe quel flux **RSS** ou **Atom** public fonctionne (Le Monde, un blog, les versions d'un dépôt GitHub…). Aucun compte n'est nécessaire. On peut afficher plusieurs cartes « News », chacune avec son flux et son rythme de rafraîchissement.

* **Identifiant du service** : `rss`
* **Souscription requise (`requires_subscription`)** : `false`, aucun compte tiers n'est nécessaire.
* **Fichiers sources dédiés** :
  * Backend : [`backend/catalog/rss.py`](../backend/catalog/rss.py) : déclaration du widget, téléchargement protégé du flux, tri et nettoyage des articles
  * Backend partagé avec les autres widgets : [`backend/catalog/__init__.py`](../backend/catalog/__init__.py) (`validate_config`), [`backend/runner.py`](../backend/runner.py), [`backend/routes/widgets.py`](../backend/routes/widgets.py), [`backend/schemas.py`](../backend/schemas.py) (bornes de `refreshSeconds`)
  * Dépendance : `feedparser`, dans [`backend/requirements.txt`](../backend/requirements.txt)
  * Frontend :
    * [`frontend/src/components/rss-widget.tsx`](../frontend/src/components/rss-widget.tsx) : la carte
    * [`frontend/src/components/widget-form.tsx`](../frontend/src/components/widget-form.tsx) : le formulaire commun, utilisé par la fenêtre d'ajout et par le panneau de réglages
    * [`frontend/src/components/settings-panel.tsx`](../frontend/src/components/settings-panel.tsx) : le panneau de réglages, commun à plusieurs cartes
    * [`frontend/src/use-widget-data.ts`](../frontend/src/use-widget-data.ts) : le chargement des données, commun à plusieurs cartes
    * [`frontend/src/use-auto-refresh.ts`](../frontend/src/use-auto-refresh.ts) : le minuteur de rafraîchissement
    * [`frontend/src/refresh.ts`](../frontend/src/refresh.ts) : lecture et bornes de l'intervalle saisi
    * [`frontend/src/widget-types.ts`](../frontend/src/widget-types.ts) : entrée « News » de la barre latérale
    * [`frontend/src/styles.ts`](../frontend/src/styles.ts) : styles `rss…`

---

## 2. Spécifications & Contrat d'API (`about.json`)

Le service expose un seul widget dans le catalogue :

```json
{
  "name": "rss",
  "widgets": [
    {
      "name": "article_list",
      "description": "Latest articles from an RSS or Atom feed",
      "params": [
        { "name": "link", "type": "string" },
        { "name": "number", "type": "integer" }
      ]
    }
  ]
}
```

### 2.1. Widget : `article_list`
* **Description** : Affiche les articles les plus récents d'un flux RSS ou Atom.
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `link` | `string` | **Oui** | — | Adresse du flux, en `http` ou `https` (ex. `https://www.franceinfo.fr/titres.rss`) |
  | `number` | `integer` | Non | `5` | Nombre d'articles affichés. Ramené entre **1 et 20** à la lecture : `0` donne 1 article, `50` en donne 20 |

* **Valeurs à l'ajout depuis la barre latérale** : `config = { "link": "https://www.franceinfo.fr/titres.rss", "number": 5 }`, `refreshSeconds = 300`.
* **`refreshSeconds`** : réglable par l'utilisateur, de `10` à `86400` secondes, avec 3 décimales au plus (`12.5` = 12 s 500 ms). Pourquoi 300 par défaut : l'actualité bouge vite, mais chaque rafraîchissement télécharge **tout** le flux (environ 37 Ko pour franceinfo). 5 minutes est un bon compromis.

* **Format des données retournées (`GET /api/widgets/{id}/data`)** :
```json
{
  "data": {
    "feed": "franceinfo - Les Titres",
    "articles": [
      {
        "title": "Titre de l'article le plus récent",
        "description": "Le début de l'article, en texte simple, coupé proprement sur un mot…",
        "link": "https://www.franceinfo.fr/...",
        "date": "2026-10-06T15:42:36+00:00"
      }
    ]
  },
  "account": null,
  "fetchedAt": "2026-10-06T15:57:12.481516+00:00"
}
```

  | Champ | Description |
  |---|---|
  | `feed` | Le nom du flux, tel que le flux le donne. `Untitled feed` s'il n'en a pas |
  | `articles` | Les `number` articles **les plus récents**, du plus récent au plus ancien (§3.3) |
  | `title` | Titre de l'article, en texte simple. `Untitled` s'il est vide |
  | `description` | Résumé de l'article, **sans HTML**, coupé à 300 caractères sur un mot, avec « … ». Peut être vide |
  | `link` | Lien vers l'article. **Vide** si le flux donne autre chose qu'un lien `http`/`https` (§3.3) |
  | `date` | Date de publication en ISO 8601 UTC, ou `null` si l'article n'est pas daté |
  | `account` | Toujours `null` : ce widget n'a pas de compte lié |
  | `fetchedAt` | Heure de la lecture côté serveur (ISO 8601 UTC). La carte l'affiche dans « Updated 17:57 » |

* **Réponses d'erreur** (toutes affichées dans la carte, Settings reste disponible pour corriger le lien) :
  | Situation | Code | Message |
  |---|---|---|
  | Lien qui n'est pas en `http` ou `https` (`ftp://`, `file://`, `franceinfo`…) | `502` | `Only http and https links are allowed` |
  | Nom de domaine inexistant | `502` | `Unknown host: exemple.invalid` |
  | Adresse interne ou privée (§3.4) | `502` | `This address is not allowed` |
  | Le site répond une erreur (404, 403, 500…) | `502` | `The feed link answered HTTP 404` |
  | Fichier de plus de 2 Mo | `502` | `Feed too large (2 MB max)` |
  | La page n'est pas un flux (une page HTML, une image…) | `502` | `Not a valid RSS or Atom feed: https://example.com` |
  | Site injoignable, ou qui reste 10 s sans répondre | `502` | `rss is unavailable` |
  | Widget inexistant ou appartenant à un autre utilisateur | `404` | `Widget not found` |

  Lors d'un rafraîchissement automatique, une erreur ne remplace pas les articles déjà affichés : ils restent, et la lecture suivante réessaie.

* **Erreurs à l'enregistrement des réglages** (`PATCH /api/widgets/{id}`, code `422`) :
  | Situation | Message |
  |---|---|
  | Lien vide | `link cannot be empty` |
  | `number` qui n'est pas un entier | `number must be an integer` |
  | Intervalle sous 10 s ou au-dessus de 86 400 s | `Input should be greater than or equal to 10` / `… less than or equal to 86400` |
  | Plus de 3 décimales | `Value error, Value must have at most three decimal places` |

---

## 3. Architecture Backend

### 3.1. Pourquoi `feedparser`
Il existe plusieurs formats de flux : **RSS** 0.9x, 1.0 et 2.0, et **Atom**. Leurs balises n'ont pas les mêmes noms (`<description>` ou `<summary>`, `<pubDate>` ou `<updated>`…). La bibliothèque `feedparser` les lit tous et les ramène aux **mêmes champs** : `title`, `summary`, `link`, `published_parsed`, `updated_parsed`.

* Elle **ne lève jamais d'erreur** : une page qui n'est pas un flux revient simplement **sans articles**. C'est pour ça que le code vérifie lui-même `if not feed.entries`.
* Le drapeau `bozo` de feedparser n'est **pas** utilisé pour refuser un flux : il signale aussi des petites fautes (une entité mal écrite…) alors que les articles se lisent très bien.
* On lui donne les **octets** reçus, et pas du texte : feedparser lit lui-même l'encodage déclaré dans le XML (`<?xml encoding="…"?>`).

---

### 3.2. Téléchargement du flux (`_load_feed`)
```text
1. Client httpx : 10 s d'attente au plus, redirections suivies, et _guard appelé avant CHAQUE requête (§3.4)
2. Téléchargement en flux (client.stream) :
     - réponse 400 ou plus       -> "The feed link answered HTTP 404"
     - plus de 2 Mo reçus         -> on coupe tout de suite : "Feed too large (2 MB max)"
3. feedparser.parse(octets reçus)
4. Aucun article                  -> "Not a valid RSS or Atom feed: …"
```

* **Pourquoi une limite de 2 Mo** : un flux pèse quelques dizaines de Ko (37 Ko pour franceinfo). Sans limite, un lien vers un fichier de plusieurs Go remplirait la mémoire du serveur. Le téléchargement en flux permet de **s'arrêter** dès que la limite est dépassée, au lieu de tout charger d'abord.
* **Délai de 10 s** : il s'applique à **chaque attente** (connexion, réception d'un morceau…), pas au téléchargement entier.
* **Erreurs réseau** (délai dépassé, connexion refusée…) : le runner transforme toute erreur httpx en `WidgetError("rss is unavailable")`, donc une `502` et jamais une `500`.

---

### 3.3. Les articles les plus récents (`fetch_article_list`)
1. **Nombre d'articles** : `number` ramené entre 1 et 20.
2. **Tri du plus récent au plus ancien** (`_newest_first`). Un flux n'est **pas forcément trié** : dans celui de franceinfo, les 5 premiers articles du fichier et les 5 plus récents ne sont pas les mêmes (seuls 2 étaient en commun lors de nos tests). La clé de tri est la date de publication, sinon la date de mise à jour, sinon le 1er janvier 1970 : un article sans date part à la fin au lieu de faire planter le tri.
3. **Nettoyage de chaque article** :
   | Fonction | Rôle |
   |---|---|
   | `_plain` | Retire les balises HTML, décode les entités (`&amp;` → `&`), réduit les espaces, puis coupe à 300 caractères **sur un mot**, avec « … ». Beaucoup de flux mettent du HTML dans leurs descriptions (`<p>`, `<img>`…) : React ne l'interpréterait pas, il l'afficherait tel quel, balises comprises |
   | `_safe_link` | Ne garde que les liens `http://` ou `https://`. Un lien `javascript:…` dans un flux exécuterait du code au clic : il est remplacé par une chaîne vide, et le titre n'est alors pas cliquable |
   | `_date` | Date donnée par feedparser (toujours en UTC) → texte ISO 8601. Le front l'affiche dans l'heure locale de l'utilisateur |

Tous les champs d'un article sont facultatifs dans les deux formats : ils sont toujours lus avec `.get()`, avec une valeur de repli.

---

### 3.4. Protection du serveur : l'attaque SSRF (`_check_url` et `_guard`)
**Le problème.** C'est **notre serveur** qui télécharge le lien tapé par l'utilisateur. Sans protection, quelqu'un pourrait taper `http://libretranslate:5000/languages`, `http://db:5432` ou `http://localhost:3000` : le serveur irait lire **nos propres services internes**, invisibles depuis internet, et renverrait leur réponse ou leurs erreurs. Ce type d'attaque s'appelle **SSRF** (*Server-Side Request Forgery* : faire faire une requête par le serveur à la place de l'attaquant).

**La parade**, appliquée à **chaque** requête :
1. Le lien doit être en `http` ou `https`, avec un nom d'hôte.
2. Le nom d'hôte est **résolu** (`getaddrinfo`), ce qui donne toutes ses adresses IP.
3. **Toutes** ces adresses doivent être **publiques** (`ipaddress.ip_address(…).is_global`). Sont refusées, entre autres :
   | Adresse | Exemple |
   |---|---|
   | Boucle locale | `127.0.0.1`, `localhost`, `[::1]` |
   | Réseaux privés, dont le réseau Docker | `10.x`, `172.16.x` à `172.31.x`, `192.168.x`, `db`, `libretranslate`, `backend` |
   | Lien local, dont l'adresse des métadonnées des hébergeurs cloud | `169.254.169.254` |

   Une adresse IPv6 peut arriver avec une « zone » (`fe80::1%eth0`) que `ipaddress` refuse de lire : elle est retirée avant la vérification.
4. **Les redirections aussi** : `_guard` est branché sur les `event_hooks` de httpx, qui l'appellent avant la première requête **et** avant chaque redirection. Un site public qui redirige vers `http://db:5432` est donc bloqué lui aussi.

**Testé** : `libretranslate`, `db`, `localhost`, `127.0.0.1`, `[::1]` et `169.254.169.254` donnent « This address is not allowed » ; une redirection publique vers une adresse interne aussi ; `ftp://…`, `file://…` et `franceinfo` donnent « Only http and https links are allowed ».

---

## 4. Architecture Frontend

### 4.1. Ajout depuis la barre latérale (`frontend/src/widget-types.ts`)
| Champ | Valeur |
|---|---|
| `label` | `News` |
| `description` | `RSS headlines` |
| `serviceName` / `widgetName` | `rss` / `article_list` |
| `defaultConfig` | `{ link: "https://www.franceinfo.fr/titres.rss", number: 5 }` |
| `defaultRefreshSeconds` | `300` |
| `fields` | `RSS_FIELDS` (exporté par `rss-widget.tsx`) : **Feed link (RSS or Atom)** |

* **« + Add » ouvre une fenêtre d'ajout** (« Add a News widget »). Le widget n'est créé **qu'à la confirmation**, comme le demande le sujet : choisir le type, le configurer, régler son rafraîchissement, puis confirmer.
  * **Feed link (RSS or Atom)** : le lien de franceinfo par défaut, 2 000 caractères maximum ;
  * **Refresh every (seconds)** : `300` par défaut.
* **Les boutons** :
  | Bouton | Effet |
  |---|---|
  | **Add widget** (ou Entrée) | Vérifie les champs, puis `POST /api/widgets` avec les valeurs choisies. La fenêtre se ferme et la nouvelle carte apparaît |
  | **Default** | Remet les valeurs par défaut dans les champs, et efface l'erreur affichée. Rien n'est envoyé |
  | **Cancel** (rouge) ou la croix × | Ferme la fenêtre sans rien créer. Échap et un clic sur le fond ne la ferment pas, pour ne pas perdre la saisie par erreur |
* **`number` n'est pas demandé**, mais il est envoyé : le dashboard part de la config par défaut et y pose les valeurs saisies (`{ ...defaultConfig, ...valeurs }`). Un nouveau widget a donc toujours `number: 5`.
* **Le lien n'est vérifié qu'à l'affichage** : la fenêtre refuse seulement un lien vide. Un lien qui n'est pas un flux crée quand même la carte, qui affiche alors l'erreur (§2.1), et Settings permet de le corriger.
* **Les mêmes champs que Settings** : la fenêtre d'ajout et le panneau Settings de la carte affichent le même formulaire (`frontend/src/components/widget-form.tsx`), avec la même liste de champs.
* La suppression (×) vient du cadre commun `WidgetFrame`.

---

### 4.2. La carte `<RssWidget />` (`frontend/src/components/rss-widget.tsx`)
La carte ne fait qu'**afficher**. Le chargement (états, rechargement, minuteur) est dans le hook commun `useWidgetData` (`frontend/src/use-widget-data.ts`), qui renvoie notamment `{ status, message, data, updatedAt }`.

| État | Quand | Affichage |
|---|---|---|
| `loading` | Au montage, ou après un nouveau réglage enregistré | « Loading... » |
| `ready` | `/data` répond `200` | La liste des articles |
| `error` | Toute erreur (lien invalide, adresse refusée, site injoignable…) | Le message d'erreur |

* **Titre** : le nom du flux quand c'est prêt (« franceinfo - Les Titres ») ; sinon « News ». Il n'affiche jamais le nom de l'ancien flux à côté d'une erreur. Un nom trop long n'est jamais coupé : le cadre commun fait passer les boutons sous le titre, puis le titre sur une 2e ligne si besoin. L'en-tête ne grandit que dans ce cas.
* **Bouton « Settings »** : **toujours visible**, même en erreur. Avec « Not a valid RSS or Atom feed », il faut pouvoir corriger le lien. Il devient « Close » quand le panneau est ouvert.
* **Bouton « Refresh »** : relit le flux tout de suite, sans attendre le minuteur. Pendant la lecture, il devient « Refreshing... » et ne peut plus être cliqué. Les derniers articles restent affichés pendant ce temps (pas d'écran « Loading... »). Si la lecture échoue, l'erreur est affichée : contrairement au minuteur, c'est l'utilisateur qui a demandé.
* **Rechargement automatique après un réglage** : l'effet de chargement dépend de toute la config (`JSON.stringify(instance.config)`). Dès que le serveur a enregistré un nouveau lien, la carte se recharge toute seule.
* **Réponse en retard** : chaque lecture reçoit un numéro (`lastRequest`). Si on enregistre Le Monde pendant qu'une lecture de franceinfo est en cours, la réponse de franceinfo arrivée après coup est **ignorée** et n'écrase pas Le Monde.

---

### 4.3. L'affichage
```
 ┌──────────────────────────────────────────────┐
 │ ⠿  franceinfo - Le…  Settings  Refresh  ×    │  <- en-tête commun
 ├──────────────────────────────────────────────┤
 │ Titre de l'article le plus récent            │  <- lien vert, gras
 │ Le début de la description, coupé à deux     │
 │ lignes au plus…                              │
 │ 06/10 · 17:42                                │
 ├──────────────────────────────────────────────┤
 │ Titre de l'article suivant                   │
 │ …                                            │
 ├──────────────────────────────────────────────┤
 │ Updated 17:57                                │
 └──────────────────────────────────────────────┘
```

* **Une vraie liste** (`<ul>` / `<li>`) : un lecteur d'écran annonce « liste, 5 éléments ».
* **Titre** : un lien qui s'ouvre dans un nouvel onglet (`target="_blank"`, `rel="noreferrer"`). Si `link` est vide (§3.3), le titre est affiché sans lien.
* **Description** : coupée à **2 lignes** avec « … » (`WebkitLineClamp: 2` dans `rssDescriptionStyle`), pour qu'une longue description ne rende pas la carte immense. Rien n'est affiché si elle est vide.
* **Date** : au format « jj/mm · hh:mm », dans l'heure locale de l'utilisateur. `en-GB` met bien le jour avant le mois, comme en français (l'anglais américain mettrait le mois en premier). La balise `<time dateTime="…">` garde la date exacte pour les lecteurs d'écran. Rien n'est affiché si l'article n'est pas daté.
* **Pied de carte** : l'heure de la dernière lecture (« Updated 17:57 »), qui rend le rafraîchissement automatique visible.
* **Couleurs** : les petits textes gris (date, pied) utilisent `#666` et non `#777` : sur fond blanc, `#777` passe juste sous le contraste minimum recommandé de **4,5:1**.
* **Clé des éléments de liste** : l'index. Les articles ne gardent aucun état, et deux articles d'un même flux peuvent avoir le même lien : le lien ne serait pas une clé fiable.

---

### 4.4. Le panneau de réglages (`frontend/src/components/settings-panel.tsx`)
* **Un panneau commun** : il ne connaît pas l'actualité. La carte lui donne la liste de ses champs (`SETTINGS_FIELDS` dans `rss-widget.tsx`), et le panneau ajoute lui-même le champ du rafraîchissement.
* **Les champs** :
  * **Feed link (RSS or Atom)** (texte, 2 000 caractères maximum) ;
  * **Refresh every (seconds)**, avec l'aide « Use a dot for milliseconds: 12.5 = 12 s 500 ms ».
* **`number` n'est pas affiché**, mais il est **conservé** : le panneau envoie `{ ...instance.config, link }`, donc `number: 5` repart avec le nouveau lien.
* **Ids des champs** : ils contiennent l'id du widget (`link-12`…). Avec plusieurs cartes ouvertes, chaque libellé reste bien rattaché à son champ.
* **Vérifications avant l'envoi**, pour économiser un aller-retour (le serveur revérifie tout) :
  * un lien vide affiche « Feed link (RSS or Atom) cannot be empty » ;
  * l'intervalle est lu par `parseSeconds` (`refresh.ts`) : une virgule affiche « Use a number with a dot, e.g. 12.5 », et une valeur hors de 10 à 86 400 affiche « Between 10 and 86400 seconds ».
* **Enregistrement** :
  1. **Un seul** `PATCH /api/widgets/{id}` avec `{ "config": { "link": …, "number": 5 }, "refreshSeconds": … }`. La config est envoyée **en entier** : le serveur la remplace, et un paramètre absent reviendrait à sa valeur par défaut.
  2. La réponse (le widget complet) est passée au dashboard par `onUpdate(updated)`, puis le panneau se ferme.
  3. La carte se recharge toute seule (§4.2), et le minuteur repart avec le nouvel intervalle.
* **Le lien n'est vérifié qu'à la lecture**, pas à l'enregistrement : un lien qui n'est pas un flux est accepté par le `PATCH`, puis la carte affiche l'erreur (§2.1).

---

### 4.5. Le rafraîchissement automatique (`frontend/src/use-auto-refresh.ts`)
* Dans `useWidgetData`, `useAutoRefresh(() => load("tick"), instance.refreshSeconds)` relit le flux toutes les `refreshSeconds` secondes, **sans** écran « Loading... ». Si une lecture automatique échoue, les derniers articles restent affichés, et la suivante réessaie.
* **Une chaîne de `setTimeout`**, pas un `setInterval` : la lecture suivante n'est planifiée qu'une fois la réponse reçue. Deux lectures ne se chevauchent donc jamais, même avec un site lent.
* **Onglet caché** : le tour est sauté, sans téléchargement du flux.
* **Jamais en dessous de 10 s**, même si une valeur incorrecte arrivait.

---

## 5. Configuration

* **Rien à configurer** : pas de clé, pas de compte, rien dans `.env`.
* La dépendance `feedparser` est installée avec les autres (`requirements.txt`), à la construction de l'image du backend.
* Le serveur doit avoir accès à internet pour télécharger les flux.

---

## 6. Cycle de Vie des Données (Flux complet)

```text
1. Ajout d'une carte « News » :
   Dashboard  -> POST /api/widgets { serviceName: "rss", widgetName: "article_list", config: { link: "https://www.franceinfo.fr/titres.rss", number: 5 }, refreshSeconds: 300, x, y }
   Backend    -> validate_config (link non vide, number entier) -> ligne widget_instances, HTTP 201

2. Chargement :
   RssWidget  -> GET /api/widgets/{id}/data
   Backend    -> run_widget -> fetch_article_list :
                 adresse vérifiée (SSRF) -> téléchargement (2 Mo max, 10 s d'attente max) -> feedparser
                 -> tri du plus récent au plus ancien -> 5 articles nettoyés
   RssWidget  -> Affiche « franceinfo - Les Titres », les 5 articles, « Updated 17:57 »

3. Rafraîchissement automatique :
   RssWidget  -> toutes les refreshSeconds (300 par défaut), relit GET /data en silence (sauté si l'onglet est caché)

4. Réglages :
   RssWidget  -> Settings -> « https://www.lemonde.fr/rss/une.xml », 600
              -> PATCH /api/widgets/{id} { config: { link: "https://www.lemonde.fr/rss/une.xml", number: 5 }, refreshSeconds: 600 }
   Dashboard  -> Remplace l'instance -> la carte se recharge, le minuteur repart à 600 s

5. Lien invalide ou interdit :
   Backend    -> 502 « Not a valid RSS or Atom feed: … » ou « This address is not allowed »
   RssWidget  -> affiche le message, Settings reste là pour corriger

6. Suppression :
   Dashboard  -> DELETE /api/widgets/{id} -> la ligne widget_instances est supprimée (rien d'autre à libérer)
```

---

## 7. Sécurité & Données Personnelles
* **SSRF** : le serveur ne télécharge que des adresses **publiques**, redirections comprises (§3.4). Nos services internes (base de données, LibreTranslate, backend) restent hors de portée.
* **Taille et attente bornées** : 2 Mo au plus par flux, et le téléchargement s'arrête si le site reste 10 secondes sans répondre. Un lien vers un énorme fichier ou un site muet ne bloque pas le serveur.
* **Liens dangereux** : seuls les liens `http`/`https` des articles sont rendus cliquables (`_safe_link`). Un `javascript:…` glissé dans un flux n'est jamais exécuté.
* **HTML des flux** : il est retiré côté serveur (`_plain`), et React échappe de toute façon le texte affiché. Aucun HTML venu d'un flux n'est interprété par le navigateur.
* **`rel="noreferrer"`** sur les liens : le site de l'article ne reçoit pas l'adresse du dashboard, et l'onglet ouvert ne peut pas agir sur l'onglet du dashboard.
* **Données envoyées** : le flux est téléchargé **par le serveur**, pas par le navigateur. Le site du flux voit l'adresse du serveur, jamais celle de l'utilisateur, et ne reçoit aucune donnée sur lui (ni nom, ni email, ni identifiant).
* **Rien n'est stocké** en dehors du réglage (`link`, `number`, `refreshSeconds`). Les articles sont relus à chaque fois et ne sont jamais enregistrés.
* **Cloisonnement** : le widget d'un autre utilisateur répond `404`.

---

## 8. Limites Connues & Pistes
* **« DNS rebinding »** : l'adresse est vérifiée, puis httpx **résout le nom une seconde fois** pour se connecter. Un attaquant qui contrôle son propre nom de domaine pourrait répondre une adresse publique à la vérification, puis une adresse interne juste après. L'attaque est difficile (il faut un serveur DNS dédié et un bon timing), mais la protection n'est donc pas totale.
  **Pistes** : se connecter directement à l'adresse IP qui a été vérifiée ; ou placer le backend derrière un proxy sortant qui n'a pas accès au réseau interne.
* **Tout le flux est retéléchargé à chaque rafraîchissement**, même s'il n'a pas changé :
  | Intervalle | Téléchargements par jour pour un widget | Volume avec franceinfo (≈ 37 Ko) |
  |---|---|---|
  | 10 s (minimum) | 8 640 | ≈ 320 Mo |
  | 300 s (défaut) | 288 | ≈ 11 Mo |

  Certains sites peuvent aussi bloquer un serveur qui les interroge trop souvent (réponse `403` ou `429`, affichée comme « The feed link answered HTTP 429 »).
  **Pistes** : envoyer les en-têtes `If-None-Match` / `If-Modified-Since` (le site répond alors `304`, sans contenu, si rien n'a changé) ; garder chaque flux en mémoire quelques minutes côté serveur, partagé entre toutes les cartes qui le lisent.
* **`number` n'a pas de champ dans le panneau Settings** : on ne peut le changer que par l'API (`PATCH`). Toutes les cartes ajoutées depuis le dashboard affichent donc 5 articles.
* **Langue du contenu** : les articles sont affichés dans une page déclarée en anglais. Un lecteur d'écran peut lire un flux français avec une voix anglaise. Piste : renvoyer la langue du flux (`feed.feed.language`) quand il la déclare, et la poser en attribut `lang` sur la liste. franceinfo ne la déclare pas.
* **Articles sans date** : ils sont classés à la fin et affichés sans date. Une date sans fuseau horaire dans le flux est considérée comme UTC par feedparser, ce qui peut la décaler d'une ou deux heures.
* **Un lien invalide n'est détecté qu'à l'affichage**, pas à l'enregistrement du réglage.
* **Pas de durée maximale pour le téléchargement entier** : un site qui envoie un octet toutes les 9 secondes n'atteint jamais le délai de 10 s. La lecture est longue, mais la limite de 2 Mo finit par l'arrêter. Piste : entourer le téléchargement d'un `asyncio.timeout(15)`.
* **Sites protégés** : un flux qui demande une connexion, des cookies ou du JavaScript (protection anti-robots) ne peut pas être lu.

---

Retour à la [documentation principale](../README.md).
