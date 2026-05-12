const jwt = require('jsonwebtoken');
const { getConnection } = require('../config/database');

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const pool = await getConnection();
        
        // Buscar en usuario y verificar si es admin
        const userResult = await pool.query(
            `SELECT u.*, 
                    CASE WHEN a.id_usuario IS NOT NULL THEN true ELSE false END as es_admin
             FROM usuario u
             LEFT JOIN administrativa a ON u.id_usuario = a.id_usuario
             WHERE u.id_usuario = $1 AND u.esta_activo = true`,
            [decoded.id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        
        req.userId = decoded.id;
        req.isAdmin = userResult.rows[0].es_admin === true;
        
        next();
    } catch (error) {
        console.error('Error en verifyToken:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const verifyAdmin = (req, res, next) => {
    if (!req.isAdmin) {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };