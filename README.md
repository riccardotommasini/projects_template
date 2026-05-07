# MIAM

![Insalogo](./images/logo-insa_0.png)

Template by [Riccardo Tommasini](riccardotommasini.com/) from [INSA Lyon](https://www.insa-lyon.fr/).

**Équipe :** William Barran · Arnaud Malle · Ashwine Trivaroul · Élodie Duverger · Nathan Vanneste · Paul Charpentier

---

## Description

MIAM est une application mobile de partage de recettes. Elle permet de découvrir des recettes, d'en créer, de les partager avec ses amis et de planifier ses courses en groupe.

## Fonctionnalités

- **Authentification** — Inscription et connexion via Supabase Auth (email + mot de passe)
- **Création de recettes** — Formulaire complet avec ingrédients, étapes, tags, photo et temps de préparation
- **Fil d'actualité** — Recettes récentes des amis, recommandations personnalisées (cold start avec recettes seed) et découverte, filtrables par tags
- **Recherche** — Recherche par nom de recette ou d'ingrédient (insensible aux accents et ligatures)
- **Amis** — Envoi/acceptation/refus de demandes d'amis ; les demandes refusées peuvent être renvoyées
- **Groupes** — Collections collaboratives de recettes avec liste de courses partagée ; ajout de ses propres recettes ou recettes enregistrées
- **Recettes enregistrées** — Marque-pages personnels sur les recettes d'autres utilisateurs
- **Avis & commentaires** — Notes étoilées et commentaires threadés (avec réponses) sur les recettes
- **Préférences** — Tags favoris utilisés pour personnaliser les recommandations
- **Dictée vocale** — Saisie par la voix pour créer une recette

## Architecture

```
MIAM/
├── frontend/     # Application mobile Expo / React Native
└── backend/      # API REST NestJS + Prisma + Supabase
```

## Prérequis

- [Node.js](https://nodejs.org/) v20 ou supérieur
- npm
- [Expo Go](https://expo.dev/client) sur iOS ou Android
- Un projet [Supabase](https://supabase.com) (base de données + auth + storage)
- Les fichiers `.env` — demander à un membre de l'équipe

## Démarrage rapide

### 1. Cloner le dépôt

```bash
git clone https://github.com/nathanvanneste/MIAM.git
cd MIAM
```

### 2. Lancer le backend

```bash
cd backend
npm install
cp .env.example .env   # remplir les valeurs
npx prisma generate
npm run start:dev
```

L'API tourne sur `http://localhost:3000`.

### 3. Exposer l'API (accès mobile)

```bash
cloudflared tunnel --url http://localhost:3000
```

Copier l'URL générée et la renseigner dans `frontend/.env` (`EXPO_PUBLIC_API_URL`).

### 4. Lancer le frontend

```bash
cd frontend
npm install
cp .env.example .env   # remplir les valeurs
npm run start:tunnel   # WSL
# ou
npx expo start         # hors WSL
```

Scanner le QR code avec l'Appareil photo (iOS) ou Expo Go (Android).

> Pour les détails complets de chaque partie, voir les README dans `/frontend` et `/backend`.

## Stack technique

| Couche | Technologies |
|---|---|
| Mobile | Expo · React Native · TypeScript · Expo Router |
| Backend | NestJS · TypeScript · Prisma ORM |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (photos recettes et avatars) |

## Licence

[MIT](https://opensource.org/licenses/MIT)
