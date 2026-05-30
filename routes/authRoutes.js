const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Rutas de registro y login
router.post('/register/alumno', authController.registerAlumno);
router.post('/register/admin', authController.registerAdmin);
router.post('/login', authController.login);

// =============================================
// RUTAS PARA RECUPERACIÓN DE CONTRASEÑA (NUEVAS)
// =============================================
router.post('/solicitar-recuperacion', authController.solicitarRecuperacion);
router.post('/verificar-codigo', authController.verificarCodigo);
router.post('/cambiar-contrasena-codigo', authController.cambiarContrasenaConCodigo);
router.post('/cambiar-contrasena', verifyToken, authController.cambiarContrasenaAutenticado);

module.exports = router;