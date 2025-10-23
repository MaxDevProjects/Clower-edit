# Clower Edit V1

Clower Edit est un mini CMS artisanal permettant d'éditer des pages depuis une interface web légère et de générer un site statique en HTML. Le projet met l'accent sur la sobriété numérique : il s'appuie sur des fichiers JSON plats, des templates Nunjucks et un déploiement SFTP intégré.

## Fonctionnalités principales

- Interface d'administration construite avec TailwindCSS et Alpine.js
- Authentification basique via JWT et mot de passe haché avec bcrypt
- CRUD complet sur les fichiers JSON représentant les pages
- Génération statique HTML avec Nunjucks (`backend/generate.js`)
- Prévisualisation locale instantanée via BroadcastChannel
- Gestion et personnalisation du thème (couleurs, polices, rayons)
- Déploiement SFTP simplifié (`backend/deploy.js`)

## Prérequis

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## Scripts npm

- `npm run dev` : lance le serveur Express et la compilation Tailwind en mode watch
- `npm run build` : génère les assets CSS puis les pages HTML statiques
- `npm run deploy` : lit la configuration FTP/SFTP et publie le contenu du dossier `public/`

## Utilisation

1. Lancez le mode développement :
   ```bash
   npm run dev
   ```
2. Ouvrez `http://localhost:3000` et connectez-vous (identifiant : `admin`, mot de passe : `admin`).
3. Créez ou éditez vos pages. Chaque sauvegarde déclenche une régénération statique.
4. Modifiez les couleurs et polices dans l'onglet Thème.
5. Renseignez vos informations FTP/SFTP dans l'onglet Paramètres puis utilisez l'onglet Déploiement.

## Structure du projet

```
clower-edit/
├── admin/              # Interface d'administration
├── backend/            # API, génération statique et déploiement
├── public/             # Sortie HTML statique
├── server.js           # Serveur Express
├── tailwind.config.js  # Configuration Tailwind
└── package.json
```

## Déploiement

Le déploiement repose sur `ssh2-sftp-client`. Assurez-vous que votre serveur distant est accessible via SFTP et que les identifiants sont renseignés dans `backend/config/settings.json`. La commande `npm run deploy` génère automatiquement les pages avant l'envoi.

## Tests manuels recommandés

- Création, édition et suppression d'une page
- Vérification de la génération dans `public/`
- Changement de thème appliqué sur les pages générées
- Déploiement de test vers un serveur SFTP de préproduction

## Sécurité

Les identifiants administrateur sont stockés dans `backend/config/settings.json`. Modifiez-les dès la première utilisation. Les jetons JWT sont valides pendant 12 heures et sont stockés côté client dans `localStorage`.

## Licence

Projet fourni pour démonstration : adaptez et enrichissez selon vos besoins.
