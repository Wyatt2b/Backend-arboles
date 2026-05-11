const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(verifyAdmin);

// Gestiones/Escuelas
router.get('/gestiones', adminController.getAllGestiones);
router.post('/gestiones', adminController.createGestion);

// Campañas
router.get('/campanias', adminController.getAllCampanias);
router.post('/campanias', adminController.createCampania);

// Árboles
router.get('/arboles', adminController.getAllArboles);
router.post('/arboles', adminController.createArbol);

// Alumnos y asignaciones
router.get('/alumnos', adminController.getAllAlumnos);
router.post('/asignar-alumno', adminController.asignarAlumnoAGestion);
router.delete('/desasignar-alumno/:id_usuario/:id_gestion', adminController.desasignarAlumnoDeGestion);

// Estadísticas
router.get('/estadisticas', adminController.getEstadisticas);

module.exports = router;