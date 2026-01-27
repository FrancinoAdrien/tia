/**
 * Routes pour les profils utilisateurs
 * - Récupération du profil avec badges premium
 * - Mise à jour du profil
 * - Statistiques utilisateur
 */

const express = require('express');
const router = express.Router();

/**
 * Récupérer le profil de l'utilisateur connecté
 * GET /api/profile/me
 */
router.get('/me', async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await req.db.query(`
            SELECT 
                u.*,
                up.avatar_url,
                up.city,
                up.bio,
                up.rating as profile_rating,
                up.total_ratings,
                w.balance as wallet_balance,
                (SELECT COUNT(*) FROM ads WHERE user_id = u.id AND is_active = true) as active_ads_count,
                (SELECT COUNT(*) FROM favorites WHERE user_id = u.id) as favorites_count,
                (SELECT COUNT(*) FROM conversations WHERE user1_id = u.id OR user2_id = u.id) as conversations_count
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.id
            LEFT JOIN wallet w ON u.id = w.user_id
            WHERE u.id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];

        // Déterminer le style premium selon le pack
        const premiumStyles = {
            'simple': {
                theme: 'basic',
                color: '#666666',
                borderColor: '#CCCCCC',
                bgGradient: 'linear-gradient(135deg, #F5F5F5 0%, #E0E0E0 100%)'
            },
            'starter': {
                theme: 'bronze',
                color: '#CD7F32',
                borderColor: '#D4A574',
                bgGradient: 'linear-gradient(135deg, #FFE4C4 0%, #DEB887 100%)',
                badge: '🥉 Starter'
            },
            'pro': {
                theme: 'silver',
                color: '#C0C0C0',
                borderColor: '#D3D3D3',
                bgGradient: 'linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 100%)',
                badge: '🥈 Pro',
                hasGlow: true
            },
            'entreprise': {
                theme: 'gold',
                color: '#FFD700',
                borderColor: '#FFA500',
                bgGradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                badge: '👑 Entreprise',
                hasGlow: true,
                hasAnimation: true
            }
        };

        const premiumStyle = premiumStyles[user.premium_pack] || premiumStyles['simple'];

        // Vérifier si le premium est actif
        const isPremiumActive = user.premium_end_date && new Date(user.premium_end_date) > new Date();

        res.json({
            success: true,
            profile: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                avatar: user.avatar_url,
                city: user.city,
                bio: user.bio,
                rating: parseFloat(user.profile_rating),
                totalRatings: user.total_ratings,
                
                // Informations premium
                premiumPack: user.premium_pack,
                badge: user.badge,
                isPremiumActive: isPremiumActive,
                premiumStartDate: user.premium_start_date,
                premiumEndDate: user.premium_end_date,
                premiumStyle: premiumStyle,
                
                // Vérifications
                isVerified: user.is_verified,
                emailVerified: user.email_verified,
                phoneVerified: user.phone_verified,
                
                // Compteurs
                activeAdsCount: parseInt(user.active_ads_count),
                favoritesCount: parseInt(user.favorites_count),
                conversationsCount: parseInt(user.conversations_count),
                adsCount: user.ads_count,
                
                // Wallet
                walletBalance: user.wallet_balance ? parseFloat(user.wallet_balance) : 0,
                points: user.points,
                credits: user.credits ? parseFloat(user.credits) : 0,
                
                // Dates
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération profil:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du profil'
        });
    }
});

/**
 * Récupérer le profil public d'un utilisateur
 * GET /api/profile/:userId
 */
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await req.db.query(`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.premium_pack,
                u.badge,
                u.is_verified,
                u.premium_end_date,
                u.created_at,
                up.avatar_url,
                up.city,
                up.bio,
                up.rating,
                up.total_ratings,
                (SELECT COUNT(*) FROM ads WHERE user_id = u.id AND is_active = true) as active_ads_count
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.id
            WHERE u.id = $1 AND u.is_active = true
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];

        // Déterminer le style premium
        const premiumStyles = {
            'simple': {
                theme: 'basic',
                color: '#666666'
            },
            'starter': {
                theme: 'bronze',
                color: '#CD7F32',
                badge: '🥉 Starter'
            },
            'pro': {
                theme: 'silver',
                color: '#C0C0C0',
                badge: '🥈 Pro'
            },
            'entreprise': {
                theme: 'gold',
                color: '#FFD700',
                badge: '👑 Entreprise'
            }
        };

        const premiumStyle = premiumStyles[user.premium_pack] || premiumStyles['simple'];
        const isPremiumActive = user.premium_end_date && new Date(user.premium_end_date) > new Date();

        res.json({
            success: true,
            profile: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                avatar: user.avatar_url,
                city: user.city,
                bio: user.bio,
                rating: parseFloat(user.rating),
                totalRatings: user.total_ratings,
                
                // Informations premium (visibles publiquement)
                premiumPack: user.premium_pack,
                badge: user.badge,
                isPremiumActive: isPremiumActive,
                premiumStyle: premiumStyle,
                isVerified: user.is_verified,
                
                // Statistiques publiques
                activeAdsCount: parseInt(user.active_ads_count),
                memberSince: user.created_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération profil public:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du profil'
        });
    }
});

/**
 * Mettre à jour le profil de l'utilisateur
 * PUT /api/profile/me
 */
router.put('/me', async (req, res) => {
    const userId = req.user.userId;
    const { firstName, lastName, bio, city } = req.body;

    try {
        // Mettre à jour les informations utilisateur
        if (firstName !== undefined || lastName !== undefined) {
            await req.db.query(
                `UPDATE users 
                 SET first_name = COALESCE($1, first_name),
                     last_name = COALESCE($2, last_name)
                 WHERE id = $3`,
                [firstName, lastName, userId]
            );
        }

        // Mettre à jour le profil
        if (bio !== undefined || city !== undefined) {
            await req.db.query(
                `UPDATE user_profiles 
                 SET bio = COALESCE($1, bio),
                     city = COALESCE($2, city)
                 WHERE id = $3`,
                [bio, city, userId]
            );
        }

        // Récupérer le profil mis à jour
        const result = await req.db.query(`
            SELECT 
                u.*,
                up.avatar_url,
                up.city,
                up.bio,
                up.rating
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.id
            WHERE u.id = $1
        `, [userId]);

        const user = result.rows[0];

        console.log('✅ Profil mis à jour pour:', userId);

        res.json({
            success: true,
            message: 'Profil mis à jour avec succès',
            profile: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                avatar: user.avatar_url,
                city: user.city,
                bio: user.bio,
                rating: parseFloat(user.rating),
                premiumPack: user.premium_pack,
                badge: user.badge
            }
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour profil:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour du profil'
        });
    }
});

/**
 * Mettre à jour l'avatar de l'utilisateur
 * PUT /api/profile/me/avatar
 */
router.put('/me/avatar', async (req, res) => {
    const userId = req.user.userId;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
        return res.status(400).json({
            success: false,
            error: 'URL de l\'avatar requis'
        });
    }

    try {
        await req.db.query(
            'UPDATE user_profiles SET avatar_url = $1 WHERE id = $2',
            [avatarUrl, userId]
        );

        console.log('✅ Avatar mis à jour pour:', userId);

        res.json({
            success: true,
            message: 'Avatar mis à jour avec succès',
            avatarUrl: avatarUrl
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour avatar:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour de l\'avatar'
        });
    }
});

/**
 * Récupérer les statistiques détaillées du profil
 * GET /api/profile/me/stats
 */
router.get('/me/stats', async (req, res) => {
    const userId = req.user.userId;

    try {
        // Statistiques des annonces
        const adsStats = await req.db.query(`
            SELECT 
                COUNT(*) as total_ads,
                COUNT(*) FILTER (WHERE is_active = true) as active_ads,
                COUNT(*) FILTER (WHERE is_sold = true) as sold_ads,
                COUNT(*) FILTER (WHERE is_featured = true) as featured_ads,
                SUM(view_count) as total_views,
                AVG(rating_avg) as avg_rating
            FROM ads
            WHERE user_id = $1
        `, [userId]);

        // Statistiques des favoris
        const favStats = await req.db.query(`
            SELECT COUNT(*) as total_favorites
            FROM favorites
            WHERE user_id = $1
        `, [userId]);

        // Statistiques des messages
        const msgStats = await req.db.query(`
            SELECT 
                COUNT(DISTINCT c.id) as total_conversations,
                COUNT(m.id) as total_messages_sent
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id AND m.sender_id = $1
            WHERE c.user1_id = $1 OR c.user2_id = $1
        `, [userId]);

        // Statistiques de rating
        const ratingStats = await req.db.query(`
            SELECT 
                COUNT(*) as ratings_received,
                AVG(rating) as avg_rating
            FROM user_ratings
            WHERE rated_user_id = $1
        `, [userId]);

        const stats = {
            ads: {
                total: parseInt(adsStats.rows[0].total_ads),
                active: parseInt(adsStats.rows[0].active_ads),
                sold: parseInt(adsStats.rows[0].sold_ads),
                featured: parseInt(adsStats.rows[0].featured_ads),
                totalViews: parseInt(adsStats.rows[0].total_views) || 0,
                avgRating: parseFloat(adsStats.rows[0].avg_rating) || 0
            },
            favorites: {
                total: parseInt(favStats.rows[0].total_favorites)
            },
            messages: {
                conversations: parseInt(msgStats.rows[0].total_conversations),
                messagesSent: parseInt(msgStats.rows[0].total_messages_sent)
            },
            reputation: {
                ratingsReceived: parseInt(ratingStats.rows[0].ratings_received),
                avgRating: parseFloat(ratingStats.rows[0].avg_rating) || 2.5
            }
        };

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('❌ Erreur récupération statistiques:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des statistiques'
        });
    }
});

/**
 * Récupérer les annonces d'un utilisateur
 * GET /api/profile/:userId/ads
 */
router.get('/:userId/ads', async (req, res) => {
    const { userId } = req.params;
    const { limit = 10, offset = 0, status = 'active' } = req.query;

    try {
        let whereClause = 'user_id = $1';
        const params = [userId];

        if (status === 'active') {
            whereClause += ' AND is_active = true AND is_sold = false';
        } else if (status === 'sold') {
            whereClause += ' AND is_sold = true';
        } else if (status === 'inactive') {
            whereClause += ' AND is_active = false';
        }

        const result = await req.db.query(`
            SELECT 
                a.*,
                c.name as category_name,
                c.slug as category_slug,
                (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image
            FROM ads a
            LEFT JOIN categories c ON a.category_id = c.id
            WHERE ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $2 OFFSET $3
        `, [...params, parseInt(limit), parseInt(offset)]);

        // Compter le total
        const countResult = await req.db.query(
            `SELECT COUNT(*) as total FROM ads WHERE ${whereClause}`,
            params
        );

        res.json({
            success: true,
            ads: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: parseFloat(ad.price),
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                isUrgent: ad.is_urgent,
                viewCount: ad.view_count,
                ratingAvg: parseFloat(ad.rating_avg),
                ratingCount: ad.rating_count,
                createdAt: ad.created_at,
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug
                },
                primaryImage: ad.primary_image
            })),
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('❌ Erreur récupération annonces utilisateur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des annonces'
        });
    }
});

module.exports = router;
