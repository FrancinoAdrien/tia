/**
 * Routes d'authentification avancées
 * - Google OAuth
 * - Vérification Email (commentée pour configuration future)
 * - Vérification SMS (commentée pour configuration future)
 * - Inscription et connexion classiques
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jwt');
const crypto = require('crypto');

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Générer un token JWT
 */
function generateToken(userId, email) {
    return jwt.sign(
        { userId, email },
        process.env.JWT_SECRET || 'tia_market_secret_key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

/**
 * Générer un code de vérification à 6 chiffres
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Générer un token de vérification email
 */
function generateEmailToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// INSCRIPTION CLASSIQUE
// ============================================================================

/**
 * Inscription classique avec email/mot de passe
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;

    console.log('📝 Tentative d\'inscription:', email);

    // Validation des champs
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email et mot de passe requis'
        });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            error: 'Format d\'email invalide'
        });
    }

    // Validation du mot de passe (min 6 caractères)
    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            error: 'Le mot de passe doit contenir au moins 6 caractères'
        });
    }

    try {
        // Vérifier si l'email existe déjà
        const existingUser = await req.db.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cet email est déjà utilisé'
            });
        }

        // Hasher le mot de passe
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // ========================================================================
        // VÉRIFICATION EMAIL - COMMENTÉ POUR CONFIGURATION FUTURE
        // ========================================================================
        // Générer un token de vérification email
        // const emailVerificationToken = generateEmailToken();
        // const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        // Insérer l'utilisateur
        const result = await req.db.query(
            `INSERT INTO users (
                email, 
                password_hash, 
                first_name, 
                last_name, 
                phone
                -- email_verification_token,
                -- verification_code_expires_at
            ) 
            VALUES ($1, $2, $3, $4, $5) 
            -- VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, first_name, last_name, phone, created_at`,
            [
                email.toLowerCase(), 
                passwordHash, 
                firstName || null, 
                lastName || null, 
                phone || null
                // emailVerificationToken,
                // tokenExpiry
            ]
        );

        const user = result.rows[0];

        // Créer le profil utilisateur
        await req.db.query(
            'INSERT INTO user_profiles (id) VALUES ($1)',
            [user.id]
        );

        // ========================================================================
        // ENVOYER EMAIL DE VÉRIFICATION - COMMENTÉ
        // ========================================================================
        // if (process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== 'simulation') {
        //     try {
        //         const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;
        //         await sendVerificationEmail(user.email, verificationUrl, user.first_name);
        //         console.log('📧 Email de vérification envoyé à:', user.email);
        //     } catch (emailError) {
        //         console.error('⚠️ Erreur envoi email:', emailError);
        //         // Ne pas bloquer l'inscription si l'email échoue
        //     }
        // }

        // Générer le token JWT
        const token = generateToken(user.id, user.email);

        console.log('✅ Utilisateur créé:', user.email);

        res.status(201).json({
            success: true,
            message: 'Compte créé avec succès',
            // emailVerificationSent: false, // Mettre true quand activé
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                emailVerified: false, // Toujours false jusqu'à vérification
                phoneVerified: false,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la création du compte'
        });
    }
});

// ============================================================================
// CONNEXION CLASSIQUE
// ============================================================================

/**
 * Connexion avec email/mot de passe
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    console.log('🔑 Tentative de connexion:', email);

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email et mot de passe requis'
        });
    }

    try {
        // Récupérer l'utilisateur
        const result = await req.db.query(
            `SELECT 
                u.*,
                up.avatar_url,
                up.city,
                up.bio,
                up.rating as user_rating
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.id
             WHERE u.email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect'
            });
        }

        const user = result.rows[0];

        // Vérifier si c'est un compte Google (pas de mot de passe)
        if (user.google_id && !user.password_hash) {
            return res.status(401).json({
                success: false,
                error: 'Ce compte utilise Google. Veuillez vous connecter avec Google.'
            });
        }

        // Vérifier le mot de passe
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect'
            });
        }

        // Vérifier si le compte est actif
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Ce compte a été désactivé'
            });
        }

        // Mettre à jour la date de dernière connexion
        await req.db.query(
            'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Générer le token JWT
        const token = generateToken(user.id, user.email);

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
                premiumPack: user.premium_pack,
                badge: user.badge,
                isVerified: user.is_verified,
                emailVerified: user.email_verified,
                phoneVerified: user.phone_verified,
                avatar: user.avatar_url,
                city: user.city,
                bio: user.bio,
                rating: parseFloat(user.user_rating),
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('❌ Erreur connexion:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la connexion'
        });
    }
});

// ============================================================================
// GOOGLE OAUTH - COMMENTÉ POUR CONFIGURATION FUTURE
// ============================================================================

/**
 * Connexion / Inscription avec Google
 * POST /api/auth/google
 * 
 * Body attendu: { idToken: "google-id-token" }
 * 
 * CONFIGURATION REQUISE:
 * - GOOGLE_CLIENT_ID dans .env
 * - npm install google-auth-library
 * 
 * Voir CONFIGURATION_SERVICES.md pour les détails
 */
router.post('/google', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({
            success: false,
            error: 'Token Google requis'
        });
    }

    try {
        // ====================================================================
        // DÉCOMMENTEZ CE CODE APRÈS AVOIR CONFIGURÉ GOOGLE OAUTH
        // ====================================================================
        
        // const { OAuth2Client } = require('google-auth-library');
        // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        // // Vérifier le token Google
        // const ticket = await client.verifyIdToken({
        //     idToken: idToken,
        //     audience: process.env.GOOGLE_CLIENT_ID,
        // });
        
        // const payload = ticket.getPayload();
        // const googleId = payload.sub;
        // const email = payload.email;
        // const firstName = payload.given_name;
        // const lastName = payload.family_name;
        // const profilePicture = payload.picture;
        // const emailVerified = payload.email_verified;

        // // Vérifier si l'utilisateur existe déjà (par email ou google_id)
        // let user = await req.db.query(
        //     'SELECT * FROM users WHERE email = $1 OR google_id = $2',
        //     [email, googleId]
        // );

        // if (user.rows.length > 0) {
        //     // Utilisateur existant - mettre à jour google_id si nécessaire
        //     user = user.rows[0];
            
        //     if (!user.google_id) {
        //         await req.db.query(
        //             'UPDATE users SET google_id = $1, google_profile_picture = $2, email_verified = $3 WHERE id = $4',
        //             [googleId, profilePicture, emailVerified, user.id]
        //         );
        //     }
        // } else {
        //     // Nouvel utilisateur - créer le compte
        //     const result = await req.db.query(
        //         `INSERT INTO users (
        //             email, 
        //             password_hash,
        //             first_name, 
        //             last_name, 
        //             google_id,
        //             google_profile_picture,
        //             email_verified,
        //             is_verified
        //         ) 
        //         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        //         RETURNING *`,
        //         [
        //             email,
        //             '', // Pas de mot de passe pour les comptes Google
        //             firstName,
        //             lastName,
        //             googleId,
        //             profilePicture,
        //             emailVerified,
        //             emailVerified
        //         ]
        //     );

        //     user = result.rows[0];

        //     // Créer le profil
        //     await req.db.query(
        //         'INSERT INTO user_profiles (id, avatar_url) VALUES ($1, $2)',
        //         [user.id, profilePicture]
        //     );

        //     console.log('✅ Nouvel utilisateur Google créé:', email);
        // }

        // // Générer le token JWT
        // const token = generateToken(user.id, user.email);

        // res.json({
        //     success: true,
        //     message: 'Connexion Google réussie',
        //     token,
        //     user: {
        //         id: user.id,
        //         email: user.email,
        //         firstName: user.first_name,
        //         lastName: user.last_name,
        //         avatar: user.google_profile_picture,
        //         emailVerified: user.email_verified,
        //         premiumPack: user.premium_pack,
        //         badge: user.badge,
        //         createdAt: user.created_at
        //     }
        // });

        // ====================================================================
        // EN ATTENDANT LA CONFIGURATION, RETOURNER UNE ERREUR EXPLICITE
        // ====================================================================
        
        return res.status(501).json({
            success: false,
            error: 'Google OAuth n\'est pas encore configuré',
            message: 'Veuillez consulter CONFIGURATION_SERVICES.md pour configurer Google OAuth',
            documentation: '/CONFIGURATION_SERVICES.md#google-oauth'
        });

    } catch (error) {
        console.error('❌ Erreur connexion Google:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la connexion Google',
            details: error.message
        });
    }
});

// ============================================================================
// VÉRIFICATION EMAIL - COMMENTÉ POUR CONFIGURATION FUTURE
// ============================================================================

/**
 * Envoyer un code de vérification par email
 * POST /api/auth/send-email-verification
 * 
 * CONFIGURATION REQUISE:
 * - EMAIL_PROVIDER dans .env (sendgrid, gmail, ou smtp)
 * - Clés API appropriées
 * 
 * Voir CONFIGURATION_SERVICES.md pour les détails
 */
router.post('/send-email-verification', async (req, res) => {
    const userId = req.user.userId;

    try {
        // const user = await req.db.query(
        //     'SELECT * FROM users WHERE id = $1',
        //     [userId]
        // );

        // if (user.rows.length === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         error: 'Utilisateur non trouvé'
        //     });
        // }

        // if (user.rows[0].email_verified) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Email déjà vérifié'
        //     });
        // }

        // // Générer un nouveau token
        // const emailVerificationToken = generateEmailToken();
        // const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        // await req.db.query(
        //     'UPDATE users SET email_verification_token = $1, verification_code_expires_at = $2 WHERE id = $3',
        //     [emailVerificationToken, tokenExpiry, userId]
        // );

        // // Envoyer l'email
        // const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;
        // await sendVerificationEmail(user.rows[0].email, verificationUrl, user.rows[0].first_name);

        // res.json({
        //     success: true,
        //     message: 'Email de vérification envoyé'
        // });

        return res.status(501).json({
            success: false,
            error: 'La vérification par email n\'est pas encore configurée',
            message: 'Veuillez consulter CONFIGURATION_SERVICES.md pour configurer l\'envoi d\'emails',
            documentation: '/CONFIGURATION_SERVICES.md#verification-email'
        });

    } catch (error) {
        console.error('❌ Erreur envoi email:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'envoi de l\'email de vérification'
        });
    }
});

/**
 * Vérifier l'email avec le token
 * POST /api/auth/verify-email
 */
router.post('/verify-email', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Token requis'
        });
    }

    try {
        // const result = await req.db.query(
        //     `SELECT * FROM users 
        //      WHERE email_verification_token = $1 
        //      AND verification_code_expires_at > CURRENT_TIMESTAMP`,
        //     [token]
        // );

        // if (result.rows.length === 0) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Token invalide ou expiré'
        //     });
        // }

        // const user = result.rows[0];

        // // Marquer l'email comme vérifié
        // await req.db.query(
        //     `UPDATE users 
        //      SET email_verified = true, 
        //          is_verified = true,
        //          email_verification_token = NULL,
        //          verification_code_expires_at = NULL
        //      WHERE id = $1`,
        //     [user.id]
        // );

        // console.log('✅ Email vérifié pour:', user.email);

        // res.json({
        //     success: true,
        //     message: 'Email vérifié avec succès'
        // });

        return res.status(501).json({
            success: false,
            error: 'La vérification par email n\'est pas encore configurée',
            documentation: '/CONFIGURATION_SERVICES.md#verification-email'
        });

    } catch (error) {
        console.error('❌ Erreur vérification email:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification de l\'email'
        });
    }
});

// ============================================================================
// VÉRIFICATION SMS - COMMENTÉ POUR CONFIGURATION FUTURE
// ============================================================================

/**
 * Envoyer un code de vérification par SMS
 * POST /api/auth/send-sms-verification
 * 
 * CONFIGURATION REQUISE:
 * - SMS_PROVIDER dans .env (twilio, orange, africasms, ou simulation)
 * - Clés API appropriées
 * 
 * En mode simulation, n'importe quel code fonctionne
 * 
 * Voir CONFIGURATION_SERVICES.md pour les détails
 */
router.post('/send-sms-verification', async (req, res) => {
    const { phone } = req.body;
    const userId = req.user.userId;

    if (!phone) {
        return res.status(400).json({
            success: false,
            error: 'Numéro de téléphone requis'
        });
    }

    try {
        // // Générer un code à 6 chiffres
        // const verificationCode = process.env.SMS_SIMULATION_MODE === 'true' 
        //     ? '123456' // Code fixe en simulation
        //     : generateVerificationCode();
        
        // const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // // Mettre à jour le numéro et le code
        // await req.db.query(
        //     `UPDATE users 
        //      SET phone = $1, 
        //          phone_verification_code = $2, 
        //          verification_code_expires_at = $3
        //      WHERE id = $4`,
        //     [phone, verificationCode, codeExpiry, userId]
        // );

        // // En mode simulation, ne pas envoyer de vrai SMS
        // if (process.env.SMS_SIMULATION_MODE === 'true') {
        //     console.log('📱 [SIMULATION] Code SMS:', verificationCode, 'pour', phone);
        //     
        //     return res.json({
        //         success: true,
        //         message: 'Code de vérification envoyé (mode simulation)',
        //         simulationCode: verificationCode, // Retourner le code en simulation
        //         expiresIn: 600 // 10 minutes en secondes
        //     });
        // }

        // // Envoyer le vrai SMS selon le provider configuré
        // await sendSMS(phone, `Votre code de vérification TIA Market: ${verificationCode}`);

        // console.log('📱 Code SMS envoyé à:', phone);

        // res.json({
        //     success: true,
        //     message: 'Code de vérification envoyé par SMS',
        //     expiresIn: 600
        // });

        // ====================================================================
        // EN MODE SIMULATION TEMPORAIRE
        // ====================================================================
        return res.json({
            success: true,
            message: 'Code de vérification envoyé (mode simulation)',
            simulationCode: '123456', // N'importe quel code fonctionne
            info: 'Mode simulation activé. N\'importe quel code de 6 chiffres fonctionne.',
            documentation: 'Voir CONFIGURATION_SERVICES.md pour configurer un vrai service SMS'
        });

    } catch (error) {
        console.error('❌ Erreur envoi SMS:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'envoi du code SMS'
        });
    }
});

/**
 * Vérifier le code SMS
 * POST /api/auth/verify-sms
 */
router.post('/verify-sms', async (req, res) => {
    const { code } = req.body;
    const userId = req.user.userId;

    if (!code) {
        return res.status(400).json({
            success: false,
            error: 'Code de vérification requis'
        });
    }

    try {
        // // En mode simulation, accepter n'importe quel code de 6 chiffres
        // if (process.env.SMS_SIMULATION_MODE === 'true') {
        //     if (code.length === 6 && /^\d+$/.test(code)) {
        //         await req.db.query(
        //             `UPDATE users 
        //              SET phone_verified = true, 
        //                  phone_verification_code = NULL,
        //                  verification_code_expires_at = NULL
        //              WHERE id = $1`,
        //             [userId]
        //         );

        //         console.log('✅ [SIMULATION] Téléphone vérifié pour user:', userId);

        //         return res.json({
        //             success: true,
        //             message: 'Téléphone vérifié avec succès (mode simulation)'
        //         });
        //     } else {
        //         return res.status(400).json({
        //             success: false,
        //             error: 'Code invalide (doit être 6 chiffres)'
        //         });
        //     }
        // }

        // // Vérifier le code en mode réel
        // const result = await req.db.query(
        //     `SELECT * FROM users 
        //      WHERE id = $1 
        //      AND phone_verification_code = $2 
        //      AND verification_code_expires_at > CURRENT_TIMESTAMP`,
        //     [userId, code]
        // );

        // if (result.rows.length === 0) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Code invalide ou expiré'
        //     });
        // }

        // // Marquer le téléphone comme vérifié
        // await req.db.query(
        //     `UPDATE users 
        //      SET phone_verified = true, 
        //          phone_verification_code = NULL,
        //          verification_code_expires_at = NULL
        //      WHERE id = $1`,
        //     [userId]
        // );

        // console.log('✅ Téléphone vérifié pour user:', userId);

        // res.json({
        //     success: true,
        //     message: 'Téléphone vérifié avec succès'
        // });

        // ====================================================================
        // EN MODE SIMULATION TEMPORAIRE
        // ====================================================================
        if (code.length === 6 && /^\d+$/.test(code)) {
            await req.db.query(
                `UPDATE users 
                 SET phone_verified = true
                 WHERE id = $1`,
                [userId]
            );

            return res.json({
                success: true,
                message: 'Téléphone vérifié avec succès (mode simulation)',
                info: 'N\'importe quel code de 6 chiffres est accepté en mode simulation'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'Code invalide (doit être 6 chiffres)'
            });
        }

    } catch (error) {
        console.error('❌ Erreur vérification SMS:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la vérification du code SMS'
        });
    }
});

module.exports = router;
