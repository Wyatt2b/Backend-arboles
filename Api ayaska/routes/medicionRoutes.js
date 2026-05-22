const express = require('express');
const router = express.Router();
const medicionController = require('../controllers/medicionController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/arbol/:id', medicionController.getMediciones);
router.post('/arbol/:id', medicionController.createMedicion);

module.exports = router;