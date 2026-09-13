-- =========================================================
-- ERP LITE - IT HOAN HAO - SCHEMA (SQLite) - MVP v1.0
-- Don gian hoa tu Logical Data Model de kip tien do 2-3 ngay:
--   - Khong Role/Permission rieng (1 user Owner)
--   - Khong Audit Log chi tiet (chi created_at/updated_at)
--   - Khong multi-revision bao gia (sua truc tiep)
--   - Currency/Tax hardcode qua bang settings (key-value)
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ============ CRM ============
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  customer_type TEXT DEFAULT 'Ca nhan', -- 'Ca nhan' | 'Doanh nghiep'
  address TEXT,
  phone TEXT,
  contact_person TEXT,
  email TEXT,
  credit_limit REAL DEFAULT 0,
  credit_term_days INTEGER DEFAULT 15,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  contact_person TEXT,
  email TEXT,
  is_credit_allowed INTEGER DEFAULT 0,
  credit_limit REAL DEFAULT 0,
  credit_term_days INTEGER DEFAULT 15,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============ PRODUCT & INVENTORY ============
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  tracking_type TEXT NOT NULL DEFAULT 'quantity', -- 'serial' | 'quantity'
  unit TEXT DEFAULT 'cai',
  min_stock_level INTEGER DEFAULT 0,
  warranty_months_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Serial: moi may 1 dong, co trang thai rieng
CREATE TABLE IF NOT EXISTS inventory_serials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  serial_no TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_stock', -- in_stock | sold | warranty | returned_supplier
  purchase_cost REAL NOT NULL DEFAULT 0,
  customer_id INTEGER REFERENCES customers(id),
  warranty_expiry_date TEXT,
  replaced_serial_id INTEGER REFERENCES inventory_serials(id),
  goods_receipt_line_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Lo (so luong): moi lan nhap la 1 lo rieng, gia nhap rieng
CREATE TABLE IF NOT EXISTS inventory_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_no TEXT NOT NULL,
  quantity_remaining REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  received_date TEXT DEFAULT (datetime('now')),
  goods_receipt_line_id INTEGER
);

-- ============ QUOTATION -> SALES ORDER ============
CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  quotation_date TEXT DEFAULT (date('now')),
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | confirmed | rejected
  valid_until TEXT,
  note TEXT,
  total_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  warranty_months INTEGER DEFAULT 0,
  line_amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  so_no TEXT UNIQUE NOT NULL,
  quotation_id INTEGER REFERENCES quotations(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_date TEXT DEFAULT (date('now')),
  status TEXT NOT NULL DEFAULT 'created', -- created | delivered | cancelled
  total_amount REAL DEFAULT 0,
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  so_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  line_amount REAL NOT NULL DEFAULT 0,
  quantity_delivered REAL NOT NULL DEFAULT 0
);

-- ============ PURCHASE ORDER -> GOODS RECEIPT ============
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_no TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  related_so_id INTEGER REFERENCES sales_orders(id),
  order_date TEXT DEFAULT (date('now')),
  expected_date TEXT,
  status TEXT NOT NULL DEFAULT 'ordered', -- ordered | partially_received | completed | cancelled
  total_amount REAL DEFAULT 0,
  cancel_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity_ordered REAL NOT NULL DEFAULT 1,
  quantity_received REAL NOT NULL DEFAULT 0,
  unit_price_expected REAL NOT NULL DEFAULT 0,
  line_amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gr_no TEXT UNIQUE NOT NULL,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  receipt_date TEXT DEFAULT (date('now')),
  supplier_invoice_no TEXT,
  supplier_invoice_date TEXT,
  supplier_invoice_amount REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gr_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id INTEGER NOT NULL REFERENCES purchase_order_lines(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  serial_no TEXT,
  batch_no TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_cost REAL NOT NULL DEFAULT 0
);

-- ============ DELIVERY -> INVOICE ============
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_no TEXT UNIQUE NOT NULL,
  so_id INTEGER NOT NULL REFERENCES sales_orders(id),
  delivery_date TEXT DEFAULT (date('now')),
  received_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  so_line_id INTEGER NOT NULL REFERENCES sales_order_lines(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  serial_id INTEGER REFERENCES inventory_serials(id),
  batch_id INTEGER REFERENCES inventory_batches(id),
  quantity REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  so_id INTEGER NOT NULL REFERENCES sales_orders(id),
  invoice_date TEXT DEFAULT (date('now')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | paid
  total_amount REAL DEFAULT 0,
  cogs_amount REAL DEFAULT 0,
  profit_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============ PAYMENT & EXPENSE ============
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT UNIQUE NOT NULL,
  payment_type TEXT NOT NULL, -- 'thu' | 'chi'
  source_doc_type TEXT, -- 'invoice' | 'purchase_order' | 'expense' | null
  source_doc_id INTEGER,
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash', -- cash | bank
  fund_source TEXT DEFAULT 'cash', -- cash | bank
  payment_date TEXT DEFAULT (date('now')),
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_no TEXT UNIQUE NOT NULL,
  category TEXT,
  expense_date TEXT DEFAULT (date('now')),
  amount REAL NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============ ATTACHMENT ============
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TEXT DEFAULT (datetime('now'))
);

-- Danh sach nhom san pham / thuong hieu / don vi tinh - co the them moi truc tiep tu giao dien,
-- khong con co dinh trong code, tranh phai sua code moi lan can them lua chon moi
CREATE TABLE IF NOT EXISTS product_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attr_type TEXT NOT NULL, -- 'category' | 'brand' | 'unit'
  value TEXT NOT NULL,
  UNIQUE(attr_type, value)
);

-- ============ LICENSE ============
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  license_name TEXT NOT NULL,
  is_microsoft INTEGER DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate_percent REAL NOT NULL DEFAULT 8,
  subtotal_amount REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  start_date TEXT DEFAULT (date('now')),
  expiry_date TEXT,
  requires_renewal INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', -- active | expired | renewed | cancelled
  renewed_from_license_id INTEGER REFERENCES licenses(id),
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Thong tin nguoi dung cuoi Microsoft Tenant - luu theo TUNG KHACH HANG (dung chung cho moi license Microsoft cua KH do)
-- Nhieu email lien he cho 1 khach hang, phan theo vai tro (dung khi gui email tong hop chung tu)
CREATE TABLE IF NOT EXISTS customer_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  email TEXT NOT NULL,
  label TEXT, -- vd: "Nguoi mua hang", "Ke toan", "Admin", "Email nhan hoa don"
  recipient_type TEXT NOT NULL DEFAULT 'to', -- 'to' | 'cc'
  is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts ON customer_contacts(customer_id);

-- ============ HOP DONG ============
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_no TEXT UNIQUE NOT NULL,
  so_id INTEGER NOT NULL REFERENCES sales_orders(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  contract_date TEXT DEFAULT (date('now')),
  tax_rate_label TEXT DEFAULT '',
  price_valid_until TEXT,
  warranty_months INTEGER DEFAULT 12,
  payment_terms_text TEXT DEFAULT '100% giá trị hợp đồng khi ký hợp đồng.',
  delivery_address TEXT,
  delivery_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | signed | cancelled
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_licenses_customer ON licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON licenses(expiry_date);

-- ============ QUAN LY NHA TRO (module rieng biet, khong lien quan du lieu cong ty IT) ============
CREATE TABLE IF NOT EXISTS bt_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_name TEXT NOT NULL UNIQUE,
  room_price REAL NOT NULL DEFAULT 0,
  has_electricity_meter INTEGER NOT NULL DEFAULT 1, -- 0 = khong co dong ho dien rieng (Phong Tret)
  flat_electricity_per_person REAL DEFAULT 0, -- dung khi has_electricity_meter=0
  management_fee_bundled INTEGER NOT NULL DEFAULT 0, -- 1 = phi quan ly da gop vao tien phong (Phong 3, 6)
  electricity_discount REAL NOT NULL DEFAULT 0, -- giam gia dien co dinh moi thang (Phong 5 = 50000)
  electricity_deduct_room_ids TEXT, -- JSON mang id cac phong can tru so dien (Phong 6 tru Phong 3,4)
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bt_tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  id_number TEXT,
  id_issue_date TEXT,
  id_issue_place TEXT,
  permanent_address TEXT,
  phone TEXT,
  vehicle_type TEXT,
  license_plate TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bt_room_occupancy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES bt_rooms(id),
  tenant_id INTEGER NOT NULL REFERENCES bt_tenants(id),
  move_in_date TEXT,
  move_out_date TEXT,
  contract_start_date TEXT,
  contract_end_date TEXT,
  contract_duration_text TEXT,
  min_stay_text TEXT,
  deposit_amount REAL DEFAULT 0,
  laundry_registered INTEGER DEFAULT 0,
  renewed_from_occupancy_id INTEGER REFERENCES bt_room_occupancy(id),
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bt_monthly_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES bt_rooms(id),
  billing_month TEXT NOT NULL, -- 'YYYY-MM'
  room_price REAL NOT NULL DEFAULT 0,
  electricity_old REAL,
  electricity_new REAL,
  electricity_kwh REAL DEFAULT 0,
  electricity_rate REAL DEFAULT 3000,
  electricity_amount REAL DEFAULT 0,
  water_occupants INTEGER DEFAULT 0,
  water_rate REAL DEFAULT 100000,
  water_amount REAL DEFAULT 0,
  laundry_occupants INTEGER DEFAULT 0,
  laundry_rate REAL DEFAULT 50000,
  laundry_amount REAL DEFAULT 0,
  management_occupants INTEGER DEFAULT 0,
  management_rate REAL DEFAULT 100000,
  management_amount REAL DEFAULT 0,
  misc_amount REAL DEFAULT 0,
  misc_note TEXT,
  total_amount REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(room_id, billing_month)
);

CREATE TABLE IF NOT EXISTS bt_monthly_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  billing_month TEXT NOT NULL,
  cost_type TEXT NOT NULL, -- 'rent_landlord' | 'electricity_bill' | 'water_bill' | 'trash' | 'internet' | 'police' | 'other'
  amount REAL NOT NULL DEFAULT 0,
  note TEXT
);

-- Hop dong thue tro theo PHONG (1 hop dong = tat ca nguoi thue trong phong do cung ky, khong phai tung ca nhan)
CREATE TABLE IF NOT EXISTS bt_room_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES bt_rooms(id),
  contract_start_date TEXT,
  contract_end_date TEXT,
  contract_duration_text TEXT,
  min_stay_text TEXT,
  deposit_amount REAL DEFAULT 0,
  laundry_registered INTEGER DEFAULT 0,
  renewed_from_contract_id INTEGER REFERENCES bt_room_contracts(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bt_room_contracts_room ON bt_room_contracts(room_id);

CREATE INDEX IF NOT EXISTS idx_bt_bills_month ON bt_monthly_bills(billing_month);
CREATE INDEX IF NOT EXISTS idx_bt_costs_month ON bt_monthly_costs(billing_month);
CREATE INDEX IF NOT EXISTS idx_bt_occupancy_room ON bt_room_occupancy(room_id);

-- ============ TONG VU: NHAN SU + TAI SAN ============
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  id_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  position TEXT,
  department TEXT,
  start_date TEXT,
  end_date TEXT,
  contract_type TEXT,
  base_salary REAL DEFAULT 0,
  bank_account TEXT,
  status TEXT DEFAULT 'active',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT UNIQUE,
  asset_name TEXT NOT NULL,
  category TEXT,
  quantity REAL DEFAULT 1,
  purchase_date TEXT,
  purchase_invoice_no TEXT,
  supplier_id INTEGER REFERENCES suppliers(id),
  purchase_cost REAL DEFAULT 0,
  depreciation_months INTEGER DEFAULT 36,
  serial_number TEXT,
  warranty_until TEXT,
  employee_id INTEGER REFERENCES employees(id),
  location TEXT,
  assigned_date TEXT,
  status TEXT DEFAULT 'in_use',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_employee ON assets(employee_id);

-- ============ TONG VU: NHAN SU + TAI SAN ============
CREATE TABLE IF NOT EXISTS hr_employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  id_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  education_level TEXT,
  position TEXT,
  branch TEXT,
  start_date TEXT,
  end_date TEXT,
  contract_type TEXT, -- 'Thử việc' | 'Chính thức' | 'Thời vụ'
  base_salary REAL DEFAULT 0,
  bank_name TEXT,
  bank_branch TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'resigned'
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hr_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT UNIQUE NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  serial_no TEXT,
  supplier_id INTEGER REFERENCES suppliers(id),
  purchase_date TEXT,
  purchase_invoice_no TEXT,
  purchase_cost REAL NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL DEFAULT 36,
  warranty_until TEXT,
  current_user_id INTEGER REFERENCES hr_employees(id),
  location TEXT,
  assigned_date TEXT,
  status TEXT NOT NULL DEFAULT 'in_use', -- 'in_use' | 'broken' | 'disposed' | 'in_stock' | 'lost'
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hr_assets_user ON hr_assets(current_user_id);

CREATE INDEX IF NOT EXISTS idx_serials_product ON inventory_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_serials_status ON inventory_serials(status);
CREATE INDEX IF NOT EXISTS idx_batches_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_so ON invoices(so_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
