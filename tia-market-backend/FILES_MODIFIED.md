# 📋 LISTE DES FICHIERS MODIFIÉS - Système Premium TIA Market

## Date: 2026-01-26

---

## ✅ FICHIERS CRÉÉS / MODIFIÉS

### 1. `/tia-market-backend/db/db.sql` ⭐ **FICHIER PRINCIPAL**
**Statut:** COMPLÈTEMENT RÉÉCRIT

**Modifications majeures:**
- Ajout de types ENUM pour les packs premium (`premium_pack`) et badges (`badge_type`)
- Table `users` étendue avec:
  - `premium_pack` (simple, starter, pro, entreprise)
  - `badge` (none, verified_seller, premium_business)
  - Compteurs: `ads_count`, `featured_ads_used`, `ad_modifications_used`, `boost_count_used`
  - Support compte entreprise: `is_company_account`, `company_owner_id`
  
- Table `user_profiles` avec système de notation:
  - `rating` (note initiale 2.5)
  - `total_ratings`, `rating_sum`

- Table `ads` étendue avec:
  - `quantity` (quantité disponible)
  - `is_featured`, `featured_until`, `featured_days`
  - `modification_count`, `boost_count`, `last_boosted_at`
  - `rating_avg`, `rating_count`

- **NOUVELLES TABLES:**
  - `company_members` - Gestion équipe entreprise (5 membres max)
  - `ad_comments` - Commentaires sur annonces avec notation (1-5 étoiles)
  - `user_ratings` - Notation entre utilisateurs (1-5 étoiles)
  - `boost_payments` - Paiements de remontée d'annonces
  - `ad_statistics` - Statistiques détaillées (Pro/Entreprise)

- **TRIGGERS AUTOMATIQUES:**
  - `update_user_rating()` - Calcul note moyenne utilisateur
  - `update_ad_rating()` - Calcul note moyenne annonce

- **DONNÉES DE TEST:**
  - 4 utilisateurs avec différents packs (simple, starter, pro, entreprise)
  - Profils avec note initiale 2.5

---

### 2. `/tia-market-backend/premiumLimits.js` 🆕 **NOUVEAU FICHIER**
**Statut:** CRÉÉ

**Contenu:**
- Constantes `PREMIUM_PACKS` et `BADGE_TYPES`
- Objet `PACK_LIMITS` avec toutes les limitations par pack:
  
  **Pack SIMPLE:**
  - 1 quantité, 3 photos, 5 annonces simultanées
  - Remontée payante: 2000 Ar (1x), 8000 Ar (5x)
  - Durée vie annonce: 30 jours
  
  **Pack STARTER:**
  - 10 quantités, 10 photos, 20 annonces
  - 5 featured de 7 jours, 5 modifications
  
  **Pack PRO:**
  - 20 quantités, 20 photos (illimité pour 10 annonces)
  - 50 annonces, 10 featured de 14 jours
  - 15 modifications, 5 remontées gratuites
  - Badge "Vendeur Vérifié"
  - Statistiques détaillées
  
  **Pack ENTREPRISE:**
  - TOUT ILLIMITÉ
  - Badge "Entreprise Premium"
  - 5 membres d'équipe
  - Statistiques détaillées

- Classe `PackLimitChecker` avec méthodes:
  - `canCreateAd()`, `canUploadPhoto()`, `canModifyAd()`
  - `canFeatureAd()`, `canBoostForFree()`, `canAddTeamMember()`
  - `getLimits()`, `getBoostPrice()`, `getErrorMessage()`

---

### 3. `/tia-market-backend/premiumRoutes.js` 🆕 **NOUVEAU FICHIER**
**Statut:** CRÉÉ

**Routes API créées:**

1. `GET /api/user/pack-limits` - Récupérer limites et usage du pack
2. `POST /api/ads/:adId/comments` - Commenter et noter une annonce (1-5 étoiles)
3. `GET /api/ads/:adId/comments` - Liste des commentaires d'une annonce
4. `POST /api/users/:userId/rate` - Noter un utilisateur (1-5 étoiles)
5. `POST /api/ads/:adId/feature` - Mettre une annonce à la une
6. `POST /api/ads/:adId/boost` - Remonter une annonce (gratuit ou payant)
7. `GET /api/ads/:adId/statistics` - Statistiques détaillées (Pro/Entreprise)
8. `POST /api/company/members` - Ajouter un membre à l'équipe (Entreprise)
9. `DELETE /api/company/members/:memberId` - Retirer un membre
10. `GET /api/company/members` - Liste des membres de l'équipe

**Fonctionnalités:**
- Vérification des limites par pack avant chaque action
- Gestion des compteurs automatique
- Messages d'erreur explicites
- Intégration avec `PackLimitChecker`

---

### 4. `/tia-market-backend/PREMIUM_SYSTEM_DOCUMENTATION.md` 🆕 **NOUVEAU FICHIER**
**Statut:** CRÉÉ

**Contenu:**
- Documentation complète du système premium
- Détails de chaque pack avec caractéristiques
- Explication du système de notation (2.5 initial, 1-5 étoiles)
- Système de commentaires
- Système de statistiques
- Système multi-utilisateurs
- Système de remontée payante
- Structure des tables
- Fonctions et triggers
- Checklist d'implémentation
- Ordre de prestige des packs

---

## 🔧 FICHIERS À MODIFIER ENSUITE

### 5. `/tia-market-backend/server.js` ⚠️ **À METTRE À JOUR**
**Modifications nécessaires:**

1. Importer les nouveaux modules:
```javascript
const { initPremiumRoutes } = require('./premiumRoutes');
const { PackLimitChecker, PREMIUM_PACKS } = require('./premiumLimits');
```

2. Initialiser les routes premium:
```javascript
// Après les autres routes
initPremiumRoutes(app, pool, authenticateToken);
```

3. Modifier la route `POST /api/ads` pour:
   - Vérifier `canCreateAd()` avant création
   - Vérifier `isValidQuantity()` pour la quantité
   - Incrémenter `ads_count` dans users

4. Modifier la route `POST /api/ads/images` pour:
   - Vérifier `canUploadPhoto()` avant upload
   - Limiter selon le pack

5. Modifier la route `PUT /api/ads/:id` pour:
   - Vérifier `canModifyAd()` avant modification
   - Incrémenter `modification_count` dans ads
   - Incrémenter `ad_modifications_used` dans users

6. Modifier `GET /api/profile` pour:
   - Inclure `premium_pack`, `badge`
   - Inclure les compteurs d'usage

7. Ajouter middleware pour vérifier les limites:
```javascript
async function checkAdLimits(req, res, next) {
  // Vérifier les limites selon l'action
}
```

---

## 📊 MIGRATIONS À EXÉCUTER

### Migration de la base de données:
```bash
# Se connecter à PostgreSQL
psql -U postgres

# Exécuter le nouveau schéma
\i /path/to/tia-market-backend/db/db.sql
```

**⚠️ ATTENTION:** Cette migration va:
- Supprimer la base de données existante (`DROP DATABASE`)
- Recréer toutes les tables
- Perdre les données existantes

**Pour migration sans perte de données:**
- Créer un fichier de migration séparé
- Faire un backup de la base actuelle
- Exécuter les `ALTER TABLE` au lieu de `DROP/CREATE`

---

## 🎯 ORDRE D'IMPLÉMENTATION RECOMMANDÉ

1. ✅ **db.sql** - FAIT
2. ✅ **premiumLimits.js** - FAIT
3. ✅ **premiumRoutes.js** - FAIT
4. ✅ **PREMIUM_SYSTEM_DOCUMENTATION.md** - FAIT
5. ⏳ **Migrer la base de données** - À FAIRE PAR VOUS
6. ⏳ **Modifier server.js** - À FAIRE
7. ⏳ **Tester les routes API** - À FAIRE
8. ⏳ **Mettre à jour le frontend mobile** - À FAIRE

---

## 📝 NOTES IMPORTANTES

### Système de notation:
- **Note initiale**: 2.5 étoiles pour tous les nouveaux utilisateurs
- **Calcul automatique**: Via triggers SQL
- **Un commentaire par annonce**: Contrainte UNIQUE
- **Une note par utilisateur**: Pour éviter les abus

### Packs premium:
- **Ordre de prestige**: Entreprise > Pro > Starter > Simple
- **Illimité = -1**: Dans le code, -1 signifie illimité
- **Badges automatiques**: Assignés selon le pack

### Remontées:
- **Simple**: Toujours payant (2000 Ar ou 8000 Ar)
- **Pro**: 5 gratuits, puis payant
- **Entreprise**: Toujours gratuit et illimité

### Statistiques:
- **Uniquement Pro et Entreprise**
- **Stockage quotidien**: Table `ad_statistics`
- **Données**: vues, favoris, messages, vues téléphone

### Multi-utilisateurs:
- **Uniquement pack Entreprise**
- **Maximum 5 membres**
- **Permissions configurables**: poster, éditer, gérer membres

---

## 🐛 À TESTER

1. Création d'annonce avec vérification des limites
2. Upload de photos avec limite par pack
3. Modification d'annonce avec compteur
4. Mise à la une avec durée selon pack
5. Remontée gratuite/payante selon pack
6. Commentaires avec notation 1-5 étoiles
7. Notation utilisateur avec note initiale 2.5
8. Ajout/retrait membres équipe (Entreprise)
9. Statistiques détaillées (Pro/Entreprise)
10. Messages d'erreur explicites pour chaque limite

---

## 📞 CONTACT / QUESTIONS

Si vous avez des questions sur l'implémentation:
1. Lisez `PREMIUM_SYSTEM_DOCUMENTATION.md`
2. Vérifiez `premiumLimits.js` pour les constantes
3. Consultez `premiumRoutes.js` pour les exemples d'utilisation
4. Examinez `db.sql` pour la structure exacte

---

## ✅ RÉSUMÉ

**Fichiers créés:** 3 (premiumLimits.js, premiumRoutes.js, PREMIUM_SYSTEM_DOCUMENTATION.md)  
**Fichiers modifiés:** 1 (db.sql - complètement réécrit)  
**Fichiers à modifier:** 1 (server.js - à mettre à jour)  

**Tables créées:** 5  
**Tables modifiées:** 3  
**Routes API ajoutées:** 10  
**Fonctions SQL:** 3  
**Triggers SQL:** 5  

**Système de notation:** ⭐⭐⭐⭐⭐ (1-5 étoiles, note initiale 2.5)  
**Packs premium:** 4 (Simple, Starter, Pro, Entreprise)  
**Multi-utilisateurs:** ✅ (5 max pour Entreprise)  
**Statistiques:** ✅ (Pro et Entreprise)  
**Remontée payante:** ✅ (2000 Ar / 8000 Ar)  

---

**Date de création:** 2026-01-26  
**Créé par:** Assistant IA  
**Projet:** TIA Market - Système Premium Complet
