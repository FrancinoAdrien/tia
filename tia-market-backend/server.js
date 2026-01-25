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
       RETURNING id, email, first_name, last_name, phone, created_at`,
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
              u.phone, u.is_verified, u.created_at
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
              u.is_verified, u.created_at, up.city, up.avatar_url, up.bio
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

// Démarrer le serveur - IMPORTANT: écouter sur toutes les interfaces
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Écouter sur toutes les interfaces

app.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('🚀 BACKEND TIA MARKET DÉMARRÉ');
    console.log('='.repeat(60));
    console.log(`📡 Serveur: http://${HOST}:${PORT}`);
    console.log(`💻 Local: http://localhost:${PORT}`);
    console.log(`📱 Mobile: http://192.168.88.29:${PORT}`);
    console.log('='.repeat(60));
    console.log('🔗 Endpoints:');
    console.log(`   🔍 Test: http://192.168.88.29:${PORT}/api/test`);
    console.log(`   📝 Register: POST http://192.168.88.29:${PORT}/api/register`);
    console.log(`   🔑 Login: POST http://192.168.88.29:${PORT}/api/login`);
    console.log('='.repeat(60));
    console.log('📱 Pour tester depuis votre téléphone:');
    console.log(`   1. Ouvrez Chrome sur votre téléphone`);
    console.log(`   2. Allez à: http://192.168.88.29:${PORT}/api/test`);
    console.log(`   3. Vous devriez voir "Backend TIA Market Opérationnel"`);
    console.log('='.repeat(60));
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

        // Insérer l'annonce
        const result = await pool.query(
            `INSERT INTO ads (
        user_id, category_id, title, description, price, 
        price_negotiable, condition, city, postal_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
            ]
        );

        const ad = result.rows[0];

        console.log('✅ Annonce créée ID:', ad.id);

        res.status(201).json({
            success: true,
            message: 'Annonce créée avec succès',
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
                createdAt: ad.created_at,
                isActive: ad.is_active,
                isSold: ad.is_sold,
                isFeatured: ad.is_featured,
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

// Route pour les annonces récentes
app.get('/api/ads/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const baseUrl = req.protocol + '://' + req.get('host');

        const result = await pool.query(
            `SELECT 
        a.*,
        u.first_name,
        u.last_name,
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
      ORDER BY a.created_at DESC
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

// Route pour les annonces populaires
app.get('/api/ads/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const result = await pool.query(
            `SELECT 
        a.*,
        u.first_name,
        u.last_name,
        c.name as category_name,
        c.slug as category_slug,
        (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as image_url
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.is_active = true AND a.is_sold = false
      ORDER BY a.view_count DESC, a.created_at DESC
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
                },
                category: {
                    name: ad.category_name,
                    slug: ad.category_slug,
                },
                imageUrl: ad.image_url,
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

app.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('🚀 BACKEND TIA MARKET DÉMARRÉ');
    console.log('='.repeat(60));
    console.log(`📡 Serveur: http://${HOST}:${PORT}`);
    console.log(`💻 Local: http://localhost:${PORT}`);
    console.log(`📱 Mobile: http://192.168.88.29:${PORT}`);
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

const result = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
          u.is_verified, u.is_premium, u.created_at, up.city, up.avatar_url, up.bio
   FROM users u
   LEFT JOIN user_profiles up ON u.id = up.id
   WHERE u.id = $1`,
    [req.user.userId]
);

app.patch('/api/user/premium', authenticateToken, async (req, res) => {
    try {
        const {
            isPremium
        } = req.body;

        if (typeof isPremium !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Le champ isPremium est requis et doit être un booléen'
            });
        }

        const result = await pool.query(
            `UPDATE users 
       SET is_premium = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, first_name, last_name, phone, is_premium, is_verified, created_at`,
            [isPremium, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            message: isPremium ? 'Statut premium activé avec succès' : 'Statut premium désactivé',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                isPremium: user.is_premium,
                isVerified: user.is_verified,
                createdAt: user.created_at,
            }
        });
    } catch (error) {
        console.error('❌ Erreur mise à jour statut premium:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour du statut premium',
            details: error.message
        });
    }
});