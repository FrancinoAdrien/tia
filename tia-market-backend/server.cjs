// backend/server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    Pool
} = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Middleware - IMPORTANT: autoriser toutes les origines en développement
app.use(cors({
    origin: '*', // En développement, autoriser tout
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configuration PostgreSQL - MODIFIEZ SI NÉCESSAIRE
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'tia_market',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
});

// Vérification de la connexion
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Erreur de connexion PostgreSQL:', err.message);
        console.log('💡 Vérifiez que:');
        console.log('   1. PostgreSQL est installé et démarré');
        console.log('   2. La base "tia_market" existe');
        console.log('   3. Les identifiants dans .env sont corrects');
    } else {
        console.log('✅ Connecté à PostgreSQL - Base: tia_market');
        release();
    }
});

// Route de test améliorée
app.get('/api/test', async (req, res) => {
    console.log('📡 Requête test reçue de:', req.ip);

    try {
        // Tester la connexion à la base
        const dbResult = await pool.query('SELECT NOW() as time, version() as version');

        res.json({
            message: '🚀 Backend TIA Market Opérationnel',
            status: 'OK',
            timestamp: new Date().toISOString(),
            server: {
                ip: '192.168.88.29',
                port: 3001,
                environment: process.env.NODE_ENV || 'development'
            },
            database: {
                connected: true,
                time: dbResult.rows[0].time,
                version: dbResult.rows[0].version.split(' ')[1]
            },
            endpoints: {
                test: 'GET /api/test',
                register: 'POST /api/register',
                login: 'POST /api/login',
                profile: 'GET /api/profile (authentifié)'
            },
            instructions: '✅ Backend prêt à recevoir des requêtes de l\'app mobile'
        });
    } catch (error) {
        console.error('❌ Erreur test endpoint:', error);
        res.status(500).json({
            error: 'Erreur base de données',
            details: error.message,
            fix: 'Vérifiez la connexion PostgreSQL et que la base tia_market existe'
        });
    }
});

// Route d'inscription
app.post('/api/register', async (req, res) => {
    console.log('📝 Tentative d\'inscription depuis:', req.ip);
    console.log('📧 Email:', req.body.email);

    const {
        email,
        password,
        firstName,
        lastName,
        phone
    } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Champs requis manquants',
            required: ['email', 'password']
        });
    }

    try {
        // Vérifier si email existe
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (userCheck.rows.length > 0) {
            return res.status(400).json({
                error: 'Email déjà utilisé',
                suggestion: 'Utilisez un autre email ou connectez-vous'
            });
        }

        // Hasher mot de passe
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insérer utilisateur
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, first_name, last_name, phone, is_premium, end_premium, created_at`,
            [email, passwordHash, firstName || null, lastName || null, phone || null]
        );

        const user = result.rows[0];

        // Créer profil
        await pool.query(
            'INSERT INTO user_profiles (id) VALUES ($1)',
            [user.id]
        );

        // Générer token
        const token = jwt.sign({
                userId: user.id,
                email: user.email
            },
            process.env.JWT_SECRET || 'tia_market_secret_key_192.168.88.29', {
                expiresIn: '7d'
            }
        );

        console.log('✅ Utilisateur créé:', user.email);

        res.status(201).json({
            success: true,
            message: 'Compte créé avec succès',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                isPremium: user.is_premium,
                premiumPlan: null,
                endPremium: user.end_premium,
                createdAt: user.created_at,
            }
        });

    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(500).json({
            error: 'Erreur lors de la création du compte',
            details: error.message
        });
    }
});

// Route de connexion
app.post('/api/login', async (req, res) => {
    console.log('🔑 Tentative de connexion depuis:', req.ip);
    console.log('📧 Email:', req.body.email);

    const {
        email,
        password
    } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email et mot de passe requis',
            received: {
                email: !!email,
                password: !!password
            }
        });
    }

    try {
        const result = await pool.query(
            `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, 
              u.phone, u.is_verified, u.is_premium, u.end_premium, u.created_at
       FROM users u
       WHERE u.email = $1 AND u.is_active = true`,
            [email]
        );

        if (result.rows.length === 0) {
            console.log('❌ Email non trouvé:', email);
            return res.status(401).json({
                error: 'Identifiants incorrects',
                suggestion: 'Vérifiez votre email et mot de passe'
            });
        }

        const user = result.rows[0];

        // Vérifier mot de passe
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            console.log('❌ Mot de passe incorrect pour:', email);
            return res.status(401).json({
                error: 'Identifiants incorrects',
                suggestion: 'Vérifiez votre email et mot de passe'
            });
        }

        // Générer token
        const token = jwt.sign({
                userId: user.id,
                email: user.email
            },
            process.env.JWT_SECRET || 'tia_market_secret_key_192.168.88.29', {
                expiresIn: '7d'
            }
        );

        console.log('✅ Connexion réussie:', user.email);

        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                isVerified: user.is_verified,
                isPremium: user.is_premium,
                premiumPlan: user.premium_plan,
                endPremium: user.end_premium,
                createdAt: user.created_at,
            }
        });

    } catch (error) {
        console.error('❌ Erreur connexion:', error);
        res.status(500).json({
            error: 'Erreur lors de la connexion',
            details: error.message
        });
    }
});

// Middleware d'authentification
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Token d\'authentification manquant'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'tia_market_secret_key_192.168.88.29', (err, user) => {
        if (err) {
            return res.status(403).json({
                error: 'Token invalide ou expiré'
            });
        }
        req.user = user;
        next();
    });
}

// Route profil (protégée)
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
              u.is_verified, u.is_premium, u.premium_plan, u.end_premium, u.created_at, 
              up.city, up.avatar_url, up.bio
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.id
       WHERE u.id = $1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                isVerified: user.is_verified,
                isPremium: user.is_premium,
                premiumPlan: user.premium_plan,
                endPremium: user.end_premium,
                city: user.city,
                avatarUrl: user.avatar_url,
                bio: user.bio,
                createdAt: user.created_at,
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Erreur récupération profil',
            details: error.message
        });
    }
});

// GET /api/user/ads - Récupérer les annonces de l'utilisateur connecté
app.get('/api/user/ads', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.is_premium,
        c.name as category_name,
        c.slug as category_slug,
        (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as image_url,
        (SELECT COUNT(*) FROM ad_images WHERE ad_id = a.id) as image_count
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC`,
            [req.user.userId]
        );

        res.json({
            success: true,
            ads: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: ad.price,
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                postalCode: ad.postal_code,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                viewCount: ad.view_count,
                createdAt: ad.created_at,
                updatedAt: ad.updated_at,
                user: {
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                    isPremium: ad.is_premium,
                },
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug,
                },
                imageUrl: ad.image_url,
                imageCount: ad.image_count,
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération annonces utilisateur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des annonces'
        });
    }
});

app.post('/api/ads', authenticateToken, async (req, res) => {
    console.log('📝 Création annonce par user:', req.user.userId);

    const {
        title,
        description,
        price,
        priceNegotiable = false,
        condition = 'good',
        categoryId,
        city,
        postalCode,
        quantity = 1, // Nouveau: quantité de produits
        isFeatured = false, // À la une
        featuredDays = 0, // 7 ou 14 jours
        isUrgent = false, // Badge urgent
        maxPhotos = 5, // Nombre de photos (peut être augmenté avec crédits)
    } = req.body;

    // Validation
    if (!title || !description || !price || !categoryId || !city) {
        return res.status(400).json({
            error: 'Champs requis manquants',
            required: ['title', 'description', 'price', 'categoryId', 'city']
        });
    }

    try {
        // Vérifier que la catégorie existe
        const categoryCheck = await pool.query(
            'SELECT id FROM categories WHERE id = $1',
            [categoryId]
        );

        if (categoryCheck.rows.length === 0) {
            return res.status(400).json({
                error: 'Catégorie invalide'
            });
        }

        // Récupérer le plan premium de l'utilisateur pour valider la quantité
        const userCheck = await pool.query(
            'SELECT premium_plan, is_premium FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Utilisateur non trouvé'
            });
        }

        const user = userCheck.rows[0];
        let maxQuantity = 1; // Par défaut pour les utilisateurs non premium
        let maxPhotos = 5; // Par défaut

        // Définir les limites selon le plan
        if (user.is_premium && user.premium_plan) {
            switch (user.premium_plan) {
                case 'starter':
                    maxQuantity = 20;
                    maxPhotos = 10;
                    break;
                case 'pro':
                    maxQuantity = 40;
                    maxPhotos = 20;
                    break;
                case 'enterprise':
                    maxQuantity = 999999; // Illimité
                    maxPhotos = 999999; // Illimité
                    break;
            }
        }

        // Valider la quantité
        if (quantity < 1 || quantity > maxQuantity) {
            return res.status(400).json({
                error: `Quantité invalide. Maximum autorisé: ${maxQuantity}`,
                maxQuantity: maxQuantity,
                plan: user.premium_plan || 'standard',
            });
        }

        // Gérer les fonctionnalités premium (À la une, Urgent, photos)
        let featuredUntil = null;
        let finalMaxPhotos = maxPhotos || 5;
        let totalCost = 0;

        // Vérifier les crédits de l'utilisateur
        const userCreditsResult = await pool.query(
            'SELECT credits FROM users WHERE id = $1',
            [req.user.userId]
        );
        const userCredits = parseFloat(userCreditsResult.rows[0] ? userCreditsResult.rows[0].credits : 0);

        // Gérer "À la une"
        if (isFeatured && featuredDays > 0) {
            const featuredCost = featuredDays === 7 ? 10000 : featuredDays === 14 ? 18000 : 0;

            if (featuredCost > 0) {
                // Vérifier les crédits gratuits pour packs Pro/Entreprise
                if (user.premium_plan === 'pro') {
                    const creditsResult = await pool.query(
                        'SELECT credits_remaining FROM user_featured_credits WHERE user_id = $1',
                        [req.user.userId]
                    );

                    if (creditsResult.rows.length > 0 && creditsResult.rows[0].credits_remaining > 0) {
                        // Utiliser un crédit gratuit
                        await pool.query(
                            'UPDATE user_featured_credits SET credits_remaining = credits_remaining - 1 WHERE user_id = $1',
                            [req.user.userId]
                        );
                        featuredUntil = new Date();
                        featuredUntil.setDate(featuredUntil.getDate() + featuredDays);
                        console.log('✅ Crédit "À la une" gratuit utilisé');
                    } else if (userCredits >= featuredCost) {
                        // Payer avec crédits
                        await pool.query(
                            'UPDATE users SET credits = credits - $1 WHERE id = $2',
                            [featuredCost, req.user.userId]
                        );
                        totalCost += featuredCost;
                        featuredUntil = new Date();
                        featuredUntil.setDate(featuredUntil.getDate() + featuredDays);

                        await pool.query(
                            `INSERT INTO credit_transactions (user_id, type, amount, description, status)
               VALUES ($1, $2, $3, $4, 'completed')`,
                            [req.user.userId, featuredDays === 7 ? 'featured_7d' : 'featured_14d', featuredCost, `À la une ${featuredDays} jours`]
                        );
                    } else {
                        return res.status(400).json({
                            error: `Crédits insuffisants pour "À la une" ${featuredDays} jours. Coût: ${featuredCost} Ar`,
                            required: featuredCost,
                            available: userCredits,
                        });
                    }
                } else if (user.premium_plan === 'enterprise') {
                    // Entreprise: illimité
                    featuredUntil = new Date();
                    featuredUntil.setDate(featuredUntil.getDate() + featuredDays);
                    console.log('✅ "À la une" gratuit pour pack Entreprise');
                } else if (userCredits >= featuredCost) {
                    // Payer avec crédits
                    await pool.query(
                        'UPDATE users SET credits = credits - $1 WHERE id = $2',
                        [featuredCost, req.user.userId]
                    );
                    totalCost += featuredCost;
                    featuredUntil = new Date();
                    featuredUntil.setDate(featuredUntil.getDate() + featuredDays);

                    await pool.query(
                        `INSERT INTO credit_transactions (user_id, type, amount, description, status)
             VALUES ($1, $2, $3, $4, 'completed')`,
                        [req.user.userId, featuredDays === 7 ? 'featured_7d' : 'featured_14d', featuredCost, `À la une ${featuredDays} jours`]
                    );
                } else {
                    return res.status(400).json({
                        error: `Crédits insuffisants pour "À la une" ${featuredDays} jours. Coût: ${featuredCost} Ar`,
                        required: featuredCost,
                        available: userCredits,
                    });
                }
            }
        }

        // Gérer "Urgent"
        if (isUrgent) {
            const urgentCost = 3000;
            if (userCredits >= urgentCost) {
                await pool.query(
                    'UPDATE users SET credits = credits - $1 WHERE id = $2',
                    [urgentCost, req.user.userId]
                );
                totalCost += urgentCost;

                await pool.query(
                    `INSERT INTO credit_transactions (user_id, type, amount, description, status)
           VALUES ($1, 'urgent', $2, 'Badge Urgent', 'completed')`,
                    [req.user.userId, urgentCost]
                );
            } else {
                return res.status(400).json({
                    error: `Crédits insuffisants pour le badge Urgent. Coût: ${urgentCost} Ar`,
                    required: urgentCost,
                    available: userCredits,
                });
            }
        }

        // Gérer photos supplémentaires
        if (maxPhotos > 5) {
            let extraPhotosCost = 0;
            if (maxPhotos === 10) {
                extraPhotosCost = 2000; // 5 photos supplémentaires
            } else if (maxPhotos === 20) {
                extraPhotosCost = 4000; // 15 photos supplémentaires
            }

            if (extraPhotosCost > 0) {
                if (userCredits >= extraPhotosCost) {
                    await pool.query(
                        'UPDATE users SET credits = credits - $1 WHERE id = $2',
                        [extraPhotosCost, req.user.userId]
                    );
                    totalCost += extraPhotosCost;
                    finalMaxPhotos = maxPhotos;

                    await pool.query(
                        `INSERT INTO credit_transactions (user_id, type, amount, description, status)
             VALUES ($1, $2, $3, $4, 'completed')`,
                        [req.user.userId, maxPhotos === 10 ? 'extra_photos_5' : 'extra_photos_15', extraPhotosCost, `${maxPhotos} photos`]
                    );
                } else {
                    return res.status(400).json({
                        error: `Crédits insuffisants pour ${maxPhotos} photos. Coût: ${extraPhotosCost} Ar`,
                        required: extraPhotosCost,
                        available: userCredits,
                    });
                }
            }
        }

        // Calculer la date d'expiration (30 jours par défaut)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Insérer l'annonce
        const result = await pool.query(
            `INSERT INTO ads (
        user_id, category_id, title, description, price, 
        price_negotiable, condition, city, postal_code, quantity, sold_quantity,
        is_featured, is_urgent, featured_until, expires_at, max_photos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
            [
                req.user.userId,
                categoryId,
                title,
                description,
                parseFloat(price),
                priceNegotiable,
                condition,
                city,
                postalCode || null,
                quantity,
                0, // sold_quantity initialisé à 0
                isFeatured || false,
                isUrgent || false,
                featuredUntil,
                expiresAt,
                finalMaxPhotos,
            ]
        );

        const ad = result.rows[0];

        console.log('✅ Annonce créée ID:', ad.id, 'Quantité:', quantity, 'Coût total:', totalCost);

        res.status(201).json({
            success: true,
            message: 'Annonce créée avec succès',
            totalCost: totalCost,
            ad: {
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: ad.price,
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                postalCode: ad.postal_code,
                categoryId: ad.category_id,
                userId: ad.user_id,
                quantity: ad.quantity || 1,
                soldQuantity: ad.sold_quantity || 0,
                createdAt: ad.created_at,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured || false,
                isUrgent: ad.is_urgent || false,
                featuredUntil: ad.featured_until,
                expiresAt: ad.expires_at,
                maxPhotos: ad.max_photos || 5,
                viewCount: ad.view_count,
            }
        });

    } catch (error) {
        console.error('❌ Erreur création annonce:', error);
        res.status(500).json({
            error: 'Erreur lors de la création de l\'annonce',
            details: error.message
        });
    }
});

// Route pour récupérer les catégories
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, slug, icon, color, parent_id
       FROM categories
       ORDER BY name ASC`
        );

        res.json({
            success: true,
            categories: result.rows
        });
    } catch (error) {
        console.error('❌ Erreur récupération catégories:', error);
        res.status(500).json({
            error: 'Erreur récupération catégories'
        });
    }
});

// Route pour récupérer les sous-catégories
app.get('/api/categories/:parentId/subcategories', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, slug, icon, parent_id
       FROM categories
       WHERE parent_id = $1
       ORDER BY name ASC`,
            [req.params.parentId]
        );

        res.json({
            success: true,
            subcategories: result.rows
        });
    } catch (error) {
        console.error('❌ Erreur récupération sous-catégories:', error);
        res.status(500).json({
            error: 'Erreur récupération sous-catégories'
        });
    }
});

// Route pour les annonces récentes (tri: À la une > Nouvelles > Normales)
app.get('/api/ads/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const baseUrl = req.protocol + '://' + req.get('host');

        const result = await pool.query(
            `SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.rating,
        u.rating_count,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon,
        c.color as category_color,
        ai.image_url,
        -- Retourner l'URL complète
        CONCAT('${baseUrl}', ai.image_url) as full_image_url
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN ad_images ai ON a.id = ai.ad_id AND ai.is_primary = true
      WHERE a.is_active = true AND a.is_sold = false
      ORDER BY 
        a.is_featured DESC,  -- À la une en premier
        a.created_at DESC    -- Puis les plus récents
      LIMIT $1`,
            [limit]
        );

        res.json({
            success: true,
            ads: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: ad.price,
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                postalCode: ad.postal_code,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                viewCount: ad.view_count,
                createdAt: ad.created_at,
                updatedAt: ad.updated_at,
                user: {
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                    rating: ad.rating,
                    ratingCount: ad.rating_count,
                },
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug,
                    icon: ad.category_icon,
                    color: ad.category_color,
                },
                // Utilisez full_image_url si disponible, sinon image_url
                imageUrl: ad.full_image_url || ad.image_url,
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération annonces récentes:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération annonces'
        });
    }
});

// Middleware pour logger les requêtes de fichiers
app.use('/uploads', (req, res, next) => {
    console.log(`📁 Requête fichier: ${req.path}`);
    next();
});

// Route pour les annonces populaires (tri: À la une > Plus vues > Plus récentes)
app.get('/api/ads/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const baseUrl = req.protocol + '://' + req.get('host');

        const result = await pool.query(
            `SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.is_premium,
        u.rating,
        u.rating_count,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon,
        c.color as category_color,
        ai.image_url,
        CONCAT('${baseUrl}', ai.image_url) as full_image_url
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN ad_images ai ON a.id = ai.ad_id AND ai.is_primary = true
      WHERE a.is_active = true AND a.is_sold = false
      ORDER BY 
        a.is_featured DESC,    -- À la une en premier
        a.view_count DESC,     -- Puis par popularité
        a.created_at DESC      -- Puis par date
      LIMIT $1`,
            [limit]
        );

        res.json({
            success: true,
            ads: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: ad.price,
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                postalCode: ad.postal_code,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                viewCount: ad.view_count,
                createdAt: ad.created_at,
                updatedAt: ad.updated_at,
                user: {
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                    isPremium: ad.is_premium,
                    rating: ad.rating,
                    ratingCount: ad.rating_count,
                },
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug,
                    icon: ad.category_icon,
                    color: ad.category_color,
                },
                imageUrl: ad.full_image_url || ad.image_url,
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération annonces populaires:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération annonces'
        });
    }
});

// Route pour les catégories avec compteur d'annonces
app.get('/api/categories/with-counts', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
        c.id, c.name, c.slug, c.icon, c.color,
        COUNT(a.id) as ad_count
      FROM categories c
      LEFT JOIN ads a ON c.id = a.category_id AND a.is_active = true AND a.is_sold = false
      WHERE c.parent_id IS NULL
      GROUP BY c.id, c.name, c.slug, c.icon, c.color
      ORDER BY c.name ASC`
        );

        res.json({
            success: true,
            categories: result.rows
        });
    } catch (error) {
        console.error('❌ Erreur récupération catégories:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération catégories'
        });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, {
                recursive: true
            });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, 'ad-' + uniqueSuffix + extension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// Route pour uploader une image d'annonce
app.post('/api/ads/images', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        console.log('📸 Upload image reçu pour user:', req.user.userId);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Aucune image fournie'
            });
        }

        const {
            adId,
            isPrimary = 'false'
        } = req.body;

        if (!adId) {
            // Supprimer le fichier uploadé
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'ID de l\'annonce requis'
            });
        }

        // Vérifier que l'annonce existe ET appartient à l'utilisateur
        const adCheck = await pool.query(
            'SELECT id FROM ads WHERE id = $1 AND user_id = $2',
            [adId, req.user.userId]
        );

        if (adCheck.rows.length === 0) {
            // Supprimer le fichier uploadé
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée ou non autorisée'
            });
        }

        // Vérifier si c'est la première image (pour la marquer comme primaire)
        const existingImages = await pool.query(
            'SELECT id FROM ad_images WHERE ad_id = $1',
            [adId]
        );

        const shouldBePrimary = existingImages.rows.length === 0 || isPrimary === 'true';

        // Insérer l'image dans la base de données
        const result = await pool.query(
            `INSERT INTO ad_images (ad_id, image_url, is_primary, position) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
            [
                adId,
                `/uploads/${req.file.filename}`,
                shouldBePrimary,
                existingImages.rows.length + 1
            ]
        );

        console.log('✅ Image uploadée ID:', result.rows[0].id);

        res.json({
            success: true,
            image: {
                id: result.rows[0].id,
                ad_id: result.rows[0].ad_id,
                image_url: result.rows[0].image_url,
                is_primary: result.rows[0].is_primary,
                position: result.rows[0].position,
                created_at: result.rows[0].created_at,
            }
        });

    } catch (error) {
        console.error('❌ Erreur upload image:', error);

        // Supprimer le fichier uploadé en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'upload de l\'image',
            details: error.message
        });
    }
});

// Route pour marquer une image comme primaire
app.patch('/api/ads/images/:id', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;

        // Récupérer l'image et vérifier les permissions
        const imageCheck = await pool.query(
            `SELECT ai.*, a.user_id 
       FROM ad_images ai
       JOIN ads a ON ai.ad_id = a.id
       WHERE ai.id = $1`,
            [id]
        );

        if (imageCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Image non trouvée'
            });
        }

        const image = imageCheck.rows[0];

        // Vérifier que l'utilisateur est le propriétaire de l'annonce
        if (image.user_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à modifier cette image'
            });
        }

        // D'abord, désélectionner toutes les images primaires pour cette annonce
        await pool.query(
            'UPDATE ad_images SET is_primary = false WHERE ad_id = $1',
            [image.ad_id]
        );

        // Puis marquer cette image comme primaire
        const result = await pool.query(
            'UPDATE ad_images SET is_primary = true WHERE id = $1 RETURNING *',
            [id]
        );

        res.json({
            success: true,
            image: {
                id: result.rows[0].id,
                ad_id: result.rows[0].ad_id,
                image_url: result.rows[0].image_url,
                is_primary: result.rows[0].is_primary,
                position: result.rows[0].position,
                created_at: result.rows[0].created_at,
            }
        });
    } catch (error) {
        console.error('❌ Erreur mise à jour image:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour de l\'image',
            details: error.message
        });
    }
});

// Route pour supprimer une image
app.delete('/api/ads/images/:id', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;

        // Récupérer l'image et vérifier les permissions
        const imageCheck = await pool.query(
            `SELECT ai.*, a.user_id 
       FROM ad_images ai
       JOIN ads a ON ai.ad_id = a.id
       WHERE ai.id = $1`,
            [id]
        );

        if (imageCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Image non trouvée'
            });
        }

        const image = imageCheck.rows[0];

        // Vérifier que l'utilisateur est le propriétaire de l'annonce
        if (image.user_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à supprimer cette image'
            });
        }

        // Supprimer le fichier physique
        const imagePath = image.image_url.replace('/uploads/', 'uploads/');
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        // Supprimer l'image de la base de données
        await pool.query('DELETE FROM ad_images WHERE id = $1', [id]);

        // Si c'était l'image primaire, définir une nouvelle image primaire
        if (image.is_primary) {
            const nextImage = await pool.query(
                'SELECT id FROM ad_images WHERE ad_id = $1 ORDER BY position ASC LIMIT 1',
                [image.ad_id]
            );

            if (nextImage.rows.length > 0) {
                await pool.query(
                    'UPDATE ad_images SET is_primary = true WHERE id = $1',
                    [nextImage.rows[0].id]
                );
            }
        }

        res.json({
            success: true,
            message: 'Image supprimée avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur suppression image:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression de l\'image',
            details: error.message
        });
    }
});

// Route pour récupérer les images d'une annonce
app.get('/api/ads/:id/images', async (req, res) => {
    try {
        const {
            id
        } = req.params;

        const result = await pool.query(
            `SELECT id, ad_id, image_url, is_primary, position, created_at
       FROM ad_images
       WHERE ad_id = $1
       ORDER BY is_primary DESC, position ASC`,
            [id]
        );

        res.json({
            success: true,
            images: result.rows
        });
    } catch (error) {
        console.error('❌ Erreur récupération images:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération images',
            details: error.message
        });
    }
});

// Route pour mettre à jour la position des images
app.patch('/api/ads/:id/images/reorder', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const {
            imageOrder
        } = req.body; // Tableau d'IDs dans l'ordre souhaité

        if (!Array.isArray(imageOrder)) {
            return res.status(400).json({
                success: false,
                error: 'imageOrder doit être un tableau'
            });
        }

        // Vérifier que l'annonce appartient à l'utilisateur
        const adCheck = await pool.query(
            'SELECT id FROM ads WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (adCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée ou non autorisée'
            });
        }

        // Mettre à jour les positions
        for (let i = 0; i < imageOrder.length; i++) {
            await pool.query(
                'UPDATE ad_images SET position = $1 WHERE id = $2 AND ad_id = $3',
                [i + 1, imageOrder[i], id]
            );
        }

        res.json({
            success: true,
            message: 'Ordre des images mis à jour'
        });
    } catch (error) {
        console.error('❌ Erreur réorganisation images:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la réorganisation des images',
            details: error.message
        });
    }
});

app.get('/api/ads/:id', async (req, res) => {
    try {
        const {
            id
        } = req.params;

        // Incrémenter le compteur de vues
        await pool.query(
            'UPDATE ads SET view_count = view_count + 1 WHERE id = $1',
            [id]
        );

        const result = await pool.query(
            `SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.phone,
        up.avatar_url,
        up.city as user_city,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon,
        c.color as category_color,
        COALESCE(
          (SELECT json_agg(image_url ORDER BY is_primary DESC, position ASC) 
           FROM ad_images WHERE ad_id = a.id),
          '[]'::json
        ) as images,
        (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as primary_image
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1 AND a.is_active = true`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }

        const ad = result.rows[0];

        // Formater la réponse
        const responseAd = {
            id: ad.id,
            title: ad.title,
            description: ad.description,
            price: ad.price,
            priceNegotiable: ad.price_negotiable,
            condition: ad.condition,
            city: ad.city,
            postalCode: ad.postal_code,
            isActive: ad.is_active,
            isSold: ad.is_sold,
            isFeatured: ad.is_featured,
            viewCount: ad.view_count,
            createdAt: ad.created_at,
            updatedAt: ad.updated_at,
            userId: ad.user_id,
            categoryId: ad.category_id,
            user: {
                firstName: ad.first_name,
                lastName: ad.last_name,
                phone: ad.phone,
                avatarUrl: ad.avatar_url,
                city: ad.user_city,
            },
            category: {
                name: ad.category_name,
                slug: ad.category_slug,
                icon: ad.category_icon,
                color: ad.category_color,
            },
            images: ad.images || [],
            imageUrl: ad.primary_image,
        };

        res.json({
            success: true,
            ad: responseAd
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

// Route pour incrémenter les vues
app.post('/api/ads/:id/view', async (req, res) => {
    try {
        const {
            id
        } = req.params;

        await pool.query(
            'UPDATE ads SET view_count = view_count + 1 WHERE id = $1',
            [id]
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error('❌ Erreur incrémentation vues:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'incrémentation des vues'
        });
    }
});

// Route pour récupérer les annonces similaires
app.get('/api/ads/:id/similar', async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const limit = parseInt(req.query.limit) || 6;

        // Récupérer la catégorie de l'annonce
        const adResult = await pool.query(
            'SELECT category_id FROM ads WHERE id = $1',
            [id]
        );

        if (adResult.rows.length === 0) {
            return res.json({
                success: true,
                ads: []
            });
        }

        const categoryId = adResult.rows[0].category_id;

        const result = await pool.query(
            `SELECT 
        a.*,
        u.first_name,
        u.last_name,
        c.name as category_name,
        (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as image_url
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id != $1 
        AND a.category_id = $2 
        AND a.is_active = true 
        AND a.is_sold = false
      ORDER BY a.created_at DESC
      LIMIT $3`,
            [id, categoryId, limit]
        );

        res.json({
            success: true,
            ads: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                price: ad.price,
                city: ad.city,
                imageUrl: ad.image_url,
                createdAt: ad.created_at,
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération annonces similaires:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération annonces similaires'
        });
    }
});

const canAccessConversation = async (conversationId, userId) => {
    const result = await pool.query(
        'SELECT id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
        [conversationId, userId]
    );
    return result.rows.length > 0;
};

app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const {
            conversationId,
            adId,
            receiverId,
            content
        } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Le message ne peut pas être vide'
            });
        }

        const senderId = req.user.userId;
        let actualConversationId = conversationId;

        // CAS 1: On a déjà une conversationId (réponse à un message existant)
        if (actualConversationId) {
            // Vérifier que la conversation existe et que l'utilisateur y a accès
            const conversationCheck = await pool.query(
                `SELECT id FROM conversations 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
                [actualConversationId, senderId]
            );

            if (conversationCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous n\'avez pas accès à cette conversation'
                });
            }
        }
        // CAS 2: Pas de conversationId (premier message)
        else if (adId && receiverId) {
            // Vérifier que l'annonce existe
            const adCheck = await pool.query(
                `SELECT a.id, a.user_id as seller_id, a.title
         FROM ads a
         WHERE a.id = $1 AND a.is_active = true`,
                [adId]
            );

            if (adCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Annonce non trouvée'
                });
            }

            // Ne pas permettre d'envoyer un message à soi-même
            if (receiverId === senderId) {
                return res.status(400).json({
                    success: false,
                    error: 'Vous ne pouvez pas vous envoyer un message à vous-même'
                });
            }

            // Vérifier que le destinataire existe
            const receiverCheck = await pool.query(
                'SELECT id, first_name, last_name FROM users WHERE id = $1',
                [receiverId]
            );

            if (receiverCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Destinataire non trouvé'
                });
            }

            const receiver = receiverCheck.rows[0];

            // Chercher d'abord si une conversation existe déjà
            const existingConversation = await pool.query(
                `SELECT id FROM conversations 
         WHERE ad_id = $1 
         AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))`,
                [adId, senderId, receiverId]
            );

            if (existingConversation.rows.length > 0) {
                actualConversationId = existingConversation.rows[0].id;
            } else {
                // Créer une nouvelle conversation
                const conversationResult = await pool.query(
                    `INSERT INTO conversations (ad_id, user1_id, user2_id)
           VALUES ($1, $2, $3)
           RETURNING id`,
                    [adId, senderId, receiverId]
                );
                actualConversationId = conversationResult.rows[0].id;
            }
        } else {
            return res.status(400).json({
                success: false,
                error: 'Soit conversationId, soit adId et receiverId sont requis'
            });
        }

        // Envoyer le message
        const messageResult = await pool.query(
            `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, content, is_read, created_at`,
            [actualConversationId, senderId, content.trim()]
        );

        const message = messageResult.rows[0];

        // Mettre à jour la conversation
        await pool.query(
            `UPDATE conversations 
       SET last_message_content = $1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           user1_unread_count = CASE 
             WHEN user1_id = $2 THEN user1_unread_count 
             ELSE user1_unread_count + 1 
           END,
           user2_unread_count = CASE 
             WHEN user2_id = $2 THEN user2_unread_count 
             ELSE user2_unread_count + 1 
           END
       WHERE id = $3`,
            [content.substring(0, 100), senderId, actualConversationId]
        );

        res.json({
            success: true,
            message: {
                id: message.id,
                conversationId: message.conversation_id,
                senderId: message.sender_id,
                content: message.content,
                isRead: message.is_read,
                createdAt: message.created_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur envoi message:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'envoi du message',
            details: error.message
        });
    }
});

// Route pour récupérer les conversations d'un utilisateur
app.get('/api/conversations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Version temporaire sans user1_unread_count
        const result = await pool.query(
            `SELECT 
        c.*,
        a.title as ad_title,
        a.price as ad_price,
        a.city as ad_city,
        ai.image_url as ad_image,
        -- Infos de l'autre utilisateur
        CASE 
          WHEN c.user1_id = $1 THEN u2.first_name
          ELSE u1.first_name 
        END as other_user_first_name,
        CASE 
          WHEN c.user1_id = $1 THEN u2.last_name
          ELSE u1.last_name 
        END as other_user_last_name,
        -- Utilisez 0 comme valeur par défaut pour unread_count
        0 as unread_count
      FROM conversations c
      LEFT JOIN ads a ON c.ad_id = a.id
      LEFT JOIN ad_images ai ON a.id = ai.ad_id AND ai.is_primary = true
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.last_message_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            conversations: result.rows.map(conv => ({
                id: conv.id,
                adId: conv.ad_id,
                adTitle: conv.ad_title,
                adPrice: conv.ad_price,
                adCity: conv.ad_city,
                adImage: conv.ad_image,
                otherUser: {
                    id: conv.user1_id === userId ? conv.user2_id : conv.user1_id,
                    firstName: conv.other_user_first_name,
                    lastName: conv.other_user_last_name,
                },
                lastMessage: conv.last_message_content,
                lastMessageAt: conv.last_message_at,
                unreadCount: 0, // Valeur par défaut
                createdAt: conv.created_at
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération conversations:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des conversations',
            details: error.message
        });
    }
});

// Route pour récupérer les messages d'une conversation
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const userId = req.user.userId;

        // Vérifier l'accès à la conversation
        if (!(await canAccessConversation(id, userId))) {
            return res.status(403).json({
                success: false,
                error: 'Accès non autorisé à cette conversation'
            });
        }

        const result = await pool.query(
            `SELECT 
        m.*,
        u.first_name,
        u.last_name,
        up.avatar_url
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC`,
            [id]
        );

        // Marquer les messages comme lus
        await pool.query(
            `UPDATE messages SET is_read = true 
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
            [id, userId]
        );

        // Réinitialiser le compteur de messages non lus
        await pool.query(
            `UPDATE conversations 
       SET user1_unread_count = CASE 
         WHEN user1_id = $1 THEN 0 
         ELSE user1_unread_count 
       END,
       user2_unread_count = CASE 
         WHEN user2_id = $1 THEN 0 
         ELSE user2_unread_count 
       END
       WHERE id = $2`,
            [userId, id]
        );

        res.json({
            success: true,
            messages: result.rows.map(msg => ({
                id: msg.id,
                conversationId: msg.conversation_id,
                senderId: msg.sender_id,
                senderName: `${msg.first_name} ${msg.last_name}`,
                senderAvatar: msg.avatar_url,
                content: msg.content,
                isRead: msg.is_read,
                isOwnMessage: msg.sender_id === userId,
                createdAt: msg.created_at
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération messages:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des messages'
        });
    }
});

// Route pour les notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 20;

        const result = await pool.query(
            `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
            [userId, limit]
        );

        const unreadCountResult = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
            [userId]
        );

        res.json({
            success: true,
            notifications: result.rows,
            unreadCount: parseInt(unreadCountResult.rows[0].count)
        });
    } catch (error) {
        console.error('❌ Erreur récupération notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des notifications'
        });
    }
});

// Route pour marquer une notification comme lue
app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Notification non trouvée'
            });
        }

        res.json({
            success: true,
            notification: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Erreur marquage notification:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du marquage de la notification'
        });
    }
});

// Route pour marquer toutes les notifications comme lues
app.post('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [userId]
        );

        res.json({
            success: true,
            message: 'Toutes les notifications ont été marquées comme lues'
        });
    } catch (error) {
        console.error('❌ Erreur marquage toutes notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du marquage des notifications'
        });
    }
});

app.get('/api/conversations/by-ad/:adId', authenticateToken, async (req, res) => {
    try {
        const {
            adId
        } = req.params;
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT id FROM conversations 
       WHERE ad_id = $1 AND (user1_id = $2 OR user2_id = $2)
       LIMIT 1`,
            [adId, userId]
        );

        if (result.rows.length > 0) {
            res.json({
                success: true,
                conversationId: result.rows[0].id
            });
        } else {
            res.json({
                success: true,
                conversationId: null
            });
        }
    } catch (error) {
        console.error('❌ Erreur récupération conversation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération conversation'
        });
    }
});

// Recherche d'annonces
app.get('/api/ads/search', async (req, res) => {
    try {
        const {
            query,
            categoryId,
            minPrice,
            maxPrice,
            condition,
            city,
            limit = 50,
            offset = 0
        } = req.query;

        const baseUrl = req.protocol + '://' + req.get('host');

        let sqlQuery = `
      SELECT 
        a.*,
        u.first_name,
        u.last_name,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon,
        c.color as category_color,
        ai.image_url,
        CONCAT('${baseUrl}', ai.image_url) as full_image_url,
        ARRAY(
          SELECT CONCAT('${baseUrl}', ai2.image_url)
          FROM ad_images ai2
          WHERE ai2.ad_id = a.id
          ORDER BY ai2.is_primary DESC
        ) as images
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN ad_images ai ON a.id = ai.ad_id AND ai.is_primary = true
      WHERE a.is_active = true AND a.is_sold = false
    `;

        const queryParams = [];
        let paramCount = 1;

        if (query) {
            sqlQuery += ` AND (a.title ILIKE $${paramCount} OR a.description ILIKE $${paramCount})`;
            queryParams.push(`%${query}%`);
            paramCount++;
        }

        if (categoryId) {
            sqlQuery += ` AND a.category_id = $${paramCount}`;
            queryParams.push(categoryId);
            paramCount++;
        }

        if (minPrice) {
            sqlQuery += ` AND a.price >= $${paramCount}`;
            queryParams.push(minPrice);
            paramCount++;
        }

        if (maxPrice) {
            sqlQuery += ` AND a.price <= $${paramCount}`;
            queryParams.push(maxPrice);
            paramCount++;
        }

        if (condition) {
            sqlQuery += ` AND a.condition = $${paramCount}`;
            queryParams.push(condition);
            paramCount++;
        }

        if (city) {
            sqlQuery += ` AND a.city ILIKE $${paramCount}`;
            queryParams.push(`%${city}%`);
            paramCount++;
        }

        sqlQuery += ` ORDER BY a.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        queryParams.push(limit, offset);

        const result = await pool.query(sqlQuery, queryParams);

        res.json({
            success: true,
            ads: result.rows.map(ad => ({
                id: ad.id,
                title: ad.title,
                description: ad.description,
                price: ad.price,
                priceNegotiable: ad.price_negotiable,
                condition: ad.condition,
                city: ad.city,
                postalCode: ad.postal_code,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
                viewCount: ad.view_count,
                createdAt: ad.created_at,
                updatedAt: ad.updated_at,
                user: {
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                },
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug,
                    icon: ad.category_icon,
                    color: ad.category_color,
                },
                imageUrl: ad.full_image_url || ad.image_url,
                images: ad.images || [],
                userId: ad.user_id,
                categoryId: ad.category_id,
            }))
        });
    } catch (error) {
        console.error('❌ Erreur recherche annonces:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la recherche'
        });
    }
});

// Mettre à jour le premium avec les nouveaux plans
app.patch('/api/user/premium', authenticateToken, async (req, res) => {
    try {
        const {
            plan
        } = req.body;

        if (!plan || !['starter', 'pro', 'enterprise'].includes(plan)) {
            return res.status(400).json({
                success: false,
                error: 'Plan invalide. Plans disponibles: starter, pro, enterprise',
            });
        }

        // Calculer la date d'expiration (30 jours pour tous les plans)
        const endPremiumDate = new Date();
        endPremiumDate.setDate(endPremiumDate.getDate() + 30);

        // Mettre à jour l'utilisateur
        const result = await pool.query(
            `UPDATE users 
       SET is_premium = true, premium_plan = $1, end_premium = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, first_name, last_name, phone, is_verified, is_premium, premium_plan, end_premium, created_at`,
            [plan, endPremiumDate, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];
        console.log('✅ Utilisateur passé en premium:', user.email, 'Plan:', plan);

        res.json({
            success: true,
            message: `Abonnement premium ${plan} activé`,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                isVerified: user.is_verified,
                isPremium: user.is_premium,
                premiumPlan: user.premium_plan,
                endPremium: user.end_premium,
                createdAt: user.created_at,
            },
        });
    } catch (error) {
        console.error('❌ Erreur mise à jour premium:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour du premium',
            details: error.message,
        });
    }
});

// ============================================================
// ENDPOINTS POUR LES POINTS ET CRÉDITS
// ============================================================

// GET /api/user/points - Récupérer les points et crédits de l'utilisateur
app.get('/api/user/points', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT points, credits FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];

        // Récupérer l'historique des points récents
        const historyResult = await pool.query(
            `SELECT * FROM user_points_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
            [userId]
        );

        res.json({
            success: true,
            points: parseInt(user.points) || 0,
            credits: parseFloat(user.credits) || 0,
            history: historyResult.rows.map(h => ({
                id: h.id,
                points: h.points,
                type: h.type,
                description: h.description,
                createdAt: h.created_at,
            })),
        });
    } catch (error) {
        console.error('❌ Erreur récupération points:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des points',
            details: error.message,
        });
    }
});

// POST /api/user/points/daily-login - Ajouter des points pour connexion quotidienne
app.post('/api/user/points/daily-login', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Vérifier si l'utilisateur a déjà reçu des points aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const checkResult = await pool.query(
            `SELECT id FROM user_points_history 
       WHERE user_id = $1 
       AND type = 'daily_login' 
       AND created_at >= $2`,
            [userId, today]
        );

        if (checkResult.rows.length > 0) {
            return res.json({
                success: true,
                message: 'Points déjà attribués aujourd\'hui',
                points: 0,
            });
        }

        // Ajouter 1 point
        await pool.query(
            `UPDATE users SET points = points + 1 WHERE id = $1`,
            [userId]
        );

        await pool.query(
            `INSERT INTO user_points_history (user_id, points, type, description)
       VALUES ($1, 1, 'daily_login', 'Connexion quotidienne')`,
            [userId]
        );

        res.json({
            success: true,
            message: '1 point ajouté pour la connexion quotidienne',
            points: 1,
        });
    } catch (error) {
        console.error('❌ Erreur ajout points connexion:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'ajout des points',
        });
    }
});

// POST /api/user/points/claim-reward - Échanger des points contre des récompenses
app.post('/api/user/points/claim-reward', authenticateToken, async (req, res) => {
    try {
        const {
            rewardType
        } = req.body; // 'credit_5000', 'starter_1m', 'pro_1m', 'pro_3m', 'enterprise_1m'
        const userId = req.user.userId;

        // Récupérer les points actuels
        const userResult = await pool.query(
            'SELECT points, credits FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = userResult.rows[0];
        const currentPoints = parseInt(user.points) || 0;

        let pointsRequired = 0;
        let rewardDescription = '';
        let action = null;

        switch (rewardType) {
            case 'credit_5000':
                pointsRequired = 100;
                rewardDescription = '5 000 Ar de crédit';
                action = async () => {
                    await pool.query(
                        'UPDATE users SET credits = credits + 5000 WHERE id = $1',
                        [userId]
                    );
                };
                break;
            case 'starter_1m':
                pointsRequired = 300;
                rewardDescription = '1 mois Pack Starter gratuit';
                action = async () => {
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + 1);
                    await pool.query(
                        `UPDATE users 
             SET is_premium = true, premium_plan = 'starter', end_premium = $1 
             WHERE id = $2`,
                        [endDate, userId]
                    );
                };
                break;
            case 'pro_1m':
                pointsRequired = 500;
                rewardDescription = '1 mois Pack Pro gratuit';
                action = async () => {
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + 1);
                    await pool.query(
                        `UPDATE users 
             SET is_premium = true, premium_plan = 'pro', end_premium = $1 
             WHERE id = $2`,
                        [endDate, userId]
                    );
                    // Ajouter 5 crédits "À la une"
                    await pool.query(
                        `INSERT INTO user_featured_credits (user_id, credits_remaining, last_reset_date)
             VALUES ($1, 5, CURRENT_DATE)
             ON CONFLICT (user_id) 
             DO UPDATE SET credits_remaining = 5, last_reset_date = CURRENT_DATE`,
                        [userId]
                    );
                };
                break;
            case 'pro_3m':
                pointsRequired = 1000;
                rewardDescription = '3 mois Pack Pro gratuit';
                action = async () => {
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + 3);
                    await pool.query(
                        `UPDATE users 
             SET is_premium = true, premium_plan = 'pro', end_premium = $1 
             WHERE id = $2`,
                        [endDate, userId]
                    );
                    await pool.query(
                        `INSERT INTO user_featured_credits (user_id, credits_remaining, last_reset_date)
             VALUES ($1, 5, CURRENT_DATE)
             ON CONFLICT (user_id) 
             DO UPDATE SET credits_remaining = 5, last_reset_date = CURRENT_DATE`,
                        [userId]
                    );
                };
                break;
            case 'enterprise_1m':
                pointsRequired = 1000;
                rewardDescription = '1 mois Pack Entreprise gratuit';
                action = async () => {
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + 1);
                    await pool.query(
                        `UPDATE users 
             SET is_premium = true, premium_plan = 'enterprise', end_premium = $1 
             WHERE id = $2`,
                        [endDate, userId]
                    );
                };
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Type de récompense invalide'
                });
        }

        if (currentPoints < pointsRequired) {
            return res.status(400).json({
                success: false,
                error: `Points insuffisants. Requis: ${pointsRequired}, Disponibles: ${currentPoints}`,
            });
        }

        // Déduire les points et appliquer la récompense
        await pool.query(
            'UPDATE users SET points = points - $1 WHERE id = $2',
            [pointsRequired, userId]
        );

        await pool.query(
            `INSERT INTO user_points_history (user_id, points, type, description)
       VALUES ($1, -$2, 'reward_claimed', 'Échange: ${rewardDescription}')`,
            [userId, pointsRequired]
        );

        if (action) {
            await action();
        }

        res.json({
            success: true,
            message: `Récompense obtenue: ${rewardDescription}`,
            pointsUsed: pointsRequired,
            remainingPoints: currentPoints - pointsRequired,
        });
    } catch (error) {
        console.error('❌ Erreur échange points:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'échange de points',
            details: error.message,
        });
    }
});

// GET /api/user/featured-credits - Récupérer les crédits "À la une" gratuits
app.get('/api/user/featured-credits', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Vérifier le plan premium
        const userResult = await pool.query(
            'SELECT premium_plan FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const premiumPlan = userResult.rows[0].premium_plan;

        if (premiumPlan === 'enterprise') {
            return res.json({
                success: true,
                creditsRemaining: 999999, // Illimité
                isUnlimited: true,
            });
        }

        if (premiumPlan === 'pro') {
            // Récupérer ou créer les crédits
            let creditsResult = await pool.query(
                'SELECT * FROM user_featured_credits WHERE user_id = $1',
                [userId]
            );

            if (creditsResult.rows.length === 0) {
                await pool.query(
                    `INSERT INTO user_featured_credits (user_id, credits_remaining, last_reset_date)
           VALUES ($1, 5, CURRENT_DATE)`,
                    [userId]
                );
                creditsResult = await pool.query(
                    'SELECT * FROM user_featured_credits WHERE user_id = $1',
                    [userId]
                );
            }

            const credits = creditsResult.rows[0];
            const lastReset = new Date(credits.last_reset_date);
            const now = new Date();

            // Réinitialiser si nouveau mois
            if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
                await pool.query(
                    `UPDATE user_featured_credits 
           SET credits_remaining = 5, last_reset_date = CURRENT_DATE 
           WHERE user_id = $1`,
                    [userId]
                );
                return res.json({
                    success: true,
                    creditsRemaining: 5,
                    isUnlimited: false,
                });
            }

            return res.json({
                success: true,
                creditsRemaining: parseInt(credits.credits_remaining) || 0,
                isUnlimited: false,
            });
        }

        res.json({
            success: true,
            creditsRemaining: 0,
            isUnlimited: false,
        });
    } catch (error) {
        console.error('❌ Erreur récupération crédits:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des crédits',
        });
    }
});

// ============================================================
// ENDPOINTS POUR LE WALLET (Compte fictif)
// ============================================================

// GET /api/wallet - Récupérer le solde du wallet
app.get('/api/wallet', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Récupérer ou créer le wallet
        let walletResult = await pool.query(
            'SELECT * FROM wallet WHERE user_id = $1',
            [userId]
        );

        if (walletResult.rows.length === 0) {
            // Créer le wallet s'il n'existe pas
            await pool.query(
                'INSERT INTO wallet (user_id, balance) VALUES ($1, 0.00)',
                [userId]
            );
            walletResult = await pool.query(
                'SELECT * FROM wallet WHERE user_id = $1',
                [userId]
            );
        }

        const wallet = walletResult.rows[0];

        res.json({
            success: true,
            wallet: {
                id: wallet.id,
                balance: parseFloat(wallet.balance),
                createdAt: wallet.created_at,
                updatedAt: wallet.updated_at,
            },
        });
    } catch (error) {
        console.error('❌ Erreur récupération wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du wallet',
            details: error.message,
        });
    }
});

// POST /api/wallet/deposit - Ajouter de l'argent au wallet (mode beta)
app.post('/api/wallet/deposit', authenticateToken, async (req, res) => {
    try {
        const {
            amount
        } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Montant invalide',
            });
        }

        // Récupérer ou créer le wallet
        let walletResult = await pool.query(
            'SELECT * FROM wallet WHERE user_id = $1',
            [userId]
        );

        if (walletResult.rows.length === 0) {
            await pool.query(
                'INSERT INTO wallet (user_id, balance) VALUES ($1, 0.00)',
                [userId]
            );
            walletResult = await pool.query(
                'SELECT * FROM wallet WHERE user_id = $1',
                [userId]
            );
        }

        const wallet = walletResult.rows[0];

        // Mettre à jour le solde
        await pool.query(
            'UPDATE wallet SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [amount, wallet.id]
        );

        // Créer une transaction
        await pool.query(
            `INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, status)
       VALUES ($1, $2, 'deposit', $3, 'Dépôt fictif (Mode Beta)', 'completed')`,
            [wallet.id, userId, amount]
        );

        // Récupérer le nouveau solde
        const newWallet = await pool.query(
            'SELECT * FROM wallet WHERE id = $1',
            [wallet.id]
        );

        console.log('✅ Dépôt effectué:', amount, 'pour user:', userId);

        res.json({
            success: true,
            message: 'Dépôt effectué avec succès',
            wallet: {
                id: newWallet.rows[0].id,
                balance: parseFloat(newWallet.rows[0].balance),
            },
        });
    } catch (error) {
        console.error('❌ Erreur dépôt wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du dépôt',
            details: error.message,
        });
    }
});

// POST /api/wallet/withdraw - Retirer de l'argent du wallet
app.post('/api/wallet/withdraw', authenticateToken, async (req, res) => {
    try {
        const {
            amount
        } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Montant invalide',
            });
        }

        // Récupérer le wallet
        const walletResult = await pool.query(
            'SELECT * FROM wallet WHERE user_id = $1',
            [userId]
        );

        if (walletResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Wallet non trouvé',
            });
        }

        const wallet = walletResult.rows[0];
        const currentBalance = parseFloat(wallet.balance);

        if (currentBalance < amount) {
            return res.status(400).json({
                success: false,
                error: 'Solde insuffisant',
                currentBalance: currentBalance,
            });
        }

        // Mettre à jour le solde
        await pool.query(
            'UPDATE wallet SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [amount, wallet.id]
        );

        // Créer une transaction
        await pool.query(
            `INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, status)
       VALUES ($1, $2, 'withdrawal', $3, 'Retrait (Mode Beta)', 'completed')`,
            [wallet.id, userId, amount]
        );

        // Récupérer le nouveau solde
        const newWallet = await pool.query(
            'SELECT * FROM wallet WHERE id = $1',
            [wallet.id]
        );

        console.log('✅ Retrait effectué:', amount, 'pour user:', userId);

        res.json({
            success: true,
            message: 'Retrait effectué avec succès',
            wallet: {
                id: newWallet.rows[0].id,
                balance: parseFloat(newWallet.rows[0].balance),
            },
        });
    } catch (error) {
        console.error('❌ Erreur retrait wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du retrait',
            details: error.message,
        });
    }
});

// GET /api/wallet/transactions - Récupérer l'historique des transactions
app.get('/api/wallet/transactions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Récupérer le wallet
        const walletResult = await pool.query(
            'SELECT id FROM wallet WHERE user_id = $1',
            [userId]
        );

        if (walletResult.rows.length === 0) {
            return res.json({
                success: true,
                transactions: [],
                total: 0,
            });
        }

        const walletId = walletResult.rows[0].id;

        // Récupérer les transactions
        const transactionsResult = await pool.query(
            `SELECT * FROM wallet_transactions
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
            [walletId, limit, offset]
        );

        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM wallet_transactions WHERE wallet_id = $1',
            [walletId]
        );

        res.json({
            success: true,
            transactions: transactionsResult.rows.map(t => ({
                id: t.id,
                type: t.type,
                amount: parseFloat(t.amount),
                description: t.description,
                status: t.status,
                createdAt: t.created_at,
            })),
            total: parseInt(countResult.rows[0].total),
        });
    } catch (error) {
        console.error('❌ Erreur récupération transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des transactions',
            details: error.message,
        });
    }
});

// Démarrer le serveur - IMPORTANT: écouter sur toutes les interfaces
// ============================================================
// ENDPOINTS POUR LES ANNONCES DE RÉSERVATION (Premium Feature)
// ============================================================

// POST /api/ads/reservation - Créer une nouvelle annonce de réservation
app.post('/api/ads/reservation', authenticateToken, async (req, res) => {
    try {
        const {
            type,
            title,
            description,
            pricePerUnit,
            unitType,
            availableFromDate,
            availableToDate,
            isOpen24h,
            openingTime,
            closingTime,
            capacity,
            features,
            phone,
            email,
            website,
            location
        } = req.body;

        // Vérifier que l'utilisateur est premium
        const userCheck = await pool.query(
            'SELECT is_premium, end_premium FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (userCheck.rows.length === 0 || !userCheck.rows[0].is_premium) {
            return res.status(403).json({
                success: false,
                error: 'Seuls les utilisateurs premium peuvent créer des annonces de réservation'
            });
        }

        // Vérifier que l'abonnement premium n'est pas expiré
        const endPremium = new Date(userCheck.rows[0].end_premium);
        if (endPremium < new Date()) {
            return res.status(403).json({
                success: false,
                error: 'Votre abonnement premium a expiré'
            });
        }

        // Valider les données requises
        if (!type || !title) {
            return res.status(400).json({
                success: false,
                error: 'Type et titre sont obligatoires'
            });
        }

        // Créer l'annonce de réservation
        const result = await pool.query(
            `INSERT INTO reservation_ads 
       (user_id, type, title, description, price_per_unit, unit_type, available_from_date, 
        available_to_date, is_open_24h, opening_time, closing_time, capacity, features, 
        phone, email, website, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
            [
                req.user.userId,
                type,
                title,
                description || null,
                pricePerUnit || null,
                unitType || null,
                availableFromDate || null,
                availableToDate || null,
                isOpen24h || false,
                openingTime || null,
                closingTime || null,
                capacity || null,
                JSON.stringify(features || []),
                phone || null,
                email || null,
                website || null,
                location || null
            ]
        );

        console.log('✅ Annonce de réservation créée ID:', result.rows[0].id);

        res.status(201).json({
            success: true,
            ad: {
                id: result.rows[0].id,
                type: result.rows[0].type,
                title: result.rows[0].title,
                description: result.rows[0].description,
                pricePerUnit: result.rows[0].price_per_unit,
                unitType: result.rows[0].unit_type,
                availableFromDate: result.rows[0].available_from_date,
                availableToDate: result.rows[0].available_to_date,
                isOpen24h: result.rows[0].is_open_24h,
                openingTime: result.rows[0].opening_time,
                closingTime: result.rows[0].closing_time,
                capacity: result.rows[0].capacity,
                features: JSON.parse(result.rows[0].features),
                phone: result.rows[0].phone,
                email: result.rows[0].email,
                website: result.rows[0].website,
                location: result.rows[0].location,
                createdAt: result.rows[0].created_at
            }
        });
    } catch (error) {
        console.error('❌ Erreur création annonce réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la création de l\'annonce'
        });
    }
});

// GET /api/ads/reservation/:id - Récupérer une annonce de réservation spécifique
app.get('/api/ads/reservation/:id', async (req, res) => {
    try {
        const {
            id
        } = req.params;

        const result = await pool.query(
            `SELECT ra.*, u.first_name, u.last_name, u.profile_image, up.phone as profile_phone
       FROM reservation_ads ra
       JOIN users u ON ra.user_id = u.id
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE ra.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce de réservation non trouvée'
            });
        }

        const ad = result.rows[0];

        // Incrémenter le nombre de vues
        await pool.query(
            'UPDATE reservation_ads SET view_count = view_count + 1 WHERE id = $1',
            [id]
        );

        res.json({
            success: true,
            ad: {
                id: ad.id,
                type: ad.type,
                title: ad.title,
                description: ad.description,
                pricePerUnit: ad.price_per_unit,
                unitType: ad.unit_type,
                availableFromDate: ad.available_from_date,
                availableToDate: ad.available_to_date,
                isOpen24h: ad.is_open_24h,
                openingTime: ad.opening_time,
                closingTime: ad.closing_time,
                capacity: ad.capacity,
                features: JSON.parse(ad.features),
                images: JSON.parse(ad.images),
                phone: ad.phone,
                email: ad.email,
                website: ad.website,
                location: ad.location,
                viewCount: ad.view_count,
                createdAt: ad.created_at,
                user: {
                    id: ad.user_id,
                    firstName: ad.first_name,
                    lastName: ad.last_name,
                    profileImage: ad.profile_image,
                    phone: ad.profile_phone
                }
            }
        });
    } catch (error) {
        console.error('❌ Erreur récupération annonce réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération de l\'annonce'
        });
    }
});

// GET /api/user/ads/reservation - Récupérer les annonces de réservation de l'utilisateur
app.get('/api/user/ads/reservation', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM reservation_ads 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
            [req.user.userId]
        );

        const ads = result.rows.map(ad => ({
            id: ad.id,
            type: ad.type,
            title: ad.title,
            description: ad.description,
            pricePerUnit: ad.price_per_unit,
            unitType: ad.unit_type,
            availableFromDate: ad.available_from_date,
            availableToDate: ad.available_to_date,
            isOpen24h: ad.is_open_24h,
            openingTime: ad.opening_time,
            closingTime: ad.closing_time,
            capacity: ad.capacity,
            features: JSON.parse(ad.features),
            images: JSON.parse(ad.images),
            phone: ad.phone,
            email: ad.email,
            website: ad.website,
            location: ad.location,
            isActive: ad.is_active,
            viewCount: ad.view_count,
            createdAt: ad.created_at,
            updatedAt: ad.updated_at
        }));

        res.json({
            success: true,
            ads: ads
        });
    } catch (error) {
        console.error('❌ Erreur récupération annonces réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des annonces'
        });
    }
});

// PUT /api/ads/reservation/:id - Modifier une annonce de réservation
app.put('/api/ads/reservation/:id', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const {
            type,
            title,
            description,
            pricePerUnit,
            unitType,
            availableFromDate,
            availableToDate,
            isOpen24h,
            openingTime,
            closingTime,
            capacity,
            features,
            phone,
            email,
            website,
            location
        } = req.body;

        // Vérifier que l'utilisateur possède l'annonce
        const adCheck = await pool.query(
            'SELECT user_id FROM reservation_ads WHERE id = $1',
            [id]
        );

        if (adCheck.rows.length === 0 || adCheck.rows[0].user_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à modifier cette annonce'
            });
        }

        const result = await pool.query(
            `UPDATE reservation_ads 
       SET type = COALESCE($1, type),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           price_per_unit = COALESCE($4, price_per_unit),
           unit_type = COALESCE($5, unit_type),
           available_from_date = COALESCE($6, available_from_date),
           available_to_date = COALESCE($7, available_to_date),
           is_open_24h = COALESCE($8, is_open_24h),
           opening_time = COALESCE($9, opening_time),
           closing_time = COALESCE($10, closing_time),
           capacity = COALESCE($11, capacity),
           features = COALESCE($12, features),
           phone = COALESCE($13, phone),
           email = COALESCE($14, email),
           website = COALESCE($15, website),
           location = COALESCE($16, location),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $17
       RETURNING *`,
            [
                type, title, description, pricePerUnit, unitType, availableFromDate,
                availableToDate, isOpen24h, openingTime, closingTime, capacity,
                features ? JSON.stringify(features) : null, phone, email, website, location, id
            ]
        );

        console.log('✅ Annonce de réservation modifiée ID:', id);

        res.json({
            success: true,
            ad: {
                id: result.rows[0].id,
                type: result.rows[0].type,
                title: result.rows[0].title,
                description: result.rows[0].description,
                pricePerUnit: result.rows[0].price_per_unit,
                unitType: result.rows[0].unit_type,
                availableFromDate: result.rows[0].available_from_date,
                availableToDate: result.rows[0].available_to_date,
                isOpen24h: result.rows[0].is_open_24h,
                openingTime: result.rows[0].opening_time,
                closingTime: result.rows[0].closing_time,
                capacity: result.rows[0].capacity,
                features: JSON.parse(result.rows[0].features),
                phone: result.rows[0].phone,
                email: result.rows[0].email,
                website: result.rows[0].website,
                location: result.rows[0].location,
                updatedAt: result.rows[0].updated_at
            }
        });
    } catch (error) {
        console.error('❌ Erreur modification annonce réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la modification de l\'annonce'
        });
    }
});

// DELETE /api/ads/reservation/:id - Supprimer une annonce de réservation
app.delete('/api/ads/reservation/:id', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;

        // Vérifier que l'utilisateur possède l'annonce
        const adCheck = await pool.query(
            'SELECT user_id FROM reservation_ads WHERE id = $1',
            [id]
        );

        if (adCheck.rows.length === 0 || adCheck.rows[0].user_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à supprimer cette annonce'
            });
        }

        await pool.query(
            'DELETE FROM reservation_ads WHERE id = $1',
            [id]
        );

        console.log('✅ Annonce de réservation supprimée ID:', id);

        res.json({
            success: true,
            message: 'Annonce supprimée avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur suppression annonce réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression de l\'annonce'
        });
    }
});

// ============================================================
// ENDPOINTS POUR LES RÉSERVATIONS D'ANNONCES (Booking System)
// ============================================================

// POST /api/bookings - Créer une réservation
app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const {
            adId,
            message
        } = req.body;
        const buyerId = req.user.userId;

        // Vérifier que l'annonce existe
        const adCheck = await pool.query(
            'SELECT user_id, title FROM ads WHERE id = $1 AND is_active = true AND is_sold = false',
            [adId]
        );

        if (adCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée ou inactive'
            });
        }

        const sellerId = adCheck.rows[0].user_id;
        const adTitle = adCheck.rows[0].title;

        // Vérifier la quantité disponible
        const adQuantityCheck = await pool.query(
            'SELECT quantity, sold_quantity, is_sold FROM ads WHERE id = $1',
            [adId]
        );

        if (adQuantityCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }

        const adQuantity = adQuantityCheck.rows[0];
        const availableQuantity = (adQuantity.quantity || 1) - (adQuantity.sold_quantity || 0);

        if (availableQuantity <= 0 || adQuantity.is_sold) {
            return res.status(400).json({
                success: false,
                error: 'Cette annonce est épuisée. Tous les produits ont été réservés.'
            });
        }

        // Vérifier qu'il n'y a pas déjà une réservation en attente pour cet utilisateur
        const existingBooking = await pool.query(
            'SELECT id FROM bookings WHERE ad_id = $1 AND buyer_id = $2 AND status IN (\'pending\', \'accepted\')',
            [adId, buyerId]
        );

        if (existingBooking.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Vous avez déjà une réservation en attente pour cette annonce'
            });
        }

        // Créer la réservation
        const bookingResult = await pool.query(
            `INSERT INTO bookings (ad_id, buyer_id, seller_id, message, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
            [adId, buyerId, sellerId, message || '']
        );

        const booking = bookingResult.rows[0];

        // Créer une notification pour le vendeur
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'booking_request', 'Nouvelle réservation', $2, $3, false)`,
            [sellerId, `${adTitle} - ${message || 'Demande de réservation'}`, booking.id]
        );

        console.log('✅ Réservation créée:', booking.id);

        res.json({
            success: true,
            booking: {
                id: booking.id,
                adId: booking.ad_id,
                buyerId: booking.buyer_id,
                sellerId: booking.seller_id,
                status: booking.status,
                createdAt: booking.created_at
            }
        });
    } catch (error) {
        console.error('❌ Erreur création réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la création de la réservation'
        });
    }
});

// GET /api/bookings/seller - Récupérer les réservations reçues
app.get('/api/bookings/seller', authenticateToken, async (req, res) => {
    try {
        const sellerId = req.user.userId;
        const {
            adId
        } = req.query; // Optionnel : filtrer par annonce

        let query = `
      SELECT 
        b.id, b.ad_id, b.buyer_id, b.seller_id, b.status, 
        b.message, b.created_at, b.updated_at, b.payment_method, b.payment_date,
        a.title, a.price,
        u.first_name, u.last_name, u.email, u.phone,
        ai.image_url
       FROM bookings b
       JOIN ads a ON b.ad_id = a.id
       JOIN users u ON b.buyer_id = u.id
       LEFT JOIN ad_images ai ON a.id = ai.ad_id AND ai.is_primary = true
       WHERE b.seller_id = $1
    `;
        const params = [sellerId];

        if (adId) {
            query += ' AND b.ad_id = $2';
            params.push(adId);
        }

        query += ' ORDER BY b.created_at DESC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            bookings: result.rows.map(row => ({
                id: row.id,
                ad: {
                    id: row.ad_id,
                    title: row.title,
                    price: row.price,
                    imageUrl: row.image_url
                },
                buyer: {
                    id: row.buyer_id,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    email: row.email,
                    phone: row.phone
                },
                status: row.status,
                message: row.message,
                paymentMethod: row.payment_method,
                paymentDate: row.payment_date,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération réservations vendeur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des réservations'
        });
    }
});

// GET /api/bookings/buyer - Récupérer les réservations effectuées
app.get('/api/bookings/buyer', authenticateToken, async (req, res) => {
    try {
        const buyerId = req.user.userId;

        const result = await pool.query(
            `SELECT 
        b.id, b.ad_id, b.buyer_id, b.seller_id, b.status, 
        b.message, b.created_at, b.updated_at,
        a.title, a.price,
        u.first_name, u.last_name, u.email,
        ai.image_url
       FROM bookings b
       JOIN ads a ON b.ad_id = a.id
       JOIN users u ON b.seller_id = u.id
       LEFT JOIN ad_images ai ON a.id = ai.ad_id AND ai.is_primary = true
       WHERE b.buyer_id = $1
       ORDER BY b.created_at DESC`,
            [buyerId]
        );

        res.json({
            success: true,
            bookings: result.rows.map(row => ({
                id: row.id,
                ad: {
                    id: row.ad_id,
                    title: row.title,
                    price: row.price,
                    imageUrl: row.image_url
                },
                seller: {
                    id: row.seller_id,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    email: row.email
                },
                status: row.status,
                message: row.message,
                createdAt: row.created_at
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération réservations acheteur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des réservations'
        });
    }
});

// PATCH /api/bookings/:id/accept - Accepter une réservation
app.patch('/api/bookings/:id/accept', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const sellerId = req.user.userId;

        // Vérifier que c'est le vendeur qui accepte
        const bookingCheck = await pool.query(
            'SELECT seller_id, buyer_id, ad_id, status FROM bookings WHERE id = $1',
            [id]
        );

        if (bookingCheck.rows.length === 0 || bookingCheck.rows[0].seller_id !== sellerId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à accepter cette réservation'
            });
        }

        const booking = bookingCheck.rows[0];

        // Vérifier qu'il n'y a pas déjà une réservation acceptée pour cette annonce
        const existingAccepted = await pool.query(
            'SELECT id FROM bookings WHERE ad_id = $1 AND status = \'accepted\' AND id != $2',
            [booking.ad_id, id]
        );

        if (existingAccepted.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Une réservation a déjà été acceptée pour cette annonce'
            });
        }

        // Rejeter automatiquement toutes les autres réservations en attente pour cette annonce
        await pool.query(
            `UPDATE bookings 
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
       WHERE ad_id = $1 AND status = 'pending' AND id != $2`,
            [booking.ad_id, id]
        );

        // Accepter cette réservation
        await pool.query(
            'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['accepted', id]
        );

        // Notifier l'acheteur
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'booking_accepted', 'Réservation acceptée', 'Votre réservation a été acceptée. Vous pouvez maintenant procéder à la livraison.', $2, false)`,
            [booking.buyer_id, id]
        );

        // Notifier les autres acheteurs que leur réservation a été refusée
        const rejectedBookings = await pool.query(
            'SELECT buyer_id FROM bookings WHERE ad_id = $1 AND status = \'rejected\' AND id != $2',
            [booking.ad_id, id]
        );

        for (const rejected of rejectedBookings.rows) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
         VALUES ($1, 'booking_rejected', 'Réservation refusée', 'Votre réservation a été refusée car une autre réservation a été acceptée.', $2, false)`,
                [rejected.buyer_id, id]
            );
        }

        console.log('✅ Réservation acceptée:', id);

        res.json({
            success: true,
            message: 'Réservation acceptée. Les autres réservations ont été automatiquement refusées.'
        });
    } catch (error) {
        console.error('❌ Erreur acceptation réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'acceptation de la réservation'
        });
    }
});

// PATCH /api/bookings/:id/reject - Refuser une réservation
app.patch('/api/bookings/:id/reject', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const sellerId = req.user.userId;

        // Vérifier que c'est le vendeur qui refuse
        const bookingCheck = await pool.query(
            'SELECT seller_id, buyer_id FROM bookings WHERE id = $1',
            [id]
        );

        if (bookingCheck.rows.length === 0 || bookingCheck.rows[0].seller_id !== sellerId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à refuser cette réservation'
            });
        }

        await pool.query(
            'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['rejected', id]
        );

        // Notifier l'acheteur
        const buyerId = bookingCheck.rows[0].buyer_id;
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'booking_rejected', 'Réservation refusée', 'Votre réservation a été refusée', $2, false)`,
            [buyerId, id]
        );

        console.log('✅ Réservation refusée:', id);

        res.json({
            success: true,
            message: 'Réservation refusée'
        });
    } catch (error) {
        console.error('❌ Erreur refus réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du refus de la réservation'
        });
    }
});

// PATCH /api/bookings/:id/deliver - Confirmer la livraison (vendeur)
app.patch('/api/bookings/:id/deliver', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const sellerId = req.user.userId;

        // Vérifier que c'est le vendeur qui confirme la livraison
        const bookingCheck = await pool.query(
            `SELECT b.seller_id, b.buyer_id, b.status, u.phone as seller_phone
       FROM bookings b
       JOIN users u ON b.seller_id = u.id
       WHERE b.id = $1`,
            [id]
        );

        if (bookingCheck.rows.length === 0 || bookingCheck.rows[0].seller_id !== sellerId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à confirmer la livraison pour cette réservation'
            });
        }

        const booking = bookingCheck.rows[0];

        if (booking.status !== 'accepted') {
            return res.status(400).json({
                success: false,
                error: 'La réservation doit être acceptée avant de confirmer la livraison'
            });
        }

        // Mettre à jour le statut à 'delivered' et enregistrer le numéro du vendeur
        await pool.query(
            `UPDATE bookings 
       SET status = 'delivered', 
           seller_phone = $1,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
            [booking.seller_phone || null, id]
        );

        // Notifier l'acheteur que la livraison est confirmée
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'delivery_confirmed', 'Livraison confirmée', 'La livraison a été confirmée. Veuillez confirmer la réception puis procéder au paiement.', $2, false)`,
            [booking.buyer_id, id]
        );

        console.log('✅ Livraison confirmée pour réservation:', id);

        res.json({
            success: true,
            message: 'Livraison confirmée. L\'acheteur doit confirmer la réception puis procéder au paiement.'
        });
    } catch (error) {
        console.error('❌ Erreur confirmation livraison:', error);
        console.error('Détails:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la confirmation de la livraison',
            details: error.message
        });
    }
});

// PATCH /api/bookings/:id/confirm-delivery - Confirmer la réception (acheteur)
app.patch('/api/bookings/:id/confirm-delivery', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const buyerId = req.user.userId;

        // Vérifier que c'est l'acheteur qui confirme la réception
        const bookingCheck = await pool.query(
            'SELECT buyer_id, seller_id, status FROM bookings WHERE id = $1',
            [id]
        );

        if (bookingCheck.rows.length === 0 || bookingCheck.rows[0].buyer_id !== buyerId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à confirmer la réception pour cette réservation'
            });
        }

        const booking = bookingCheck.rows[0];

        if (booking.status !== 'delivered') {
            return res.status(400).json({
                success: false,
                error: 'La livraison doit être confirmée par le vendeur avant de confirmer la réception'
            });
        }

        // Mettre à jour le statut à 'delivery_confirmed'
        await pool.query(
            `UPDATE bookings 
       SET status = 'delivery_confirmed', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
            [id]
        );

        // Notifier le vendeur que la réception est confirmée
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'delivery_received', 'Réception confirmée', 'Le client a confirmé la réception. Le paiement peut maintenant être effectué.', $2, false)`,
            [booking.seller_id, id]
        );

        console.log('✅ Réception confirmée pour réservation:', id);

        res.json({
            success: true,
            message: 'Réception confirmée. Vous pouvez maintenant procéder au paiement.'
        });
    } catch (error) {
        console.error('❌ Erreur confirmation réception:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la confirmation de la réception'
        });
    }
});

// PATCH /api/bookings/:id/payment - Simuler le paiement Mobile Money (seulement si delivery_confirmed)
app.patch('/api/bookings/:id/payment', authenticateToken, async (req, res) => {
    try {
        const {
            id
        } = req.params;
        const {
            paymentMethod,
            buyerPhone,
            transactionCode
        } = req.body;
        const buyerId = req.user.userId;

        // Vérifier que c'est l'acheteur qui paie
        const bookingCheck = await pool.query(
            `SELECT b.buyer_id, b.seller_id, b.ad_id, b.status, b.seller_phone, u.phone as buyer_phone_db
       FROM bookings b
       JOIN users u ON b.buyer_id = u.id
       WHERE b.id = $1`,
            [id]
        );

        if (bookingCheck.rows.length === 0 || bookingCheck.rows[0].buyer_id !== buyerId) {
            return res.status(403).json({
                success: false,
                error: 'Non autorisé à payer cette réservation'
            });
        }

        const booking = bookingCheck.rows[0];

        // Vérifier que la réception a été confirmée
        if (booking.status !== 'delivery_confirmed') {
            return res.status(400).json({
                success: false,
                error: 'Le paiement n\'est possible qu\'après confirmation de la réception de la livraison'
            });
        }

        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                error: 'Méthode de paiement requise'
            });
        }

        if (paymentMethod === 'mobile_money' && (!buyerPhone || !transactionCode)) {
            return res.status(400).json({
                success: false,
                error: 'Numéro de téléphone et code de transaction requis pour Mobile Money'
            });
        }

        if (!booking.seller_phone) {
            return res.status(400).json({
                success: false,
                error: 'Le numéro de téléphone du vendeur n\'est pas disponible'
            });
        }

        // Simulation du paiement Mobile Money (3 secondes)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Mettre à jour le statut à 'paid'
        await pool.query(
            `UPDATE bookings 
       SET status = 'paid', 
           payment_method = $1, 
           payment_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
            [paymentMethod, id]
        );

        // Incrémenter sold_quantity et vérifier si l'annonce est épuisée
        const adUpdateResult = await pool.query(
            `UPDATE ads 
       SET sold_quantity = sold_quantity + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING quantity, sold_quantity`,
            [booking.ad_id]
        );

        if (adUpdateResult.rows.length > 0) {
            const ad = adUpdateResult.rows[0];
            const totalQuantity = ad.quantity || 1;
            const soldQuantity = ad.sold_quantity || 0;

            // Si toutes les quantités sont vendues, marquer l'annonce comme vendue
            if (soldQuantity >= totalQuantity) {
                await pool.query(
                    `UPDATE ads 
           SET is_sold = true, 
               is_active = false,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
                    [booking.ad_id]
                );
            }
        }

        // Mettre à jour le statut de la réservation à 'completed'
        await pool.query(
            `UPDATE bookings 
       SET status = 'completed', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
            [id]
        );

        // Notifier le vendeur
        await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'payment_received', 'Paiement reçu', 'Le paiement Mobile Money a été reçu. Transaction: ' || $3, $2, false)`,
            [booking.seller_id, id, transactionCode || 'N/A']
        );

        console.log('✅ Paiement Mobile Money effectué pour réservation:', id);

        res.json({
            success: true,
            message: 'Paiement effectué avec succès',
            transactionCode: transactionCode,
            sellerPhone: booking.seller_phone
        });
    } catch (error) {
        console.error('❌ Erreur paiement:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du paiement',
            details: error.message
        });
    }
});

// ============================================
// SYSTÈME DE NOTATION DES UTILISATEURS
// ============================================

// Route pour exécuter la migration du système de notation
app.post('/api/setup/rating-system', async (req, res) => {
    try {
        console.log('🔧 Installation du système de notation...');
        
        // Ajouter les colonnes rating et rating_count à la table users
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 2.50,
            ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
        `);
        
        // Mettre à jour tous les utilisateurs existants avec une note de 2.5
        await pool.query(`
            UPDATE users 
            SET rating = 2.50, rating_count = 0 
            WHERE rating IS NULL;
        `);
        
        // Créer la table user_ratings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_ratings (
                id SERIAL PRIMARY KEY,
                rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rater_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ad_id UUID REFERENCES ads(id) ON DELETE SET NULL,
                rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(rated_user_id, rater_user_id, ad_id)
            );
        `);
        
        // Créer les index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_user_ratings_rated_user ON user_ratings(rated_user_id);
            CREATE INDEX IF NOT EXISTS idx_user_ratings_rater_user ON user_ratings(rater_user_id);
            CREATE INDEX IF NOT EXISTS idx_user_ratings_ad ON user_ratings(ad_id);
        `);
        
        console.log('✅ Système de notation installé avec succès');
        
        res.json({
            success: true,
            message: 'Système de notation installé avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur installation système de notation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'installation du système de notation',
            details: error.message
        });
    }
});

// Route pour noter un utilisateur
app.post('/api/users/:userId/rate', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { rating, comment, adId } = req.body;
        const raterUserId = req.user.userId;
        
        // Validation
        if (!rating || rating < 0 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'La note doit être entre 0 et 5'
            });
        }
        
        // Vérifier qu'on ne note pas soi-même
        if (userId === raterUserId) {
            return res.status(400).json({
                success: false,
                error: 'Vous ne pouvez pas vous noter vous-même'
            });
        }
        
        // Insérer ou mettre à jour la note
        await pool.query(`
            INSERT INTO user_ratings (rated_user_id, rater_user_id, ad_id, rating, comment)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (rated_user_id, rater_user_id, ad_id) 
            DO UPDATE SET rating = $4, comment = $5, created_at = CURRENT_TIMESTAMP
        `, [userId, raterUserId, adId || null, rating, comment || null]);
        
        // Recalculer la note moyenne de l'utilisateur
        const avgResult = await pool.query(`
            SELECT COALESCE(AVG(rating), 2.50) as avg_rating, COUNT(*) as rating_count
            FROM user_ratings
            WHERE rated_user_id = $1
        `, [userId]);
        
        const avgRating = parseFloat(avgResult.rows[0].avg_rating).toFixed(2);
        const ratingCount = parseInt(avgResult.rows[0].rating_count);
        
        // Mettre à jour la note de l'utilisateur
        await pool.query(`
            UPDATE users 
            SET rating = $1, rating_count = $2 
            WHERE id = $3
        `, [avgRating, ratingCount, userId]);
        
        console.log(`✅ Note ajoutée: ${rating}/5 pour utilisateur ${userId}`);
        
        res.json({
            success: true,
            message: 'Note enregistrée avec succès',
            newRating: avgRating,
            ratingCount: ratingCount
        });
    } catch (error) {
        console.error('❌ Erreur notation utilisateur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la notation',
            details: error.message
        });
    }
});

// Route pour récupérer les notes d'un utilisateur
app.get('/api/users/:userId/ratings', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Récupérer les informations de l'utilisateur
        const userResult = await pool.query(`
            SELECT rating, rating_count 
            FROM users 
            WHERE id = $1
        `, [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        const user = userResult.rows[0];
        
        // Récupérer les évaluations individuelles (les 10 dernières)
        const ratingsResult = await pool.query(`
            SELECT 
                ur.rating,
                ur.comment,
                ur.created_at,
                u.first_name,
                u.last_name
            FROM user_ratings ur
            JOIN users u ON ur.rater_user_id = u.id
            WHERE ur.rated_user_id = $1
            ORDER BY ur.created_at DESC
            LIMIT 10
        `, [userId]);
        
        res.json({
            success: true,
            averageRating: parseFloat(user.rating),
            ratingCount: user.rating_count,
            ratings: ratingsResult.rows.map(r => ({
                rating: r.rating,
                comment: r.comment,
                createdAt: r.created_at,
                raterName: `${r.first_name} ${r.last_name.charAt(0)}.`
            }))
        });
    } catch (error) {
        console.error('❌ Erreur récupération notes:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des notes'
        });
    }
});

// Route pour vérifier si un utilisateur peut noter un autre (a effectué une transaction)
app.get('/api/users/:userId/can-rate', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const raterUserId = req.user.userId;
        
        // Vérifier si l'utilisateur a effectué une réservation avec cet utilisateur
        const result = await pool.query(`
            SELECT COUNT(*) as count
            FROM bookings b
            JOIN ads a ON b.ad_id = a.id
            WHERE a.user_id = $1 
            AND b.buyer_id = $2
            AND b.status = 'completed'
        `, [userId, raterUserId]);
        
        const canRate = parseInt(result.rows[0].count) > 0;
        
        res.json({
            success: true,
            canRate: canRate
        });
    } catch (error) {
        console.error('❌ Erreur vérification droit de notation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification'
        });
    }
});

// ============================================
// SYSTÈME DE FAVORIS
// ============================================

// Route pour installer le système de favoris (première exécution)
app.post('/api/setup/favorites-system', async (req, res) => {
    try {
        console.log('🔧 Installation du système de favoris...');
        
        // Créer la table des favoris
        await pool.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, ad_id)
            );
        `);
        
        // Créer les index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
            CREATE INDEX IF NOT EXISTS idx_favorites_ad_id ON favorites(ad_id);
            CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);
        `);
        
        console.log('✅ Système de favoris installé avec succès');
        
        res.json({
            success: true,
            message: 'Système de favoris installé avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur installation système favoris:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'installation du système de favoris',
            details: error.message
        });
    }
});

// Ajouter/Retirer un favori
app.post('/api/favorites/:adId', authenticateToken, async (req, res) => {
    try {
        const { adId } = req.params;
        const userId = req.user.userId;
        
        // Vérifier si l'annonce existe
        const adCheck = await pool.query('SELECT id FROM ads WHERE id = $1', [adId]);
        if (adCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annonce non trouvée'
            });
        }
        
        // Vérifier si déjà en favoris
        const existingFavorite = await pool.query(
            'SELECT id FROM favorites WHERE user_id = $1 AND ad_id = $2',
            [userId, adId]
        );
        
        if (existingFavorite.rows.length > 0) {
            // Retirer des favoris
            await pool.query(
                'DELETE FROM favorites WHERE user_id = $1 AND ad_id = $2',
                [userId, adId]
            );
            
            console.log(`❌ Favori retiré: annonce ${adId} pour utilisateur ${userId}`);
            
            return res.json({
                success: true,
                isFavorite: false,
                message: 'Annonce retirée des favoris'
            });
        } else {
            // Ajouter aux favoris
            await pool.query(
                'INSERT INTO favorites (user_id, ad_id) VALUES ($1, $2)',
                [userId, adId]
            );
            
            console.log(`✅ Favori ajouté: annonce ${adId} pour utilisateur ${userId}`);
            
            return res.json({
                success: true,
                isFavorite: true,
                message: 'Annonce ajoutée aux favoris'
            });
        }
    } catch (error) {
        console.error('❌ Erreur ajout/retrait favori:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la modification des favoris'
        });
    }
});

// Récupérer tous les favoris de l'utilisateur
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const baseUrl = req.protocol + '://' + req.get('host');
        
        const result = await pool.query(`
            SELECT 
                a.*,
                u.first_name,
                u.last_name,
                u.rating,
                u.rating_count,
                c.name as category_name,
                c.slug as category_slug,
                c.icon as category_icon,
                c.color as category_color,
                ai.image_url,
                CONCAT('${baseUrl}', ai.image_url) as full_image_url,
                f.created_at as favorited_at
            FROM favorites f
            JOIN ads a ON f.ad_id = a.id
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN ad_images ai ON a.id = ai.ad_id AND ai.is_primary = true
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
        `, [userId]);
        
        const favorites = result.rows.map(ad => ({
            id: ad.id,
            title: ad.title,
            description: ad.description,
            price: ad.price,
            priceNegotiable: ad.price_negotiable,
            condition: ad.condition,
            city: ad.city,
            postalCode: ad.postal_code,
            isActive: ad.is_active,
            isSold: ad.is_sold,
            isFeatured: ad.is_featured,
            viewCount: ad.view_count,
            createdAt: ad.created_at,
            updatedAt: ad.updated_at,
            favoritedAt: ad.favorited_at,
            user: {
                firstName: ad.first_name,
                lastName: ad.last_name,
                rating: ad.rating,
                ratingCount: ad.rating_count,
            },
            category: {
                name: ad.category_name,
                slug: ad.category_slug,
                icon: ad.category_icon,
                color: ad.category_color,
            },
            imageUrl: ad.full_image_url || ad.image_url,
            userId: ad.user_id,
            categoryId: ad.category_id,
        }));
        
        res.json({
            success: true,
            favorites: favorites,
            count: favorites.length
        });
    } catch (error) {
        console.error('❌ Erreur récupération favoris:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des favoris'
        });
    }
});

// Vérifier si une annonce est en favoris
app.get('/api/favorites/:adId/check', authenticateToken, async (req, res) => {
    try {
        const { adId } = req.params;
        const userId = req.user.userId;
        
        const result = await pool.query(
            'SELECT id FROM favorites WHERE user_id = $1 AND ad_id = $2',
            [userId, adId]
        );
        
        res.json({
            success: true,
            isFavorite: result.rows.length > 0
        });
    } catch (error) {
        console.error('❌ Erreur vérification favori:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification'
        });
    }
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Écouter sur toutes les interfaces

app.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('🚀 BACKEND TIA MARKET DÉMARRÉ');
    console.log('='.repeat(60));
    console.log(`📡 Serveur: http://${HOST}:${PORT}`);
    console.log(`💻 Local: http://localhost:${PORT}`);
    // Détecter l'IP automatiquement si possible
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let detectedIP = '192.168.88.29'; // IP par défaut

    // Chercher une IP locale
    for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        for (const addr of addresses) {
            if (addr.family === 'IPv4' && !addr.internal && addr.address.startsWith('192.168.')) {
                detectedIP = addr.address;
                break;
            }
        }
        if (detectedIP !== '192.168.88.29') break;
    }

    console.log(`📱 Mobile: http://${detectedIP}:${PORT}`);
    console.log(`⚠️  Si l'IP est différente, mettez à jour tia-market/utils/config.ts`);
    console.log('='.repeat(60));
    console.log('🔗 Endpoints:');
    console.log(`   🔍 Test: GET /api/test`);
    console.log(`   📝 Register: POST /api/register`);
    console.log(`   🔑 Login: POST /api/login`);
    console.log(`   📸 Upload image: POST /api/ads/images`);
    console.log(`   🖼️ Get images: GET /api/ads/:id/images`);
    console.log(`   ⭐ Mark primary: PATCH /api/ads/images/:id`);
    console.log(`   🗑️ Delete image: DELETE /api/ads/images/:id`);
    console.log('='.repeat(60));
    console.log('📁 Dossier uploads:', path.join(__dirname, 'uploads'));
    console.log('='.repeat(60));
});