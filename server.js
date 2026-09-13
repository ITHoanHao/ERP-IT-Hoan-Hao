const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
const { DATA_DIR } = require('./lib/dataDir');
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

app.use(session({
  secret: 'erp-lite-ithoanhao-secret-key-doi-khi-trien-khai-that',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }, // 8 gio
}));

// Middleware: require login cho moi route tru /login
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect('/login');
}

app.locals.formatMoney = (n) => {
  if (n === null || n === undefined) return '0';
  return Math.round(n).toLocaleString('vi-VN');
};
app.locals.formatDate = (d) => {
  if (!d) return '';
  return d.split(' ')[0].split('-').reverse().join('/');
};

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.use('/', require('./routes/auth'));
app.use(requireAuth);

app.use((req, res, next) => {
  try {
    const db = require('./db');
    const { getNotifications } = require('./lib/orderPipeline');
    res.locals.notifications = getNotifications(db);
  } catch (e) {
    res.locals.notifications = [];
  }
  next();
});

app.use('/', require('./routes/dashboard'));
app.use('/tracking', require('./routes/tracking'));
app.use('/wizard', require('./routes/wizard'));
app.use('/help', require('./routes/help'));
app.use('/customers', require('./routes/customers'));
app.use('/suppliers', require('./routes/suppliers'));
app.use('/products', require('./routes/products'));
app.use('/product-attributes', require('./routes/productAttributes'));
app.use('/inventory', require('./routes/inventory'));
app.use('/quotations', require('./routes/quotations'));
app.use('/sales-orders', require('./routes/salesOrders'));
app.use('/purchase-orders', require('./routes/purchaseOrders'));
app.use('/goods-receipts', require('./routes/goodsReceipts'));
app.use('/deliveries', require('./routes/deliveries'));
app.use('/invoices', require('./routes/invoices'));
app.use('/licenses', require('./routes/licenses'));
app.use('/contracts', require('./routes/contracts'));
app.use('/documents', require('./routes/documents'));
app.use('/nhatro', require('./routes/boarding'));
app.use('/tongvu', require('./routes/generalAffairs'));
app.use('/employees', require('./routes/employees'));
app.use('/assets', require('./routes/assets'));
app.use('/payments', require('./routes/payments'));
app.use('/expenses', require('./routes/expenses'));
app.use('/reports', require('./routes/reports'));
app.use('/search', require('./routes/search'));
app.use('/settings', require('./routes/settings'));

app.listen(PORT, () => {
  console.log(`ERP Lite dang chay tai http://localhost:${PORT}`);
});
