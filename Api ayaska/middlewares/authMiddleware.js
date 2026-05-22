const jwt = require('jsonwebtoken');
const { getConnection, sql } = require('../config/database');

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const pool = await getConnection();
        
        // Verificar si es admin en la tabla Administrativa
        const adminResult = await pool.request()
            .input('id', sql.Int, decoded.id)
            .query('SELECT * FROM Administrativa WHERE id = @id AND esta_activo = 1');
        
        req.userId = decoded.id;
        req.isAdmin = adminResult.recordset.length > 0;
        
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