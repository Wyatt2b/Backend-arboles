const express = require('express');
const router = express.Router();
const arbolController = require('../controllers/arbolController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/mis-arboles', arbolController.getMisArboles);
router.get('/especies', arbolController.getEspecies);
router.get('/:id', arbolController.getArbolDetalle);
router.put('/:id', arbolController.updateArbol);

module.exports = router;