// backend/routes/ads.js - Ajoutez ces routes pour les images

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration du stockage pour multer
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
    cb(null, 'ad-' + req.body.adId + '-' + uniqueSuffix + path.extname(file.originalname));
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
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// Route pour uploader une image d'annonce
router.post('/images', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }

    const { adId, isPrimary } = req.body;
    
    // Vérifier que l'annonce existe
    const adCheck = await pool.query('SELECT id FROM ads WHERE id = $1', [adId]);
    if (adCheck.rows.length === 0) {
      // Supprimer le fichier uploadé
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Annonce non trouvée' });
    }

    // Insérer l'image dans la base de données
    const result = await pool.query(
      `INSERT INTO ad_images (ad_id, image_url, is_primary) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [adId, `/uploads/${req.file.filename}`, isPrimary === 'true']
    );

    res.json({
      success: true,
      image: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erreur upload image:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erreur lors de l\'upload de l\'image' });
  }
});

// Route pour marquer une image comme primaire
router.patch('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isPrimary } = req.body;

    // D'abord, désélectionner toutes les images primaires pour cette annonce
    const adImage = await pool.query('SELECT ad_id FROM ad_images WHERE id = $1', [id]);
    
    if (adImage.rows.length > 0) {
      await pool.query(
        'UPDATE ad_images SET is_primary = false WHERE ad_id = $1',
        [adImage.rows[0].ad_id]
      );
    }

    // Puis marquer cette image comme primaire
    const result = await pool.query(
      'UPDATE ad_images SET is_primary = $1 WHERE id = $2 RETURNING *',
      [isPrimary, id]
    );

    res.json({
      success: true,
      image: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour image:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'image' });
  }
});

module.exports = router;