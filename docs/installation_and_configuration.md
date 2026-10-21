# Documentation — Installation et configuration

Ce document explique comment récupérer le projet sur une machine, puis remplir le fichier `.env` dont l'application a besoin pour démarrer.

---

## 1. Prérequis

| Outil | À quoi il sert | Pour vérifier qu'il est installé |
|---|---|---|
| [Docker](https://www.docker.com/), avec Docker Compose v2 | Fait tourner toute l'application : base de données, backend, frontend, traduction | `docker compose version` |
| [Git](https://git-scm.com/install/) | Télécharge le projet | `git --version` |
| Un compte Google avec la validation en deux étapes | Envoie les emails de confirmation de compte (§3.4) et crée le client OAuth du widget Gmail (§3.5) | — |

* **Rien d'autre à installer** : Python, Node.js et PostgreSQL sont dans les conteneurs Docker.
* **Environ 5 Go d'espace disque libre** : pour les images Docker, et pour les ~2,6 Go de modèles de traduction téléchargés au premier lancement.
* **Le port 8080 doit être libre** : c'est celui du dashboard.
* **Linux** : si `docker` demande `sudo`, suivez les [étapes post-installation de Docker](https://docs.docker.com/engine/install/linux-postinstall/).
* **macOS et Windows** (Docker Desktop) : tout fonctionne. Seul `client.host` dans `about.json` donnera l'adresse de la machine virtuelle de Docker au lieu de celle de l'ordinateur.

---

## 2. Téléchargement du projet

```bash
git clone git@github.com:EpitechPGE3-2026/G-WEB-500-LIL-5-1-dashboard-19.git
cd G-WEB-500-LIL-5-1-dashboard-19
```

* Le clone en SSH demande une clé SSH ajoutée à votre compte GitHub, et un accès au dépôt.
* Sans clé SSH, clonez en HTTPS. Git vous demandera alors de vous identifier sur GitHub :

```bash
git clone https://github.com/EpitechPGE3-2026/G-WEB-500-LIL-5-1-dashboard-19.git
```

---

## 3. Le fichier `.env`

### 3.1. Créer le fichier

À la racine du projet, dans le même dossier que `docker-compose.yml` :

| Système | Commande |
|---|---|
| Linux, macOS, Git Bash | `cp .env.example .env` |
| Windows (invite de commandes) | `copy .env.example .env` |
| Windows (PowerShell) | `Copy-Item .env.example .env` |

Ouvrez ensuite `.env` dans un éditeur de texte : [VS Code](https://code.visualstudio.com/) (`code .env`), `nano .env` dans un terminal, ou le Bloc-notes sous Windows. Le nom commence par un point : le fichier est **caché** dans la plupart des explorateurs de fichiers.

* **`.env.example`** est sur Git. Il ne contient que des valeurs d'exemple.
* **`.env`** contient les vraies valeurs. Il est ignoré par Git (`.gitignore`). Ne le commitez jamais, et ne le montrez jamais à l'écran.
* **Format** : une variable par ligne, `NOM=valeur`, sans espace autour du `=` et sans guillemets. Les lignes qui commencent par `#` sont des commentaires.
* **Toutes les variables sont obligatoires**, sauf celles notées « facultative ». S'il en manque une, le backend s'arrête au démarrage. Son nom apparaît dans `docker compose logs backend`, par exemple `KeyError: 'JWT_SECRET'`.
* **Les valeurs sont lues au démarrage des conteneurs.** Après une modification du `.env` sur une application déjà lancée :

```bash
docker compose up -d --force-recreate backend
```

---

### 3.2. Base de données (PostgreSQL)

| Variable | Valeur d'exemple | À changer ? | Rôle |
|---|---|---|---|
| `POSTGRES_USER` | `dashboard` | Facultatif | Utilisateur de la base |
| `POSTGRES_PASSWORD` | `change_this_password` | **Oui** | Mot de passe de cet utilisateur |
| `POSTGRES_DB` | `dashboard` | Facultatif | Nom de la base |
| `POSTGRES_HOST` | `db` | Non | Ignorée avec Docker : `docker-compose.yml` impose `db`, le nom du conteneur de la base |
| `POSTGRES_PORT` | `5432` | Non | Ignorée avec Docker : `docker-compose.yml` impose `5432` |

* **Le mot de passe ne doit contenir que des lettres et des chiffres.** Il est placé tel quel dans l'adresse de connexion (`postgresql://utilisateur:mot_de_passe@db:5432/base`). Un `@`, un `:`, un `/` ou un `#` la casserait. Pour en générer un :

```bash
openssl rand -hex 16
```

* **Ces trois valeurs ne servent qu'à la création de la base**, au tout premier lancement. Les modifier ensuite ne change pas la base existante, et le backend ne peut plus s'y connecter. Pour repartir d'une base vide (**tous les comptes et widgets sont effacés**) :

```bash
docker compose down
docker volume rm g-web-500-lil-5-1-dashboard-19_dashboard-db-data
```

Le début du nom du volume est le nom du dossier du projet, en minuscules (`docker volume ls` pour le retrouver). N'utilisez pas `docker compose down -v` : la commande supprime aussi les modèles de traduction, soit ~2,6 Go à télécharger de nouveau.

---

### 3.3. Connexion des utilisateurs (JWT)

| Variable | Valeur d'exemple | À changer ? | Rôle |
|---|---|---|---|
| `JWT_SECRET` | `change_this_to_a_long_random_value` | **Oui** | Clé qui signe les jetons de connexion |
| `JWT_EXPIRES_MINUTES` | `60` | Facultative | Durée d'une session, en minutes. Ensuite, il faut se reconnecter |

* **`JWT_SECRET` doit rester secret** : quiconque le connaît peut fabriquer un jeton et se faire passer pour n'importe quel utilisateur. Générez une valeur aléatoire (sous Windows, la commande fonctionne dans Git Bash, installé avec Git) :

```bash
openssl rand -hex 32
```

* Le changer plus tard déconnecte tous les utilisateurs : leurs jetons ne sont plus valides.

---

### 3.4. Emails de confirmation (SMTP Gmail)

À l'inscription, le backend envoie un email avec un lien de confirmation. **Un compte non confirmé ne peut pas se connecter** : sans SMTP correct, personne ne peut utiliser le dashboard.

| Variable | Valeur d'exemple | À changer ? | Rôle |
|---|---|---|---|
| `EMAIL_VERIFICATION` | `your.address@gmail.com` | **Oui** | Expéditeur affiché. Mettez la même adresse que `SMTP_USER` : sinon, Gmail la remplace par le compte connecté |
| `SMTP_HOST` | `smtp.gmail.com` | Non | Serveur d'envoi de Gmail |
| `SMTP_PORT` | `587` | Non | Port STARTTLS. Le port `465` ne fonctionne pas : le backend attend STARTTLS |
| `SMTP_USER` | `your.address@gmail.com` | **Oui** | Compte Gmail qui envoie les emails |
| `SMTP_PASSWORD` | `your_16_char_password` | **Oui** | **Mot de passe d'application** de ce compte, **pas** son mot de passe habituel |
| `APP_BASE_URL` | `http://localhost:8080` | Non, en local | Adresse du dashboard. Début du lien de confirmation (`/verify?token=…`) et page de retour après la connexion Google (`/dashboard`) |
| `CONFIRMATION_EXPIRES_HOURS` | `24` | Facultative | Durée de validité du lien de confirmation, en heures. Le texte de l'email annonce cette même durée |

**Obtenir un mot de passe d'application :**
1. Activez la **validation en deux étapes** sur le compte Google : *Compte Google → Sécurité*.
2. Ouvrez [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), donnez un nom (par exemple « Dashboard »), puis cliquez sur **Créer**.
3. Google affiche 16 lettres, en 4 groupes. Copiez-les **sans les espaces** dans `SMTP_PASSWORD`. Google ne les affichera plus jamais.

**Si l'email n'arrive pas :**
* Regardez dans les spams.
* Regardez les journaux du backend. Le compte est créé quand même, seul l'email est perdu :

```bash
docker compose logs backend | grep "\[mail\]"
```

---

### 3.5. Widget Gmail (OAuth Google)

| Variable | Valeur d'exemple | À changer ? | Rôle |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | `your_google_client_id` | **Oui** | Identifiant du client OAuth, qui finit par `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `your_google_client_secret` | **Oui** | Code secret de ce client |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8080/api/oauth/google/callback` | Non | Adresse où Google renvoie après la connexion. Doit être **identique**, caractère pour caractère, à celle déclarée chez Google |

* **Ces trois variables sont obligatoires, même sans widget Gmail.** Avec les valeurs d'exemple, l'application démarre normalement. Seul le bouton « Connect Gmail » échoue, avec une erreur Google `invalid_client`.
* **Google n'accepte `http://` que pour `localhost`** : ouvrez le dashboard sur `http://localhost:8080` pour connecter un compte Gmail.

**Créer le client OAuth dans la [console Google Cloud](https://console.cloud.google.com/) :**
1. Créez un projet.
2. *API et services → Bibliothèque* : recherchez **Gmail API**, puis cliquez sur **Activer**.
3. *Google Auth Platform* :
   * **Branding** : nom de l'application et adresse email d'assistance ;
   * **Audience** : type d'utilisateur **Externe** ;
   * **Accès aux données** : ajoutez le scope `https://www.googleapis.com/auth/gmail.readonly`, en lecture seule.
4. *Clients → Créer un client* :
   * type **Application Web** ;
   * URI de redirection autorisée : `http://localhost:8080/api/oauth/google/callback`.
5. Copiez l'**ID client** dans `GOOGLE_CLIENT_ID` et le **code secret** dans `GOOGLE_CLIENT_SECRET`.

**Selon l'état de publication de l'application (onglet *Audience*) :**
* **En test** :
  * seules les adresses ajoutées dans **Utilisateurs tests** peuvent se connecter ;
  * Google coupe chaque connexion au bout de 7 jours : il faut alors reconnecter le widget.
* **En production, sans validation Google** (c'est le cas du projet de l'équipe) :
  * tout compte peut se connecter, dans la limite de 100 utilisateurs ;
  * Google affiche d'abord « Google n'a pas validé cette application ». Il faut cliquer sur **Paramètres avancés**, puis sur **Accéder à … (non sécurisé)**.

---

### 3.6. Variable facultative, absente de `.env.example`

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| `LIBRETRANSLATE_URL` | `http://libretranslate:5000` | Serveur de traduction du widget Translate. Par défaut, c'est le conteneur `libretranslate` du projet, sans clé d'API. À ajouter uniquement pour utiliser un autre serveur LibreTranslate |

---

## 4. Vérifier la configuration

* [ ] `POSTGRES_PASSWORD` est changé, avec seulement des lettres et des chiffres.
* [ ] `JWT_SECRET` est une longue valeur aléatoire.
* [ ] `EMAIL_VERIFICATION` et `SMTP_USER` contiennent la même adresse Gmail.
* [ ] `SMTP_PASSWORD` est un mot de passe d'application, écrit sans espaces.
* [ ] `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` viennent de votre client OAuth (ou restent les valeurs d'exemple, sans widget Gmail).

Deux commandes pour le vérifier :

```bash
# aucune ligne affichée = plus aucune valeur d'exemple dans le .env
grep -nE "change_this|your_|your\." .env

# .env ne doit PAS apparaître : il est bien ignoré par Git
git status --short
```

## 5. Étape suivante

Vous avez fini la configuration. Vous pouvez maintenant **[lancer le dashboard](launching.md)**.

Retour à la [documentation principale](../README.md).
