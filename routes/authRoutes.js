const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rutas que ya funcionaban
router.post('/register/alumno', authController.registerAlumno);
router.post('/register/admin', authController.registerAdmin);
router.post('/login', authController.login);

// ============================================
// ESTO ES LO QUE LE FALTA A TU CÓDIGO 
// (Sin esto, la app no puede pedir correos)
// ============================================
router.post('/solicitar-codigo', authController.solicitarCodigo);
router.post('/restablecer-password', authController.restablecerPassword);

module.exports = router;
