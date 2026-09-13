const express = require('express');
const db = require('../db');
const { getTrackedOrders } = require('../lib/orderPipeline');
const router = express.Router();

router.get('/', (req, res) => {
  const orders = getTrackedOrders(db);
  res.render('tracking/index', { title: 'Theo dõi đơn hàng', orders });
});

module.exports = router;
