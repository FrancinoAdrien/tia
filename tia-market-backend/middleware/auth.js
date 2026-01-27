/**
 * Middleware d'authentification
 * Vérifie le token JWT et attache les informations utilisateur à la requête
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware pour authentifier les requêtes avec token JWT
 * Utilisation: app.get('/api/protected', authenticateToken, (req, res) => {...})
 */
function authenticateToken(req, res, next) {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token d\'authentification requis',
            message: 'Veuillez vous connecter pour accéder à cette ressource'
        });
    }

    // Vérifier le token
    jwt.verify(token, process.env.JWT_SECRET || 'tia_market_secret_key', (err, user) => {
        if (err) {
            // Token invalide ou expiré
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token expiré',
                    message: 'Votre session a expiré. Veuillez vous reconnecter.'
                });
            }

            return res.status(403).json({
                success: false,
                error: 'Token invalide',
                message: 'Le token d\'authentification est invalide'
            });
        }

        // Token valide - attacher les infos utilisateur à la requête
        req.user = user;
        next();
    });
}

/**
 * Middleware optionnel pour les routes qui peuvent fonctionner avec ou sans auth
 * Attache les infos utilisateur si le token est présent et valide, sinon continue
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // Pas de token, mais on continue quand même
        req.user = null;
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET || 'tia_market_secret_key', (err, user) => {
        if (err) {
            // Token invalide, on continue sans utilisateur
            req.user = null;
        } else {
            // Token valide
            req.user = user;
        }
        next();
    });
}

/**
 * Middleware pour vérifier si l'utilisateur a un pack premium actif
 */
function requirePremium(req, res, next) {
    // Vérifier d'abord l'authentification
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentification requise'
        });
    }

    // Vérifier le pack premium depuis la base de données
    req.db.query(
        'SELECT premium_pack, premium_end_date FROM users WHERE id = $1',
        [req.user.userId]
    ).then(result => {
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        const user = result.rows[0];
        const isPremium = user.premium_pack !== 'simple';
        const isPremiumActive = user.premium_end_date && new Date(user.premium_end_date) > new Date();

        if (!isPremium || !isPremiumActive) {
            return res.status(403).json({
                success: false,
                error: 'Abonnement premium requis',
                message: 'Cette fonctionnalité est réservée aux membres premium'
            });
        }

        req.user.premiumPack = user.premium_pack;
        next();
    }).catch(error => {
        console.error('❌ Erreur vérification premium:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification du premium'
        });
    });
}

/**
 * Middleware pour vérifier un pack premium spécifique
 * @param {string[]} allowedPacks - Packs autorisés (ex: ['pro', 'entreprise'])
 */
function requireSpecificPack(allowedPacks) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentification requise'
            });
        }

        req.db.query(
            'SELECT premium_pack, premium_end_date FROM users WHERE id = $1',
            [req.user.userId]
        ).then(result => {
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                });
            }

            const user = result.rows[0];
            const isPremiumActive = user.premium_end_date && new Date(user.premium_end_date) > new Date();

            if (!allowedPacks.includes(user.premium_pack) || !isPremiumActive) {
                return res.status(403).json({
                    success: false,
                    error: 'Pack premium insuffisant',
                    message: `Cette fonctionnalité requiert un pack: ${allowedPacks.join(' ou ')}`,
                    currentPack: user.premium_pack
                });
            }

            req.user.premiumPack = user.premium_pack;
            next();
        }).catch(error => {
            console.error('❌ Erreur vérification pack:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la vérification du pack'
            });
        });
    };
}

/**
 * Middleware pour attacher la connexion DB à la requête
 */
function attachDb(pool) {
    return (req, res, next) => {
        req.db = pool;
        next();
    };
}

module.exports = {
    authenticateToken,
    optionalAuth,
    requirePremium,
    requireSpecificPack,
    attachDb
};
