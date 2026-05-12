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

// Administrativos (NUEVA RUTA)
router.get('/administrativos', adminController.getAllAdministrativos);

// Estadísticas
router.get('/estadisticas', adminController.getEstadisticas);

// Árboles por gestión
router.get('/gestiones/:id_gestion/arboles', adminController.getArbolesPorGestion);

// Árboles asignados a alumno
router.get('/alumnos/:id_usuario/arboles', adminController.getArbolesAsignados);

// Asignar/desasignar árboles
router.post('/alumnos/arboles', adminController.asignarArbolAlumno);
router.delete('/alumnos/:id_usuario/arboles/:id_arbol', adminController.desasignarArbolAlumno);

module.exports = router;