/**
 * Routes améliorées pour les annonces
 * - Liste avec filtrage par catégorie
 * - Pagination
 * - Priorisation des annonces à la une
 * - Recherche avancée
 */

const express = require('express');
const router = express.Router();

/**
 * Récupérer les annonces avec filtres et pagination
 * GET /api/ads
 */
router.get('/', async (req, res) => {
    const {
        page = 1,
        limit = 20,
        categoryId,
        subcategoryId,
        minPrice,
        maxPrice,
        city,
        condition,
        search,
        sortBy = 'featured_first', // featured_first, recent, price_asc, price_desc, popular
        isFeatured,
        isUrgent
    } = req.query;

    const userId = req.user?.userId; // Utilisateur authentifié si connecté

    try {
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Construction de la requête avec filtres
        let whereConditions = ['a.is_active = true', 'a.is_sold = false'];
        const params = [];
        let paramIndex = 1;

        // Filtre par catégorie
        if (categoryId) {
            whereConditions.push(`a.category_id = $${paramIndex}`);
            params.push(categoryId);
            paramIndex++;
        }

        // Filtre par sous-catégorie
        if (subcategoryId) {
            whereConditions.push(`a.category_id = $${paramIndex}`);
            params.push(subcategoryId);
            paramIndex++;
        }

        // Filtre par prix minimum
        if (minPrice) {
            whereConditions.push(`a.price >= $${paramIndex}`);
            params.push(parseFloat(minPrice));
            paramIndex++;
        }

        // Filtre par prix maximum
        if (maxPrice) {
            whereConditions.push(`a.price <= $${paramIndex}`);
            params.push(parseFloat(maxPrice));
            paramIndex++;
        }

        // Filtre par ville
        if (city) {
            whereConditions.push(`LOWER(a.city) = LOWER($${paramIndex})`);
            params.push(city);
            paramIndex++;
        }

        // Filtre par condition
        if (condition) {
            whereConditions.push(`a.condition = $${paramIndex}`);
            params.push(condition);
            paramIndex++;
        }

        // Filtre featured
        if (isFeatured === 'true') {
            whereConditions.push('a.is_featured = true');
            whereConditions.push('(a.featured_until IS NULL OR a.featured_until > CURRENT_TIMESTAMP)');
        }

        // Filtre urgent
        if (isUrgent === 'true') {
            whereConditions.push('a.is_urgent = true');
        }

        // Recherche textuelle
        if (search && search.trim() !== '') {
            whereConditions.push(`(
                LOWER(a.title) LIKE LOWER($${paramIndex}) OR 
                LOWER(a.description) LIKE LOWER($${paramIndex})
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        // Définir l'ordre de tri
        let orderByClause;
        switch (sortBy) {
            case 'featured_first':
                // Annonces à la une en premier, puis par date
                orderByClause = `
                    CASE 
                        WHEN a.is_featured = true AND (a.featured_until IS NULL OR a.featured_until > CURRENT_TIMESTAMP) THEN 0
                        WHEN a.is_urgent = true THEN 1
                        ELSE 2
                    END ASC,
                    a.created_at DESC
                `;
                break;
            case 'recent':
                orderByClause = 'a.created_at DESC';
                break;
            case 'price_asc':
                orderByClause = 'a.price ASC, a.created_at DESC';
                break;
            case 'price_desc':
                orderByClause = 'a.price DESC, a.created_at DESC';
                break;
            case 'popular':
                orderByClause = 'a.view_count DESC, a.created_at DESC';
                break;
            case 'rating':
                orderByClause = 'a.rating_avg DESC, a.rating_count DESC, a.created_at DESC';
                break;
            default:
                orderByClause = 'a.created_at DESC';
        }

        // Requête principale
        const query = `
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
                pc.name as parent_category_name,
                (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image,
                (SELECT COUNT(*) FROM favorites WHERE ad_id = a.id) as favorite_count,
                COALESCE(
                    (SELECT ARRAY_AGG(image_url ORDER BY is_primary DESC, position ASC)
                     FROM ad_images WHERE ad_id = a.id),
                    ARRAY[]::TEXT[]
                ) as all_images
                ${userId ? `, EXISTS(SELECT 1 FROM favorites WHERE user_id = $${paramIndex} AND ad_id = a.id) as is_favorited` : ', false as is_favorited'}
            FROM ads a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            WHERE ${whereClause}
            ORDER BY ${orderByClause}
            LIMIT $${paramIndex + (userId ? 1 : 0)} OFFSET $${paramIndex + (userId ? 2 : 1)}
        `;

        if (userId) {
            params.push(userId);
        }
        params.push(parseInt(limit), offset);

        const result = await req.db.query(query, params);

        // Compter le total
        const countQuery = `SELECT COUNT(*) as total FROM ads a WHERE ${whereClause}`;
        const countParams = userId ? params.slice(0, -3) : params.slice(0, -2); // Enlever userId, limit et offset
        const countResult = await req.db.query(countQuery, countParams);

        const totalAds = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalAds / parseInt(limit));

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
                postalCode: ad.postal_code,
                quantity: ad.quantity,
                soldQuantity: ad.sold_quantity,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                isUrgent: ad.is_urgent,
                featuredUntil: ad.featured_until,
                viewCount: ad.view_count,
                ratingAvg: parseFloat(ad.rating_avg),
                ratingCount: ad.rating_count,
                createdAt: ad.created_at,
                updatedAt: ad.updated_at,
                expiresAt: ad.expires_at,
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
                    color: ad.category_color,
                    parentName: ad.parent_category_name
                },
                primaryImage: ad.primary_image,
                images: ad.all_images,
                favoriteCount: parseInt(ad.favorite_count),
                isFavorite: ad.is_favorited
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalAds: totalAds,
                limit: parseInt(limit),
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            filters: {
                categoryId,
                subcategoryId,
                minPrice,
                maxPrice,
                city,
                condition,
                search,
                sortBy,
                isFeatured,
                isUrgent
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération annonces:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des annonces',
            details: error.message
        });
    }
});

/**
 * Récupérer une annonce par ID avec détails complets
 * GET /api/ads/:id
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const query = `
            SELECT 
                a.*,
                u.id as user_id,
                u.first_name,
                u.last_name,
                u.phone,
                u.premium_pack,
                u.badge,
                u.created_at as user_member_since,
                up.avatar_url as user_avatar,
                up.city as user_city,
                up.bio as user_bio,
                up.rating as user_rating,
                up.total_ratings as user_total_ratings,
                c.id as category_id,
                c.name as category_name,
                c.slug as category_slug,
                c.icon as category_icon,
                c.color as category_color,
                c.parent_id as category_parent_id,
                pc.name as parent_category_name,
                COALESCE(
                    (SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', ai.id,
                            'url', ai.image_url,
                            'isPrimary', ai.is_primary,
                            'position', ai.position
                        ) ORDER BY ai.is_primary DESC, ai.position ASC
                    ) FROM ad_images ai WHERE ai.ad_id = a.id),
                    '[]'::JSON
                ) as images,
                (SELECT COUNT(*) FROM favorites WHERE ad_id = a.id) as favorite_count,
                (SELECT COUNT(*) FROM ad_comments WHERE ad_id = a.id AND is_approved = true) as comment_count
                ${userId ? `, EXISTS(SELECT 1 FROM favorites WHERE user_id = '${userId}' AND ad_id = a.id) as is_favorited` : ', false as is_favorited'}
            FROM ads a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            WHERE a.id = $1
        `;

        const result = await req.db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }

        const ad = result.rows[0];

        // Incrémenter le compteur de vues (seulement si ce n'est pas le propriétaire)
        if (!userId || userId !== ad.user_id) {
            await req.db.query(
                'UPDATE ads SET view_count = view_count + 1 WHERE id = $1',
                [id]
            );
        }

        res.json({
            success: true,
            ad: {
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: parseFloat(ad.price),
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                postalCode: ad.postal_code,
                latitude: ad.latitude,
                longitude: ad.longitude,
                quantity: ad.quantity,
                soldQuantity: ad.sold_quantity,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                isUrgent: ad.is_urgent,
                featuredUntil: ad.featured_until,
                viewCount: ad.view_count + 1, // +1 pour inclure cette vue
                ratingAvg: parseFloat(ad.rating_avg),
                ratingCount: ad.rating_count,
                modificationCount: ad.modification_count,
                createdAt: ad.created_at,
                updatedAt: ad.updated_at,
                expiresAt: ad.expires_at,
                user: {
                    id: ad.user_id,
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                    phone: ad.phone,
                    premiumPack: ad.premium_pack,
                    badge: ad.badge,
                    avatar: ad.user_avatar,
                    city: ad.user_city,
                    bio: ad.user_bio,
                    rating: parseFloat(ad.user_rating),
                    totalRatings: ad.user_total_ratings,
                    memberSince: ad.user_member_since
                },
                category: {
                    id: ad.category_id,
                    name: ad.category_name,
                    slug: ad.category_slug,
                    icon: ad.category_icon,
                    color: ad.category_color,
                    parentId: ad.category_parent_id,
                    parentName: ad.parent_category_name
                },
                images: ad.images,
                favoriteCount: parseInt(ad.favorite_count),
                commentCount: parseInt(ad.comment_count),
                isFavorite: ad.is_favorited
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération annonce:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération de l\'annonce',
            details: error.message
        });
    }
});

/**
 * Récupérer les villes disponibles pour les filtres
 * GET /api/ads/filters/cities
 */
router.get('/filters/cities', async (req, res) => {
    try {
        const result = await req.db.query(`
            SELECT DISTINCT city, COUNT(*) as ad_count
            FROM ads
            WHERE is_active = true AND is_sold = false AND city IS NOT NULL AND city != ''
            GROUP BY city
            ORDER BY ad_count DESC, city ASC
            LIMIT 50
        `);

        res.json({
            success: true,
            cities: result.rows.map(row => ({
                name: row.city,
                count: parseInt(row.ad_count)
            }))
        });

    } catch (error) {
        console.error('❌ Erreur récupération villes:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des villes'
        });
    }
});

/**
 * Récupérer les annonces similaires
 * GET /api/ads/:id/similar
 */
router.get('/:id/similar', async (req, res) => {
    const { id } = req.params;
    const { limit = 6 } = req.query;

    try {
        // D'abord, récupérer l'annonce courante pour connaître sa catégorie
        const adResult = await req.db.query(
            'SELECT category_id, price FROM ads WHERE id = $1',
            [id]
        );

        if (adResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }

        const currentAd = adResult.rows[0];

        // Récupérer des annonces similaires (même catégorie, prix similaire)
        const result = await req.db.query(`
            SELECT 
                a.*,
                u.first_name,
                u.last_name,
                u.premium_pack,
                u.badge,
                up.rating as user_rating,
                c.name as category_name,
                c.slug as category_slug,
                (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image
            FROM ads a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.id
            LEFT JOIN categories c ON a.category_id = c.id
            WHERE a.is_active = true 
                AND a.is_sold = false
                AND a.id != $1
                AND a.category_id = $2
                AND ABS(a.price - $3) <= ($3 * 0.5)  -- Prix dans un range de ±50%
            ORDER BY 
                CASE WHEN a.is_featured = true THEN 0 ELSE 1 END,
                ABS(a.price - $3),
                a.created_at DESC
            LIMIT $4
        `, [id, currentAd.category_id, currentAd.price, parseInt(limit)]);

        res.json({
            success: true,
            similarAds: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                price: parseFloat(ad.price),
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                isFeatured: ad.is_featured,
                isUrgent: ad.is_urgent,
                viewCount: ad.view_count,
                ratingAvg: parseFloat(ad.rating_avg),
                ratingCount: ad.rating_count,
                createdAt: ad.created_at,
                user: {
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                    premiumPack: ad.premium_pack,
                    badge: ad.badge,
                    rating: parseFloat(ad.user_rating)
                },
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug
                },
                primaryImage: ad.primary_image
            }))
        });

    } catch (error) {
        console.error('❌ Erreur récupération annonces similaires:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des annonces similaires'
        });
    }
});

module.exports = router;
