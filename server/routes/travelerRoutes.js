const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  listTravelers,
  createTraveler,
  updateTraveler,
  deleteTraveler,
  setDefaultTraveler,
} = require('../controllers/travelerController');

const router = express.Router();

router.get('/', protect, listTravelers);
router.post('/', protect, createTraveler);
router.put('/:id', protect, updateTraveler);
router.delete('/:id', protect, deleteTraveler);
router.patch('/:id/default', protect, setDefaultTraveler);

module.exports = router;
