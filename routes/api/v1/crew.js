const express = require('express');
const router = express.Router();
const crewController = require('../../../controllers/api/v1/crewController');

// GET crew data by ID
// router.get('/:id', crewController.getCrewDataById);

// POST new crew data
router.post('/', crewController.createCrewData);

// PUT & PATCH crew data
router.put('/', crewController.updateCrewData);
router.patch('/', crewController.updateCrewData);

// DELETE crew data by ID
router.delete('/:id', crewController.deleteCrewData);

module.exports = router;