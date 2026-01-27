/**
 * Routes pour les prix et fonctionnalités premium
 * - Récupération des prix depuis la base de données
 * - Informations sur les packs premium
 * - Comparaison des fonctionnalités
 */

const express = require('express');
const router = express.Router();

/**
 * Récupérer tous les prix premium
 * GET /api/premium/pricing
 */
router.get('/pricing', async (req, res) => {
    try {
        const result = await req.db.query(`
            SELECT 
                id,
                pack_name,
                price_ar,
                price_usd,
                duration_days,
                features,
                is_active,
                created_at,
                updated_at
            FROM premium_pricing
            WHERE is_active = true
            ORDER BY price_ar ASC
        `);

        res.json({
            success: true,
            pricing: result.rows.map(pack => ({
                id: pack.id,
                packName: pack.pack_name,
                priceAr: parseFloat(pack.price_ar),
                priceUsd: pack.price_usd ? parseFloat(pack.price_usd) : null,
                durationDays: pack.duration_days,
                features: pack.features,
                isActive: pack.is_active,
                createdAt: pack.created_at,
                updatedAt: pack.updated_at
            }))
        });

    } catch (error) {
        console.error('❌ Erreur récupération prix premium:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des prix premium'
        });
    }
});

/**
 * Récupérer le prix d'un pack spécifique
 * GET /api/premium/pricing/:packName
 */
router.get('/pricing/:packName', async (req, res) => {
    const { packName } = req.params;

    // Valider le nom du pack
    const validPacks = ['starter', 'pro', 'entreprise'];
    if (!validPacks.includes(packName)) {
        return res.status(400).json({
            success: false,
            error: 'Nom de pack invalide. Valeurs acceptées: starter, pro, entreprise'
        });
    }

    try {
        const result = await req.db.query(`
            SELECT 
                id,
                pack_name,
                price_ar,
                price_usd,
                duration_days,
                features,
                is_active
            FROM premium_pricing
            WHERE pack_name = $1 AND is_active = true
        `, [packName]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Pack premium non trouvé'
            });
        }

        const pack = result.rows[0];

        res.json({
            success: true,
            pack: {
                id: pack.id,
                packName: pack.pack_name,
                priceAr: parseFloat(pack.price_ar),
                priceUsd: pack.price_usd ? parseFloat(pack.price_usd) : null,
                durationDays: pack.duration_days,
                features: pack.features,
                isActive: pack.is_active
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération prix pack:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du prix du pack'
        });
    }
});

/**
 * Comparer les fonctionnalités des différents packs
 * GET /api/premium/compare
 */
router.get('/compare', async (req, res) => {
    try {
        const result = await req.db.query(`
            SELECT 
                pack_name,
                price_ar,
                features
            FROM premium_pricing
            WHERE is_active = true
            ORDER BY price_ar ASC
        `);

        // Définir les limites par pack (correspond au système premium existant)
        const packLimits = {
            'simple': {
                ads: 3,
                photos: 3,
                featured: 0,
                modifications: 5,
                stats: 'basic'
            },
            'starter': {
                ads: 10,
                photos: 5,
                featured: 0,
                modifications: 10,
                stats: 'basic'
            },
            'pro': {
                ads: 50,
                photos: 15,
                featured: 5,
                modifications: 20,
                stats: 'advanced'
            },
            'entreprise': {
                ads: -1, // illimité
                photos: 30,
                featured: 15,
                modifications: -1, // illimité
                stats: 'complete',
                multiUsers: 5
            }
        };

        const comparison = result.rows.map(pack => ({
            packName: pack.pack_name,
            price: parseFloat(pack.price_ar),
            features: pack.features,
            limits: packLimits[pack.pack_name] || {}
        }));

        // Ajouter le pack simple (gratuit)
        comparison.unshift({
            packName: 'simple',
            price: 0,
            features: [
                "3 annonces simultanées",
                "3 photos par annonce",
                "Messagerie de base",
                "Statistiques limitées"
            ],
            limits: packLimits['simple']
        });

        res.json({
            success: true,
            comparison: comparison
        });

    } catch (error) {
        console.error('❌ Erreur comparaison packs:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la comparaison des packs'
        });
    }
});

/**
 * Obtenir les limites du pack actuel de l'utilisateur
 * GET /api/premium/my-limits
 */
router.get('/my-limits', async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await req.db.query(`
            SELECT 
                u.premium_pack,
                u.ads_count,
                u.featured_ads_used,
                u.ad_modifications_used,
                u.boost_count_used,
                u.premium_start_date,
                u.premium_end_date,
                pp.features,
                pp.price_ar
            FROM users u
            LEFT JOIN premium_pricing pp ON u.premium_pack = pp.pack_name
            WHERE u.id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];
        const pack = user.premium_pack;

        // Définir les limites selon le pack
        const limits = {
            'simple': {
                maxAds: 3,
                maxPhotos: 3,
                maxFeaturedAds: 0,
                maxModifications: 5,
                hasStats: false,
                hasAutoBoost: false
            },
            'starter': {
                maxAds: 10,
                maxPhotos: 5,
                maxFeaturedAds: 0,
                maxModifications: 10,
                hasStats: true,
                hasAutoBoost: false
            },
            'pro': {
                maxAds: 50,
                maxPhotos: 15,
                maxFeaturedAds: 5,
                maxModifications: 20,
                hasStats: true,
                hasAdvancedStats: true,
                hasAutoBoost: true
            },
            'entreprise': {
                maxAds: -1, // illimité
                maxPhotos: 30,
                maxFeaturedAds: 15,
                maxModifications: -1, // illimité
                hasStats: true,
                hasAdvancedStats: true,
                hasCompleteStats: true,
                hasAutoBoost: true,
                multiUsers: 5
            }
        };

        const currentLimits = limits[pack] || limits['simple'];

        // Vérifier si le premium est actif
        const isPremiumActive = user.premium_end_date && new Date(user.premium_end_date) > new Date();

        res.json({
            success: true,
            currentPack: pack,
            isPremiumActive: isPremiumActive,
            premiumEndDate: user.premium_end_date,
            features: user.features || [],
            price: user.price_ar ? parseFloat(user.price_ar) : 0,
            usage: {
                adsCount: user.ads_count,
                featuredAdsUsed: user.featured_ads_used,
                modificationsUsed: user.ad_modifications_used,
                boostsUsed: user.boost_count_used
            },
            limits: currentLimits,
            remaining: {
                ads: currentLimits.maxAds === -1 ? -1 : Math.max(0, currentLimits.maxAds - user.ads_count),
                featuredAds: currentLimits.maxFeaturedAds === -1 ? -1 : Math.max(0, currentLimits.maxFeaturedAds - user.featured_ads_used),
                modifications: currentLimits.maxModifications === -1 ? -1 : Math.max(0, currentLimits.maxModifications - user.ad_modifications_used)
            }
        });

    } catch (error) {
        console.error('❌ Erreur récupération limites:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des limites'
        });
    }
});

/**
 * Vérifier si l'utilisateur peut effectuer une action
 * POST /api/premium/can-do
 */
router.post('/can-do', async (req, res) => {
    const userId = req.user.userId;
    const { action } = req.body; // 'create_ad', 'feature_ad', 'modify_ad', 'boost_ad'

    if (!action) {
        return res.status(400).json({
            success: false,
            error: 'Action requise'
        });
    }

    try {
        const result = await req.db.query(`
            SELECT 
                premium_pack,
                ads_count,
                featured_ads_used,
                ad_modifications_used,
                boost_count_used,
                premium_end_date
            FROM users
            WHERE id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];
        const pack = user.premium_pack;

        const limits = {
            'simple': { maxAds: 3, maxFeaturedAds: 0, maxModifications: 5 },
            'starter': { maxAds: 10, maxFeaturedAds: 0, maxModifications: 10 },
            'pro': { maxAds: 50, maxFeaturedAds: 5, maxModifications: 20 },
            'entreprise': { maxAds: -1, maxFeaturedAds: 15, maxModifications: -1 }
        };

        const currentLimits = limits[pack] || limits['simple'];
        let canDo = false;
        let reason = '';

        switch (action) {
            case 'create_ad':
                canDo = currentLimits.maxAds === -1 || user.ads_count < currentLimits.maxAds;
                reason = canDo ? '' : `Limite d'annonces atteinte (${currentLimits.maxAds})`;
                break;

            case 'feature_ad':
                canDo = currentLimits.maxFeaturedAds === -1 || user.featured_ads_used < currentLimits.maxFeaturedAds;
                reason = canDo ? '' : `Limite d'annonces à la une atteinte (${currentLimits.maxFeaturedAds})`;
                break;

            case 'modify_ad':
                canDo = currentLimits.maxModifications === -1 || user.ad_modifications_used < currentLimits.maxModifications;
                reason = canDo ? '' : `Limite de modifications atteinte (${currentLimits.maxModifications})`;
                break;

            case 'boost_ad':
                canDo = true; // Le boost est toujours possible (payant)
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Action invalide'
                });
        }

        res.json({
            success: true,
            canDo: canDo,
            reason: reason,
            currentPack: pack,
            limits: currentLimits
        });

    } catch (error) {
        console.error('❌ Erreur vérification action:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification de l\'action'
        });
    }
});

module.exports = router;
