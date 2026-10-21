# Documentation Complète — Service & Widgets Weather (Météo actuelle et prévisions)

Ce document est la documentation technique et fonctionnelle dédiée exclusivement au service **Weather** et à ses deux widgets : la météo actuelle et les prévisions.

---

## 1. Présentation du Service

Le service **Weather** propose deux widgets pour une commune choisie par l'utilisateur :
* **Weather** (`city_temperature`), la météo **actuelle** :
  * la température ;
  * l'état du ciel, avec une icône (dégagé, nuages, brouillard, bruine, pluie, neige, orage) ;
  * l'humidité ;
  * la vitesse du vent.
* **Forecast** (`city_forecast`), les **prévisions de 1 à 7 jours**. Pour chaque jour :
  * l'état du ciel, avec une icône ;
  * les températures minimale et maximale ;
  * la probabilité de pluie.

Les données viennent d'**Open-Meteo**, un service gratuit, **sans compte ni clé**. On peut afficher plusieurs cartes de chaque widget, chacune avec sa ville, ses unités et son rythme de rafraîchissement.

* **Identifiant du service** : `weather`
* **Souscription requise (`requires_subscription`)** : `false`, aucun compte tiers n'est nécessaire.
* **Fichiers sources dédiés** :
  * Backend :
    * [`backend/catalog/weather.py`](../backend/catalog/weather.py) : déclaration des deux widgets, lecture de la météo et des prévisions, traduction du code météo
    * [`backend/catalog/places.py`](../backend/catalog/places.py) : recherche de la commune, partagée avec l'horloge
  * Backend partagé avec les autres widgets : [`backend/catalog/__init__.py`](../backend/catalog/__init__.py) (`validate_config`), [`backend/catalog/types.py`](../backend/catalog/types.py) (`Param.choices`, pour du texte comme pour des entiers), [`backend/runner.py`](../backend/runner.py), [`backend/routes/widgets.py`](../backend/routes/widgets.py), [`backend/schemas.py`](../backend/schemas.py) (bornes de `refreshSeconds`)
  * Frontend :
    * [`frontend/src/components/weather-widget.tsx`](../frontend/src/components/weather-widget.tsx) : la carte de la météo actuelle
    * [`frontend/src/components/forecast-widget.tsx`](../frontend/src/components/forecast-widget.tsx) : la carte des prévisions
    * [`frontend/src/components/widget-form.tsx`](../frontend/src/components/widget-form.tsx) : le formulaire commun, utilisé par la fenêtre d'ajout et par le panneau de réglages
    * [`frontend/src/components/settings-panel.tsx`](../frontend/src/components/settings-panel.tsx) : le panneau de réglages, commun à plusieurs cartes
    * [`frontend/src/weather-icon.ts`](../frontend/src/weather-icon.ts) : correspondance entre noms et icônes
    * [`frontend/src/assets/weather/`](../frontend/src/assets/weather/) : les 8 icônes PNG
    * [`frontend/src/use-widget-data.ts`](../frontend/src/use-widget-data.ts) : le chargement des données, commun à plusieurs cartes
    * [`frontend/src/use-auto-refresh.ts`](../frontend/src/use-auto-refresh.ts) : le minuteur de rafraîchissement
    * [`frontend/src/refresh.ts`](../frontend/src/refresh.ts) : lecture et bornes de l'intervalle saisi
    * [`frontend/src/widget-types.ts`](../frontend/src/widget-types.ts) : entrées « Weather » et « Forecast » de la barre latérale
    * [`frontend/src/styles.ts`](../frontend/src/styles.ts) : styles `weather…` et `forecast…`

---

## 2. Spécifications & Contrat d'API (`about.json`)

Le service expose deux widgets dans le catalogue :

```json
{
  "name": "weather",
  "widgets": [
    {
      "name": "city_temperature",
      "description": "Current weather for a city: temperature, sky, humidity, wind",
      "params": [
        { "name": "city", "type": "string" },
        { "name": "units", "type": "string" }
      ]
    },
    {
      "name": "city_forecast",
      "description": "Forecast for the next days in a city: sky, min and max temperature, chance of rain",
      "params": [
        { "name": "city", "type": "string" },
        { "name": "units", "type": "string" },
        { "name": "days", "type": "integer" }
      ]
    }
  ]
}
```

### 2.1. Widget : `city_temperature`
* **Description** : Affiche la météo actuelle d'une commune.
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `city` | `string` | **Oui** | — | Nom de la commune, tel que tapé (ex. `Lille`, `lille`, `Tokyo`) |
  | `units` | `string` | Non | `metric` | `metric` (°C, km/h) ou `imperial` (°F, mph). Toute autre valeur est refusée à l'enregistrement avec une `422` : `units must be one of: metric, imperial` |

* **Valeurs à l'ajout depuis la barre latérale** : `config = { "city": "Lille", "units": "metric" }`, `refreshSeconds = 900`.
* **`refreshSeconds`** : réglable par l'utilisateur, de `10` à `86400` secondes, avec 3 décimales au plus (`12.5` = 12 s 500 ms). Pourquoi 900 par défaut : Open-Meteo ne met à jour la météo actuelle que **toutes les 15 minutes** (sa réponse indique `"interval": 900`). Rafraîchir plus souvent ne montrerait rien de nouveau.

* **Format des données retournées (`GET /api/widgets/{id}/data`)** :
```json
{
  "data": {
    "city": "Lille",
    "country": "France",
    "temperature": 12.1,
    "humidity": 91,
    "wind": 5.0,
    "icon": "clouds",
    "label": "Clouds",
    "units": { "temperature": "°C", "wind": "km/h" }
  },
  "account": null,
  "fetchedAt": "2026-10-06T09:37:12.481516+00:00"
}
```

  | Champ | Description |
  |---|---|
  | `city`, `country` | Le nom et le pays de la commune **trouvée** par Open-Meteo : « lille » tapé donne « Lille », « France » |
  | `temperature` | Température à 2 m, dans l'unité choisie |
  | `humidity` | Humidité relative, en % |
  | `wind` | Vitesse du vent à 10 m, dans l'unité choisie |
  | `icon` | Nom de l'icône à afficher : `clear`, `clouds`, `mist`, `drizzle`, `rain` ou `snow` (§3.3) |
  | `label` | Libellé lisible de l'état du ciel (`Clear`, `Clouds`, `Fog`, `Rain showers`, `Thunderstorm`…) |
  | `units` | Les libellés d'unités, écrits par nous (§3.2) |
  | `account` | Toujours `null` : ce widget n'a pas de compte lié |
  | `fetchedAt` | Heure de la lecture côté serveur (ISO 8601 UTC). La carte l'affiche dans « Updated 11:37 » |

* **Réponses d'erreur** :
  | Situation | Code | Message | Affichage dans la carte |
  |---|---|---|---|
  | Commune introuvable | `502` | `Unknown city: Xyzzzqq` | Le message. Le bouton Settings reste disponible pour corriger |
  | Open-Meteo injoignable ou en erreur | `502` | `weather is unavailable` | Le message, ou la dernière météo gardée si c'était un rafraîchissement automatique |
  | Widget inexistant ou appartenant à un autre utilisateur | `404` | `Widget not found` | Le message |

* **Erreurs à l'enregistrement des réglages** (`PATCH /api/widgets/{id}`, code `422`) :
  | Situation | Message |
  |---|---|
  | Ville vide | `city cannot be empty` |
  | Unités inconnues | `units must be one of: metric, imperial` |
  | Intervalle sous 10 s ou au-dessus de 86 400 s | `Input should be greater than or equal to 10` / `… less than or equal to 86400` |
  | Plus de 3 décimales | `Value error, Value must have at most three decimal places` |

### 2.2. Widget : `city_forecast`
* **Description** : Affiche les prévisions d'une commune pour les prochains jours, aujourd'hui compris.
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `city` | `string` | **Oui** | — | Nom de la commune, tel que tapé |
  | `units` | `string` | Non | `metric` | `metric` (°C) ou `imperial` (°F), comme pour `city_temperature` |
  | `days` | `integer` | Non | `5` | Nombre de jours, de **1 à 7**. Toute autre valeur est refusée à l'enregistrement avec une `422` : `days must be one of: 1, 2, 3, 4, 5, 6, 7` |

* **Valeurs à l'ajout depuis la barre latérale** : `config = { "city": "Lille", "units": "metric", "days": 5 }`, `refreshSeconds = 3600`. Ce sont **toujours** ces valeurs : un nouvel ajout ne reprend jamais la ville d'une autre carte météo.
* **`refreshSeconds`** : réglable de `10` à `86400` secondes, comme pour l'autre widget. Pourquoi 3600 par défaut : des prévisions par jour ne changent que quelques fois dans la journée. Une heure suffit, et ça préserve le quota Open-Meteo partagé avec la météo actuelle (§8).
* **Pourquoi 7 jours au plus** : Open-Meteo va jusqu'à 16 jours, mais au-delà d'une semaine une prévision ne vaut guère mieux qu'une supposition. 7 lignes tiennent aussi dans la carte sans la rendre immense.

* **Format des données retournées (`GET /api/widgets/{id}/data`)** :
```json
{
  "data": {
    "city": "Lille",
    "country": "France",
    "days": [
      { "date": "2026-10-06", "min": 11.4, "max": 22.6, "rain": 0, "icon": "mist", "label": "Fog" },
      { "date": "2026-10-07", "min": 12.2, "max": 20.7, "rain": 100, "icon": "rain", "label": "Rain" }
    ],
    "units": { "temperature": "°C" }
  },
  "account": null,
  "fetchedAt": "2026-10-06T19:42:12.481516+00:00"
}
```

  | Champ | Description |
  |---|---|
  | `city`, `country` | La commune **trouvée** par Open-Meteo, comme pour `city_temperature` |
  | `days` | Un élément par jour, dans l'ordre, en commençant par **aujourd'hui dans la commune** (§3.4) |
  | `date` | Le jour, au format `AAAA-MM-JJ`, dans le fuseau horaire de la commune |
  | `min`, `max` | Températures minimale et maximale à 2 m, dans l'unité choisie |
  | `rain` | Probabilité maximale de précipitations du jour, en % (la neige compte aussi). Peut être `null` pour un jour lointain |
  | `icon`, `label` | L'état du ciel, avec la même table que la météo actuelle (§3.3) |
  | `units` | Le libellé de l'unité de température, écrit par nous |

* **Réponses d'erreur** : les mêmes que pour `city_temperature` (`Unknown city: …`, `weather is unavailable`, `Widget not found`).
* **Erreurs à l'enregistrement des réglages** (code `422`) : les mêmes, plus :
  | Situation | Message |
  |---|---|
  | `days` hors de 1 à 7 | `days must be one of: 1, 2, 3, 4, 5, 6, 7` |
  | `days` qui n'est pas un entier | `days must be an integer` |

---

## 3. Architecture Backend

### 3.1. Pourquoi Open-Meteo
| Service | Compte ou clé ? | Verdict |
|---|---|---|
| OpenWeatherMap (utilisé dans un ancien projet) | Compte + clé API | ❌ une clé à gérer et à garder secrète |
| **Open-Meteo** | **Non** | ✅ gratuit, sans clé, recherche de commune incluse |

Conditions d'Open-Meteo pour l'usage gratuit (https://open-meteo.com/en/terms) :
* **usage non commercial uniquement**, ce qui est notre cas ;
* au plus **600 appels par minute, 5 000 par heure et 10 000 par jour** ;
* **licence CC BY 4.0** : la source doit être citée. La carte affiche donc « Weather data by Open-Meteo.com », avec un lien.

---

### 3.2. Lecture de la météo (`fetch_city_temperature` dans `backend/catalog/weather.py`)
Chaque lecture fait **2 appels** à Open-Meteo (les prévisions aussi, §3.4) :

1. **Trouver la commune** (`find_place`, dans `backend/catalog/places.py`) : `GET https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en`
   * on garde le **premier** résultat : latitude, longitude, nom, pays ;
   * une commune inconnue renvoie une réponse **sans** clé `results`, ce qui donne `WidgetError("Unknown city: …")`.
2. **Lire la météo actuelle** : `GET https://api.open-meteo.com/v1/forecast` avec `current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`. Malgré son nom (`/forecast`), cette adresse sert aussi la météo actuelle : c'est pour ça que la constante s'appelle `WEATHER_URL`.
   * Cet appel passe par `_weather(client, place, units, params)`, **partagée** avec les prévisions : elle ajoute la position de la commune et les paramètres d'unités, puis vérifie la réponse.

* **Unités** (`UNITS`) :
  | `units` | Paramètres envoyés à Open-Meteo | Libellés affichés |
  |---|---|---|
  | `metric` | aucun (°C et km/h par défaut) | `°C`, `km/h` |
  | `imperial` | `temperature_unit=fahrenheit`, `wind_speed_unit=mph` | `°F`, `mph` |

  Les libellés sont écrits **par nous**, car Open-Meteo écrit « mp/h ». Un widget créé avant l'ajout du paramètre `units` n'en a pas dans sa config : il reste en `metric`.
* **Erreurs réseau** : toute erreur HTTP d'Open-Meteo est transformée par le runner en `WidgetError("weather is unavailable")`, donc une `502` et jamais une `500`.

---

### 3.3. Du code météo à l'icône (`CONDITIONS` et `_condition`)
Open-Meteo donne l'état du ciel sous forme d'un **code météo WMO** (un standard international). Le backend le traduit en un nom d'icône et un libellé :

| Codes WMO | Signification | `icon` | `label` |
|---|---|---|---|
| 0, 1 | Ciel dégagé, peu nuageux | `clear` | Clear |
| 2, 3 | Partiellement nuageux, couvert | `clouds` | Clouds |
| 45, 48 | Brouillard | `mist` | Fog |
| 51 à 57 | Bruine | `drizzle` | Drizzle |
| 61 à 67 | Pluie | `rain` | Rain |
| 71 à 77 | Neige | `snow` | Snow |
| 80 à 82 | Averses de pluie | `rain` | Rain showers |
| 85, 86 | Averses de neige | `snow` | Snow showers |
| 95 à 99 | Orage | `rain` | Thunderstorm (pas d'icône d'orage : on reprend la pluie, mais le libellé le dit) |

Un code absent ou inconnu donne `clouds` et « Unknown » au lieu de planter.

---

### 3.4. Lecture des prévisions (`fetch_city_forecast`)
1. **Trouver la commune** : le même `find_place` que la météo actuelle.
2. **Lire les prévisions** : `_weather` avec :
   | Paramètre envoyé | Rôle |
   |---|---|
   | `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` | Une valeur par jour pour chaque mesure |
   | `timezone=auto` | Les jours sont ceux **de la commune**, pas des jours UTC. À Tokyo, la liste commence déjà au lendemain quand il est 21 h à Lille |
   | `forecast_days={days}` | Le nombre de jours demandé |
3. **Remettre chaque jour en un seul objet** : Open-Meteo renvoie **une liste par mesure** (toutes les dates, puis tous les minimums…), dans le même ordre. `zip` les relit ensemble, jour par jour, et `_condition` traduit chaque code météo.

* **`DAYS`** (`("1", …, "7")`) sert à la fois aux `choices` du paramètre et à la borne : `days` est aussi ramené entre 1 et 7 à la lecture, pour une ligne enregistrée avant cette règle.
* **Vérification d'un entier parmi des choix** : `validate_config` applique désormais les `choices` aux paramètres `integer` aussi. Les choix sont écrits en texte (`"1"`…`"7"`), et la valeur reçue est comparée sous forme de texte une fois convertie en entier. `5` et `"5"` sont donc acceptés, `8` et `0` sont refusés.

---

## 4. Architecture Frontend

### 4.1. Ajout depuis la barre latérale (`frontend/src/widget-types.ts`)
| Champ | Valeur |
|---|---|
| `label` | `Weather` |
| `description` | `Current weather` |
| `serviceName` / `widgetName` | `weather` / `city_temperature` |
| `defaultConfig` | `{ city: "Lille", units: "metric" }` |
| `defaultRefreshSeconds` | `900` |
| `fields` | `WEATHER_FIELDS` (exporté par `weather-widget.tsx`) : **City**, **Units** |

Et pour les prévisions :

| Champ | Valeur |
|---|---|
| `label` | `Forecast` |
| `description` | `Next days` |
| `serviceName` / `widgetName` | `weather` / `city_forecast` |
| `defaultConfig` | `{ city: "Lille", units: "metric", days: 5 }` |
| `defaultRefreshSeconds` | `3600` |
| `fields` | `FORECAST_FIELDS` (exporté par `forecast-widget.tsx`) : **City**, **Units**, **Days** |

* **« + Add » ouvre une fenêtre d'ajout** (« Add a Weather widget » ou « Add a Forecast widget »). Le widget n'est créé **qu'à la confirmation**, comme le demande le sujet : choisir le type, le configurer, régler son rafraîchissement, puis confirmer.
  | Fenêtre | Champs, préremplis avec les valeurs par défaut |
  |---|---|
  | Weather | City (Lille), Units (Metric), Refresh every (900) |
  | Forecast | City (Lille), Units (Metric), Days (5 days), Refresh every (3600) |
* **Les boutons** :
  | Bouton | Effet |
  |---|---|
  | **Add widget** (ou Entrée) | Vérifie les champs, puis `POST /api/widgets` avec les valeurs saisies. La fenêtre se ferme et la nouvelle carte apparaît |
  | **Default** | Remet les valeurs par défaut dans les champs, et efface l'erreur affichée. Rien n'est envoyé |
  | **Cancel** (rouge) ou la croix × | Ferme la fenêtre sans rien créer. Échap et un clic sur le fond ne la ferment pas, pour ne pas perdre la saisie par erreur |
* **Les mêmes champs que Settings** : la fenêtre d'ajout et le panneau Settings de la carte affichent le même formulaire (`frontend/src/components/widget-form.tsx`), avec la même liste de champs. Les vérifications sont donc les mêmes (§4.5).
* **Chaque ouverture repart des valeurs par défaut** : la ville d'une autre carte météo n'est jamais reprise.
* La suppression (×) vient du cadre commun `WidgetFrame`.

---

### 4.2. La carte `<WeatherWidget />` (`frontend/src/components/weather-widget.tsx`)
La carte ne fait qu'**afficher**. Le chargement (états, rechargement, minuteur) est dans le hook commun `useWidgetData` (`frontend/src/use-widget-data.ts`), qui renvoie notamment `{ status, message, data, updatedAt }`.

| État | Quand | Affichage |
|---|---|---|
| `loading` | Au montage, ou après un nouveau réglage enregistré | « Loading... » |
| `ready` | `/data` répond `200` | La météo |
| `error` | Toute erreur (commune inconnue, Open-Meteo injoignable…) | Le message d'erreur |

* **Bouton « Settings »** : **toujours visible**, même en erreur. Avec « Unknown city: Xyzzzqq », il faut pouvoir corriger la ville. Il devient « Close » quand le panneau est ouvert.
* **Bouton « Refresh »** : relit la météo tout de suite, sans attendre le minuteur. Pendant la lecture, il devient « Refreshing... » et ne peut plus être cliqué. La dernière météo reste affichée pendant ce temps (pas d'écran « Loading... »). Si la lecture échoue, l'erreur est affichée : contrairement au minuteur, c'est l'utilisateur qui a demandé.
* **Titre** : « Lille, France » (la commune trouvée) quand c'est prêt ; sinon la ville tapée. Il n'affiche jamais le nom de la ville précédente à côté d'une erreur.
* **Rechargement automatique après un réglage** : l'effet de chargement dépend de toute la config (`JSON.stringify(instance.config)`). Dès que le serveur a enregistré une nouvelle ville ou de nouvelles unités, la carte se recharge toute seule.
* **Réponse en retard** : chaque lecture reçoit un numéro (`lastRequest`). Si on enregistre Tokyo pendant qu'une lecture de Paris est en cours, la réponse de Paris arrivée après coup est **ignorée** et n'écrase pas Tokyo.

---

### 4.3. L'affichage
```
 ┌──────────────────────────────────────────────┐
 │ ⠿  Lille, France     Settings  Refresh  ×    │  <- en-tête commun
 ├──────────────────────────────────────────────┤
 │           [icône]   12 °C                    │
 │                 Clouds                       │  <- fond dégradé bleu,
 │   [≈] Humidity 91 %      [~] Wind 5 km/h     │     texte blanc
 │  Updated 11:37 · Weather data by Open-Meteo  │
 └──────────────────────────────────────────────┘
```

* **Icône du temps** en 64 px. Son `alt` est le libellé (« Clouds »), puisque l'icône porte une information.
* **Température et vent arrondis** (`Math.round`). L'humidité est affichée telle quelle.
* **Petites icônes d'humidité et de vent** en 20 px, avec `alt=""` : le texte à côté dit déjà ce qu'elles représentent.
* **Pied de carte** : l'heure de la dernière lecture (« Updated 11:37 », l'heure locale de l'utilisateur), qui rend le rafraîchissement automatique visible, puis la mention de la source exigée par la licence. Le lien s'ouvre dans un nouvel onglet (`target="_blank"`, `rel="noreferrer"`).
* **Couleurs** : un dégradé bleu ciel (`#14507a` vers `#2a78b0`) avec du texte blanc, dont le contraste dépasse **4,5:1** partout (le minimum recommandé). Le dégradé jaune-rose de l'ancien projet ne donnait que **1,3:1** pour le texte blanc côté jaune. En plus, les icônes sont **claires ou blanches** et se verraient mal sur une carte blanche.

---

### 4.4. Les icônes (`frontend/src/assets/weather/` et `frontend/src/weather-icon.ts`)
| Fichier | Taille | Utilisé pour |
|---|---|---|
| `clear.png`, `clouds.png`, `drizzle.png`, `mist.png`, `rain.png`, `snow.png` | 224 × 224 | L'état du ciel (64 px à l'écran) |
| `humidity.png` | 79 × 66 | L'humidité (20 px) |
| `wind.png` | 79 × 78 | Le vent (20 px) |

* Elles viennent d'un ancien atelier météo. Leur fond est **transparent**, et `humidity` et `wind` sont dessinées **entièrement en blanc** : il leur faut un fond foncé.
* `WEATHER_ICONS` associe un nom (`clear`, `clouds`…) à son image. `weatherIcon(name)` renvoie l'icône des nuages pour un nom inconnu, plutôt qu'une image cassée.
* **Les images sont importées** (`import clear from "./assets/weather/clear.png"`) et non pas lues dans un dossier public : Vite casse le build si un fichier manque. ⚠ `tsc` **ne détecte pas** un chemin d'image faux, car `vite-env.d.ts` déclare que tout fichier `*.png` existe. C'est Vite qui le signale.

---

### 4.5. Le panneau de réglages (`frontend/src/components/settings-panel.tsx`)
* **Un panneau commun** : il ne connaît pas la météo. La carte lui donne la liste de ses champs (`SETTINGS_FIELDS` dans `weather-widget.tsx`) : un champ texte, ou une liste déroulante quand le champ a des `options`. Le panneau ajoute lui-même le champ du rafraîchissement.
* **Les champs** :
  * **City** (texte, 100 caractères maximum) ;
  * **Units** (Metric : °C, km/h / Imperial : °F, mph) ;
  * **Refresh every (seconds)**, avec l'aide « Use a dot for milliseconds: 12.5 = 12 s 500 ms ».
* **Ids des champs** : ils contiennent l'id du widget (`city-12`…). Avec plusieurs cartes météo ouvertes, chaque libellé reste bien rattaché à son champ.
* **Vérifications avant l'envoi**, pour économiser un aller-retour (le serveur revérifie tout) :
  * une ville vide affiche « City cannot be empty » ;
  * l'intervalle est lu par `parseSeconds` (`refresh.ts`) : une virgule affiche « Use a number with a dot, e.g. 12.5 », et une valeur hors de 10 à 86 400 affiche « Between 10 and 86400 seconds ».
* **Enregistrement** :
  1. **Un seul** `PATCH /api/widgets/{id}` avec `{ "config": { "city": …, "units": … }, "refreshSeconds": … }`. La config est envoyée **en entier** : le serveur la remplace, et un paramètre absent reviendrait à sa valeur par défaut.
  2. La réponse (le widget complet) est passée au dashboard par `onUpdate(updated)`, puis le panneau se ferme.
  3. La carte se recharge toute seule (§4.2), et le minuteur repart avec le nouvel intervalle.
* **Envoi** : c'est un `<form>`, donc la touche Entrée enregistre aussi.

---

### 4.6. Le rafraîchissement automatique (`frontend/src/use-auto-refresh.ts`)
* Dans `useWidgetData`, `useAutoRefresh(() => load("tick"), instance.refreshSeconds)` relit la météo toutes les `refreshSeconds` secondes, **sans** écran « Loading... ». Si une lecture automatique échoue, la dernière météo reste affichée, et la suivante réessaie.
* **Une chaîne de `setTimeout`**, pas un `setInterval` : la lecture suivante n'est planifiée qu'une fois la réponse reçue. Deux lectures ne se chevauchent donc jamais.
* **Onglet caché** : le tour est sauté, sans appel à Open-Meteo.
* **Jamais en dessous de 10 s**, même si une valeur incorrecte arrivait.

---

### 4.7. La carte des prévisions `<ForecastWidget />` (`frontend/src/components/forecast-widget.tsx`)
Elle suit le même modèle que la carte de la météo actuelle : `useWidgetData` pour le chargement, les états `loading` / `ready` / `error`, les boutons « Settings » (toujours visible) et « Refresh », et le même pied de carte (« Updated 21:42 · Weather data by Open-Meteo.com »).

```
 ┌──────────────────────────────────────────────┐
 │ ⠿  Lille, France     Settings  Refresh  ×    │  <- en-tête commun
 ├──────────────────────────────────────────────┤
 │ Forecast · 5 days                            │
 │ Tue 06/10   [icône]   11 – 23 °C    Rain 0 % │
 │ Wed 07/10   [icône]   12 – 21 °C  Rain 100 % │  <- fond dégradé bleu,
 │ …                                            │     texte blanc
 │  Updated 21:42 · Weather data by Open-Meteo  │
 └──────────────────────────────────────────────┘
```

* **Titre** : la commune trouvée (« Lille, France »), comme la météo actuelle. Le nombre de jours est dans la carte (« Forecast · 5 days ») et pas dans le titre : un titre court reste sur la même ligne que ses boutons, alors qu'un titre plus long ferait passer les boutons sur une 2e ligne. Cette ligne distingue aussi la carte d'une carte de météo actuelle sur la même ville.
* **Une vraie liste** (`<ul>` / `<li>`), une ligne par jour : la date, l'icône, « min – max » et « Rain 40 % ».
* **Date** : « Tue 06/10 ». La date reçue (`2026-10-06`) est le jour **de la commune** : elle est lue et affichée en UTC (`timeZone: "UTC"`). Sans ça, un navigateur à l'ouest de Greenwich afficherait la veille.
* **Icône du temps** : 36 px, avec le libellé en `alt` et en `title` (« Rain »), puisqu'elle porte l'information.
* **Probabilité de pluie** : écrite en toutes lettres (« Rain 40 % »). La petite icône d'humidité n'a pas été reprise : ses traits horizontaux ressemblent à du brouillard. Rien n'est affiché si la valeur manque.
* **Températures arrondies** (`Math.round`), avec l'unité une seule fois à la fin (« 11 – 23 °C »).
* **Panneau de réglages** : le panneau commun, avec les champs de la météo actuelle (`WEATHER_FIELDS`, exporté par `weather-widget.tsx`) plus **Days**, une liste déroulante de « 1 day » à « 7 days ». Une liste plutôt qu'un champ texte : le serveur n'accepte que ces 7 valeurs, il n'y a rien à mal taper. Le panneau envoie `"7"` en texte, et le serveur le convertit en entier (`7`).
* **Styles** : `forecastCaptionStyle`, `forecastListStyle`, `forecastDayStyle` (une grille : date | icône | températures | pluie), `forecastIconStyle`, `forecastTempStyle`, `forecastRainStyle`. Le fond reprend `weatherBodyStyle`, pour que les deux cartes météo se ressemblent.

---

## 5. Configuration

* **Rien à configurer** : pas de clé, pas de compte, rien dans `.env`.
* Le serveur doit avoir accès à internet pour joindre Open-Meteo.

---

## 6. Cycle de Vie des Données (Flux complet)

```text
1. Ajout d'une carte météo :
   Dashboard     -> POST /api/widgets { serviceName: "weather", widgetName: "city_temperature", config: { city: "Lille", units: "metric" }, refreshSeconds: 900, x, y }
   Backend       -> validate_config (city non vide, units parmi metric / imperial) -> ligne widget_instances, HTTP 201

2. Chargement :
   WeatherWidget -> GET /api/widgets/{id}/data
   Backend       -> run_widget -> fetch_city_temperature : recherche de la commune, puis météo actuelle
   WeatherWidget -> Affiche « Lille, France », l'icône, la température, l'humidité, le vent, « Updated 11:37 »

3. Rafraîchissement automatique :
   WeatherWidget -> toutes les refreshSeconds (900 par défaut), relit GET /data en silence (sauté si l'onglet est caché)

4. Réglages :
   WeatherWidget -> Settings -> « Tokyo », Imperial, 600 -> PATCH /api/widgets/{id} { config: { city: "Tokyo", units: "imperial" }, refreshSeconds: 600 }
   Dashboard     -> Remplace l'instance -> la carte se recharge, le minuteur repart à 600 s

5. Commune inconnue :
   Backend       -> 502 « Unknown city: Xyzzzqq » -> la carte affiche le message, Settings reste là pour corriger

5 bis. Prévisions :
   Dashboard      -> POST /api/widgets { serviceName: "weather", widgetName: "city_forecast", config: { city: "Lille", units: "metric", days: 5 }, refreshSeconds: 3600, x, y }
   Backend        -> validate_config (days parmi 1 à 7) -> HTTP 201
   ForecastWidget -> GET /data -> fetch_city_forecast : recherche de la commune, puis prévisions par jour
                  -> « Forecast · 5 days » et une ligne par jour
   ForecastWidget -> Settings -> « Tokyo », Imperial, « 7 days », 600 -> PATCH { config: { city: "Tokyo", units: "imperial", days: "7" }, refreshSeconds: 600 }
   Backend        -> enregistre days = 7 (entier) -> la carte se recharge : 7 lignes en °F

6. Suppression :
   Dashboard     -> DELETE /api/widgets/{id} -> la ligne widget_instances est supprimée (rien d'autre à libérer)
```

---

## 7. Sécurité & Données Personnelles
* **Seul le nom de la commune** est envoyé à Open-Meteo. Aucune donnée sur l'utilisateur n'est transmise (ni nom, ni email, ni identifiant), et la requête part du serveur, pas du navigateur.
* **Rien n'est stocké** en dehors du réglage (`city`, `units`, `days`, `refreshSeconds`). La météo et les prévisions sont relues à chaque fois et ne sont jamais enregistrées.
* **Cloisonnement** : le widget d'un autre utilisateur répond `404`.
* **Licence** : la mention « Weather data by Open-Meteo.com » respecte la licence CC BY 4.0 d'Open-Meteo.

---

## 8. Limites Connues & Pistes
* **Le quota gratuit est partagé par tout le serveur**, par les deux widgets météo et par l'horloge : 10 000 appels par jour, et chaque lecture coûte 2 appels (la commune, puis la météo ou les prévisions).
  | Intervalle | Appels par jour pour un widget | Widgets supportés en tout |
  |---|---|---|
  | 10 s (minimum) | 17 280 | **aucun** : un seul widget dépasse la limite |
  | 60 s | 2 880 | 3 |
  | 900 s (défaut de la météo actuelle) | 192 | 52 |
  | 3 600 s (défaut des prévisions) | 48 | 208 |

  **Pistes** :
  * garder en mémoire les coordonnées de chaque commune, ce qui divise les appels par 2 ;
  * garder la météo d'une ville pendant 15 minutes côté serveur : Open-Meteo ne la met pas à jour plus souvent.
* **Homonymes** : seul le premier résultat de la recherche est gardé. Une ville qui existe dans plusieurs pays peut tomber sur la mauvaise (piste : proposer la liste des résultats).
* **Une commune inconnue n'est détectée qu'à l'affichage**, pas à l'enregistrement du réglage.
* **Pas d'icône d'orage** : l'icône de pluie est utilisée, avec le libellé « Thunderstorm ».
* **Prévisions limitées à 7 jours**, alors qu'Open-Meteo en donne 16 : c'est un choix (§2.2).
* **« Rain » compte aussi la neige** : c'est la probabilité de précipitations en général. Le libellé reste court pour tenir dans la ligne.
* **Deux cartes sur la même ville cherchent la commune chacune de leur côté** : la piste du cache des coordonnées (plus haut) en profiterait aussi.

---

Retour à la [documentation principale](../README.md).
