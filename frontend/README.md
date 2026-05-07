# MIAM — Frontend Mobile

Application mobile développée avec **Expo**, **React Native** et **TypeScript**.

## Prérequis

- [Node.js](https://nodejs.org/) v20 ou supérieur
- npm
- [Expo Go](https://expo.dev/client) installé sur votre téléphone (iOS ou Android)
- Backend lancé et accessible (voir `backend/README.md`)

## Variables d'environnement

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_API_URL=https://xxxx.trycloudflare.com   # URL du backend (tunnel Cloudflare)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

> `EXPO_PUBLIC_API_URL` doit pointer vers le tunnel Cloudflare lancé côté backend. L'URL change à chaque lancement — ne pas mettre de `/` final.

## Installation

```bash
npm install
```

## Lancer l'application

```bash
# Sur WSL (recommandé)
npm run start:tunnel

# Hors WSL
npx expo start
```

Scanner le QR code avec :
- **iOS** — l'application Appareil photo
- **Android** — l'application Expo Go

## Architecture

```
src/
├── components/
│   ├── ui/              # Composants génériques réutilisables
│   │   ├── Recipe/      # RecipeCard, CommentSection, RecipeTabBar...
│   │   └── ...          # UserAvatar, SearchBar, TagChips, UnitDropdown...
│   └── features/        # Composants métier
│       ├── recipe/      # IngredientSearch, StepList
│       └── group/       # AddRecipeModal, AddMemberModal, CreateGroupModal
├── screens/             # Écrans de l'application
│   ├── FeedScreen       # Fil d'actualité avec filtres par tags
│   ├── RecipeScreen     # Détail recette (ingrédients, préparation, avis)
│   ├── CreateRecipeScreen
│   ├── ProfileScreen
│   ├── FriendsScreen
│   ├── InvitationsScreen
│   ├── GroupDetailScreen
│   └── ...
├── services/            # Appels API (un fichier par domaine)
│   ├── recipes.service.ts
│   ├── users.service.ts
│   ├── groups.service.ts
│   ├── friends.service.ts
│   └── ...
├── types/               # Types et interfaces TypeScript
├── constants/           # Couleurs, typographie, espacements, unités
├── utils/               # Fonctions utilitaires (normalize, search...)
└── config/              # Configuration API et Supabase
```

## Écrans principaux

| Écran | Description |
|---|---|
| Feed | Fil d'actualité : recettes des amis, recommandations, découverte — filtrable par tags |
| Recipe | Détail d'une recette avec onglets Ingrédients / Préparation / Avis |
| CreateRecipe | Création/édition de recette (ingrédients, étapes, tags, photo, dictée vocale) |
| Profile | Profil utilisateur, mes recettes, recettes enregistrées |
| Friends | Recherche d'utilisateurs et envoi de demandes d'amis |
| Invitations | Acceptation/refus des demandes reçues |
| Groups | Liste des groupes — recettes collaboratives et liste de courses |
| Preferences | Sélection de tags favoris pour les recommandations |

## Conventions

- Un écran = un fichier dans `src/screens/`
- Les composants sans logique métier vont dans `src/components/ui/`
- Les composants liés aux fonctionnalités vont dans `src/components/features/`
- Toute communication avec le backend passe par `src/services/`, jamais directement depuis un composant
- Les routes sont gérées par **Expo Router** (dossier `app/`)

## Stack technique

| Outil | Rôle |
|---|---|
| Expo | Build, déploiement et accès aux APIs natives |
| React Native | Framework mobile cross-platform (iOS + Android) |
| TypeScript | Typage statique |
| Expo Router | Navigation basée sur le système de fichiers |
| Supabase JS | Auth et storage côté client |
| Lucide React Native | Icônes |
