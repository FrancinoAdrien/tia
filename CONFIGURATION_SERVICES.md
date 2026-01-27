# 🔧 CONFIGURATION DES SERVICES EXTERNES

Ce document explique comment configurer les services externes pour l'application TIA Market.

## 📋 Table des matières
1. [Google OAuth Configuration](#google-oauth)
2. [Vérification Email](#verification-email)
3. [Vérification SMS](#verification-sms)
4. [Variables d'environnement](#variables-environnement)

---

## 🔐 Google OAuth Configuration {#google-oauth}

### Étape 1 : Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API "Google+ API" et "Google OAuth2 API"

### Étape 2 : Créer des identifiants OAuth 2.0

1. Dans le menu, allez à **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **OAuth client ID**
3. Choisissez le type d'application :
   - **Application type** : Web application (pour le backend)
   - **Application type** : Android/iOS (pour l'app mobile)

4. **Pour Web Application** :
   - **Nom** : TIA Market Backend
   - **Authorized redirect URIs** : 
     - `http://localhost:3001/api/auth/google/callback`
     - `https://votre-domaine.com/api/auth/google/callback` (en production)

5. **Pour Android** :
   - **Package name** : com.votre.tiamarket
   - **SHA-1 certificate fingerprint** : Obtenu avec `keytool -list -v -keystore ~/.android/debug.keystore`

6. **Pour iOS** :
   - **Bundle ID** : com.votre.tiamarket
   - **App Store ID** : (si déjà publié)

### Étape 3 : Configurer Expo pour Google OAuth

Pour une application React Native/Expo :

```bash
# Installer les dépendances
npm install @react-native-google-signin/google-signin
npm install expo-auth-session expo-random
```

### Étape 4 : Variables d'environnement

Ajoutez dans votre fichier `.env` :

```env
# Google OAuth
GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre-client-secret
GOOGLE_REDIRECT_URI=http://192.168.x.x:3001/api/auth/google/callback

# Pour Android
GOOGLE_ANDROID_CLIENT_ID=votre-android-client-id.apps.googleusercontent.com

# Pour iOS  
GOOGLE_IOS_CLIENT_ID=votre-ios-client-id.apps.googleusercontent.com
```

### Étape 5 : Configuration Expo (app.json)

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "plugins": [
      "@react-native-google-signin/google-signin"
    ]
  }
}
```

---

## 📧 Vérification Email {#verification-email}

### Option 1 : SendGrid (Recommandé)

**Avantages** : Gratuit jusqu'à 100 emails/jour, facile à configurer

1. Créez un compte sur [SendGrid](https://sendgrid.com/)
2. Allez dans **Settings** > **API Keys**
3. Créez une nouvelle API Key avec permissions "Mail Send"
4. Vérifiez votre domaine d'envoi (ou utilisez un email vérifié)

**Variables d'environnement** :
```env
# SendGrid
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@tia-market.mg
EMAIL_FROM_NAME=TIA Market
```

### Option 2 : Nodemailer avec Gmail

**Note** : Nécessite un mot de passe d'application Gmail

1. Activez la validation en 2 étapes sur votre compte Gmail
2. Générez un "Mot de passe d'application" : [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Utilisez ce mot de passe dans la configuration

**Variables d'environnement** :
```env
# Gmail SMTP
EMAIL_PROVIDER=gmail
GMAIL_USER=votre-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_FROM=noreply@tia-market.mg
```

### Option 3 : Service SMTP personnalisé

```env
# SMTP Personnalisé
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.votre-serveur.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-utilisateur
SMTP_PASSWORD=votre-mot-de-passe
EMAIL_FROM=noreply@tia-market.mg
```

### Template d'email de vérification

Le backend générera automatiquement un email avec :
- Un lien de vérification valide 24h
- Un design responsive
- Les informations de l'utilisateur

---

## 📱 Vérification SMS {#verification-sms}

### Option 1 : Twilio (Recommandé)

**Avantages** : Fiable, support international, $15 de crédit gratuit

1. Créez un compte sur [Twilio](https://www.twilio.com/)
2. Obtenez votre **Account SID** et **Auth Token**
3. Achetez un numéro de téléphone Twilio (ou utilisez le numéro de test)
4. Pour Madagascar, vérifiez la disponibilité des SMS

**Variables d'environnement** :
```env
# Twilio
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=votre-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Option 2 : African SMS Providers

Pour Madagascar et l'Afrique, considérez :

#### 2.1 Orange SMS API
```env
SMS_PROVIDER=orange
ORANGE_CLIENT_ID=votre-client-id
ORANGE_CLIENT_SECRET=votre-client-secret
ORANGE_SENDER=TIAMarket
```

#### 2.2 AfricaSMS
```env
SMS_PROVIDER=africasms
AFRICASMS_API_KEY=votre-api-key
AFRICASMS_SENDER=TIAMarket
```

### Option 3 : Mode Simulation (Développement)

Pour le développement, le système accepte n'importe quel code :

```env
# Mode simulation (DEV ONLY)
SMS_PROVIDER=simulation
SMS_SIMULATION_MODE=true
SMS_DEFAULT_CODE=123456  # Code qui fonctionne toujours
```

**⚠️ ATTENTION** : Désactivez le mode simulation en production !

---

## 🔑 Variables d'environnement complètes {#variables-environnement}

Créez un fichier `.env` à la racine du backend avec :

```env
# ============================================================================
# BASE DE DONNÉES
# ============================================================================
DB_USER=postgres
DB_HOST=localhost
DB_NAME=tia_market
DB_PASSWORD=votre-mot-de-passe
DB_PORT=5432

# ============================================================================
# JWT & SÉCURITÉ
# ============================================================================
JWT_SECRET=votre-secret-jwt-tres-securise-changez-moi
JWT_EXPIRES_IN=7d

# ============================================================================
# GOOGLE OAUTH
# ============================================================================
GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre-client-secret
GOOGLE_REDIRECT_URI=http://192.168.x.x:3001/api/auth/google/callback
GOOGLE_ANDROID_CLIENT_ID=votre-android-client-id.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=votre-ios-client-id.apps.googleusercontent.com

# ============================================================================
# EMAIL (Choisissez UNE option)
# ============================================================================

# Option 1: SendGrid (Recommandé)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@tia-market.mg
EMAIL_FROM_NAME=TIA Market

# Option 2: Gmail
# EMAIL_PROVIDER=gmail
# GMAIL_USER=votre-email@gmail.com
# GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
# EMAIL_FROM=noreply@tia-market.mg

# Option 3: SMTP Personnalisé
# EMAIL_PROVIDER=smtp
# SMTP_HOST=smtp.votre-serveur.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=votre-utilisateur
# SMTP_PASSWORD=votre-mot-de-passe
# EMAIL_FROM=noreply@tia-market.mg

# ============================================================================
# SMS (Choisissez UNE option)
# ============================================================================

# Option 1: Twilio (Recommandé)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=votre-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Option 2: Orange SMS API
# SMS_PROVIDER=orange
# ORANGE_CLIENT_ID=votre-client-id
# ORANGE_CLIENT_SECRET=votre-client-secret
# ORANGE_SENDER=TIAMarket

# Option 3: Mode Simulation (DEV ONLY - Désactiver en production!)
# SMS_PROVIDER=simulation
# SMS_SIMULATION_MODE=true
# SMS_DEFAULT_CODE=123456

# ============================================================================
# SERVEUR
# ============================================================================
PORT=3001
NODE_ENV=development

# ============================================================================
# FRONTEND URL (pour les CORS et redirections)
# ============================================================================
FRONTEND_URL=exp://192.168.x.x:8081
WEB_FRONTEND_URL=http://localhost:3000

# ============================================================================
# UPLOAD & STOCKAGE
# ============================================================================
MAX_FILE_SIZE=10485760  # 10MB en bytes
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/webp
UPLOAD_DIR=./uploads
```

---

## 🚀 Démarrage rapide

### 1. Installation des dépendances

```bash
cd tia-market-backend
npm install
```

### 2. Configuration minimale pour développement

```env
# .env minimal pour développer
DB_USER=postgres
DB_HOST=localhost
DB_NAME=tia_market
DB_PASSWORD=
JWT_SECRET=dev-secret-key

# Mode simulation pour email et SMS
EMAIL_PROVIDER=simulation
SMS_PROVIDER=simulation
SMS_SIMULATION_MODE=true
```

### 3. Créer la base de données

```bash
psql -U postgres
CREATE DATABASE tia_market;
\c tia_market
\i db/schema.sql
```

### 4. Lancer le serveur

```bash
npm run dev
```

---

## 📝 Notes importantes

### Sécurité

1. **Ne committez JAMAIS le fichier .env** dans Git
2. Utilisez des secrets forts en production
3. Activez HTTPS en production
4. Limitez les tentatives de vérification (rate limiting)

### Coûts

| Service | Gratuit | Prix |
|---------|---------|------|
| SendGrid | 100 emails/jour | $15/mois pour 40k emails |
| Twilio | $15 crédit initial | $0.0075/SMS |
| Google OAuth | Gratuit | Gratuit |

### Mode Production

Avant de déployer en production :

1. ✅ Désactivez le mode simulation SMS
2. ✅ Configurez un vrai service d'email
3. ✅ Utilisez HTTPS
4. ✅ Configurez les domaines autorisés (CORS)
5. ✅ Activez le rate limiting
6. ✅ Sauvegardez régulièrement la base de données

---

## 🆘 Support

En cas de problème :

1. Vérifiez les logs du serveur
2. Testez les endpoints avec Postman
3. Vérifiez que les variables d'environnement sont correctes
4. Consultez la documentation officielle des services

---

**Dernière mise à jour** : 27 janvier 2026
**Version** : 2.0
