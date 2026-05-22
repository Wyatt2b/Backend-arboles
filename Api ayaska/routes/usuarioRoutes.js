const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/perfil', usuarioController.getPerfil);
router.put('/perfil', usuarioController.updatePerfil);

module.exports = router;