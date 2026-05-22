const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register/alumno', authController.registerAlumno);
router.post('/register/admin', authController.registerAdmin);
router.post('/login', authController.login);

module.exports = router;