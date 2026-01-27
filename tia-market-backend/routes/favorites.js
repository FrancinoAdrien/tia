/**
 * Routes pour le système de favoris
 * - Ajouter/retirer une annonce des favoris
 * - Récupérer la liste des favoris d'un utilisateur
 * - Vérifier si une annonce est en favori
 */

const express = require('express');
const router = express.Router();

/**
 * Ajouter une annonce aux favoris
 * POST /api/favorites/:adId
 */
router.post('/:adId', async (req, res) => {
    const { adId } = req.params;
    const userId = req.user.userId;

    try {
        // Vérifier que l'annonce existe
        const adCheck = await req.db.query(
            'SELECT id, is_active FROM ads WHERE id = $1',
            [adId]
        );

        if (adCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }

        // Vérifier si déjà en favori
        const existingFav = await req.db.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND ad_id = $2',
            [userId, adId]
        );

        if (existingFav.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cette annonce est déjà dans vos favoris'
            });
        }

        // Ajouter aux favoris
        const result = await req.db.query(
            `INSERT INTO favorites (user_id, ad_id) 
             VALUES ($1, $2) 
             RETURNING *`,
            [userId, adId]
        );

        console.log('⭐ Favori ajouté:', userId, adId);

        res.status(201).json({
            success: true,
            message: 'Annonce ajoutée aux favoris',
            favorite: {
                userId: result.rows[0].user_id,
                adId: result.rows[0].ad_id,
                createdAt: result.rows[0].created_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur ajout favori:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'ajout aux favoris'
        });
    }
});

/**
 * Retirer une annonce des favoris
 * DELETE /api/favorites/:adId
 */
router.delete('/:adId', async (req, res) => {
    const { adId } = req.params;
    const userId = req.user.userId;

    try {
        // Vérifier si l'annonce est en favori
        const existingFav = await req.db.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND ad_id = $2',
            [userId, adId]
        );

        if (existingFav.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cette annonce n\'est pas dans vos favoris'
            });
        }

        // Retirer des favoris
        await req.db.query(
            'DELETE FROM favorites WHERE user_id = $1 AND ad_id = $2',
            [userId, adId]
        );

        console.log('⭐ Favori retiré:', userId, adId);

        res.json({
            success: true,
            message: 'Annonce retirée des favoris'
        });

    } catch (error) {
        console.error('❌ Erreur suppression favori:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression du favori'
        });
    }
});

/**
 * Toggle favori (ajouter si absent, retirer si présent)
 * POST /api/favorites/:adId/toggle
 */
router.post('/:adId/toggle', async (req, res) => {
    const { adId } = req.params;
    const userId = req.user.userId;

    try {
        // Vérifier que l'annonce existe
        const adCheck = await req.db.query(
            'SELECT id, is_active FROM ads WHERE id = $1',
            [adId]
        );

        if (adCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }

        // Vérifier si déjà en favori
        const existingFav = await req.db.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND ad_id = $2',
            [userId, adId]
        );

        if (existingFav.rows.length > 0) {
            // Retirer des favoris
            await req.db.query(
                'DELETE FROM favorites WHERE user_id = $1 AND ad_id = $2',
                [userId, adId]
            );

            console.log('⭐ Favori retiré (toggle):', userId, adId);

            return res.json({
                success: true,
                action: 'removed',
                isFavorite: false,
                message: 'Annonce retirée des favoris'
            });
        } else {
            // Ajouter aux favoris
            await req.db.query(
                'INSERT INTO favorites (user_id, ad_id) VALUES ($1, $2)',
                [userId, adId]
            );

            console.log('⭐ Favori ajouté (toggle):', userId, adId);

            return res.json({
                success: true,
                action: 'added',
                isFavorite: true,
                message: 'Annonce ajoutée aux favoris'
            });
        }

    } catch (error) {
        console.error('❌ Erreur toggle favori:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du basculement du favori'
        });
    }
});

/**
 * Récupérer tous les favoris de l'utilisateur
 * GET /api/favorites
 */
router.get('/', async (req, res) => {
    const userId = req.user.userId;
    const { limit = 20, offset = 0, categoryId } = req.query;

    try {
        let query = `
            SELECT 
                a.*,
                u.first_name,
                u.last_name,
                u.premium_pack,
                u.badge,
                up.avatar_url as user_avatar,
                up.rating as user_rating,
                c.name as category_name,
                c.slug as category_slug,
                c.icon as category_icon,
                c.color as category_color,
                (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image,
                f.created_at as favorited_at,
                COALESCE(
                    (SELECT ARRAY_AGG(image_url ORDER BY is_primary DESC, position ASC)
                     FROM ad_images WHERE ad_id = a.id),
                    ARRAY[]::TEXT[]
                ) as all_images
            FROM favorites f
            JOIN ads a ON f.ad_id = a.id
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.id
            LEFT JOIN categories c ON a.category_id = c.id
            WHERE f.user_id = $1
        `;

        const params = [userId];
        let paramIndex = 2;

        // Filtre par catégorie si fourni
        if (categoryId) {
            query += ` AND a.category_id = $${paramIndex}`;
            params.push(categoryId);
            paramIndex++;
        }

        query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await req.db.query(query, params);

        // Compter le total
        let countQuery = 'SELECT COUNT(*) as total FROM favorites f JOIN ads a ON f.ad_id = a.id WHERE f.user_id = $1';
        const countParams = [userId];

        if (categoryId) {
            countQuery += ' AND a.category_id = $2';
            countParams.push(categoryId);
        }

        const countResult = await req.db.query(countQuery, countParams);

        res.json({
            success: true,
            favorites: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: parseFloat(ad.price),
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                postalCode: ad.postal_code,
                quantity: ad.quantity,
                soldQuantity: ad.sold_quantity,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                isUrgent: ad.is_urgent,
                viewCount: ad.view_count,
                ratingAvg: parseFloat(ad.rating_avg),
                ratingCount: ad.rating_count,
                createdAt: ad.created_at,
                updatedAt: ad.updated_at,
                expiresAt: ad.expires_at,
                favoritedAt: ad.favorited_at,
                user: {
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                    premiumPack: ad.premium_pack,
                    badge: ad.badge,
                    avatar: ad.user_avatar,
                    rating: parseFloat(ad.user_rating)
                },
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug,
                    icon: ad.category_icon,
                    color: ad.category_color
                },
                primaryImage: ad.primary_image,
                images: ad.all_images,
                isFavorite: true
            })),
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('❌ Erreur récupération favoris:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des favoris'
        });
    }
});

/**
 * Vérifier si une annonce est en favori
 * GET /api/favorites/:adId/check
 */
router.get('/:adId/check', async (req, res) => {
    const { adId } = req.params;
    const userId = req.user.userId;

    try {
        const result = await req.db.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND ad_id = $2',
            [userId, adId]
        );

        res.json({
            success: true,
            isFavorite: result.rows.length > 0,
            adId: adId
        });

    } catch (error) {
        console.error('❌ Erreur vérification favori:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification du favori'
        });
    }
});

/**
 * Vérifier le statut favori de plusieurs annonces
 * POST /api/favorites/check-multiple
 */
router.post('/check-multiple', async (req, res) => {
    const { adIds } = req.body;
    const userId = req.user.userId;

    if (!Array.isArray(adIds) || adIds.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'adIds doit être un tableau non vide'
        });
    }

    try {
        const result = await req.db.query(
            'SELECT ad_id FROM favorites WHERE user_id = $1 AND ad_id = ANY($2)',
            [userId, adIds]
        );

        const favoriteAdIds = result.rows.map(row => row.ad_id);

        res.json({
            success: true,
            favorites: adIds.reduce((acc, adId) => {
                acc[adId] = favoriteAdIds.includes(adId);
                return acc;
            }, {})
        });

    } catch (error) {
        console.error('❌ Erreur vérification multiple favoris:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification des favoris'
        });
    }
});

/**
 * Supprimer tous les favoris de l'utilisateur
 * DELETE /api/favorites/all
 */
router.delete('/all', async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await req.db.query(
            'DELETE FROM favorites WHERE user_id = $1 RETURNING ad_id',
            [userId]
        );

        console.log('⭐ Tous les favoris supprimés pour:', userId);

        res.json({
            success: true,
            message: 'Tous les favoris ont été supprimés',
            count: result.rows.length
        });

    } catch (error) {
        console.error('❌ Erreur suppression tous favoris:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression des favoris'
        });
    }
});

module.exports = router;
