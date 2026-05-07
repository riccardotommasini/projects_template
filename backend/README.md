# MIAM — Backend

API REST développée avec **NestJS** et **TypeScript**, connectée à **Supabase** (PostgreSQL + Auth + Storage) via **Prisma**.

## Prérequis

- [Node.js](https://nodejs.org/) v20 ou supérieur
- npm
- Un projet [Supabase](https://supabase.com) (base de données + auth + storage)

## Variables d'environnement

```bash
cp .env.example .env
```

```env
PORT=3000
DATABASE_URL=postgresql://...          # URL de connexion directe Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # Ne jamais exposer publiquement
```

Les clés Supabase sont disponibles sur [supabase.com](https://supabase.com) → votre projet → **Settings → API**.

## Installation

```bash
npm install
npx prisma generate     # Génère le client Prisma (nécessite Node 20+)
npx prisma db push      # Applique le schéma sur la base (première fois ou après modification)
```

## Lancer le serveur

```bash
npm run start:dev    # Mode développement avec hot reload
npm run start:prod   # Mode production (après npm run build)
```

L'API est disponible sur `http://localhost:3000`.

## Exposer l'API pour les appareils mobiles

Expo Go ne peut pas accéder à `localhost` depuis un téléphone. Utiliser un tunnel Cloudflare :

```bash
# Installation (une seule fois)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Lancement (dans un terminal séparé, après avoir démarré le backend)
cloudflared tunnel --url http://localhost:3000
```

Une URL publique est générée (ex : `https://xxxx.trycloudflare.com`). La renseigner dans `frontend/.env` (`EXPO_PUBLIC_API_URL`).

> L'URL change à chaque lancement du tunnel. Le terminal doit rester ouvert.

## Tests

```bash
npm run test          # Tests unitaires
npm run test:e2e      # Tests end-to-end
npm run test:cov      # Couverture de code
```

## Architecture

```
src/
├── auth/                     # Vérification des tokens JWT Supabase
├── prisma/                   # Service Prisma (connexion DB)
├── data/                     # Recettes seed (cold start) + SeedRecipesService
├── recipes/                  # Recettes : CRUD, feed, recommandations, avis, commentaires
│   └── dto/                  # Validation des données entrantes
├── ingredients/              # Ingrédients et recherche insensible aux accents
├── users/                    # Utilisateurs, amis, recettes enregistrées, préférences
│   └── dto/
├── groups/                   # Groupes collaboratifs et membres
│   └── dto/
├── tags/                     # Tags de recettes
├── shopping-lists/           # Listes de courses partagées par groupe
├── app.module.ts
└── main.ts
```

## Principaux endpoints

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/auth/register` | Inscription |
| `GET` | `/users/me` | Profil de l'utilisateur connecté |
| `GET` | `/users/me/friends` | Liste d'amis |
| `POST` | `/users/me/friendships` | Envoyer une demande d'ami |
| `GET` | `/recipes/feed` | Fil d'actualité (recettes amis) |
| `GET` | `/recipes/recommendations` | Recommandations personnalisées (seed) |
| `GET` | `/recipes/:id` | Détail d'une recette |
| `POST` | `/recipes` | Créer une recette |
| `GET` | `/recipes/:id/comments` | Commentaires d'une recette |
| `POST` | `/recipes/:id/comments` | Ajouter un commentaire |
| `POST` | `/recipes/:id/reviews` | Noter une recette |
| `GET` | `/ingredients?search=xxx` | Recherche d'ingrédients (insensible aux accents) |
| `GET` | `/groups/me` | Groupes de l'utilisateur |
| `POST` | `/groups/:id/recipes` | Ajouter une recette à un groupe |
| `GET` | `/tags` | Liste de tous les tags |

Toutes les routes sont protégées par JWT (`Authorization: Bearer <token>`) sauf mention contraire.

## Stack technique

| Outil | Rôle |
|---|---|
| NestJS | Framework backend Node.js |
| TypeScript | Typage statique |
| Prisma | ORM — modèles, migrations, requêtes DB |
| Supabase | PostgreSQL + Auth JWT + Storage |
| class-validator | Validation des DTOs |
| Cloudflared | Tunnel pour exposer l'API en développement |
