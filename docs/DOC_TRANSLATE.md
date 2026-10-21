# Documentation Complète — Service & Widget Translate (Traduction)

Ce document est la documentation technique et fonctionnelle dédiée exclusivement au service **Translate** et à son widget.

---

## 1. Présentation du Service

Le service **Translate** traduit un texte d'une langue à une autre, **pendant que l'utilisateur tape**, entre 11 langues :

| Code | Langue | Code | Langue |
|---|---|---|---|
| `en` | English | `hi` | Hindi |
| `fr` | French | `ja` | Japanese |
| `es` | Spanish | `de` | German |
| `zh-Hans` | Chinese (simplifié) | `ru` | Russian |
| `ar` | Arabic | `id` | Indonesian |
| `pt` | Portuguese | | |

La traduction est faite par **LibreTranslate**, un logiciel libre qui tourne **dans notre propre `docker-compose`**. Il ne faut ni compte, ni clé, ni email, et il n'y a pas de quota. Le texte tapé ne quitte jamais la machine.

* **Identifiant du service** : `translate`
* **Souscription requise (`requires_subscription`)** : `false`, aucun compte tiers n'est nécessaire.
* **Fichiers sources dédiés** :
  * Backend :
    * [`backend/catalog/translate.py`](../backend/catalog/translate.py) : déclaration du widget, liste des langues et appel à LibreTranslate
    * [`backend/routes/translate.py`](../backend/routes/translate.py) : route `POST /api/translate`
  * Backend partagé avec les autres widgets : [`backend/catalog/__init__.py`](../backend/catalog/__init__.py) (`validate_config`), [`backend/catalog/types.py`](../backend/catalog/types.py) (`Param.choices`), [`backend/schemas.py`](../backend/schemas.py) (`TranslateRequest`), [`backend/config.py`](../backend/config.py), [`backend/main.py`](../backend/main.py)
  * Frontend :
    * [`frontend/src/components/translate-widget.tsx`](../frontend/src/components/translate-widget.tsx) : carte du widget (menus, saisie, résultat) et champs de la fenêtre d'ajout (`TRANSLATE_FIELDS`)
    * [`frontend/src/components/widget-form.tsx`](../frontend/src/components/widget-form.tsx) : le formulaire commun de la fenêtre d'ajout
    * [`frontend/src/widget-types.ts`](../frontend/src/widget-types.ts) : entrée « Translate » de la barre latérale
    * [`frontend/src/styles.ts`](../frontend/src/styles.ts) : styles `translate…`
  * Infrastructure : [`docker-compose.yml`](../docker-compose.yml), service `libretranslate`

---

## 2. Spécifications & Contrat d'API (`about.json`)

Le service expose un seul widget dans le catalogue :

```json
{
  "name": "translate",
  "widgets": [
    {
      "name": "text",
      "description": "Translate a text between two languages",
      "params": [
        { "name": "source", "type": "string" },
        { "name": "target", "type": "string" }
      ]
    }
  ]
}
```

### 2.1. Widget : `text`
* **Description** : Traduit le texte tapé, de la langue `source` vers la langue `target`.
* **Paramètres** :
  | Paramètre | Type | Requis | Valeur par défaut | Description |
  |---|---|---|---|---|
  | `source` | `string` | Non | `en` | Langue du texte tapé, parmi les 11 codes ci-dessus |
  | `target` | `string` | Non | `fr` | Langue de la traduction, parmi les 11 codes ci-dessus |

  Une langue inconnue est refusée à l'enregistrement (`POST` ou `PATCH /api/widgets`) avec une `422` : `source must be one of: en, fr, es, zh-Hans, ar, pt, hi, ja, de, ru, id`.

* **Le texte tapé n'est pas un paramètre** : il n'est jamais enregistré. Il passe seulement par `POST /api/translate` (§2.2).
* **Valeurs à l'ajout depuis la barre latérale** : `config = { "source": "en", "target": "fr" }`, proposées dans la fenêtre d'ajout (§4.1). Chaque « + Add » repart de anglais → français, quels que soient les réglages des autres traducteurs.
* **`refreshSeconds`** : la valeur `300` est enregistrée car la base en exige une, mais elle **ne sert pas**. Une traduction ne change pas avec le temps : elle se déclenche quand on tape, pas sur un minuteur.

* **Format des données retournées (`GET /api/widgets/{id}/data`)** : la liste des langues. C'est le seul endroit où elle est écrite, et le front construit ses menus à partir d'elle.
```json
{
  "data": {
    "languages": [
      { "code": "en", "name": "English" },
      { "code": "fr", "name": "French" },
      { "code": "zh-Hans", "name": "Chinese" }
    ]
  },
  "account": null,
  "fetchedAt": "2026-10-06T08:15:02.481516+00:00"
}
```
  La liste réelle contient les 11 langues, dans l'ordre du tableau du §1. `account` vaut toujours `null` : ce widget n'a pas de compte lié.

---

### 2.2. Route de traduction : `POST /api/translate`

| Méthode | Route | Authentification | Rôle |
|---|---|---|---|
| `POST` | `/api/translate` | Bearer (JWT) | Traduit un texte. Les langues voyagent avec le texte, donc pas besoin d'attendre l'enregistrement du réglage du widget. |

* **Requête** :
```json
{ "text": "Where is the train station?", "source": "en", "target": "fr" }
```
* **Réponse** (`200`) :
```json
{ "translatedText": "Où est la gare ?" }
```
* **Réponses d'erreur** (pour une `422`, le message est dans `detail[0].msg`) :
  | Situation | Code | Message |
  |---|---|---|
  | Pas de jeton, ou jeton expiré | `401` | `Invalid or expired session` |
  | Texte vide ou uniquement des espaces | `422` | `Value error, Text cannot be empty` |
  | Plus de 2 000 caractères | `422` | `Value error, Text is too long: 2000 characters max` |
  | Langue hors des 11 codes | `422` | `Value error, Unsupported language` |
  | Champ manquant | `422` | `Field required` |
  | LibreTranslate refuse la demande | `502` | Le message renvoyé par LibreTranslate |
  | LibreTranslate injoignable (arrêté, ou modèles encore en téléchargement) | `502` | `Translation server not ready yet (its first start downloads the language models, about 10 min)` |

* **Même langue des deux côtés** : le texte est renvoyé tel quel (`200`), sans appeler LibreTranslate.

---

## 3. Architecture Backend

### 3.1. Pourquoi LibreTranslate, hébergé chez nous
| Service | Compte ou clé ? | Verdict |
|---|---|---|
| Google Cloud Translation | Clé API + carte bancaire | ❌ |
| DeepL API Free | Compte + clé | ❌ |
| URL « cachée » de Google Traduction | Non, mais interdite par les conditions de Google | ❌ indéfendable |
| libretranslate.com (serveur public) | Clé payante : sans clé, il répond `400` « Visit https://portal.libretranslate.com to get an API key » | ❌ |
| MyMemory | Non, mais 5 000 caractères par jour en anonyme, et des erreurs renvoyées avec un statut HTTP 200 | ❌ abandonné |
| **LibreTranslate dans notre `docker-compose`** | **Non**, sans quota, et le texte reste sur la machine | ✅ |

---

### 3.2. Appel à LibreTranslate (`translate_text` dans `backend/catalog/translate.py`)
1. **Même langue** : le texte est renvoyé tout de suite, sans réveiller le modèle.
2. **Requête** : `POST {LIBRETRANSLATE_URL}/translate` avec `{ "q": texte, "source": …, "target": …, "format": "text" }`.
3. **Délai d'attente de 30 s** : la traduction tourne sur le processeur, et le premier appel après un démarrage charge le modèle en mémoire.
4. **Erreurs** : LibreTranslate répond avec un vrai statut HTTP et un corps `{ "error": "…" }`. Ce message est lu et transmis dans une `WidgetError`. Si le corps n'est pas du JSON, le message devient « Translation failed ».
5. **Succès** : on renvoie le champ `translatedText`.

`fetch_languages` répond à `GET /api/widgets/{id}/data` avec la liste `LANGUAGES`. `config` et `credentials` n'y servent pas, mais tous les widgets du catalogue ont cette même signature.

---

### 3.3. Validation
* **Réglages du widget** (`validate_config` dans `backend/catalog/__init__.py`) : `Param` a un champ `choices`. Un paramètre texte qui a des `choices` n'accepte que ces valeurs, comparées après suppression des espaces autour (`" fr "` est accepté). Un `choices` vide accepte n'importe quel texte, comme pour la ville de l'horloge.
* **Texte à traduire** (`TranslateRequest` dans `backend/schemas.py`) :
  * le texte ne doit pas être vide une fois les espaces retirés ;
  * il fait au plus `MAX_CHARS` (2 000) **caractères**. Python compte comme `Array.from(text).length` côté front : un emoji compte pour 1 ;
  * `source` et `target` doivent faire partie de `LANGUAGES`.
* **Pourquoi une limite de 2 000 caractères**, alors que LibreTranslate n'en impose pas chez nous : chaque pause pendant la frappe retraduit **tout** le texte sur le processeur. Un texte énorme collé occuperait le conteneur longtemps.

---

### 3.4. La route (`backend/routes/translate.py`)
* **Réservée aux utilisateurs connectés** (`Depends(current_user)`) : notre serveur de traduction ne doit pas devenir un service public gratuit.
* `WidgetError` (LibreTranslate a refusé) devient une `502` avec son message.
* `httpx.HTTPError` (injoignable ou trop lent) devient une `502` avec un message qui donne la cause la plus fréquente : « Translation server not ready yet (its first start downloads the language models, about 10 min) ». Sans ça, on croirait le traducteur cassé alors qu'il télécharge encore ses modèles.
* Le routeur est branché dans `backend/main.py` (`app.include_router(translate.router)`).

---

### 3.5. Le service Docker `libretranslate` (`docker-compose.yml`)
| Réglage | Valeur | Pourquoi |
|---|---|---|
| `image` | `libretranslate/libretranslate:v1.9.6` | Version épinglée, pas `latest` |
| `LT_LOAD_ONLY` | `en,fr,es,zh-Hans,ar,pt,hi,ja,de,ru,id` | Ne télécharge et ne charge que ces langues. Ce sont les mêmes codes que `LANGUAGES` |
| `LT_UPDATE_MODELS` | `"true"` | **Indispensable** : sans lui, LibreTranslate n'installe des modèles que s'il en a moins de 2. Un premier démarrage interrompu (Ctrl+C) reste alors bloqué avec quelques langues seulement. Avec lui, chaque démarrage télécharge seulement les modèles manquants, et un démarrage hors ligne continue avec ceux qui sont déjà là |
| `expose: 5000` | Pas de `ports` | Accessible seulement par le backend, comme le backend lui-même |
| Volume `dashboard-translate-models` | `/home/libretranslate/.local` | Les modèles téléchargés sont gardés entre deux redémarrages |
| `healthcheck` sur `/languages` | `start_period: 15m` | `docker compose ps` affiche `starting`, puis `healthy` quand il répond vraiment. On n'utilise pas le `scripts/healthcheck.py` officiel, qui affiche `healthy` pendant tout le téléchargement |
| Pas de `depends_on` côté backend | — | Pendant le téléchargement des modèles, le reste du dashboard marche. Seul le traducteur répond « Translation server not ready yet… » |

* **L'adresse** vient de `LIBRETRANSLATE_URL` (`backend/config.py`). Par défaut, elle vaut `http://libretranslate:5000`, le nom du service dans le compose.
* **Mesures sur notre machine** :
  | | Valeur |
  |---|---|
  | Premier démarrage (téléchargement des 22 modèles) | environ 10 min |
  | Redémarrage, modèles déjà présents | environ 4 s |
  | Taille des modèles (volume) | 2,64 Go |
  | Taille de l'image | 847 Mo |
  | Mémoire au repos | environ 300 Mo |
  | Temps d'une traduction courte | 0,2 à 0,6 s |
* **Traductions indirectes** : entre deux langues autres que l'anglais (par exemple français → allemand), LibreTranslate passe par l'anglais. On perd un peu en finesse : « Où est la gare ? » donne « Wo ist die Station? » au lieu de « Wo ist der Bahnhof? ».
* **Ajouter une langue** : ajoute son code (voir la liste du serveur public sur https://libretranslate.com/languages, 51 langues) à `LANGUAGES` **et** à `LT_LOAD_ONLY`, puis redémarre `libretranslate`. Ses modèles seront téléchargés à ce moment-là.

---

## 4. Architecture Frontend

### 4.1. Ajout depuis la barre latérale (`frontend/src/widget-types.ts`)
| Champ | Valeur |
|---|---|
| `label` | `Translate` |
| `description` | `English → French` |
| `serviceName` / `widgetName` | `translate` / `text` |
| `defaultConfig` | `{ source: "en", target: "fr" }` |
| `defaultRefreshSeconds` | `300` (inutilisé, voir §2.1) |
| `fields` | `TRANSLATE_FIELDS` (exporté par `translate-widget.tsx`) : **From**, **To** |
| `hideRefresh` | `true` : la fenêtre d'ajout ne demande pas de rafraîchissement |

* **« + Add » ouvre une fenêtre d'ajout** (« Add a Translate widget »). Le widget n'est créé **qu'à la confirmation**, comme le demande le sujet : choisir le type, le configurer, puis confirmer.
  * **From** (English par défaut) et **To** (French par défaut) : deux listes avec les 11 langues installées.
  * **Pas de champ « Refresh every »** : une traduction se lance quand on tape, pas sur un minuteur. Le formulaire commun le cache (`withRefresh={false}`, déclenché par `hideRefresh`), et la valeur par défaut (`300`) est envoyée telle quelle, car le serveur en veut une.
* **Les langues des listes** (`LANGUAGE_OPTIONS`) sont écrites dans le front, avec les mêmes codes que `LANGUAGES` dans `backend/catalog/translate.py`. Les deux listes doivent rester identiques : une langue présente seulement dans le front serait refusée par le serveur (`422`). La carte, elle, lit toujours ses langues sur le serveur (§4.2).
* **Les boutons** :
  | Bouton | Effet |
  |---|---|
  | **Add widget** (ou Entrée) | Vérifie les champs, puis `POST /api/widgets` avec les valeurs choisies. La fenêtre se ferme et la nouvelle carte apparaît |
  | **Default** | Remet les valeurs par défaut dans les champs, et efface l'erreur affichée. Rien n'est envoyé |
  | **Cancel** (rouge) ou la croix × | Ferme la fenêtre sans rien créer. Échap et un clic sur le fond ne la ferment pas, pour ne pas perdre la saisie par erreur |
* **Chaque ouverture repart d'anglais → français** : les langues d'un autre traducteur ne sont jamais reprises.
* **Changer de langues ensuite** se fait directement dans la carte, avec ses deux menus (§4.2). Il n'y a pas de bouton Settings.
* La suppression (×) vient du cadre commun `WidgetFrame`. Supprimer un traducteur ne libère rien, puisqu'il n'a ni compte ni connexion.

---

### 4.2. Le composant `<TranslateWidget />` (`frontend/src/components/translate-widget.tsx`)
| État | Quand | Affichage |
|---|---|---|
| `loading` | Pendant le chargement de la liste des langues (`GET /data`) | « Loading... » |
| `ready` | La liste est reçue | Menus, champ de saisie, compteur, résultat |
| `error` | `GET /data` a échoué | Le message d'erreur |

Il n'y a **pas de bouton Refresh ni Settings** : tout se règle dans la carte, et la traduction est instantanée. La poignée ⠿ et le × viennent du cadre commun.

* **Titre de la carte** : « English → French », d'après les langues choisies. Deux traducteurs restent ainsi faciles à distinguer.
* **Menus « From » et « To »** : le même petit composant `LanguageSelect`, utilisé deux fois.
* **Bouton ⇄** (`aria-label="Swap languages"`) : il inverse les deux langues, et la traduction devient le texte à traduire, comme sur Google Traduction.
* **Champ de saisie** :
  * `aria-label="Text to translate"`, placeholder « Type in English... » selon la langue source ;
  * `lang` (la langue source) et `dir="auto"` : la bonne police, et l'arabe s'écrit de droite à gauche tout seul ;
  * taille fixe (3 lignes, pas de redimensionnement) : la carte ne grandit pas par-dessus ses voisines.
* **Compteur** : « 44 / 2000 characters », qui passe en rouge au-delà. Il compte avec `Array.from(text).length`, comme Python, alors que `text.length` compterait un emoji pour 2. « Translating... » s'affiche à gauche pendant une traduction.
* **Résultat** :
  * `aria-live="polite"` : un lecteur d'écran lit chaque nouvelle traduction, sans couper l'utilisateur ;
  * `lang` (la langue cible) et `dir="auto"` ;
  * hauteur maximale avec défilement ;
  * l'ancienne traduction **reste affichée** pendant que la nouvelle se charge, donc rien ne clignote ;
  * au-delà de 2 000 caractères, « Too long: 2000 characters max » s'affiche, et aucune requête ne part.

---

### 4.3. Traduction instantanée
```
   une touche est tapée (ou une langue change)
                    |
                    v
   minuteur de 500 ms relancé, le précédent est annulé
                    |
          500 ms sans nouvelle touche
                    v
   demande n° N : POST /api/translate { text, source, target }
                    |
                    v
   réponse reçue : N est-il encore le dernier numéro envoyé ?
          | oui                         | non
          v                             v
   afficher la traduction     ignorer cette réponse en retard
```

* **Une requête par pause, pas par touche** (`DEBOUNCE_MS = 500`) : taper « Where is the train station? » d'une traite (27 touches) n'envoie qu'**une** requête.
* **Le numéro de demande** (`lastRequest`) : si on tape « hel », qu'on s'arrête, puis qu'on tape « hello », deux demandes partent. Si la réponse à « hel » arrive **après** celle de « hello », elle est ignorée et n'écrase pas la bonne traduction.
* **Le nettoyage de l'effet** fait deux choses à chaque nouvelle touche, changement de langue ou suppression de la carte : il annule le minuteur en attente, **et** il invalide la réponse en cours en augmentant le numéro.
* **Texte vide ou trop long** : la traduction est effacée, et aucune requête ne part.

---

### 4.4. Changer de langue
1. La langue choisie s'applique tout de suite. Comme `source` et `target` font partie des dépendances de l'effet de traduction, le texte est retraduit tout seul.
2. En parallèle, `PATCH /api/widgets/{id}` avec `{ "config": { "source": …, "target": … } }` **mémorise** le choix. La réponse du serveur (le widget complet) est passée au dashboard par `onUpdate(updated)`.
3. Si l'enregistrement échoue, « Could not save the languages » s'affiche sous la carte. La traduction marche quand même.

---

## 5. Configuration

* **Rien à mettre dans `.env`** : pas de clé, pas d'email.
* `LIBRETRANSLATE_URL` est facultative. Elle vaut par défaut `http://libretranslate:5000`, et ne sert que si LibreTranslate tourne ailleurs.
* **Premier `docker compose up`** : il faut internet et environ 10 minutes pour télécharger les modèles. Pour suivre l'avancement : `docker compose logs -f libretranslate`. C'est prêt quand apparaissent « Loaded support for 11 languages (22 models total)! » puis « Listening at: http://[::]:5000 ».
* **`docker compose down -v` et `docker volume prune -a`** suppriment aussi le volume des modèles : le `up` suivant les re-télécharge (environ 10 min). Un `down` sans `-v` les garde. Pour repartir d'une base vide **sans** perdre les modèles, supprime seulement le volume de la base (`docker volume rm <projet>_dashboard-db-data`).
* **Savoir si c'est prêt** : `docker compose ps` doit afficher `healthy` pour `libretranslate`. Ne l'arrête pas en plein téléchargement : grâce à `LT_UPDATE_MODELS`, il reprendrait au démarrage suivant, mais seulement à partir des modèles déjà terminés.

---

## 6. Cycle de Vie des Données (Flux complet)

```text
1. Ajout d'un traducteur :
   Dashboard        -> POST /api/widgets { serviceName: "translate", widgetName: "text", config: { source: "en", target: "fr" }, refreshSeconds: 300, x, y }
   Backend          -> validate_config : source et target parmi les 11 codes
   Backend          -> Enregistre l'instance (table widget_instances), HTTP 201

2. Chargement de la carte :
   TranslateWidget  -> GET /api/widgets/{id}/data -> les 11 langues -> menus remplis, titre « English → French »

3. Traduction :
   TranslateWidget  -> 500 ms après la dernière touche : POST /api/translate { text, source, target }
   Backend          -> TranslateRequest valide (texte non vide, 2 000 caractères max, langues connues)
   Backend          -> POST http://libretranslate:5000/translate
   TranslateWidget  -> Affiche translatedText (sauf si une demande plus récente est partie)

4. Changement de langue ou ⇄ :
   TranslateWidget  -> Retraduit avec les nouvelles langues
   TranslateWidget  -> PATCH /api/widgets/{id} { config: { source, target } } -> onUpdate(widget renvoyé)

5. Rechargement de la page :
   TranslateWidget  -> Les langues sont relues depuis la config, le texte tapé est perdu (il n'est jamais enregistré)

6. Suppression :
   Dashboard        -> DELETE /api/widgets/{id}
   Backend          -> Supprime la ligne widget_instances (rien d'autre à libérer)
```

---

## 7. Sécurité & Données Personnelles
* **Le texte reste sur la machine** : il va du navigateur au backend, puis au conteneur LibreTranslate, et rien n'est envoyé à un service extérieur.
* **Rien n'est stocké** : ni le texte, ni la traduction. Seules les deux langues choisies sont enregistrées, dans `config`.
* **Accès réservé** : `POST /api/translate` exige d'être connecté, et LibreTranslate n'est pas exposé hors du réseau Docker (`expose` et pas `ports`).
* **Taille limitée** (2 000 caractères) : un utilisateur ne peut pas bloquer le serveur de traduction avec un texte géant.

---

## 8. Limites Connues & Pistes
* **Premier démarrage long** : environ 10 minutes et 2,64 Go de modèles, avec internet obligatoire. À signaler dans le README pour l'évaluation.
* **Qualité variable** :
  * les traductions entre deux langues autres que l'anglais passent par l'anglais (§3.5) ;
  * des petits défauts existent, par exemple `أين محطة القطار؟?`, avec un point d'interrogation en double vers l'arabe.
* **Le texte tapé est perdu au rechargement** : c'est voulu (rien n'est stocké), mais on pourrait le garder dans le navigateur.
* **Le rafraîchissement périodique ne s'applique pas** : `refreshSeconds` est enregistré mais inutilisé, car une traduction ne dépend que du texte. C'est un choix à justifier en soutenance.
* **Pas de détection de langue** : LibreTranslate accepte `source: "auto"`, qu'on pourrait proposer en option « Detect language ».
* **Pas de bouton « Copier »** pour la traduction (piste : `navigator.clipboard.writeText`).

---

Retour à la [documentation principale](../README.md).
