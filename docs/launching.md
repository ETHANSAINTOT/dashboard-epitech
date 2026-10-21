# Documentation — Lancement

Ce document explique comment démarrer le dashboard, créer un compte, puis arrêter l'application sans perdre de données.

> **Avant de commencer**, le projet doit être installé et le fichier `.env` rempli, en suivant la [documentation d'installation et de configuration](installation_and_configuration.md). Sans `.env` complet, le backend ne démarre pas.

---

## 1. Démarrer l'application

Placez-vous à la **racine du projet**, le dossier qui contient `docker-compose.yml` et `.env` :

```bash
cd G-WEB-500-LIL-5-1-dashboard-19
docker compose up --build
```

La commande construit les images, puis démarre les cinq conteneurs :

| Conteneur | Rôle |
|---|---|
| `dashboard-db` | Base de données PostgreSQL : comptes, widgets, connexions Gmail |
| `dashboard-host-ip` | Relève l'adresse réseau de la machine pour `about.json`, puis s'arrête (c'est normal) |
| `dashboard-backend` | API FastAPI, joignable seulement à travers le frontend |
| `dashboard-frontend` | Serveur Vite : le site, sur le port **8080** |
| `dashboard-translate` | Serveur de traduction LibreTranslate, pour le widget Translate |

Les journaux de tous les conteneurs défilent dans le terminal. Laissez-le ouvert : `Ctrl + C` dans ce terminal arrête l'application.

* **Pour garder la main sur le terminal**, lancez l'application en arrière-plan avec `-d`, puis suivez les journaux quand vous en avez besoin :

```bash
docker compose up --build -d
docker compose logs -f
```

---

## 2. Attendre que tout soit prêt

**Le dashboard est prêt** quand le frontend affiche son adresse dans les journaux :

```
dashboard-frontend  |   ➜  Local:   http://localhost:8080/
dashboard-frontend  |   ➜  Network: http://172.19.0.5:8080/
```

La ligne `Network` donne l'adresse interne du conteneur, inutilisable depuis le navigateur : ignorez-la.

* **Premier lancement** : comptez quelques minutes, le temps de télécharger les images et d'installer les dépendances Python et Node.js.
* **Lancements suivants** : quelques secondes.

**Le widget Translate demande plus de temps au premier lancement.** LibreTranslate télécharge ses modèles de langue (~2,6 Go), ce qui peut prendre jusqu'à un quart d'heure selon la connexion. Le reste du dashboard fonctionne déjà pendant ce temps. Seul le widget Translate affiche `translate is unavailable`, jusqu'à ce que le conteneur soit prêt. Pour le vérifier :

```bash
docker compose ps
```

`dashboard-translate` doit indiquer `(healthy)`. Les modèles sont gardés dans un volume Docker : ils ne sont téléchargés qu'une fois.

---

## 3. Ouvrir le dashboard

Ouvrez un navigateur sur **[http://localhost:8080](http://localhost:8080)**.

* Utilisez bien `localhost` et le même ordinateur. Le lien de l'email de confirmation et la connexion Gmail renvoient vers `http://localhost:8080`.
* La description des services et des widgets est disponible sur [http://localhost:8080/about.json](http://localhost:8080/about.json).

---

## 4. Créer un compte

1. Sur la page d'accueil, cliquez sur **Sign Up**.
2. Remplissez le formulaire :
   * prénom, nom et adresse email ;
   * mot de passe de **12 à 16 caractères**, avec au moins une majuscule, une minuscule, un chiffre et un caractère spécial ;
   * cochez la case d'acceptation des conditions d'utilisation, puis cliquez sur **Sign Up**.
3. La page **Account created** s'affiche. Ouvrez l'email **Confirm your Dashboard account** reçu à l'adresse indiquée, puis cliquez sur le lien. Ce lien n'est valable que pendant la durée réglée dans le `.env` (24 heures par défaut).
4. La page **Account verification** confirme le compte. Cliquez sur **Sign In**.

* **Pas d'email reçu** : regardez dans les spams, puis dans les journaux du backend (`docker compose logs backend | grep "\[mail\]"`).
* **« Please confirm your email before signing in »** à la connexion : le compte existe, mais le lien de l'email n'a pas encore été ouvert.

---

## 5. Se connecter

Sur la page d'accueil, cliquez sur **Sign In**, puis entrez l'adresse email et le mot de passe du compte. Le dashboard s'ouvre.

* La session dure le temps réglé dans le `.env` (60 minutes par défaut). Ensuite, il faut se reconnecter.
* Le bouton **Sign out**, en haut à droite du dashboard, termine la session tout de suite.

---

## 6. Arrêter et relancer

| Pour… | Commande | Comptes et widgets |
|---|---|---|
| Arrêter une application lancée sans `-d` | `Ctrl + C` dans son terminal | Conservés |
| Arrêter une application lancée avec `-d` | `docker compose stop` | Conservés |
| Arrêter et supprimer les conteneurs | `docker compose down` | Conservés |
| Tout effacer | `docker compose down -v` | **Effacés**, ainsi que les ~2,6 Go de modèles de traduction. À éviter |

**Les comptes restent actifs tant que les volumes Docker ne sont pas supprimés.** Comptes, widgets et connexions Gmail sont enregistrés dans le volume de la base de données. Ils survivent à `stop`, à `down` et au redémarrage de l'ordinateur. Pour relancer, il suffit de se reconnecter avec **Sign In** :

```bash
docker compose up
```

* **`--build` n'est utile que si les dépendances ont changé** (`backend/requirements.txt` ou `frontend/package.json`). Le code est lu directement depuis les dossiers du projet : une modification du code est prise en compte sans relancer.
* **Après un changement de `frontend/package.json`**, ajoutez `-V`. Sinon, le conteneur garde ses anciens `node_modules` :

```bash
docker compose up --build -V
```

---

## 7. En cas de problème

| Cas | Cause probable | Solution |
|---|---|---|
| `port is already allocated` ou `address already in use` au lancement | Un autre programme utilise le port 8080 | Arrêter ce programme, puis relancer |
| La page ne charge pas, `dashboard-backend` s'arrête | Une variable manque dans le `.env` | `docker compose logs backend` donne son nom, à ajouter selon la [documentation d'installation](installation_and_configuration.md) |
| `permission denied` sur Docker (Linux) | L'utilisateur n'a pas accès à Docker | Voir les prérequis de la [documentation d'installation](installation_and_configuration.md) |
| Le widget Translate affiche `translate is unavailable` | LibreTranslate n'est pas encore prêt | Attendre `(healthy)` dans `docker compose ps` (§2) |
| « Connect Gmail » mène à une erreur Google `invalid_client` | Variables `GOOGLE_…` absentes ou fausses | Créer le client OAuth selon la [documentation d'installation](installation_and_configuration.md) |
| « This verification link has expired » | Le lien de confirmation a dépassé sa durée de validité | Aucun renvoi d'email n'existe pour l'instant : l'adresse reste bloquée (voir ci-dessous) |

**Limite connue** : il n'existe pas encore de bouton pour renvoyer l'email de confirmation. Si le lien est perdu ou expiré, la même adresse ne peut pas être réinscrite (`This email is already registered`). Il faut alors utiliser une autre adresse.

---

Retour à la [documentation principale](../README.md).
