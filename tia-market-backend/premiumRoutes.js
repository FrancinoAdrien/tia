// backend/premiumRoutes.js
// Routes pour gérer les fonctionnalités premium

const { PREMIUM_PACKS, BADGE_TYPES, PackLimitChecker } = require('./premiumLimits');

/**
 * Initialise toutes les routes premium
 * @param {Express.Application} app 
 * @param {Pool} pool - Instance de connexion PostgreSQL
 * @param {Function} authenticateToken - Middleware d'authentification
 */
function initPremiumRoutes(app, pool, authenticateToken) {

  // ==============================================================================
  // ROUTE: Obtenir les limites du pack de l'utilisateur
  // ==============================================================================
  app.get('/api/user/pack-limits', authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT premium_pack, ads_count, featured_ads_used, ad_modifications_used, boost_count_used
         FROM users WHERE id = $1`,
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      const user = result.rows[0];
      const limits = PackLimitChecker.getLimits(user.premium_pack);

      res.json({
        success: true,
        pack: user.premium_pack,
        limits: limits,
        usage: {
          ads_count: user.ads_count,
          featured_ads_used: user.featured_ads_used,
          ad_modifications_used: user.ad_modifications_used,
          boost_count_used: user.boost_count_used
        },
        remaining: {
          ads: limits.max_simultaneous_ads === -1 ? 'illimité' : limits.max_simultaneous_ads - user.ads_count,
          featured: limits.featured_count === -1 ? 'illimité' : limits.featured_count - user.featured_ads_used,
          boosts: limits.free_boosts === -1 ? 'illimité' : limits.free_boosts - user.boost_count_used
        }
      });
    } catch (error) {
      console.error('❌ Erreur récupération limites:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Commenter et noter une annonce
  // ==============================================================================
  app.post('/api/ads/:adId/comments', authenticateToken, async (req, res) => {
    try {
      const { adId } = req.params;
      const { comment, rating } = req.body;

      if (!comment || !rating) {
        return res.status(400).json({
          success: false,
          error: 'Le commentaire et la note sont requis'
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'La note doit être entre 1 et 5'
        });
      }

      // Vérifier que l'annonce existe
      const adCheck = await pool.query('SELECT id FROM ads WHERE id = $1', [adId]);
      if (adCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Annonce non trouvée' });
      }

      // Insérer le commentaire
      const result = await pool.query(
        `INSERT INTO ad_comments (ad_id, user_id, comment, rating)
         VALUES ($1, $2, $3, $4)
         RETURNING id, ad_id, user_id, comment, rating, is_approved, created_at`,
        [adId, req.user.userId, comment, rating]
      );

      res.json({
        success: true,
        message: 'Commentaire ajouté avec succès',
        comment: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({
          success: false,
          error: 'Vous avez déjà commenté cette annonce'
        });
      }
      console.error('❌ Erreur ajout commentaire:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Récupérer les commentaires d'une annonce
  // ==============================================================================
  app.get('/api/ads/:adId/comments', async (req, res) => {
    try {
      const { adId } = req.params;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const result = await pool.query(
        `SELECT 
          c.id, c.comment, c.rating, c.created_at,
          u.first_name, u.last_name,
          up.avatar_url
         FROM ad_comments c
         JOIN users u ON c.user_id = u.id
         LEFT JOIN user_profiles up ON u.id = up.id
         WHERE c.ad_id = $1 AND c.is_approved = true
         ORDER BY c.created_at DESC
         LIMIT $2 OFFSET $3`,
        [adId, limit, offset]
      );

      res.json({
        success: true,
        comments: result.rows
      });
    } catch (error) {
      console.error('❌ Erreur récupération commentaires:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Noter un utilisateur
  // ==============================================================================
  app.post('/api/users/:userId/rate', authenticateToken, async (req, res) => {
    try {
      const { userId } = req.params;
      const { rating, comment, transactionId } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Note invalide (doit être entre 1 et 5)'
        });
      }

      // Ne pas se noter soi-même
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          error: 'Vous ne pouvez pas vous noter vous-même'
        });
      }

      // Vérifier que l'utilisateur existe
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      // Insérer la note
      const result = await pool.query(
        `INSERT INTO user_ratings (rated_user_id, rater_user_id, rating, comment, transaction_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, rating, created_at`,
        [userId, req.user.userId, rating, comment || null, transactionId || null]
      );

      res.json({
        success: true,
        message: 'Note ajoutée avec succès',
        rating: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Vous avez déjà noté cet utilisateur'
        });
      }
      console.error('❌ Erreur ajout note:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Mettre une annonce à la une (featured)
  // ==============================================================================
  app.post('/api/ads/:adId/feature', authenticateToken, async (req, res) => {
    try {
      const { adId } = req.params;

      // Récupérer les infos utilisateur
      const userResult = await pool.query(
        'SELECT premium_pack, featured_ads_used FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      const user = userResult.rows[0];

      // Vérifier si l'utilisateur peut mettre à la une
      if (!PackLimitChecker.canFeatureAd(user.premium_pack, user.featured_ads_used)) {
        return res.status(403).json({
          success: false,
          error: PackLimitChecker.getErrorMessage(user.premium_pack, 'featured')
        });
      }

      // Vérifier que l'annonce appartient à l'utilisateur
      const adCheck = await pool.query(
        'SELECT id FROM ads WHERE id = $1 AND user_id = $2',
        [adId, req.user.userId]
      );

      if (adCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Annonce non trouvée ou non autorisée'
        });
      }

      // Calculer la date de fin
      const featuredDays = PackLimitChecker.getFeaturedDays(user.premium_pack);
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + featuredDays);

      // Mettre à jour l'annonce
      await pool.query(
        `UPDATE ads 
         SET is_featured = true, 
             featured_until = $1, 
             featured_days = featured_days + $2
         WHERE id = $3`,
        [featuredUntil, featuredDays, adId]
      );

      // Incrémenter le compteur utilisateur (sauf si illimité)
      if (user.premium_pack !== PREMIUM_PACKS.ENTREPRISE) {
        await pool.query(
          'UPDATE users SET featured_ads_used = featured_ads_used + 1 WHERE id = $1',
          [req.user.userId]
        );
      }

      res.json({
        success: true,
        message: 'Annonce mise à la une avec succès',
        featured_until: featuredUntil,
        days: featuredDays
      });
    } catch (error) {
      console.error('❌ Erreur mise à la une:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Remonter une annonce (boost)
  // ==============================================================================
  app.post('/api/ads/:adId/boost', authenticateToken, async (req, res) => {
    try {
      const { adId } = req.params;
      const { boostCount = 1 } = req.body; // 1 ou 5

      // Récupérer les infos utilisateur
      const userResult = await pool.query(
        'SELECT premium_pack, boost_count_used FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      const user = userResult.rows[0];

      // Vérifier si l'annonce appartient à l'utilisateur
      const adCheck = await pool.query(
        'SELECT id FROM ads WHERE id = $1 AND user_id = $2',
        [adId, req.user.userId]
      );

      if (adCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Annonce non trouvée ou non autorisée'
        });
      }

      // Vérifier si gratuit
      const isFree = PackLimitChecker.canBoostForFree(user.premium_pack, user.boost_count_used);
      const price = isFree ? 0 : PackLimitChecker.getBoostPrice(user.premium_pack, boostCount);

      // Si payant, créer un enregistrement de paiement
      if (!isFree && price > 0) {
        await pool.query(
          `INSERT INTO boost_payments (user_id, ad_id, amount, boost_count, payment_status)
           VALUES ($1, $2, $3, $4, 'completed')`,
          [req.user.userId, adId, price, boostCount]
        );
      }

      // Mettre à jour l'annonce
      await pool.query(
        `UPDATE ads 
         SET boost_count = boost_count + $1,
             last_boosted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [boostCount, adId]
      );

      // Incrémenter le compteur si gratuit (sauf illimité)
      if (isFree && user.premium_pack !== PREMIUM_PACKS.ENTREPRISE) {
        await pool.query(
          'UPDATE users SET boost_count_used = boost_count_used + $1 WHERE id = $2',
          [boostCount, req.user.userId]
        );
      }

      res.json({
        success: true,
        message: isFree ? 'Annonce remontée gratuitement' : 'Annonce remontée avec succès',
        cost: price,
        is_free: isFree,
        boost_count: boostCount
      });
    } catch (error) {
      console.error('❌ Erreur remontée annonce:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Récupérer les statistiques d'une annonce (Pro/Entreprise uniquement)
  // ==============================================================================
  app.get('/api/ads/:adId/statistics', authenticateToken, async (req, res) => {
    try {
      const { adId } = req.params;

      // Vérifier le pack de l'utilisateur
      const userResult = await pool.query(
        'SELECT premium_pack FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      const user = userResult.rows[0];

      if (!PackLimitChecker.hasDetailedStats(user.premium_pack)) {
        return res.status(403).json({
          success: false,
          error: 'Statistiques détaillées disponibles uniquement pour les packs Pro et Entreprise'
        });
      }

      // Vérifier que l'annonce appartient à l'utilisateur
      const adCheck = await pool.query(
        'SELECT id FROM ads WHERE id = $1 AND user_id = $2',
        [adId, req.user.userId]
      );

      if (adCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Annonce non trouvée ou non autorisée'
        });
      }

      // Récupérer les statistiques des 30 derniers jours
      const result = await pool.query(
        `SELECT date, views_count, favorites_count, messages_count, phone_views_count
         FROM ad_statistics
         WHERE ad_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY date DESC`,
        [adId]
      );

      res.json({
        success: true,
        statistics: result.rows
      });
    } catch (error) {
      console.error('❌ Erreur récupération statistiques:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Ajouter un membre à l'équipe (Pack Entreprise uniquement)
  // ==============================================================================
  app.post('/api/company/members', authenticateToken, async (req, res) => {
    try {
      const { userId, role = 'member', permissions = {} } = req.body;

      // Vérifier que l'utilisateur est un compte entreprise
      const userResult = await pool.query(
        'SELECT premium_pack, is_company_account FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      const user = userResult.rows[0];

      if (user.premium_pack !== PREMIUM_PACKS.ENTREPRISE) {
        return res.status(403).json({
          success: false,
          error: 'Cette fonctionnalité est réservée au pack Entreprise'
        });
      }

      // Compter les membres actuels
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM company_members WHERE company_account_id = $1',
        [req.user.userId]
      );

      const currentCount = parseInt(countResult.rows[0].count);

      if (!PackLimitChecker.canAddTeamMember(user.premium_pack, currentCount)) {
        return res.status(403).json({
          success: false,
          error: PackLimitChecker.getErrorMessage(user.premium_pack, 'team')
        });
      }

      // Vérifier que l'utilisateur à ajouter existe
      const memberCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (memberCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur à ajouter non trouvé' });
      }

      // Ajouter le membre
      const result = await pool.query(
        `INSERT INTO company_members (
          company_account_id, user_id, role, 
          can_post_ads, can_edit_ads, can_manage_members, added_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, company_account_id, user_id, role, added_at`,
        [
          req.user.userId,
          userId,
          role,
          permissions.can_post_ads !== false,
          permissions.can_edit_ads !== false,
          permissions.can_manage_members === true,
          req.user.userId
        ]
      );

      res.json({
        success: true,
        message: 'Membre ajouté avec succès',
        member: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Cet utilisateur est déjà membre de l\'équipe'
        });
      }
      console.error('❌ Erreur ajout membre:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Retirer un membre de l'équipe
  // ==============================================================================
  app.delete('/api/company/members/:memberId', authenticateToken, async (req, res) => {
    try {
      const { memberId } = req.params;

      // Vérifier les permissions
      const memberCheck = await pool.query(
        `SELECT cm.*, u.premium_pack
         FROM company_members cm
         JOIN users u ON cm.company_account_id = u.id
         WHERE cm.id = $1 AND cm.company_account_id = $2`,
        [memberId, req.user.userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Membre non trouvé ou non autorisé'
        });
      }

      // Supprimer le membre
      await pool.query('DELETE FROM company_members WHERE id = $1', [memberId]);

      res.json({
        success: true,
        message: 'Membre retiré avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur suppression membre:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ==============================================================================
  // ROUTE: Liste des membres de l'équipe
  // ==============================================================================
  app.get('/api/company/members', authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT 
          cm.id, cm.role, cm.can_post_ads, cm.can_edit_ads, cm.can_manage_members, cm.added_at,
          u.id as user_id, u.email, u.first_name, u.last_name,
          up.avatar_url
         FROM company_members cm
         JOIN users u ON cm.user_id = u.id
         LEFT JOIN user_profiles up ON u.id = up.id
         WHERE cm.company_account_id = $1
         ORDER BY cm.added_at DESC`,
        [req.user.userId]
      );

      res.json({
        success: true,
        members: result.rows
      });
    } catch (error) {
      console.error('❌ Erreur récupération membres:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  console.log('✅ Routes premium initialisées');
}

module.exports = { initPremiumRoutes };
