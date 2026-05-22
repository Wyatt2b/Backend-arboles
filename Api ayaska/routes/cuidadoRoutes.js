const express = require('express');
const router = express.Router();
const cuidadoController = require('../controllers/cuidadoController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/tipos', cuidadoController.getTiposCuidados);
router.get('/arbol/:id', cuidadoController.getCuidadosArbol);
router.get('/arbol/:id/:fecha', cuidadoController.getCuidadoDetalle);
router.post('/arbol/:id', cuidadoController.createCuidado);

module.exports = router;