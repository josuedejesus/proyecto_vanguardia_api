var express = require('express');
var router = express.Router();

const tagsController = require('../controllers/tags');

router.get('/get-tags', tagsController.getTags);
router.post('/create-tag', tagsController.createTag);
router.post('/get-tag', tagsController.getTag);

module.exports = router;
