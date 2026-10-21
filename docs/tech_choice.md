# Documentation — Choix technologiques

Pour chaque couche du projet (backend, frontend, base de données), ce document compare **quatre options sur les mêmes critères**, puis justifie le choix retenu à partir des besoins du projet et des compétences de l'équipe.

**Notation** : ★ = point faible, ★★ = correct, ★★★ = point fort, **pour ce projet**. Une note faible ne veut pas dire que la technologie est mauvaise, mais qu'elle répond moins bien à nos besoins.

| Couche | Choix | Options comparées |
|---|---|---|
| Backend | **Python + FastAPI** | Java (Spring Boot), C# (ASP.NET Core), Kotlin (Ktor) |
| Frontend | **React** (TypeScript, Vite) | Vue, Angular, Svelte |
| Base de données | **PostgreSQL** | MySQL, MariaDB, Microsoft SQL Server |

---

## 1. Backend

### 1.1. Les besoins du projet

* **Une API REST en JSON** : comptes, widgets, données des services, `about.json`.
* **Beaucoup d'appels vers des APIs externes** : Open-Meteo, Gmail, CheapShark, flux RSS, LibreTranslate. Le backend passe l'essentiel de son temps à **attendre** ces réponses : il doit savoir en attendre plusieurs à la fois (asynchrone).
* **Vérifier tout ce qui arrive** : la configuration des widgets, l'intervalle de rafraîchissement, les formulaires.
* **Lire des formats variés** : flux RSS et Atom, fuseaux horaires, OAuth 2.0 de Google.

### 1.2. Comparaison

| Critère | Python (FastAPI) | Java (Spring Boot) | C# (ASP.NET Core) | Kotlin (Ktor) |
|---|---|---|---|---|
| Code à écrire pour une route | ★★★ une fonction et un décorateur | ★ classes, annotations, objets de transfert | ★★ « Minimal APIs », mais un projet pensé en classes | ★★ concis, mais configuration Gradle et JVM |
| Style de programmation | ★★★ des fonctions et des modules, des objets seulement quand ils servent | ★ tout est classe : très orienté objet | ★ très orienté objet | ★★ orienté objet, fonctions possibles |
| Appels asynchrones aux APIs externes | ★★★ `async` / `await` natif, client `httpx` | ★★ possible (WebFlux, threads virtuels), mais plus complexe | ★★★ `async` / `await` natif | ★★★ coroutines |
| Validation des données reçues | ★★★ Pydantic : les types déclarés suffisent, erreur `422` automatique | ★★ Bean Validation, par annotations | ★★ DataAnnotations | ★★ plugin à configurer |
| Bibliothèques pour nos services (RSS, fuseaux, HTTP) | ★★★ `feedparser`, `zoneinfo` (standard), `httpx` | ★★ riches, mais plus lourdes à intégrer | ★★ riches, centrées sur .NET | ★★ celles de Java |
| Relance pendant le développement | ★★★ `uvicorn --reload` : immédiat | ★ compilation, puis démarrage de la JVM | ★★ `dotnet watch` | ★ compilation, puis démarrage de la JVM |
| Performances brutes | ★★ suffisantes : le backend attend surtout le réseau | ★★★ | ★★★ | ★★★ |
| Connaissances de l'équipe | ★★★ langage déjà pratiqué | ★ peu | ★ peu | ★ peu |

### 1.3. Le choix : Python avec FastAPI

* **Adapté aux APIs** : une route FastAPI tient en une fonction. Le code reste court et lisible, sans couches de classes.
* **Asynchrone natif** : pendant qu'une carte attend Open-Meteo, le serveur répond aux autres. C'est exactement le travail de ce backend, qui passe son temps à interroger d'autres APIs.
* **Validation gratuite** : les modèles Pydantic de `schemas.py` décrivent les données attendues. FastAPI refuse tout seul une requête invalide, avec un message clair.
* **Les bonnes bibliothèques** : `feedparser` lit tous les formats de flux, `zoneinfo` gère les fuseaux horaires de l'horloge, `httpx` fait les appels asynchrones.
* **Les compétences de l'équipe** : Python est déjà connu de l'équipe, contrairement à Java, C# et Kotlin. Ces trois langages, très orientés objet, auraient demandé un apprentissage en plus du projet, pour un besoin qui ne s'y prête pas particulièrement.

**Ce que nous acceptons** : Python est moins rapide que la JVM ou .NET, ce qui ne change rien ici, puisque le temps est passé à attendre le réseau. Son typage dynamique laisse passer certaines erreurs jusqu'à l'exécution : les modèles Pydantic et les types déclarés sur les routes en rattrapent une grande partie.

---

## 2. Frontend

### 2.1. Les besoins du projet

* **Beaucoup d'éléments qui se ressemblent** : sept types de cartes avec le même cadre, le même chargement de données, le même formulaire de réglages, les mêmes boutons.
* **De la logique partagée** : chargement, rafraîchissement automatique, déplacement, agrandissement, à écrire une seule fois pour toutes les cartes.
* **Une interface qui change souvent** : données rafraîchies, fenêtres, cartes déplacées en direct.
* **Moins d'erreurs possibles** : vérifier les données échangées avec l'API avant même de lancer l'application.

### 2.2. Comparaison

| Critère | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| Réutilisation de l'interface | ★★★ un morceau d'interface (JSX) est une valeur, qu'on passe en paramètre comme une autre | ★★ par des « slots » nommés | ★★ par projection de contenu, plus verbeuse | ★★ par des « snippets » (Svelte 5) |
| Réutilisation de la logique | ★★★ hooks : de simples fonctions, importées où il faut | ★★★ « composables », équivalents aux hooks | ★★ services injectés, sous forme de classes | ★★ stores et « runes » |
| Style de programmation | ★★★ des fonctions | ★★★ des fonctions (Composition API) | ★ classes, décorateurs, injection de dépendances | ★★★ des fonctions |
| Vérification TypeScript | ★★★ le JSX est du TypeScript : `tsc` vérifie aussi l'interface | ★★ les templates sont à part, vérifiés par `vue-tsc` | ★★★ TypeScript natif | ★★ vérifié par `svelte-check` |
| Apprentissage | ★★ JSX et quelques hooks | ★★★ proche du HTML | ★ beaucoup de concepts (RxJS, modules, CLI) | ★★★ proche du HTML |
| Écosystème et aide en ligne | ★★★ le plus large | ★★ large | ★★ large | ★ le plus petit, syntaxe changée récemment |
| Mise en place | ★★★ modèle Vite, trois dépendances | ★★★ modèle Vite | ★ CLI Angular, projet lourd | ★★★ modèle Vite |
| Connaissances de l'équipe | ★★ bases de JavaScript, React très documenté | ★ aucune | ★ aucune | ★ aucune |

### 2.3. Le choix : React (avec TypeScript et Vite)

* **Le plus réutilisable pour notre besoin** : un composant React est une fonction, et un morceau d'interface est une valeur qu'on passe en paramètre. Le cadre commun des cartes (`WidgetFrame`) reçoit ainsi les boutons propres à chaque carte et la poignée de déplacement, sans code spécial.
* **La logique écrite une fois** : les hooks sont de simples fonctions. `useWidgetData` charge les données de six cartes, `useAutoRefresh` les rafraîchit, et `useMove`, `useResize` et `useLayout` gèrent le placement de toutes les cartes.
* **Moins d'erreurs** : avec TypeScript, l'interface elle-même est vérifiée avant l'exécution. Une propriété oubliée ou mal typée sur une carte est signalée par `tsc`.
* **Un écosystème immense** : pour chaque question, une documentation et des exemples à jour. C'est un vrai gain pour une équipe qui apprend en même temps qu'elle construit.
* **Angular a été écarté** pour la même raison que Java côté backend : très orienté objet, beaucoup de concepts et de fichiers pour une seule page. **Vue** était l'alternative la plus sérieuse, avec un modèle proche, mais un écosystème plus petit. **Svelte** a la communauté la plus réduite, et sa syntaxe vient de changer : beaucoup de ressources en ligne sont déjà dépassées.

**Ce que nous acceptons** : React est une bibliothèque et non un framework complet. Il a fallu choisir nous-mêmes le routeur (React Router). Les hooks ont aussi leurs pièges, comme les dépendances des effets, qu'il faut connaître.

### 2.4. Et Tailwind CSS ?

Tailwind n'apparaît pas dans la comparaison : c'est un outil de **mise en forme** (des classes CSS utilitaires), pas un framework d'interface. Il s'utilise *avec* React, Vue ou Angular.

Nous l'avons écarté au profit de styles écrits en TypeScript dans `styles.ts`, plus `index.css` pour la mise en page et le téléphone. Cela fait une dépendance et une configuration en moins, et les styles sont vérifiés par TypeScript. En contrepartie, tout ce qui dépend de la taille de l'écran doit passer par `index.css`, car un style en ligne ne peut pas être modifié par une media query.

---

## 3. Base de données

### 3.1. Les besoins du projet

* **Des données relationnelles** : un utilisateur a des widgets, un widget peut être relié à une connexion Google.
* **Des données souples** : la configuration d'un widget change d'un service à l'autre (une ville, un flux, des langues…). Elle est stockée en **JSON**, tout comme les jetons OAuth de Google.
* **Des identifiants publics** (UUID), et des **dates avec fuseau horaire** : l'expiration d'un lien de confirmation est comparée à l'heure UTC.
* **Faire évoluer la base sans l'effacer** : au démarrage, le backend ajoute les colonnes apparues depuis, avec `ADD COLUMN IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS`.
* **Un accès asynchrone depuis Python**, comme le reste du backend.

### 3.2. Comparaison

| Critère | PostgreSQL | MySQL | MariaDB | Microsoft SQL Server |
|---|---|---|---|---|
| Types utilisés par le projet (JSON, UUID, dates avec fuseau) | ★★★ `JSONB`, `UUID` et `TIMESTAMPTZ` natifs | ★★ JSON natif, mais pas de type UUID, et dates rendues sans fuseau en Python | ★★ JSON stocké en texte vérifié, UUID (depuis 10.7), dates sans fuseau | ★★ UUID et dates avec fuseau, mais JSON stocké en texte (type natif seulement dans les toutes dernières versions) |
| Migrations au démarrage (`IF NOT EXISTS` sur colonnes et index) | ★★★ les deux | ★ aucun des deux | ★★★ les deux | ★ aucun : il faut interroger le catalogue système avant chaque ajout |
| Pilote Python asynchrone pour SQLAlchemy | ★★★ `asyncpg`, pilote de référence, très rapide | ★★ `aiomysql`, `asyncmy` | ★★ `aiomysql`, `asyncmy` | ★ `aioodbc`, plus un pilote ODBC Microsoft à installer dans l'image |
| Licence | ★★★ PostgreSQL License, libre et permissive | ★★ GPL, propriété d'Oracle | ★★★ GPL, communautaire | ★ propriétaire, édition gratuite limitée à 10 Go |
| Image Docker | ★★★ officielle, variante Alpine légère | ★★ officielle, sans variante Alpine | ★★ officielle, sans variante Alpine | ★ plus d'1 Go, 2 Go de mémoire minimum |
| Configuration et extensions | ★★★ très configurable, nombreuses extensions (`pgcrypto`…) | ★★ moteurs de stockage, plugins | ★★ moteurs de stockage, plugins | ★★ riche, mais centré sur l'écosystème Microsoft |
| Connaissances de l'équipe | ★★ SQL standard | ★★ SQL standard | ★★ SQL standard | ★ T-SQL, qui s'écarte du standard |

### 3.3. Le choix : PostgreSQL

* **Tous les types dont le projet a besoin, en natif** : la configuration des widgets et les jetons Google sont en `JSONB`, l'identifiant public des comptes en `UUID`, les dates en `TIMESTAMPTZ`. Python reçoit des dates avec fuseau, qu'il compare directement à l'heure UTC. Avec MySQL ou MariaDB, ces dates arriveraient sans fuseau et la comparaison échouerait.
* **Les migrations simples du démarrage** : `ADD COLUMN IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS` permettent de faire évoluer une base déjà remplie sans rien effacer. MySQL et SQL Server ne les proposent pas.
* **Le meilleur duo avec Python** : SQLAlchemy fonctionne avec les quatre bases, mais `asyncpg` est le pilote asynchrone de référence, et les types PostgreSQL sont directement utilisables dans les modèles SQLAlchemy.
* **Configurable et extensible** : c'est un serveur très réglable, avec des extensions. `pgcrypto`, par exemple, permettrait de chiffrer les jetons OAuth directement en base.
* **Libre et léger à déployer** : licence permissive, et image officielle Alpine dans Docker. SQL Server, au contraire, est propriétaire et demande plus d'1 Go d'image et 2 Go de mémoire.
* **Les compétences de l'équipe** : le SQL appris s'applique tel quel. PostgreSQL suit de près le standard SQL, contrairement au T-SQL de SQL Server.

**Ce que nous acceptons** : les modèles utilisent des types propres à PostgreSQL (`JSONB`, `UUID`). Changer de base plus tard demanderait de les adapter.

---

## 4. Les autres outils

| Outil | Rôle dans le projet | Pourquoi lui |
|---|---|---|
| TypeScript | Langage du frontend | Les erreurs de type sont trouvées avant l'exécution |
| Vite | Serveur de développement du frontend | Démarrage instantané, rechargement à chaud, relais `/api` intégré. Create React App n'est plus maintenu |
| React Router | Navigation entre les pages | La solution standard avec React |
| SQLAlchemy (asynchrone) | Accès à la base depuis Python | Requêtes écrites en Python, modèles typés, sessions asynchrones |
| httpx | Appels aux APIs externes | Client HTTP asynchrone, avec des délais d'attente réglables |
| feedparser | Lecture des flux RSS et Atom | Gère les nombreuses variantes de format des flux |
| PyJWT et bcrypt | Connexion et mots de passe | Jetons sans état côté serveur ; hachage lent et salé des mots de passe |
| LibreTranslate | Traduction | Hébergé dans le projet : gratuit, sans clé d'API, et les textes ne partent pas chez un tiers |
| Open-Meteo | Météo et recherche de villes | Gratuit et sans clé d'API |
| Docker Compose | Lancement de l'ensemble | Une seule commande, et le même environnement pour toute l'équipe |

---

Retour à la [documentation principale](../README.md).
