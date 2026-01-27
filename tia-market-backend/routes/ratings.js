/**
 * Routes pour le système de ratings et commentaires
 * - Ratings des annonces avec commentaires
 * - Ratings des utilisateurs
 * - Récupération des ratings et statistiques
 */

const express = require('express');
const router = express.Router();

/**
 * Ajouter un commentaire et rating sur une annonce
 * POST /api/ads/:adId/comments
 */
router.post('/:adId/comments', async (req, res) => {
    const { adId } = req.params;
    const { comment, rating } = req.body;
    const userId = req.user.userId;

    try {
        // Vérifier que l'annonce existe
        const adCheck = await req.db.query(
            'SELECT id, user_id FROM ads WHERE id = $1',
            [adId]
        );

        if (adCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }

        // Ne pas permettre de commenter sa propre annonce
        if (adCheck.rows[0].user_id === userId) {
            return res.status(403).json({
                success: false,
                error: 'Vous ne pouvez pas commenter votre propre annonce'
            });
        }

        // Valider le rating
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Le rating doit être entre 1 et 5'
            });
        }

        // Insérer le commentaire
        const result = await req.db.query(
            `INSERT INTO ad_comments (ad_id, user_id, comment, rating) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *, 
             (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = $2) as user_name,
             (SELECT avatar_url FROM user_profiles WHERE id = $2) as user_avatar`,
            [adId, userId, comment, rating]
        );

        const newComment = result.rows[0];

        console.log('✅ Commentaire ajouté sur annonce', adId);

        res.status(201).json({
            success: true,
            message: 'Commentaire ajouté avec succès',
            comment: {
                id: newComment.id,
                adId: newComment.ad_id,
                userId: newComment.user_id,
                userName: newComment.user_name,
                userAvatar: newComment.user_avatar,
                comment: newComment.comment,
                rating: newComment.rating,
                isApproved: newComment.is_approved,
                createdAt: newComment.created_at
            }
        });

    } catch (error) {
        // Si c'est une erreur de contrainte unique (utilisateur a déjà commenté)
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                error: 'Vous avez déjà commenté cette annonce'
            });
        }

        console.error('❌ Erreur ajout commentaire:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'ajout du commentaire'
        });
    }
});

/**
 * Récupérer les commentaires d'une annonce
 * GET /api/ads/:adId/comments
 */
router.get('/:adId/comments', async (req, res) => {
    const { adId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    try {
        const result = await req.db.query(
            `SELECT 
                ac.*,
                u.first_name || ' ' || u.last_name as user_name,
                up.avatar_url as user_avatar,
                up.rating as user_rating
             FROM ad_comments ac
             JOIN users u ON ac.user_id = u.id
             LEFT JOIN user_profiles up ON u.id = up.id
             WHERE ac.ad_id = $1 AND ac.is_approved = true
             ORDER BY ac.created_at DESC
             LIMIT $2 OFFSET $3`,
            [adId, limit, offset]
        );

        // Compter le total
        const countResult = await req.db.query(
            'SELECT COUNT(*) as total FROM ad_comments WHERE ad_id = $1 AND is_approved = true',
            [adId]
        );

        res.json({
            success: true,
            comments: result.rows.map(c => ({
                id: c.id,
                adId: c.ad_id,
                userId: c.user_id,
                userName: c.user_name,
                userAvatar: c.user_avatar,
                userRating: parseFloat(c.user_rating),
                comment: c.comment,
                rating: c.rating,
                createdAt: c.created_at,
                updatedAt: c.updated_at
            })),
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('❌ Erreur récupération commentaires:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des commentaires'
        });
    }
});

/**
 * Modifier un commentaire
 * PUT /api/ads/:adId/comments/:commentId
 */
router.put('/:adId/comments/:commentId', async (req, res) => {
    const { adId, commentId } = req.params;
    const { comment, rating } = req.body;
    const userId = req.user.userId;

    try {
        // Vérifier que le commentaire existe et appartient à l'utilisateur
        const commentCheck = await req.db.query(
            'SELECT * FROM ad_comments WHERE id = $1 AND ad_id = $2 AND user_id = $3',
            [commentId, adId, userId]
        );

        if (commentCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Commentaire non trouvé ou non autorisé'
            });
        }

        // Mettre à jour le commentaire
        const result = await req.db.query(
            `UPDATE ad_comments 
             SET comment = $1, rating = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [comment, rating, commentId]
        );

        res.json({
            success: true,
            message: 'Commentaire modifié avec succès',
            comment: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Erreur modification commentaire:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la modification du commentaire'
        });
    }
});

/**
 * Supprimer un commentaire
 * DELETE /api/ads/:adId/comments/:commentId
 */
router.delete('/:adId/comments/:commentId', async (req, res) => {
    const { adId, commentId } = req.params;
    const userId = req.user.userId;

    try {
        // Vérifier que le commentaire existe et appartient à l'utilisateur
        const commentCheck = await req.db.query(
            'SELECT * FROM ad_comments WHERE id = $1 AND ad_id = $2 AND user_id = $3',
            [commentId, adId, userId]
        );

        if (commentCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Commentaire non trouvé ou non autorisé'
            });
        }

        // Supprimer le commentaire
        await req.db.query('DELETE FROM ad_comments WHERE id = $1', [commentId]);

        res.json({
            success: true,
            message: 'Commentaire supprimé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur suppression commentaire:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression du commentaire'
        });
    }
});

/**
 * Noter un utilisateur
 * POST /api/users/:userId/rate
 */
router.post('/users/:userId/rate', async (req, res) => {
    const { userId: ratedUserId } = req.params;
    const { rating, comment, transactionId } = req.body;
    const raterUserId = req.user.userId;

    try {
        // Ne pas permettre de se noter soi-même
        if (ratedUserId === raterUserId) {
            return res.status(403).json({
                success: false,
                error: 'Vous ne pouvez pas vous noter vous-même'
            });
        }

        // Vérifier que l'utilisateur existe
        const userCheck = await req.db.query(
            'SELECT id FROM users WHERE id = $1',
            [ratedUserId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        // Valider le rating
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Le rating doit être entre 1 et 5'
            });
        }

        // Insérer le rating
        const result = await req.db.query(
            `INSERT INTO user_ratings (rated_user_id, rater_user_id, rating, comment, transaction_id) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [ratedUserId, raterUserId, rating, comment, transactionId || null]
        );

        console.log('✅ Rating ajouté pour utilisateur', ratedUserId);

        res.status(201).json({
            success: true,
            message: 'Notation ajoutée avec succès',
            rating: result.rows[0]
        });

    } catch (error) {
        // Si c'est une erreur de contrainte unique
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                error: 'Vous avez déjà noté cet utilisateur pour cette transaction'
            });
        }

        console.error('❌ Erreur ajout rating:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'ajout de la notation'
        });
    }
});

/**
 * Récupérer les ratings d'un utilisateur
 * GET /api/users/:userId/ratings
 */
router.get('/users/:userId/ratings', async (req, res) => {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    try {
        // Récupérer le profil avec les stats
        const profileResult = await req.db.query(
            'SELECT rating, total_ratings FROM user_profiles WHERE id = $1',
            [userId]
        );

        if (profileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const profile = profileResult.rows[0];

        // Récupérer les ratings
        const ratingsResult = await req.db.query(
            `SELECT 
                ur.*,
                u.first_name || ' ' || u.last_name as rater_name,
                up.avatar_url as rater_avatar
             FROM user_ratings ur
             JOIN users u ON ur.rater_user_id = u.id
             LEFT JOIN user_profiles up ON u.id = up.id
             WHERE ur.rated_user_id = $1
             ORDER BY ur.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({
            success: true,
            averageRating: parseFloat(profile.rating),
            totalRatings: profile.total_ratings,
            ratings: ratingsResult.rows.map(r => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                raterName: r.rater_name,
                raterAvatar: r.rater_avatar,
                createdAt: r.created_at
            })),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('❌ Erreur récupération ratings:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des notations'
        });
    }
});

module.exports = router;
