# Documentation Complète — Service & Widget CheapShark (Jeux gratuits)

Ce document est la documentation technique et fonctionnelle dédiée exclusivement au service **CheapShark** et à son widget « Free games ».

---

## 1. Présentation du Service

Le service **CheapShark** affiche les **jeux PC gratuits du moment**, c'est-à-dire les offres dont le prix est tombé à **0 $** (Steam, Epic Games Store, GOG…). Pour chaque jeu :
* la vignette du jeu ;
* le titre, cliquable, qui ouvre la page de l'offre dans un nouvel onglet ;
* la boutique (« Steam », « Epic Games Store »…) ;
* le prix habituel, barré, suivi de « Free » (ex. ~~$29.99~~ → Free).

Les données viennent de l'API publique **[CheapShark](https://apidocs.cheapshark.com/)**. Aucun compte ni clé n'est nécessaire. On peut afficher plusieurs cartes « Free games », chacune avec son nombre de jeux et son rythme de rafraîchissement.

* **Identifiant du service** : `cheapshark`
* **Souscription requise (`requires_subscription`)** : `false`, aucun compte tiers n'est nécessaire.
* **Fichiers sources dédiés** :
  * Backend : [`backend/catalog/cheapshark.py`](../backend/catalog/cheapshark.py) : déclaration du widget, appels à l'API, mise en forme des jeux
  * Backend partagé avec les autres widgets : [`backend/catalog/__init__.py`](../backend/catalog/__init__.py) (enregistrement du service, `validate_config`), [`backend/runner.py`](../backend/runner.py), [`backend/routes/widgets.py`](../backend/routes/widgets.py), [`backend/schemas.py`](../backend/schemas.py) (bornes de `refreshSeconds`)
  * Dépendance : `httpx`, déjà dans [`backend/requirements.txt`](../backend/requirements.txt)
  * Frontend :
    * [`frontend/src/components/free-games-widget.tsx`](../frontend/src/components/free-games-widget.tsx) : la carte
    * [`frontend/src/components/settings-panel.tsx`](../frontend/src/components/settings-panel.tsx) : le panneau de réglages, commun à plusieurs cartes
    * [`frontend/src/use-widget-data.ts`](../frontend/src/use-widget-data.ts) : le chargement des données, commun à plusieurs cartes
    * [`frontend/src/use-auto-refresh.ts`](../frontend/src/use-auto-refresh.ts) : le minuteur de rafraîchissement
    * [`frontend/src/refresh.ts`](../frontend/src/refresh.ts) : lecture et bornes de l'intervalle saisi
    * [`frontend/src/widget-types.ts`](../frontend/src/widget-types.ts) : entrée « Free games » de la barre latérale
    * [`frontend/src/styles.ts`](../frontend/src/styles.ts) : styles `freeGame…`

---

## 2. Spécifications & Contrat d'API (`about.json`)

Le service expose un seul widget dans le catalogue :

```json
{
  "name": "cheapshark",
  "widgets": [
    {
      "name": "free_games",
      "description": "Games that are free right now",
      "params": [
        { "name": "number", "type": "integer" }
      ]
    }
  ]
}
```

### 2.1. Widget : `free_games`
* **Description** : Affiche les jeux actuellement gratuits, les plus récents en premier.
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `number` | `integer` | Non | `5` | Nombre de jeux affichés. Ramené entre **1 et 20** à la lecture : `0` donne 1 jeu, `50` en donne 20 |

* **Valeurs à l'ajout depuis la barre latérale** : `config = { "number": 5 }`, `refreshSeconds = 1800`.
* **`refreshSeconds`** : réglable par l'utilisateur, de `10` à `86400` secondes, avec 3 décimales au plus (`12.5` = 12 s 500 ms). Pourquoi 1800 (30 minutes) par défaut : une offre gratuite dure en général plusieurs jours, et chaque rafraîchissement fait 2 appels à CheapShark. Un rythme plus rapide n'apporterait rien.

* **Format des données retournées (`GET /api/widgets/{id}/data`)** :
```json
{
  "data": {
    "games": [
      {
        "title": "System Shock 2: 25th Anniversary Remaster",
        "thumb": "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/866570/capsule_231x87.jpg",
        "store": "Steam",
        "normalPrice": "29.99",
        "link": "https://www.cheapshark.com/redirect?dealID=hRTjXz0QVII9SmGiVx0IyQZ%2BE%2BJg%2Ff90nJerO7lunGI%3D"
      }
    ]
  },
  "account": null,
  "fetchedAt": "2026-10-07T13:30:00.000000+00:00"
}
```
  * `account` vaut toujours `null` : ce service n'a pas de compte connecté.
  * `games` peut être **vide** (aucune offre gratuite à cet instant) : la carte affiche alors « No free game right now. ».

* **Erreurs possibles** (HTTP `502`, message affiché dans la carte) :
  | Message | Cause |
  |---|---|
  | `CheapShark is unreachable` | Le serveur n'arrive pas à joindre l'API (réseau coupé, délai de 10 s dépassé) |
  | `CheapShark answered HTTP 4xx/5xx` | L'API a refusé ou échoué (voir §8 pour le `400`) |
  | `CheapShark sent an invalid answer` | La réponse n'est pas du JSON |

---

## 3. Fonctionnement Backend (`backend/catalog/cheapshark.py`)

### 3.1. Les deux appels à l'API
Pour une lecture, le serveur interroge **deux** points d'entrée de `https://www.cheapshark.com/api/1.0`, **en parallèle** (`asyncio.gather`) :

| Appel | Paramètres | Rôle |
|---|---|---|
| `GET /deals` | `upperPrice=0`, `pageSize=number`, `sortBy=recent` | Les offres à 0 $, les plus récentes d'abord |
| `GET /stores` | — | La liste des boutiques : sert à transformer `storeID` (« 1 ») en nom (« Steam ») |

* **`upperPrice=0`** est ce qui fait de la liste un « jeux gratuits » : seules les offres dont le prix est de 0 $ sont renvoyées.
* **Un seul client `httpx`** sert aux deux appels, avec un délai maximal de **10 s**.

### 3.2. Mise en forme (`fetch_free_games`)
* `number` est ramené entre **1 et 20** : `max(1, min(int(number), 20))`.
* Chaque offre est réduite à 5 champs : `title`, `thumb`, `store`, `normalPrice`, `link`.
* **Boutique inconnue** : si `storeID` n'est pas dans la liste, la carte affiche « Unknown store ».
* **Offre sans `dealID`** : elle est ignorée, car sans identifiant on ne peut pas construire de lien.
* **Lien** : `https://www.cheapshark.com/redirect?dealID=…`. Ce lien passe par CheapShark, qui redirige vers la page de la boutique. Le serveur n'a donc aucune adresse de boutique à construire. Le `dealID` reçu est **déjà encodé** (`%2B`, `%3D`…) et est repris tel quel.

### 3.3. Gestion des erreurs (`_get`)
Toute erreur est convertie en `WidgetError`, que la route transforme en `502` avec un message lisible :
* erreur réseau ou délai dépassé (`httpx.HTTPError`) → « CheapShark is unreachable » ;
* statut HTTP ≥ 400 → « CheapShark answered HTTP *code* » ;
* corps qui n'est pas du JSON → « CheapShark sent an invalid answer ».

### 3.4. L'en-tête `User-Agent`
CheapShark **refuse** (`HTTP 400`) toute requête sans `User-Agent` descriptif :
> *Missing or generic User-Agent header detected. Please identify your client with a descriptive User-Agent.*

Le client envoie donc `EpitechDashboard/1.0 (school project)` (constante `USER_AGENT`). Il ne contient **aucune donnée personnelle**.

---

## 4. Fonctionnement Frontend (`free-games-widget.tsx`)

### 4.1. La carte
* **Titre** : « Free games ».
* **Boutons** : **Settings** (ouvre ou ferme le panneau, toujours disponible, même en cas d'erreur) et **Refresh** (relit tout de suite, désactivé pendant une lecture).
* **États** :
  | État | Affichage |
  |---|---|
  | Chargement | « Loading... » |
  | Erreur | Le message du serveur (ex. « CheapShark is unreachable ») |
  | Prêt, avec jeux | La liste, puis « Updated 15:30 » |
  | Prêt, sans jeu | « No free game right now. » |

* **Moins de jeux que demandé** : quand la carte affiche moins de jeux que le nombre réglé, un petit texte s'ajoute sous la liste, par exemple « Only 2 of the 5 games you asked for are shown: CheapShark has no other free game right now. », avec un lien **« Check on CheapShark »** vers https://www.cheapshark.com/browse?upperPrice=0 (nouvel onglet), où l'utilisateur peut vérifier lui-même. Ce n'est pas un bug : CheapShark n'a simplement pas plus de jeux gratuits à cet instant.
  * Le nombre demandé est calculé comme côté serveur : le réglage ramené entre 1 et 20.
  * Sans aucun jeu, la carte garde « No free game right now. », suivi du seul lien.
  * Quand il y a assez de jeux, le texte n'apparaît pas.

### 4.2. Un jeu de la liste
* Vignette de **60 × 28 px** (`loading="lazy"`, `alt=""` car décorative, le titre étant juste à côté).
* Titre en lien vers l'offre : `target="_blank"` et `rel="noreferrer"` (§7).
* Ligne « boutique · ~~prix~~ → Free ».

### 4.3. Le rechargement automatique
Le chargement est assuré par `useWidgetData` (commun à plusieurs cartes) : à l'affichage, quand un réglage est enregistré, et à chaque minuteur. Voir la documentation RSS (§4.5) pour le détail du minuteur : une chaîne de `setTimeout`, tour sauté si l'onglet est caché, jamais en dessous de 10 s.

### 4.4. Le panneau Settings
* **Les champs** :
  * **Number of games (1-20)** (texte, 2 caractères maximum) ;
  * **Refresh every (seconds)**, avec l'aide « Use a dot for milliseconds: 12.5 = 12 s 500 ms ».
* **Vérifications avant l'envoi** : un champ vide est refusé (« Number of games (1-20) cannot be empty »), l'intervalle est contrôlé par `parseSeconds`.
* **Enregistrement** : un seul `PATCH /api/widgets/{id}` avec `{ "config": { "number": "8" }, "refreshSeconds": … }`. Le panneau envoie le texte saisi : c'est le serveur (`validate_config`) qui le convertit en entier. Un texte comme `abc` est refusé par le serveur (`422`, « number must be an integer »).
* Une valeur hors de 1 à 20 est **acceptée** à l'enregistrement, puis ramenée entre 1 et 20 à la lecture (§2.1).

---

## 5. Configuration

* **Rien à configurer** : pas de clé, pas de compte, rien dans `.env`.
* `httpx` est installé avec les autres dépendances (`requirements.txt`).
* Le serveur doit avoir accès à internet pour joindre `www.cheapshark.com`.

---

## 6. Cycle de Vie des Données (Flux complet)

```text
1. Ajout d'une carte « Free games » :
   Dashboard  -> POST /api/widgets { serviceName: "cheapshark", widgetName: "free_games", config: { number: 5 }, refreshSeconds: 1800, x, y }
   Backend    -> validate_config (number entier) -> ligne widget_instances, HTTP 201

2. Chargement :
   FreeGamesWidget -> GET /api/widgets/{id}/data
   Backend         -> run_widget -> fetch_free_games :
                        GET /deals?upperPrice=0&pageSize=5&sortBy=recent  } en parallèle
                        GET /stores                                       }
                        -> noms de boutiques associés -> 5 jeux mis en forme
   FreeGamesWidget -> Affiche les 5 jeux, « Updated 15:30 »

3. Rafraîchissement automatique :
   FreeGamesWidget -> toutes les refreshSeconds (1800 par défaut), relit GET /data en silence (sauté si l'onglet est caché)

4. Réglages :
   FreeGamesWidget -> Settings -> « 10 », 600
                   -> PATCH /api/widgets/{id} { config: { number: "10" }, refreshSeconds: 600 }
   Dashboard       -> Remplace l'instance -> la carte se recharge, le minuteur repart à 600 s

5. CheapShark en panne :
   Backend         -> 502 « CheapShark is unreachable » (ou « answered HTTP … »)
   FreeGamesWidget -> affiche le message, Settings reste là, la lecture suivante réessaie

6. Suppression :
   Dashboard  -> DELETE /api/widgets/{id} -> la ligne widget_instances est supprimée (rien d'autre à libérer)
```

---

## 7. Sécurité & Données Personnelles
* **Pas de SSRF** : l'adresse appelée est **fixe** (`www.cheapshark.com`), l'utilisateur ne saisit aucune URL. Contrairement au widget RSS, aucune vérification d'adresse n'est nécessaire.
* **Liens** : ils commencent toujours par `https://www.cheapshark.com/redirect`, construits côté serveur. Aucun lien venant de l'API n'est repris tel quel, donc pas de `javascript:…` possible.
* **`rel="noreferrer"`** sur les liens : le site de destination ne reçoit pas l'adresse du dashboard, et l'onglet ouvert ne peut pas agir sur celui du dashboard.
* **Texte** : React échappe tout ce qui est affiché (titres, boutiques).
* **Données envoyées** : les appels sont faits **par le serveur**, pas par le navigateur. CheapShark voit l'adresse du serveur, jamais celle de l'utilisateur. Le `User-Agent` est générique : ni nom, ni email, ni identifiant.
* **Images** : les vignettes sont chargées **directement par le navigateur** depuis le CDN de la boutique (ex. Steam). Cette boutique voit donc l'adresse de l'utilisateur, comme pour n'importe quelle image web.
* **Rien n'est stocké** en dehors du réglage (`number`, `refreshSeconds`). Les jeux sont relus à chaque fois.
* **Cloisonnement** : le widget d'un autre utilisateur répond `404`.

---

## 8. Limites Connues & Pistes
* **`User-Agent` obligatoire** : sans lui, CheapShark répond `HTTP 400` (§3.4). Si ce message apparaît de nouveau, vérifier que l'en-tête est bien envoyé.
* **« Gratuit » = prix à 0 $ sur CheapShark** : cela inclut des offres temporaires (Epic, Steam) mais aussi des jeux free-to-play listés à 0 $, ou des démos selon la boutique.
* **Quota de l'API** : CheapShark limite le nombre de requêtes. Chaque lecture en fait **2**, et la liste des boutiques est redemandée à chaque fois alors qu'elle change très rarement.
  **Piste** : garder `/stores` en mémoire côté serveur (par exemple 24 h).
* **Prix en dollars uniquement** : `normalPrice` est en USD, sans conversion.
* **Une seule page de résultats** : au plus 20 jeux, sans pagination.
* **Pas de date de fin d'offre** : l'API ne la fournit pas, donc la carte ne peut pas dire « gratuit jusqu'au… ».
* **Langue** : l'interface est en anglais, les titres sont ceux de la boutique.
* **Vignettes** : elles dépendent du CDN de la boutique. Si une image ne charge pas, seul le texte reste.
* **Pas de test automatique** pour ce widget.

---

Retour à la [documentation principale](../README.md).
