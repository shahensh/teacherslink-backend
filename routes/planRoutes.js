const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { getPlans, createPlan, updatePlan, deletePlan, togglePlanSystem, getPlanSystemStatus, toggleSchoolPlans, toggleTeacherPlans } = require('../controllers/planController');

router.get('/', getPlans);
router.post('/', protect, adminOnly, createPlan);
router.post('/toggle-system', protect, adminOnly, togglePlanSystem);
router.get('/system-status', getPlanSystemStatus);
router.put('/school-status', protect, adminOnly, toggleSchoolPlans);
router.put('/teacher-status', protect, adminOnly, toggleTeacherPlans);
router.put('/:id', protect, adminOnly, updatePlan);
router.delete('/:id', protect, adminOnly, deletePlan);

module.exports = router;