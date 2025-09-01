var express = require('express');
var router = express.Router();

const locationsController = require('../controllers/locations');

router.get('/get-locations', locationsController.getLocations);

module.exports = router;
