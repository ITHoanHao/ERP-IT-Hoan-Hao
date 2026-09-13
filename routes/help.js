const express = require('express');
const versionInfo = require('../lib/version');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('help/index', { title: 'Trợ giúp & Hướng dẫn sử dụng', versionInfo });
});

module.exports = router;
