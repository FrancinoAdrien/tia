// backend/server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
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
        ip: '192.168.88.43',
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
  
  const { email, password, firstName, lastName, phone } = req.body;

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
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'tia_market_secret_key_192.168.88.43',
      { expiresIn: '7d' }
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
  
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email et mot de passe requis',
      received: { email: !!email, password: !!password }
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
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'tia_market_secret_key_192.168.88.43',
      { expiresIn: '7d' }
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
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'tia_market_secret_key_192.168.88.43', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide ou expiré' });
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
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
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
      return res.status(400).json({ error: 'Catégorie invalide' });
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
    res.status(500).json({ error: 'Erreur récupération catégories' });
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
    res.status(500).json({ error: 'Erreur récupération sous-catégories' });
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
        u.is_premium,
        c.name as category_name,
        c.slug as category_slug,
        (SELECT image_url FROM ad_images WHERE ad_id = a.id AND is_primary = true LIMIT 1) as image_url
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.is_active = true AND a.is_sold = false
      ORDER BY 
        CASE WHEN u.is_premium = true THEN 0 ELSE 1 END,
        a.is_featured DESC,
        a.view_count DESC, 
        a.created_at DESC
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
      fs.mkdirSync(uploadPath, { recursive: true });
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
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

    const { adId, isPrimary = 'false' } = req.body;
    
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
    const { id } = req.params;

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
    const { id } = req.params;

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
    const { id } = req.params;
    
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
    const { id } = req.params;
    const { imageOrder } = req.body; // Tableau d'IDs dans l'ordre souhaité
    
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
    const { id } = req.params;
    
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
    const { id } = req.params;
    
    await pool.query(
      'UPDATE ads SET view_count = view_count + 1 WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
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
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 6;
    
    // Récupérer la catégorie de l'annonce
    const adResult = await pool.query(
      'SELECT category_id FROM ads WHERE id = $1',
      [id]
    );
    
    if (adResult.rows.length === 0) {
      return res.json({ success: true, ads: [] });
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
    const { conversationId, adId, receiverId, content } = req.body;
    
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
    }
    else {
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { adId } = req.params;
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

// Mettre à jour le premium
app.patch('/api/user/premium', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Plan invalide',
      });
    }

    // Calculer la date d'expiration
    const daysToAdd = plan === 'monthly' ? 30 : 365;
    const endPremiumDate = new Date();
    endPremiumDate.setDate(endPremiumDate.getDate() + daysToAdd);

    // Mettre à jour l'utilisateur
    const result = await pool.query(
      `UPDATE users 
       SET is_premium = true, end_premium = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, first_name, last_name, phone, is_verified, is_premium, end_premium, created_at`,
      [endPremiumDate, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];
    console.log('✅ Utilisateur passé en premium:', user.email);

    res.json({
      success: true,
      message: 'Abonnement premium activé',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isVerified: user.is_verified,
        isPremium: user.is_premium,
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
    const { id } = req.params;

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
    const { id } = req.params;
    const { 
      type, title, description, pricePerUnit, unitType, availableFromDate, 
      availableToDate, isOpen24h, openingTime, closingTime, capacity, 
      features, phone, email, website, location 
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
    const { id } = req.params;

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
    const { adId, message } = req.body;
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

    // Vérifier qu'il n'y a pas déjà une réservation acceptée pour cette annonce
    const acceptedBooking = await pool.query(
      'SELECT id FROM bookings WHERE ad_id = $1 AND status = \'accepted\'',
      [adId]
    );

    if (acceptedBooking.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cette annonce a déjà une réservation acceptée. Les nouvelles réservations ne sont plus possibles.'
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
    const { adId } = req.query; // Optionnel : filtrer par annonce

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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
    const sellerId = req.user.userId;

    // Vérifier que c'est le vendeur qui confirme la livraison
    const bookingCheck = await pool.query(
      'SELECT seller_id, buyer_id, status FROM bookings WHERE id = $1',
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

    // Mettre à jour le statut à 'delivered' (on utilisera 'paid' comme statut temporaire, ou on peut ajouter 'delivered')
    // Pour l'instant, on va utiliser un statut personnalisé dans payment_method pour indiquer la livraison
    await pool.query(
      `UPDATE bookings 
       SET status = 'delivered', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    // Notifier l'acheteur que la livraison est confirmée
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'delivery_confirmed', 'Livraison confirmée', 'La livraison a été confirmée. Vous pouvez maintenant procéder au paiement.', $2, false)`,
      [booking.buyer_id, id]
    );

    console.log('✅ Livraison confirmée pour réservation:', id);

    res.json({
      success: true,
      message: 'Livraison confirmée. L\'acheteur peut maintenant procéder au paiement.'
    });
  } catch (error) {
    console.error('❌ Erreur confirmation livraison:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la confirmation de la livraison'
    });
  }
});

// PATCH /api/bookings/:id/payment - Simuler le paiement (seulement si delivered)
app.patch('/api/bookings/:id/payment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const buyerId = req.user.userId;

    // Vérifier que c'est l'acheteur qui paie
    const bookingCheck = await pool.query(
      'SELECT buyer_id, seller_id, ad_id, status FROM bookings WHERE id = $1',
      [id]
    );

    if (bookingCheck.rows.length === 0 || bookingCheck.rows[0].buyer_id !== buyerId) {
      return res.status(403).json({
        success: false,
        error: 'Non autorisé à payer cette réservation'
      });
    }

    const booking = bookingCheck.rows[0];

    // Vérifier que la livraison a été confirmée
    if (booking.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        error: 'Le paiement n\'est possible qu\'après confirmation de la livraison par le vendeur'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Méthode de paiement requise'
      });
    }

    // Simulation du paiement (2 secondes)
    await new Promise(resolve => setTimeout(resolve, 2000));

    await pool.query(
      `UPDATE bookings 
       SET status = 'paid', 
           payment_method = $1, 
           payment_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [paymentMethod, id]
    );

    // Notifier le vendeur
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
       VALUES ($1, 'payment_received', 'Paiement reçu', 'Le paiement a été reçu pour votre annonce', $2, false)`,
      [booking.seller_id, id]
    );

    console.log('✅ Paiement effectué pour réservation:', id);

    res.json({
      success: true,
      message: 'Paiement effectué avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur paiement:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du paiement'
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
  console.log(`📱 Mobile: http://192.168.88.43:${PORT}`);
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