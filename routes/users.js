var express = require('express');
var router = express.Router();

const usersController = require('../controllers/users');

router.get('/get-users', usersController.getUsers);
router.post('/create-user', usersController.createUser);
router.post('/login', usersController.login)
module.exports = router;
