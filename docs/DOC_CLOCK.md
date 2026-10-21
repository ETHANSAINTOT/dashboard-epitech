# Documentation Complète — Service & Widget Clock (Horloge mondiale)

Ce document est la documentation technique et fonctionnelle dédiée exclusivement au service **Clock** et à son widget.

---

## 1. Présentation du Service

Le service **Clock** affiche l'heure en direct d'une ville choisie par l'utilisateur, à la seconde près :
* l'heure, qui avance toute seule chaque seconde ;
* la date complète (« Tuesday, 6 October 2026 ») ;
* le fuseau horaire (`Europe/Paris`), le décalage avec l'heure universelle (`UTC +02:00`) et son abréviation (`CEST`) ;
* l'heure d'été ou d'hiver (« Summer time » / « Standard time »).

N'importe quelle ville du monde fonctionne : on tape son nom, comme pour la météo. Aucun compte n'est nécessaire. On peut afficher plusieurs horloges, chacune avec sa ville et son rythme de rafraîchissement.

* **Identifiant du service** : `clock`
* **Souscription requise (`requires_subscription`)** : `false`, aucun compte tiers n'est nécessaire.
* **Fichiers sources dédiés** :
  * Backend :
    * [`backend/catalog/clock.py`](../backend/catalog/clock.py) : déclaration du widget et calcul de l'heure
    * [`backend/catalog/places.py`](../backend/catalog/places.py) : recherche de la ville, partagée avec la météo
  * Backend partagé avec les autres widgets : [`backend/catalog/__init__.py`](../backend/catalog/__init__.py) (`validate_config`), [`backend/runner.py`](../backend/runner.py), [`backend/routes/widgets.py`](../backend/routes/widgets.py), [`backend/schemas.py`](../backend/schemas.py) (bornes de `refreshSeconds`)
  * Frontend :
    * [`frontend/src/components/clock-widget.tsx`](../frontend/src/components/clock-widget.tsx) : la carte et sa trotteuse
    * [`frontend/src/components/widget-form.tsx`](../frontend/src/components/widget-form.tsx) : le formulaire commun (champs, rafraîchissement, vérifications, boutons), utilisé par la fenêtre d'ajout et par le panneau de réglages
    * [`frontend/src/components/settings-panel.tsx`](../frontend/src/components/settings-panel.tsx) : le panneau de réglages de la carte
    * [`frontend/src/components/modal.tsx`](../frontend/src/components/modal.tsx) : la fenêtre qui contient le formulaire d'ajout
    * [`frontend/src/pages/dashboard.tsx`](../frontend/src/pages/dashboard.tsx) : ouverture de la fenêtre d'ajout
    * [`frontend/src/dashboard/add-widget-modal.tsx`](../frontend/src/dashboard/add-widget-modal.tsx) : la fenêtre d'ajout
    * [`frontend/src/dashboard/use-widget-actions.ts`](../frontend/src/dashboard/use-widget-actions.ts) : création du widget à une place libre
    * [`frontend/src/use-widget-data.ts`](../frontend/src/use-widget-data.ts) : le chargement des données, commun à plusieurs cartes
    * [`frontend/src/use-auto-refresh.ts`](../frontend/src/use-auto-refresh.ts) : le minuteur de rafraîchissement
    * [`frontend/src/widget-types.ts`](../frontend/src/widget-types.ts) : entrée « Clock » de la barre latérale
    * [`frontend/src/styles.ts`](../frontend/src/styles.ts) : styles `clock…`

---

## 2. Spécifications & Contrat d'API (`about.json`)

Le service expose un seul widget dans le catalogue :

```json
{
  "name": "clock",
  "widgets": [
    {
      "name": "current_time",
      "description": "Current time in a city, with its time zone and UTC offset",
      "params": [
        { "name": "city", "type": "string" }
      ]
    }
  ]
}
```

### 2.1. Widget : `current_time`
* **Description** : Affiche l'heure en direct d'une ville, avec son fuseau horaire.
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `city` | `string` | **Oui** | — | Nom de la ville, tel que tapé (ex. `Paris`, `tokyo`, `New York`, `Montréal`) |

* **Valeurs à l'ajout depuis la barre latérale** : `config = { "city": "Paris" }`, `refreshSeconds = 3600`.
* **`refreshSeconds`** : réglable par l'utilisateur, de `10` à `86400` secondes, avec 3 décimales au plus (`12.5` = 12 s 500 ms). Ici, le rafraîchissement **ne fait pas avancer l'heure** : les secondes avancent dans le navigateur (§4.3). Il **resynchronise** la carte avec l'horloge du serveur et relit le fuseau (le passage à l'heure d'été change le décalage). Une heure suffit, et chaque lecture coûte un appel à Open-Meteo (§8).

* **Format des données retournées (`GET /api/widgets/{id}/data`)** :
```json
{
  "data": {
    "city": "Paris",
    "country": "France",
    "timezone": "Europe/Paris",
    "offset": "+02:00",
    "abbreviation": "CEST",
    "dst": true,
    "now": 1791323825225
  },
  "account": null,
  "fetchedAt": "2026-10-06T21:57:05.225000+00:00"
}
```

  | Champ | Description |
  |---|---|
  | `city`, `country` | La ville **trouvée** par Open-Meteo : « tokyo » tapé donne « Tokyo », « Japan » |
  | `timezone` | Le fuseau horaire officiel (base IANA) : `Europe/Paris`, `Asia/Tokyo`… |
  | `offset` | Le décalage avec l'heure universelle, au format `+02:00` |
  | `abbreviation` | L'abréviation du fuseau (`CEST`, `JST`, `EDT`). Certains fuseaux n'en ont pas et donnent un nombre : `+04` pour Dubaï |
  | `dst` | `true` pendant l'heure d'été |
  | `now` | L'heure du **serveur** en millisecondes depuis 1970. La carte s'en sert pour corriger l'horloge de l'ordinateur (§4.3) |
  | `account` | Toujours `null` : ce widget n'a pas de compte lié |
  | `fetchedAt` | Heure de la lecture côté serveur (ISO 8601 UTC) |

* **Réponses d'erreur** :
  | Situation | Code | Message | Affichage dans la carte |
  |---|---|---|---|
  | Ville introuvable | `502` | `Unknown city: Xyzzzqq` | Le message. Le bouton Settings reste disponible pour corriger |
  | Ville sans fuseau connu du serveur (cas très rare) | `502` | `No time zone known for …` | Le message |
  | Open-Meteo injoignable ou en erreur | `502` | `clock is unavailable` | Le message, ou l'horloge déjà affichée si c'était un rafraîchissement automatique |
  | Widget inexistant ou appartenant à un autre utilisateur | `404` | `Widget not found` | Le message |

* **Erreurs à l'enregistrement des réglages** (`PATCH /api/widgets/{id}`, code `422`) :
  | Situation | Message |
  |---|---|
  | Ville vide | `city cannot be empty` |
  | Intervalle sous 10 s ou au-dessus de 86 400 s | `Input should be greater than or equal to 10` / `… less than or equal to 86400` |
  | Plus de 3 décimales | `Value error, Value must have at most three decimal places` |

---

## 3. Architecture Backend

### 3.1. Le choix : Open-Meteo pour la ville, Python pour l'heure
| Solution | Problème | Verdict |
|---|---|---|
| Ancienne version : WorldTimeAPI, puis TimeAPI.io, puis Python en secours | WorldTimeAPI est souvent en panne ou lent, chaque lecture pouvait attendre 2 délais de 4 s. Il fallait taper la région (`America`) et la ville au format du fuseau (`New_York`) | ❌ remplacé |
| **Open-Meteo (recherche de ville) + Python (`zoneinfo`)** | Aucun : la recherche de ville donne le fuseau, et Python connaît tous les fuseaux | ✅ |

* **Une API de l'heure est inutile** : le serveur connaît déjà l'heure (son horloge est synchronisée sur internet), et Python connaît les règles de chaque fuseau (heure d'été comprise) grâce à sa base de fuseaux (`zoneinfo`, 486 fuseaux dans notre conteneur).
* **Le seul besoin externe est de trouver la ville** : la recherche de ville d'Open-Meteo, déjà utilisée par la météo, renvoie aussi son fuseau (`Lille` → `Europe/Paris`, `Montréal` → `America/Toronto`). Le paramètre `region` a donc disparu : on tape une ville, c'est tout.

---

### 3.2. Recherche de la ville (`find_place` dans `backend/catalog/places.py`)
* `GET https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en`.
* On garde le **premier** résultat : nom, pays, position et **fuseau horaire**.
* Une ville inconnue renvoie une réponse sans clé `results`, ce qui donne `WidgetError("Unknown city: …")`.
* Cette fonction est **partagée** avec le service météo : c'était `_geocode` dans `weather.py`, déplacée dans `places.py` pour ne pas la copier.

---

### 3.3. Calcul de l'heure (`fetch_current_time` dans `backend/catalog/clock.py`)
1. `find_place` donne le fuseau, par exemple `Asia/Tokyo`.
2. `datetime.now(ZoneInfo("Asia/Tokyo"))` donne l'heure actuelle dans ce fuseau.
3. On en tire :
   * le décalage, `%z` (`+0900`), remis au format `+09:00` ;
   * l'abréviation, `tzname()` (`JST`) ;
   * l'heure d'été, `dst()` ;
   * l'heure du serveur en millisecondes (`now`).
* **Fuseau inconnu** : un fuseau vide ou absent de la base du serveur donne `WidgetError("No time zone known for …")` au lieu d'une erreur `500`.
* **Erreurs réseau** : toute erreur HTTP d'Open-Meteo est transformée par le runner en `WidgetError("clock is unavailable")`, donc une `502`.

---

## 4. Architecture Frontend

### 4.1. Ajout depuis la barre latérale (`frontend/src/widget-types.ts`)
| Champ | Valeur |
|---|---|
| `label` | `Clock` |
| `description` | `Paris time` |
| `serviceName` / `widgetName` | `clock` / `current_time` |
| `defaultConfig` | `{ city: "Paris" }` |
| `defaultRefreshSeconds` | `3600` |
| `fields` | `CLOCK_FIELDS` (exporté par `clock-widget.tsx`) : le champ **City** |

* **« + Add » ouvre une fenêtre d'ajout** (« Add a Clock widget »), comme le demande le sujet : choisir le type, le configurer, régler son rafraîchissement, puis confirmer. Le widget n'est créé **qu'à la confirmation**.
  ```
   ┌──────────────────────────────────────┐
   │ Add a Clock widget                 × │
   │ City                    [Paris     ] │
   │ Refresh every (seconds) [3600      ] │
   │ Use a dot for milliseconds…          │
   │ [Add widget]  [Default]  [Cancel]    │
   └──────────────────────────────────────┘
  ```
* **Les champs** sont préremplis avec les valeurs par défaut (Paris, 3600). Chaque ouverture repart de ces valeurs : la ville d'une autre horloge, ou d'une saisie annulée, n'est jamais reprise.
* **Les boutons** :
  | Bouton | Effet |
  |---|---|
  | **Add widget** (ou Entrée) | Vérifie les champs, puis `POST /api/widgets` avec la ville et l'intervalle saisis. La fenêtre se ferme et la nouvelle carte apparaît |
  | **Default** | Remet Paris et 3600 dans les champs, et efface l'erreur affichée. Rien n'est envoyé |
  | **Cancel** (rouge) ou la croix × | Ferme la fenêtre sans rien créer |
* **Seuls Cancel et la croix ferment la fenêtre**. La touche Échap et un clic sur le fond sombre ne font rien. Avant, sélectionner le texte d'un champ à la souris et relâcher le bouton hors de la fenêtre comptait comme un clic sur le fond, et fermait la fenêtre en perdant la saisie. La fenêtre « Delete my account » suit la même règle, car c'est le même composant (`modal.tsx`).
* **Les vérifications** sont celles du panneau de réglages (§4.4) : « City cannot be empty », « Use a number with a dot, e.g. 12.5 », « Between 10 and 86400 seconds ». Une erreur du serveur s'affiche aussi dans la fenêtre, qui reste ouverte.
* **Clavier** : à l'ouverture, le curseur est dans le champ City. À la fermeture, il revient sur le bouton « + Add » qui a ouvert la fenêtre, sans faire défiler la page (la nouvelle carte reste visible).
* **Un formulaire commun** (`widget-form.tsx`) : la fenêtre d'ajout et le panneau Settings de la carte affichent le même formulaire, avec la même liste de champs (`CLOCK_FIELDS`). Seuls le bouton principal (« Add widget » ou « Save ») et le bouton « Default » (fenêtre d'ajout seulement) changent.

---

### 4.2. La carte `<ClockWidget />` (`frontend/src/components/clock-widget.tsx`)
Le chargement (états, rechargement après un réglage, minuteur) est dans le hook commun `useWidgetData` (`frontend/src/use-widget-data.ts`).

| État | Quand | Affichage |
|---|---|---|
| `loading` | Au montage, ou après un nouveau réglage enregistré | « Loading... » |
| `ready` | `/data` répond `200` | L'horloge |
| `error` | Toute erreur (ville inconnue, Open-Meteo injoignable…) | Le message d'erreur |

* **Titre** : « Tokyo, Japan » (la ville trouvée) quand c'est prêt ; sinon la ville tapée. Il n'affiche jamais le nom de la ville précédente à côté d'une erreur.
* **Bouton « Settings »** : **toujours visible**, même en erreur, pour pouvoir corriger une ville inconnue. Il devient « Close » quand le panneau est ouvert.
* **Pas de bouton « Refresh »** : les secondes avancent déjà en direct. Relire le serveur à la main ne changerait rien à l'écran.

```
 ┌──────────────────────────────────────────────┐
 │ ⠿  Paris, France                Settings  ×  │  <- en-tête commun
 ├──────────────────────────────────────────────┤
 │                  23:58:51                    │
 │          Tuesday, 6 October 2026             │
 │  [Europe/Paris] [UTC +02:00 · CEST] [Summer time]
 └──────────────────────────────────────────────┘
```

* **Pastilles** : une liste (`<ul>`), lue « liste, 3 éléments » par un lecteur d'écran. Vert foncé sur vert clair : contraste supérieur à 4,5:1.

---

### 4.3. La trotteuse (`useServerNow`)
C'est la partie la plus délicate, et la cause du « décalage dans l'affichage des secondes » relevé lors du suivi.

* **L'heure affichée** = l'heure de l'ordinateur + un **écart** (`skew`), mesuré à chaque lecture : `skew = data.now - Date.now()`. Si l'ordinateur de l'utilisateur avance ou retarde de quelques minutes, la carte affiche quand même l'heure du serveur. Sur notre machine, l'écart mesuré est d'environ 8 ms (le temps du trajet de la réponse).
* **Le navigateur fait la conversion** vers le fuseau de la ville (`toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo" })`), heure d'été comprise.
* **Un tick calé sur le début de chaque seconde**, et pas un `setInterval(1000)` :
  * un `setInterval` dérive : il part à un moment quelconque de la seconde, prend quelques millisecondes de retard à chaque tour, affiche donc chaque seconde en retard et en saute parfois une ;
  * ici, chaque tick calcule le temps restant jusqu'à la seconde suivante (`1000 - (now % 1000)`), plus **10 ms** de marge.
* **Calé sur la seconde de l'heure corrigée, pas de l'ordinateur** : un premier essai calait le tick sur la seconde de l'ordinateur. Avec un écart de -8 ms, chaque tick tombait 8 ms **avant** la nouvelle seconde corrigée, et la carte affichait la seconde précédente presque tout le temps : environ **1 s de retard**. Le tick est maintenant calé sur l'heure corrigée, avec la marge de 10 ms. Vérifié sur 12 lectures en 4 secondes : l'heure affichée est toujours identique à celle de l'ordinateur.
* **Nouvel écart, nouveau calage** : quand une lecture change l'écart, le tick repart avec le nouveau.

---

### 4.4. Le panneau de réglages (`frontend/src/components/settings-panel.tsx`)
* **Un panneau commun** à plusieurs cartes, qui affiche le formulaire commun (`widget-form.tsx`). L'horloge lui donne un seul champ : **City** (texte, 100 caractères maximum). Le formulaire ajoute **Refresh every (seconds)**, et les boutons **Save** et **Cancel**.
* **Vérifications avant l'envoi** : une ville vide affiche « City cannot be empty » ; l'intervalle est lu par `parseSeconds` (`refresh.ts`).
* **Enregistrement** : **un seul** `PATCH /api/widgets/{id}` avec `{ "config": { "city": … }, "refreshSeconds": … }`. La réponse est passée au dashboard par `onUpdate(updated)`, et la carte se recharge toute seule : sa config a changé.

---

### 4.5. Le rafraîchissement automatique (`frontend/src/use-auto-refresh.ts`)
* Dans `useWidgetData`, `useAutoRefresh(() => load("tick"), instance.refreshSeconds)` relit `/data` toutes les `refreshSeconds` secondes, **sans** écran « Loading... ». L'écart et le fuseau sont mis à jour, la trotteuse continue sans à-coup.
* **Une chaîne de `setTimeout`** : deux lectures ne se chevauchent jamais.
* **Onglet caché** : le tour est sauté. La trotteuse, elle, continue (le navigateur la ralentit en arrière-plan, et elle se recale dès le retour sur l'onglet).
* **Jamais en dessous de 10 s**, même si une valeur incorrecte arrivait.

---

## 5. Configuration

* **Rien à configurer** : pas de clé, pas de compte, rien dans `.env`.
* Le serveur doit avoir accès à internet pour joindre Open-Meteo, et son horloge doit être à l'heure (c'est le cas d'une machine synchronisée sur internet).

---

## 6. Cycle de Vie des Données (Flux complet)

```text
1. Ajout d'une horloge :
   Dashboard    -> « + Add » -> fenêtre « Add a Clock widget » (Paris, 3600) -> l'utilisateur tape « Tokyo », 600 -> Add widget
   Dashboard    -> POST /api/widgets { serviceName: "clock", widgetName: "current_time", config: { city: "Tokyo" }, refreshSeconds: 600, x, y }
   Backend      -> validate_config (city non vide) -> ligne widget_instances, HTTP 201

2. Chargement :
   ClockWidget  -> GET /api/widgets/{id}/data
   Backend      -> run_widget -> fetch_current_time : find_place (Open-Meteo), puis zoneinfo
   ClockWidget  -> écart = now (serveur) - heure de l'ordinateur -> « Paris, France », 23:58:51, la date, les pastilles

3. Chaque seconde :
   ClockWidget  -> tick calé sur la seconde suivante -> nouvelle heure affichée (aucun appel réseau)

4. Rafraîchissement automatique :
   ClockWidget  -> toutes les refreshSeconds (3600 par défaut), relit GET /data en silence -> nouvel écart, fuseau à jour

5. Réglages :
   ClockWidget  -> Settings -> « Tokyo », 600 -> PATCH /api/widgets/{id} { config: { city: "Tokyo" }, refreshSeconds: 600 }
   Dashboard    -> Remplace l'instance -> la carte se recharge : « Tokyo, Japan », 07:00:29, UTC +09:00 · JST

6. Ville inconnue :
   Backend      -> 502 « Unknown city: Xyzzzqq » -> la carte affiche le message, Settings reste là pour corriger

7. Suppression :
   Dashboard    -> DELETE /api/widgets/{id} -> la ligne widget_instances est supprimée (rien d'autre à libérer)
```

---

## 7. Sécurité & Données Personnelles
* **Seul le nom de la ville** est envoyé à Open-Meteo, par le serveur. Aucune donnée sur l'utilisateur n'est transmise.
* **Plus aucun appel depuis le navigateur** : l'ancienne version appelait TimeAPI.io directement depuis la page, ce qui donnait l'adresse IP de l'utilisateur à ce service. Tout passe maintenant par le serveur.
* **Rien n'est stocké** en dehors du réglage (`city`, `refreshSeconds`).
* **Cloisonnement** : le widget d'un autre utilisateur répond `404`.

---

## 8. Limites Connues & Pistes
* **Quota Open-Meteo partagé** avec la météo et les prévisions : 10 000 appels par jour pour tout le serveur. Une horloge coûte 1 appel par lecture : 24 par jour à 3600 s, mais 8 640 par jour à 10 s. Piste : garder en mémoire le fuseau de chaque ville, qui ne change jamais. L'horloge n'aurait alors plus besoin d'appel du tout après la première lecture.
* **Homonymes** : seul le premier résultat de la recherche est gardé (piste : proposer la liste des résultats).
* **Une ville inconnue n'est détectée qu'à l'affichage**, pas à l'enregistrement du réglage.
* **Pastilles à jour au rythme du rafraîchissement** : lors du passage à l'heure d'été, l'heure affichée change tout de suite (le navigateur applique les règles du fuseau), mais les pastilles « UTC +01:00 » et « Standard time » attendent la lecture suivante, une heure au plus avec la valeur par défaut.
* **Base de fuseaux du système** : le conteneur (`python:latest`) contient la base de fuseaux. Sur une image minimale qui ne l'aurait pas, il faudrait ajouter le paquet `tzdata` aux dépendances.

---

Retour à la [documentation principale](../README.md).
