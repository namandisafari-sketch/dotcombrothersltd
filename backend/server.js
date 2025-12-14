import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { body } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually parse .env file FIRST before anything else
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Environment variables are now loaded manually above

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB default

// Create upload directories
['logos', 'products', 'documents', 'backups'].forEach(dir => {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created upload directory: ${fullPath}`);
  }
});

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
});

// CORS configuration - Allow requests from frontend
app.use(cors({
  origin: [
    'http://localhost:8080', 
    'http://localhost:5173',
    'https://dotcombrothersltd.com',
    'https://www.dotcombrothersltd.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// PostgreSQL connection pool
console.log('\n========== BACKEND STARTING ==========\n');
console.log('Loaded', Object.keys(process.env).filter(k => ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'PORT', 'JWT_SECRET', 'NODE_ENV', 'MAX_FILE_SIZE', 'UPLOAD_DIR'].includes(k)).length, 'environment variables');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('\n');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Add error handler to prevent crashes
pool.on('error', (err, client) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

// Test database connection asynchronously (doesn't block server startup)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ DATABASE CONNECTION FAILED!');
    console.error('Error:', err.message);
  } else {
    console.log('✅ DATABASE CONNECTED!');
    release();
  }
});

// ============= MIDDLEWARE =============

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Role check middleware
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1',
        [req.user.id]
      );
      
      if (rows.length === 0 || !roles.includes(rows[0].role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      req.userRole = rows[0].role;
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

// ============= FILE UPLOAD CONFIGURATION =============

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'documents';
    const uploadPath = path.join(UPLOAD_DIR, type);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and documents are allowed.'));
    }
  }
});

// ============= HEALTH CHECK =============

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// ============= FILE UPLOAD & SERVING ENDPOINTS =============

// Upload file endpoint
app.post('/api/upload/:type', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/api/files/${req.params.type}/${req.file.filename}`;
    
    res.json({
      success: true,
      filename: req.file.filename,
      path: fileUrl,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files
app.get('/api/files/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, type, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.sendFile(path.resolve(filePath));
});

// Delete file endpoint
app.delete('/api/files/:type/:filename', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, type, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= AUTHENTICATION ENDPOINTS =============

// Register new user
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM user_credentials WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Check if this is the first user (will be admin)
      const userCountResult = await pool.query('SELECT COUNT(*) FROM user_credentials');
      const isFirstUser = parseInt(userCountResult.rows[0].count) === 0;
      const defaultRole = isFirstUser ? 'admin' : 'user';
      
      // Create profile first
      const profileResult = await pool.query(
        'INSERT INTO profiles (id, full_name, is_active) VALUES (gen_random_uuid(), $1, true) RETURNING id',
        [full_name]
      );
      
      const userId = profileResult.rows[0].id;
      
      // Create user credentials
      await pool.query(
        'INSERT INTO user_credentials (user_id, email, password_hash) VALUES ($1, $2, $3)',
        [userId, email, hashedPassword]
      );
      
      // Assign user role
      await pool.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, defaultRole]
      );
      
      await pool.query('COMMIT');
      
      // Generate JWT
      const token = jwt.sign(
        { id: userId, email: email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.json({ 
        user: {
          id: userId,
          email: email,
          full_name: full_name,
          role: defaultRole
        }, 
        token 
      });
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Login attempt for:', email);
  
  try {
    // Get user credentials
    const result = await pool.query(
      `SELECT uc.user_id as id, uc.email, uc.password_hash, p.full_name, p.is_active, ur.role
       FROM user_credentials uc
       JOIN profiles p ON p.id = uc.user_id
       LEFT JOIN user_roles ur ON ur.user_id = uc.user_id
       WHERE uc.email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    console.log('✅ User found:', { email: user.email, hasHash: !!user.password_hash, isActive: user.is_active });
    
    if (!user.is_active) {
      console.log('❌ Account deactivated:', email);
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    // Verify password
    console.log('🔑 Comparing password... (length:', password?.length, ')');
    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log('🔑 Password valid?', validPassword);
    
    if (!validPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('✅ Authentication successful for:', email);
    
    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/user', authenticateToken, async (req, res) => {
  try {
    // Fetch user data from profiles
    const { rows: userRows } = await pool.query(
      `SELECT uc.user_id as id, uc.email, p.full_name, p.department_id, p.is_active
       FROM user_credentials uc
       JOIN profiles p ON p.id = uc.user_id
       WHERE uc.user_id = $1`,
      [req.user.id]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch role from user_roles table (security best practice)
    const { rows: roleRows } = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    
    const user = {
      ...userRows[0],
      role: roleRows.length > 0 ? roleRows[0].role : 'user'
    };
    
    console.log('getCurrentUser returning:', user);
    
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= DEPARTMENTS ENDPOINTS =============

app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// ============= CUSTOMERS ENDPOINTS =============

app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` WHERE department_id = $${params.length}`;
    }
    
    query += ' ORDER BY name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, department_id } = req.body;
    const result = await pool.query(
      'INSERT INTO customers (name, email, phone, address, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, phone, address, department_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, account_type, credit_limit } = req.body;
    const result = await pool.query(
      `UPDATE customers SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address),
        account_type = COALESCE($5, account_type),
        credit_limit = COALESCE($6, credit_limit)
      WHERE id = $7 RETURNING *`,
      [name, email, phone, address, account_type, credit_limit, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

app.delete('/api/customers/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully', customer: result.rows[0] });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// ============= PRODUCTS ENDPOINTS =============

app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    let query = 'SELECT * FROM products WHERE is_archived = false';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    
    query += ' ORDER BY name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, cost_price, selling_price, current_stock, unit, barcode, department_id } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, cost_price, selling_price, current_stock, unit, barcode, department_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, cost_price, selling_price, current_stock || 0, unit, barcode, department_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cost_price, selling_price, current_stock, unit, barcode } = req.body;
    const result = await pool.query(
      'UPDATE products SET name = $1, cost_price = $2, selling_price = $3, current_stock = $4, unit = $5, barcode = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
      [name, cost_price, selling_price, current_stock, unit, barcode, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE products SET is_archived = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product archived successfully', product: result.rows[0] });
  } catch (error) {
    console.error('Error archiving product:', error);
    res.status(500).json({ error: 'Failed to archive product' });
  }
});

// ============= PERFUME SCENTS ENDPOINTS =============

app.get('/api/perfume-scents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM perfume_scents ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching perfume scents:', error);
    res.status(500).json({ error: 'Failed to fetch perfume scents' });
  }
});

app.post('/api/perfume-scents', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'INSERT INTO perfume_scents (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, req.user.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating perfume scent:', error);
    res.status(500).json({ error: 'Failed to create perfume scent' });
  }
});

app.put('/api/perfume-scents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_out_of_stock } = req.body;
    const result = await pool.query(
      'UPDATE perfume_scents SET name = $1, is_out_of_stock = $2 WHERE id = $3 RETURNING *',
      [name, is_out_of_stock, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating perfume scent:', error);
    res.status(500).json({ error: 'Failed to update perfume scent' });
  }
});

app.delete('/api/perfume-scents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM perfume_scents WHERE id = $1', [id]);
    res.json({ message: 'Perfume scent deleted successfully' });
  } catch (error) {
    console.error('Error deleting perfume scent:', error);
    res.status(500).json({ error: 'Failed to delete perfume scent' });
  }
});

// ============= PERFUME SCENTS ENDPOINTS =============

app.get('/api/perfume-scents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM perfume_scents ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching perfume scents:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/perfume-scents', authenticateToken, async (req, res) => {
  try {
    const { name, is_out_of_stock, flagged_by } = req.body;
    const result = await pool.query(
      `INSERT INTO perfume_scents (name, is_out_of_stock, flagged_at, flagged_by, created_by) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, is_out_of_stock || false, is_out_of_stock ? new Date().toISOString() : null, flagged_by, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating perfume scent:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/perfume-scents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_out_of_stock, flagged_by } = req.body;
    const result = await pool.query(
      `UPDATE perfume_scents 
       SET name = $1, is_out_of_stock = $2, flagged_at = $3, flagged_by = $4 
       WHERE id = $5 RETURNING *`,
      [name, is_out_of_stock, is_out_of_stock ? new Date().toISOString() : null, flagged_by, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating perfume scent:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/perfume-scents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM perfume_scents WHERE id = $1', [id]);
    res.json({ message: 'Perfume scent deleted successfully' });
  } catch (error) {
    console.error('Error deleting perfume scent:', error);
    res.status(500).json({ error: 'Failed to delete perfume scent' });
  }
});

// ============= STOCK ALERTS ENDPOINTS =============

app.get('/api/stock-alerts', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    let query = `
      SELECT sa.*, p.* 
      FROM stock_alerts sa 
      JOIN products p ON sa.product_id = p.id 
      WHERE sa.is_resolved = false
    `;
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND p.department_id = $${params.length}`;
    }
    
    query += ' ORDER BY sa.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= PERFUME PRICING CONFIG ENDPOINTS =============

app.get('/api/perfume-pricing-config', authenticateToken, async (req, res) => {
  try {
    const { department_id } = req.query;
    const result = await pool.query(
      'SELECT * FROM perfume_pricing_config WHERE department_id = $1',
      [department_id]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching perfume pricing config:', error);
    res.status(500).json({ error: 'Failed to fetch perfume pricing config' });
  }
});

app.post('/api/perfume-pricing-config', authenticateToken, async (req, res) => {
  try {
    const { department_id, retail_price_per_ml, wholesale_price_per_ml, bottle_cost_config, packing_material_cost, additional_charge_type, additional_charge_value } = req.body;
    const result = await pool.query(
      `INSERT INTO perfume_pricing_config 
       (department_id, retail_price_per_ml, wholesale_price_per_ml, bottle_cost_config, packing_material_cost, additional_charge_type, additional_charge_value) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (department_id) DO UPDATE SET
       retail_price_per_ml = $2, wholesale_price_per_ml = $3, bottle_cost_config = $4, 
       packing_material_cost = $5, additional_charge_type = $6, additional_charge_value = $7, updated_at = NOW()
       RETURNING *`,
      [department_id, retail_price_per_ml, wholesale_price_per_ml, JSON.stringify(bottle_cost_config), packing_material_cost, additional_charge_type, additional_charge_value]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating/updating perfume pricing config:', error);
    res.status(500).json({ error: 'Failed to create/update perfume pricing config' });
  }
});

// ============= APPOINTMENTS ENDPOINTS =============

app.get('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, c.name as customer_name, s.name as service_name 
       FROM appointments a
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN services s ON a.service_id = s.id
       ORDER BY a.appointment_date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const { customer_id, service_id, appointment_date, duration_minutes, assigned_staff, notes, status } = req.body;
    const result = await pool.query(
      `INSERT INTO appointments (customer_id, service_id, appointment_date, duration_minutes, assigned_staff, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [customer_id, service_id, appointment_date, duration_minutes, assigned_staff, notes, status || 'scheduled']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_id, service_id, appointment_date, duration_minutes, assigned_staff, notes, status } = req.body;
    const result = await pool.query(
      `UPDATE appointments SET 
       customer_id = $1, service_id = $2, appointment_date = $3, duration_minutes = $4, 
       assigned_staff = $5, notes = $6, status = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [customer_id, service_id, appointment_date, duration_minutes, assigned_staff, notes, status, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM appointments WHERE id = $1', [id]);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// ============= SUPPLIERS ENDPOINTS =============

app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.post('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_person, email, phone, address, notes) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, contact_person, email, phone, address, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

app.put('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, email, phone, address, notes } = req.body;
    const result = await pool.query(
      `UPDATE suppliers SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5, notes = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, contact_person, email, phone, address, notes, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

app.delete('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// ============= INTERNAL USAGE ENDPOINTS =============

app.get('/api/internal-usage', authenticateToken, async (req, res) => {
  try {
    const { department_id } = req.query;
    let query = `SELECT iu.*, p.name as product_name, d.name as department_name 
                 FROM internal_stock_usage iu
                 LEFT JOIN products p ON iu.product_id = p.id
                 LEFT JOIN departments d ON iu.department_id = d.id`;
    const params = [];
    
    if (department_id) {
      query += ' WHERE iu.department_id = $1';
      params.push(department_id);
    }
    
    query += ' ORDER BY iu.usage_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching internal usage:', error);
    res.status(500).json({ error: 'Failed to fetch internal usage' });
  }
});

app.post('/api/internal-usage', authenticateToken, async (req, res) => {
  try {
    const { product_id, department_id, quantity, unit_value, total_value, reason, notes, usage_date } = req.body;
    const result = await pool.query(
      `INSERT INTO internal_stock_usage 
       (product_id, department_id, quantity, unit_value, total_value, reason, notes, usage_date, recorded_by, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed') RETURNING *`,
      [product_id, department_id, quantity, unit_value, total_value, reason, notes, usage_date, req.user.userId]
    );
    
    // Update product stock
    await pool.query(
      'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
      [quantity, product_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating internal usage:', error);
    res.status(500).json({ error: 'Failed to create internal usage' });
  }
});

// ============= SALES ENDPOINTS =============

// Get sales with items
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status, departmentId } = req.query;
    let query = `
      SELECT s.*, 
             json_agg(
               json_build_object(
                 'id', si.id,
                 'item_name', si.item_name,
                 'quantity', si.quantity,
                 'unit_price', si.unit_price,
                 'subtotal', si.subtotal,
                 'product_id', si.product_id,
                 'service_id', si.service_id,
                 'variant_id', si.variant_id
               )
             ) as sale_items
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND s.department_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND s.created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND s.created_at <= $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }
    
    query += ' GROUP BY s.id ORDER BY s.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

app.get('/api/sales-today', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];
    
    if (startDate) {
      params.push(startDate);
      query += ` AND created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND created_at <= $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

app.get('/api/sales-today', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    const today = new Date().toISOString().split('T')[0];
    
    let query = `
      SELECT COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE DATE(created_at) = $1
      AND status != 'voided'
    `;
    const params = [today];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json({ total: Number(result.rows[0].total) });
  } catch (error) {
    console.error('Error fetching today sales:', error);
    res.status(500).json({ error: 'Failed to fetch today sales' });
  }
});

app.get('/api/sales-recent', authenticateToken, async (req, res) => {
  try {
    const { departmentId, limit = 10 } = req.query;
    
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent sales:', error);
    res.status(500).json({ error: 'Failed to fetch recent sales' });
  }
});

app.get('/api/products-low-stock', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    
    let query = `
      SELECT * FROM products 
      WHERE current_stock <= reorder_level 
      AND is_archived = false
    `;
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    
    query += ' ORDER BY current_stock ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

app.get('/api/products-count', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    
    let query = 'SELECT COUNT(*) as count FROM products WHERE is_archived = false';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching products count:', error);
    res.status(500).json({ error: 'Failed to fetch products count' });
  }
});

app.get('/api/customers-count', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    
    let query = 'SELECT COUNT(*) as count FROM customers';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` WHERE department_id = $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching customers count:', error);
    res.status(500).json({ error: 'Failed to fetch customers count' });
  }
});

app.post('/api/sales', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { sale, items } = req.body;
    
    // Insert sale
    const saleResult = await client.query(
      `INSERT INTO sales (receipt_number, customer_id, subtotal, discount, total, amount_paid, change_amount, payment_method, cashier_name, department_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [sale.receipt_number, sale.customer_id, sale.subtotal, sale.discount, sale.total, sale.amount_paid, sale.change_amount, sale.payment_method, sale.cashier_name, sale.department_id, sale.status]
    );
    
    const createdSale = saleResult.rows[0];
    
    // Insert sale items
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, variant_id, item_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [createdSale.id, item.product_id, item.variant_id, item.item_name, item.quantity, item.unit_price, item.subtotal]
      );
      
      // Update stock
      if (item.product_id) {
        await client.query(
          'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(createdSale);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  } finally {
    client.release();
  }
});

// ============= SERVICES ENDPOINTS =============

app.get('/api/services', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    let query = `
      SELECT s.*, c.name as category_name
      FROM services s
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE 1=1
    `;
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND s.department_id = $${params.length}`;
    }
    
    query += ' ORDER BY s.name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

app.post('/api/services', authenticateToken, async (req, res) => {
  try {
    const { name, category_id, base_price, material_cost, is_negotiable, description, department_id } = req.body;
    const result = await pool.query(
      `INSERT INTO services (name, category_id, base_price, material_cost, is_negotiable, description, department_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, category_id, base_price, material_cost || 0, is_negotiable, description, department_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

app.put('/api/services/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, base_price, material_cost, is_negotiable, description, department_id } = req.body;
    const result = await pool.query(
      `UPDATE services 
       SET name = $1, category_id = $2, base_price = $3, material_cost = $4, 
           is_negotiable = $5, description = $6, department_id = $7
       WHERE id = $8 RETURNING *`,
      [name, category_id, base_price, material_cost, is_negotiable, description, department_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

app.delete('/api/services/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ message: 'Service deleted successfully', service: result.rows[0] });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ============= CATEGORIES ENDPOINTS =============

app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ============= SETTINGS ENDPOINTS =============

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings LIMIT 1');
    res.json(result.rows[0] || {
      business_name: 'DOTCOM BROTHERS LTD',
      business_phone: '+256745368426',
      business_address: 'Kasangati opp Kasangati Police Station',
      whatsapp_number: '+256745368426'
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.json({
      business_name: 'DOTCOM BROTHERS LTD',
      business_phone: '+256745368426',
      business_address: 'Kasangati opp Kasangati Police Station',
      whatsapp_number: '+256745368426'
    });
  }
});

app.put('/api/settings', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { 
      business_name, 
      business_phone, 
      business_email, 
      business_address, 
      whatsapp_number, 
      website,
      seasonal_remark,
      currency
    } = req.body;
    
    // Check if settings exist
    const checkResult = await pool.query('SELECT id FROM settings LIMIT 1');
    
    let result;
    if (checkResult.rows.length === 0) {
      // Insert new settings
      result = await pool.query(
        `INSERT INTO settings (
          business_name, business_phone, business_email, business_address, 
          whatsapp_number, website, seasonal_remark, currency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [business_name, business_phone, business_email, business_address, 
         whatsapp_number, website, seasonal_remark, currency || 'UGX']
      );
    } else {
      // Update existing settings
      result = await pool.query(
        `UPDATE settings SET
          business_name = COALESCE($1, business_name),
          business_phone = COALESCE($2, business_phone),
          business_email = COALESCE($3, business_email),
          business_address = COALESCE($4, business_address),
          whatsapp_number = COALESCE($5, whatsapp_number),
          website = COALESCE($6, website),
          seasonal_remark = COALESCE($7, seasonal_remark),
          currency = COALESCE($8, currency),
          updated_at = NOW()
        WHERE id = $9 RETURNING *`,
        [business_name, business_phone, business_email, business_address, 
         whatsapp_number, website, seasonal_remark, currency, checkResult.rows[0].id]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/department-settings/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const result = await pool.query(
      'SELECT * FROM department_settings WHERE department_id = $1',
      [departmentId]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching department settings:', error);
    res.status(500).json({ error: 'Failed to fetch department settings' });
  }
});

app.put('/api/department-settings/:departmentId', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { 
      business_name, 
      business_phone, 
      business_email, 
      business_address, 
      whatsapp_number, 
      website,
      seasonal_remark,
      logo_url
    } = req.body;
    
    // Check if department settings exist
    const checkResult = await pool.query(
      'SELECT id FROM department_settings WHERE department_id = $1',
      [departmentId]
    );
    
    let result;
    if (checkResult.rows.length === 0) {
      // Insert new department settings
      result = await pool.query(
        `INSERT INTO department_settings (
          department_id, business_name, business_phone, business_email, business_address, 
          whatsapp_number, website, seasonal_remark, logo_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [departmentId, business_name, business_phone, business_email, business_address, 
         whatsapp_number, website, seasonal_remark, logo_url]
      );
    } else {
      // Update existing department settings
      result = await pool.query(
        `UPDATE department_settings SET
          business_name = COALESCE($1, business_name),
          business_phone = COALESCE($2, business_phone),
          business_email = COALESCE($3, business_email),
          business_address = COALESCE($4, business_address),
          whatsapp_number = COALESCE($5, whatsapp_number),
          website = COALESCE($6, website),
          seasonal_remark = COALESCE($7, seasonal_remark),
          logo_url = COALESCE($8, logo_url),
          updated_at = NOW()
        WHERE department_id = $9 RETURNING *`,
        [business_name, business_phone, business_email, business_address, 
         whatsapp_number, website, seasonal_remark, logo_url, departmentId]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating department settings:', error);
    res.status(500).json({ error: 'Failed to update department settings' });
  }
});

// ============= EXPENSES ENDPOINTS =============

app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { departmentId, startDate, endDate } = req.query;
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${params.length}`;
    }
    
    query += ' ORDER BY date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.post('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { amount, category, description, date, department_id } = req.body;
    const result = await pool.query(
      'INSERT INTO expenses (amount, category, description, date, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [amount, category, description, date, department_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

app.put('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, description, date } = req.body;
    const result = await pool.query(
      `UPDATE expenses SET
        amount = COALESCE($1, amount),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        date = COALESCE($4, date)
      WHERE id = $5 RETURNING *`,
      [amount, category, description, date, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

app.delete('/api/expenses/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully', expense: result.rows[0] });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ============= RECONCILIATIONS ENDPOINTS =============

app.get('/api/reconciliations', authenticateToken, async (req, res) => {
  try {
    const { departmentId, startDate, endDate, status } = req.query;
    let query = 'SELECT * FROM reconciliations WHERE 1=1';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reconciliations:', error);
    res.status(500).json({ error: 'Failed to fetch reconciliations' });
  }
});

// ============= CREDITS ENDPOINTS =============

app.get('/api/credits', authenticateToken, async (req, res) => {
  try {
    const { departmentId, startDate, endDate, status } = req.query;
    let query = 'SELECT * FROM credits WHERE 1=1';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND (from_department_id = $${params.length} OR to_department_id = $${params.length})`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND approved_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND approved_at <= $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching credits:', error);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

// ============= SUSPENDED REVENUE ENDPOINTS =============

app.get('/api/suspended-revenue', authenticateToken, async (req, res) => {
  try {
    const { departmentId, startDate, endDate, status } = req.query;
    let query = 'SELECT * FROM suspended_revenue WHERE 1=1';
    const params = [];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${params.length}`;
    }
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      params.push(statuses);
      query += ` AND status = ANY($${params.length})`;
    }
    
    query += ' ORDER BY date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching suspended revenue:', error);
    res.status(500).json({ error: 'Failed to fetch suspended revenue' });
  }
});

// ============= PRODUCT VARIANTS ENDPOINTS =============

app.get('/api/product-variants', authenticateToken, async (req, res) => {
  try {
    const { productId, barcode } = req.query;
    let query = 'SELECT pv.*, p.name as product_name, p.selling_price as product_selling_price FROM product_variants pv LEFT JOIN products p ON pv.product_id = p.id WHERE 1=1';
    const params = [];
    
    if (productId) {
      params.push(productId);
      query += ` AND pv.product_id = $${params.length}`;
    }
    
    if (barcode) {
      params.push(barcode);
      query += ` AND pv.barcode = $${params.length}`;
    }
    
    query += ' ORDER BY pv.variant_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching product variants:', error);
    res.status(500).json({ error: 'Failed to fetch product variants' });
  }
});

// ============= SALE ITEMS ENDPOINTS =============

app.get('/api/sale-items', authenticateToken, async (req, res) => {
  try {
    const { saleId } = req.query;
    let query = `
      SELECT si.*, 
             p.name as product_name, 
             s.name as service_name, 
             pv.variant_name, pv.color, pv.size
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN services s ON si.service_id = s.id
      LEFT JOIN product_variants pv ON si.variant_id = pv.id
      WHERE 1=1
    `;
    const params = [];
    
    if (saleId) {
      params.push(saleId);
      query += ` AND si.sale_id = $${params.length}`;
    }
    
    query += ' ORDER BY si.created_at';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sale items:', error);
    res.status(500).json({ error: 'Failed to fetch sale items' });
  }
});

// ============= VOID SALE ENDPOINT =============

app.put('/api/sales/:id/void', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { void_reason, voided_by } = req.body;
    
    // Get sale items to restore stock
    const itemsResult = await client.query(
      'SELECT * FROM sale_items WHERE sale_id = $1',
      [id]
    );
    
    // Restore stock
    for (const item of itemsResult.rows) {
      if (item.product_id && item.variant_id) {
        await client.query(
          'UPDATE product_variants SET current_stock = current_stock + $1 WHERE id = $2',
          [item.quantity, item.variant_id]
        );
      } else if (item.product_id) {
        await client.query(
          'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }
    
    // Update sale status
    const result = await client.query(
      `UPDATE sales 
       SET status = 'voided', void_reason = $1, voided_by = $2, voided_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [void_reason, voided_by, id]
    );
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error voiding sale:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============= RECONCILIATIONS CREATE ENDPOINT =============

app.post('/api/reconciliations', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { cashier_name, date, system_cash, reported_cash, difference, notes, department_id, status } = req.body;
    
    // Create reconciliation
    const recResult = await client.query(
      `INSERT INTO reconciliations (
        cashier_name, date, system_cash, reported_cash, difference, 
        notes, department_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [cashier_name, date, system_cash, reported_cash, difference, notes, department_id, status || 'pending']
    );
    
    const reconciliation = recResult.rows[0];
    
    // Auto-create suspended revenue for surplus (positive difference)
    if (difference > 0) {
      await client.query(
        `INSERT INTO suspended_revenue (
          department_id, reconciliation_id, amount, cashier_name, date, 
          reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [
          department_id,
          reconciliation.id,
          difference,
          cashier_name,
          date,
          `Cash surplus from reconciliation - Expected: ${system_cash} UGX, Reported: ${reported_cash} UGX`
        ]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(reconciliation);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating reconciliation:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============= DAILY SALES ENDPOINT =============

app.get('/api/sales/daily/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const { departmentId } = req.query;
    
    let query = `
      SELECT COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE DATE(created_at) = $1
      AND status != 'voided'
      AND payment_method NOT IN ('mobile_money', 'card')
    `;
    const params = [date];
    
    if (departmentId) {
      params.push(departmentId);
      query += ` AND department_id = $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json({ total: parseFloat(result.rows[0].total || 0) });
  } catch (error) {
    console.error('Error fetching daily sales:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

// ============= MOBILE MONEY TRANSACTIONS ENDPOINTS =============

app.get('/api/mobile-money-transactions', authenticateToken, async (req, res) => {
  try {
    const { department_id } = req.query;
    let query = 'SELECT * FROM mobile_money_transactions';
    const params = [];
    
    if (department_id) {
      query += ' WHERE department_id = $1';
      params.push(department_id);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching mobile money transactions:', error);
    res.status(500).json({ error: 'Failed to fetch mobile money transactions' });
  }
});

app.post('/api/mobile-money-transactions', authenticateToken, async (req, res) => {
  try {
    const { phone_number, amount, transaction_type, customer_id, customer_name, customer_number, department_id, provider, reference_number, notes, status } = req.body;
    const result = await pool.query(
      `INSERT INTO mobile_money_transactions 
       (phone_number, amount, transaction_type, customer_id, customer_name, customer_number, department_id, provider, reference_number, notes, processed_by, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [phone_number, amount, transaction_type, customer_id, customer_name, customer_number, department_id, provider, reference_number, notes, req.user.userId, status || 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating mobile money transaction:', error);
    res.status(500).json({ error: 'Failed to create mobile money transaction' });
  }
});

// ============= DEPARTMENTS ENDPOINTS =============

app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

app.post('/api/departments', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, is_mobile_money, is_perfume_department } = req.body;
    const result = await pool.query(
      `INSERT INTO departments (name, description, is_mobile_money, is_perfume_department) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description, is_mobile_money || false, is_perfume_department || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

app.put('/api/departments/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_mobile_money, is_perfume_department } = req.body;
    const result = await pool.query(
      `UPDATE departments SET name = $1, description = $2, is_mobile_money = $3, is_perfume_department = $4 
       WHERE id = $5 RETURNING *`,
      [name, description, is_mobile_money, is_perfume_department, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

app.delete('/api/departments/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM departments WHERE id = $1', [id]);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ============= CATEGORIES ENDPOINTS =============

app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { name, type } = req.body;
    const result = await pool.query(
      'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING *',
      [name, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ============= USER ROLES ENDPOINTS =============

app.get('/api/user-roles', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ur.*, p.full_name, p.department_id 
       FROM user_roles ur 
       LEFT JOIN profiles p ON ur.user_id = p.id
       ORDER BY p.full_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

app.get('/api/profiles', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, 
       (SELECT role FROM user_roles WHERE user_id = p.id LIMIT 1) as role,
       d.name as department_name
       FROM profiles p
       LEFT JOIN departments d ON p.department_id = d.id
       ORDER BY p.full_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

app.put('/api/profiles/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, department_id, is_active } = req.body;
    const result = await pool.query(
      `UPDATE profiles SET full_name = $1, department_id = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [full_name, department_id, is_active, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============= CREDITS ENDPOINTS =============
// Get all credits (with department filtering)
app.get('/api/credits', authenticateToken, async (req, res) => {
  try {
    const { department_id, is_admin } = req.query;
    
    let query = `
      SELECT c.*, 
        fd.name as from_department_name,
        td.name as to_department_name
      FROM credits c
      LEFT JOIN departments fd ON c.from_department_id = fd.id
      LEFT JOIN departments td ON c.to_department_id = td.id
    `;
    
    const params = [];
    
    // Filter by department if not admin
    if (is_admin !== 'true' && department_id) {
      query += ' WHERE (c.from_department_id = $1 OR c.to_department_id = $1)';
      params.push(department_id);
    } else if (is_admin === 'true' && department_id) {
      query += ' WHERE (c.from_department_id = $1 OR c.to_department_id = $1)';
      params.push(department_id);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching credits:', error);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

// Create credit
app.post('/api/credits', authenticateToken, async (req, res) => {
  try {
    const {
      transaction_type,
      from_department_id,
      to_department_id,
      from_person,
      to_person,
      amount,
      purpose,
      notes
    } = req.body;
    
    const query = `
      INSERT INTO credits (
        transaction_type, from_department_id, to_department_id,
        from_person, to_person, amount, purpose, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      transaction_type,
      from_department_id || null,
      to_department_id || null,
      from_person || null,
      to_person || null,
      amount,
      purpose,
      notes || null,
      req.user.userId
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating credit:', error);
    res.status(500).json({ error: 'Failed to create credit' });
  }
});

// Update credit status (approve/reject)
app.put('/api/credits/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const query = `
      UPDATE credits
      SET status = $1, approved_by = $2, approved_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, req.user.userId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credit not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating credit status:', error);
    res.status(500).json({ error: 'Failed to update credit status' });
  }
});

// Settle credit
app.put('/api/credits/:id/settle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE credits
      SET settlement_status = 'settled', settled_at = NOW(), settled_by = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [req.user.userId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credit not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error settling credit:', error);
    res.status(500).json({ error: 'Failed to settle credit' });
  }
});

// Send credit notification (inbox message)
app.post('/api/credits/:id/notify', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, from_department_id, to_department_id, subject } = req.body;
    
    const query = `
      INSERT INTO interdepartmental_inbox (
        from_department_id, to_department_id, credit_id,
        subject, message, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      from_department_id || null,
      to_department_id || null,
      id,
      subject,
      message,
      req.user.userId
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ============= INBOX ENDPOINTS =============
// Get inbox messages (with department filtering and related data)
app.get('/api/inbox', authenticateToken, async (req, res) => {
  try {
    const { department_id, is_admin } = req.query;
    
    let query = `
      SELECT 
        i.*,
        fd.name as from_department_name,
        td.name as to_department_name,
        c.amount as credit_amount,
        c.purpose as credit_purpose,
        c.transaction_type as credit_transaction_type,
        c.status as credit_status,
        c.settlement_status as credit_settlement_status
      FROM interdepartmental_inbox i
      LEFT JOIN departments fd ON i.from_department_id = fd.id
      LEFT JOIN departments td ON i.to_department_id = td.id
      LEFT JOIN credits c ON i.credit_id = c.id
    `;
    
    const params = [];
    
    // Filter by department if not admin
    if (is_admin !== 'true' && department_id) {
      query += ' WHERE (i.from_department_id = $1 OR i.to_department_id = $1)';
      params.push(department_id);
    } else if (is_admin === 'true' && department_id) {
      query += ' WHERE (i.from_department_id = $1 OR i.to_department_id = $1)';
      params.push(department_id);
    }
    
    query += ' ORDER BY i.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inbox messages:', error);
    res.status(500).json({ error: 'Failed to fetch inbox messages' });
  }
});

// Mark message as read
app.put('/api/inbox/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE interdepartmental_inbox
      SET is_read = true, read_at = NOW(), read_by = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [req.user.userId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// ============= SUPPLIERS ENDPOINTS =============
// Get all suppliers
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM suppliers ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Create supplier
app.post('/api/suppliers', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, contact_person || null, phone || null, email || null, address || null, notes || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update supplier
app.put('/api/suppliers/:id', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE suppliers 
       SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5, notes = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, contact_person || null, phone || null, email || null, address || null, notes || null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete supplier
app.delete('/api/suppliers/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// ============= INTERNAL USAGE ENDPOINTS =============
// Get internal usage (with department filtering)
app.get('/api/internal-usage', authenticateToken, async (req, res) => {
  try {
    const { department_id } = req.query;
    
    let query = `
      SELECT 
        iu.*,
        p.name as product_name,
        p.unit as product_unit,
        d.name as department_name
      FROM internal_stock_usage iu
      LEFT JOIN products p ON iu.product_id = p.id
      LEFT JOIN departments d ON iu.department_id = d.id
    `;
    
    const params = [];
    
    if (department_id) {
      query += ' WHERE iu.department_id = $1';
      params.push(department_id);
    }
    
    query += ' ORDER BY iu.usage_date DESC, iu.created_at DESC';
    
    const result = await pool.query(query, params);
    
    // Format for compatibility with frontend expectations
    const formatted = result.rows.map(row => ({
      ...row,
      products: { name: row.product_name, unit: row.product_unit },
      departments: { name: row.department_name }
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching internal usage:', error);
    res.status(500).json({ error: 'Failed to fetch internal usage' });
  }
});

// Create internal usage record
app.post('/api/internal-usage', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      product_id,
      department_id,
      quantity,
      unit_value,
      total_value,
      reason,
      notes,
      usage_date
    } = req.body;
    
    await client.query('BEGIN');
    
    // Insert usage record
    const usageResult = await client.query(
      `INSERT INTO internal_stock_usage (
        product_id, department_id, quantity, unit_value, total_value,
        reason, notes, usage_date, recorded_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        product_id,
        department_id,
        quantity,
        unit_value,
        total_value,
        reason || null,
        notes || null,
        usage_date || new Date().toISOString().split('T')[0],
        req.user.userId,
        'recorded'
      ]
    );
    
    // Update product stock
    const productResult = await client.query(
      'SELECT tracking_type, current_stock, current_stock_ml FROM products WHERE id = $1',
      [product_id]
    );
    
    if (productResult.rows.length > 0) {
      const product = productResult.rows[0];
      
      if (product.tracking_type === 'milliliter') {
        await client.query(
          'UPDATE products SET current_stock_ml = current_stock_ml - $1 WHERE id = $2',
          [quantity, product_id]
        );
      } else {
        await client.query(
          'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
          [quantity, product_id]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(usageResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating internal usage:', error);
    res.status(500).json({ error: 'Failed to create internal usage record' });
  } finally {
    client.release();
  }
});

// Update internal usage status
app.put('/api/internal-usage/:id/status', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE internal_stock_usage SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Internal usage record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating internal usage status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ============= USER MANAGEMENT ENDPOINTS =============
// Create new user (staff)
app.post('/api/users/create', authenticateToken, requireRole(['admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, fullName, role, departmentId, navPermissions } = req.body;
    
    await client.query('BEGIN');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate user ID (mimicking UUID)
    const userId = crypto.randomUUID();
    
    // Insert into profiles FIRST (user_credentials has FK to profiles)
    console.log('📝 Creating profile with ID:', userId, 'Name:', fullName, 'Department:', departmentId);
    const profileResult = await client.query(
      `INSERT INTO profiles (id, full_name, department_id, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, fullName, departmentId || null, true]
    );
    console.log('✅ Profile created successfully:', profileResult.rows[0]);
    
    // Insert into user_credentials
    console.log('📝 Creating user_credentials for user:', userId, 'Email:', email.toLowerCase());
    const credResult = await client.query(
      'INSERT INTO user_credentials (user_id, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, email',
      [userId, email.toLowerCase(), hashedPassword]
    );
    console.log('✅ User credentials created successfully:', credResult.rows[0]);
    
    // Insert into user_roles
    await client.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [userId, role]
    );
    
    // Insert nav permissions if provided (skip for now if table doesn't exist)
    if (navPermissions && navPermissions.length > 0) {
      try {
        for (const navPath of navPermissions) {
          await client.query(
            'INSERT INTO user_nav_permissions (user_id, nav_path) VALUES ($1, $2)',
            [userId, navPath]
          );
        }
        console.log('✅ Nav permissions created successfully');
      } catch (permError) {
        console.log('⚠️ Nav permissions table might not exist yet, skipping:', permError.message);
        // Don't fail user creation if nav permissions table doesn't exist
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({ 
      id: userId, 
      email, 
      full_name: fullName,
      role,
      department_id: departmentId 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating user:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error detail:', error.detail);
    if (error.code === '23505') {
      res.status(409).json({ error: 'User with this email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
  } finally {
    client.release();
  }
});

// Update user role and permissions
app.put('/api/users/:userId/role', authenticateToken, requireRole(['admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { role, departmentId, navPermissions } = req.body;
    
    await client.query('BEGIN');
    
    // Update profile department
    await client.query(
      'UPDATE profiles SET department_id = $1, updated_at = NOW() WHERE id = $2',
      [departmentId || null, userId]
    );
    
    // Update or insert role
    const roleExists = await client.query(
      'SELECT id FROM user_roles WHERE user_id = $1',
      [userId]
    );
    
    if (roleExists.rows.length > 0) {
      await client.query(
        'UPDATE user_roles SET role = $1 WHERE user_id = $2',
        [role, userId]
      );
    } else {
      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, role]
      );
    }
    
    // Delete existing nav permissions
    await client.query('DELETE FROM user_nav_permissions WHERE user_id = $1', [userId]);
    
    // Insert new nav permissions
    if (navPermissions && navPermissions.length > 0) {
      for (const navPath of navPermissions) {
        await client.query(
          'INSERT INTO user_nav_permissions (user_id, nav_path) VALUES ($1, $2)',
          [userId, navPath]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  } finally {
    client.release();
  }
});

// Toggle user activation
app.put('/api/users/:userId/activation', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    
    const result = await pool.query(
      'UPDATE profiles SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [isActive, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling user activation:', error);
    res.status(500).json({ error: 'Failed to toggle user activation' });
  }
});

// Delete user
app.delete('/api/users/:userId', authenticateToken, requireRole(['admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { masterPassword } = req.body;
    
    // Verify master password (admin's password)
    const adminResult = await client.query(
      'SELECT password_hash FROM user_credentials WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (adminResult.rows.length === 0) {
      return res.status(401).json({ error: 'Admin credentials not found' });
    }
    
    const validPassword = await bcrypt.compare(masterPassword, adminResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid master password' });
    }
    
    await client.query('BEGIN');
    
    // Delete nav permissions
    await client.query('DELETE FROM user_nav_permissions WHERE user_id = $1', [userId]);
    
    // Delete user roles
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    
    // Delete profile
    await client.query('DELETE FROM profiles WHERE id = $1', [userId]);
    
    // Delete credentials
    await client.query('DELETE FROM user_credentials WHERE user_id = $1', [userId]);
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// Get user navigation permissions
app.get('/api/users/:userId/nav-permissions', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Return empty array if table doesn't exist yet
    try {
      const result = await pool.query(
        'SELECT nav_path FROM user_nav_permissions WHERE user_id = $1',
        [userId]
      );
      
      res.json(result.rows.map(row => row.nav_path));
    } catch (tableError) {
      if (tableError.code === '42P01') {
        // Table doesn't exist, return empty array
        console.log('⚠️ user_nav_permissions table does not exist, returning empty permissions');
        res.json([]);
      } else {
        throw tableError;
      }
    }
  } catch (error) {
    console.error('Error fetching nav permissions:', error);
    res.status(500).json({ error: 'Failed to fetch navigation permissions' });
  }
});

// ============= APPOINTMENTS ENDPOINTS =============
// Get all appointments (with joins for customer and service data)
app.get('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        a.*,
        c.name as customer_name,
        c.phone as customer_phone,
        s.name as service_name,
        s.base_price as service_price
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN services s ON a.service_id = s.id
      ORDER BY a.appointment_date DESC
    `;
    
    const result = await pool.query(query);
    
    // Format for compatibility with frontend expectations
    const formatted = result.rows.map(row => ({
      ...row,
      customers: row.customer_name ? { name: row.customer_name, phone: row.customer_phone } : null,
      services: row.service_name ? { name: row.service_name, base_price: row.service_price } : null
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Create appointment
app.post('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id,
      service_id,
      appointment_date,
      duration_minutes,
      notes,
      assigned_staff,
      status
    } = req.body;
    
    const query = `
      INSERT INTO appointments (
        customer_id, service_id, appointment_date, duration_minutes,
        notes, assigned_staff, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      customer_id || null,
      service_id || null,
      appointment_date,
      duration_minutes || 60,
      notes || null,
      assigned_staff || null,
      status || 'scheduled'
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_id,
      service_id,
      appointment_date,
      duration_minutes,
      notes,
      assigned_staff,
      status
    } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (customer_id !== undefined) {
      updates.push(`customer_id = $${paramIndex++}`);
      values.push(customer_id);
    }
    if (service_id !== undefined) {
      updates.push(`service_id = $${paramIndex++}`);
      values.push(service_id);
    }
    if (appointment_date !== undefined) {
      updates.push(`appointment_date = $${paramIndex++}`);
      values.push(appointment_date);
    }
    if (duration_minutes !== undefined) {
      updates.push(`duration_minutes = $${paramIndex++}`);
      values.push(duration_minutes);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (assigned_staff !== undefined) {
      updates.push(`assigned_staff = $${paramIndex++}`);
      values.push(assigned_staff);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `
      UPDATE appointments
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
app.delete('/api/appointments/:id', authenticateToken, requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// ============= STAFF PERFORMANCE ENDPOINTS =============

// Get all staff performance records
app.get('/api/staff-performance', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sp.*, p.full_name as user_name
      FROM staff_performance sp
      LEFT JOIN profiles p ON p.id = sp.user_id
      ORDER BY sp.date DESC, sp.total_sales DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching staff performance:', error);
    res.status(500).json({ error: 'Failed to fetch staff performance' });
  }
});

// ============= LANDING PAGE CONTENT ENDPOINTS =============

// Get all landing page content
app.get('/api/landing-page-content', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM landing_page_content
      ORDER BY order_index ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching landing page content:', error);
    res.status(500).json({ error: 'Failed to fetch landing page content' });
  }
});

// Update landing page content
app.put('/api/landing-page-content/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      content,
      button_text,
      button_link,
      image_url,
      is_visible
    } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (subtitle !== undefined) {
      updates.push(`subtitle = $${paramIndex++}`);
      values.push(subtitle);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(content);
    }
    if (button_text !== undefined) {
      updates.push(`button_text = $${paramIndex++}`);
      values.push(button_text);
    }
    if (button_link !== undefined) {
      updates.push(`button_link = $${paramIndex++}`);
      values.push(button_link);
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(image_url);
    }
    if (is_visible !== undefined) {
      updates.push(`is_visible = $${paramIndex++}`);
      values.push(is_visible);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `
      UPDATE landing_page_content
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating landing page content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// ============= SERVICE SHOWCASE ENDPOINTS =============

// Get all service showcase items
app.get('/api/service-showcase', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM service_showcase
      ORDER BY display_order ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service showcase:', error);
    res.status(500).json({ error: 'Failed to fetch service showcase' });
  }
});

// Create service showcase item
app.post('/api/service-showcase', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      features,
      display_order,
      is_visible,
      is_featured
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO service_showcase (
        name, description, icon, features, display_order, is_visible, is_featured
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      name,
      description || null,
      icon || null,
      features || [],
      display_order || 0,
      is_visible !== undefined ? is_visible : true,
      is_featured !== undefined ? is_featured : false
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service showcase:', error);
    res.status(500).json({ error: 'Failed to create service showcase' });
  }
});

// Update service showcase item
app.put('/api/service-showcase/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      icon,
      features,
      display_order,
      is_visible,
      is_featured
    } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(icon);
    }
    if (features !== undefined) {
      updates.push(`features = $${paramIndex++}`);
      values.push(features);
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(display_order);
    }
    if (is_visible !== undefined) {
      updates.push(`is_visible = $${paramIndex++}`);
      values.push(is_visible);
    }
    if (is_featured !== undefined) {
      updates.push(`is_featured = $${paramIndex++}`);
      values.push(is_featured);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `
      UPDATE service_showcase
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service showcase:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete service showcase item
app.delete('/api/service-showcase/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM service_showcase WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service showcase:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ============= SUSPENDED REVENUE ENDPOINTS =============

// Get suspended revenue records
app.get('/api/suspended-revenue', authenticateToken, async (req, res) => {
  try {
    const { department_id } = req.query;
    
    let query = `
      SELECT * FROM suspended_revenue
      ORDER BY date DESC, created_at DESC
    `;
    const params = [];
    
    if (department_id) {
      query = `
        SELECT * FROM suspended_revenue
        WHERE department_id = $1
        ORDER BY date DESC, created_at DESC
      `;
      params.push(department_id);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching suspended revenue:', error);
    res.status(500).json({ error: 'Failed to fetch suspended revenue' });
  }
});

// Create suspended revenue record
app.post('/api/suspended-revenue', authenticateToken, async (req, res) => {
  try {
    const {
      cashier_name,
      date,
      amount,
      reason,
      investigation_notes,
      department_id,
      status
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO suspended_revenue (
        cashier_name,
        date,
        amount,
        reason,
        investigation_notes,
        department_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      cashier_name,
      date,
      amount,
      reason || null,
      investigation_notes || null,
      department_id || null,
      status || 'pending'
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating suspended revenue:', error);
    res.status(500).json({ error: 'Failed to create suspended revenue record' });
  }
});

// Update suspended revenue status
app.put('/api/suspended-revenue/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      resolved_at,
      investigation_notes
    } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (resolved_at !== undefined) {
      updates.push(`resolved_at = $${paramIndex++}`);
      values.push(resolved_at);
    }
    if (investigation_notes !== undefined) {
      updates.push(`investigation_notes = $${paramIndex++}`);
      values.push(investigation_notes);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `
      UPDATE suspended_revenue
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suspended revenue record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating suspended revenue:', error);
    res.status(500).json({ error: 'Failed to update suspended revenue' });
  }
});

// ============= PERFUME REPORTING ENDPOINTS =============

// Perfume Revenue Report
app.get('/api/perfume-revenue-report', authenticateToken, async (req, res) => {
  try {
    const { date, departmentId } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Get sales with perfume items
    let salesQuery = `
      SELECT s.*, 
        json_agg(json_build_object(
          'customer_type', si.customer_type,
          'scent_mixture', si.scent_mixture,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'subtotal', si.subtotal,
          'bottle_cost', si.bottle_cost
        )) as sale_items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.status != 'voided'
        AND s.created_at >= $1::timestamp
        AND s.created_at < ($1::timestamp + interval '1 day')
    `;
    
    const params = [targetDate];
    
    if (departmentId) {
      salesQuery += ` AND s.department_id = $2`;
      params.push(departmentId);
    }
    
    salesQuery += ` GROUP BY s.id`;
    
    const salesResult = await pool.query(salesQuery, params);
    
    // Calculate metrics
    let retailRevenue = 0, wholesaleRevenue = 0;
    let retailCount = 0, wholesaleCount = 0;
    let totalMlSold = 0;
    
    salesResult.rows.forEach(sale => {
      sale.sale_items?.forEach(item => {
        if (item.scent_mixture) {
          totalMlSold += item.quantity || 0;
          if (item.customer_type === 'wholesale') {
            wholesaleRevenue += item.subtotal || 0;
            wholesaleCount += 1;
          } else {
            retailRevenue += item.subtotal || 0;
            retailCount += 1;
          }
        }
      });
    });
    
    // Get expenses
    let expensesQuery = 'SELECT * FROM expenses WHERE date = $1';
    const expensesParams = [targetDate];
    if (departmentId) {
      expensesQuery += ' AND department_id = $2';
      expensesParams.push(departmentId);
    }
    const expenses = await pool.query(expensesQuery, expensesParams);
    const totalExpenses = expenses.rows.reduce((sum, exp) => sum + Number(exp.amount), 0);
    
    // Get reconciliations
    let recQuery = 'SELECT * FROM reconciliations WHERE date = $1';
    const recParams = [targetDate];
    if (departmentId) {
      recQuery += ' AND department_id = $2';
      recParams.push(departmentId);
    }
    const reconciliations = await pool.query(recQuery, recParams);
    const totalDifference = reconciliations.rows.reduce((sum, rec) => sum + Number(rec.difference), 0);
    
    // Get voided sales
    let voidQuery = `
      SELECT s.*, 
        json_agg(json_build_object(
          'scent_mixture', si.scent_mixture,
          'quantity', si.quantity,
          'subtotal', si.subtotal
        )) as sale_items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.status = 'voided'
        AND s.voided_at >= $1::timestamp
        AND s.voided_at < ($1::timestamp + interval '1 day')
    `;
    const voidParams = [targetDate];
    if (departmentId) {
      voidQuery += ' AND s.department_id = $2';
      voidParams.push(departmentId);
    }
    voidQuery += ' GROUP BY s.id';
    
    const voidedSales = await pool.query(voidQuery, voidParams);
    const voidedPerfumeSales = voidedSales.rows.filter(sale =>
      sale.sale_items?.some(item => item.scent_mixture)
    );
    const totalVoidedAmount = voidedPerfumeSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    
    // Get credits
    let creditsQuery = `
      SELECT * FROM credits 
      WHERE created_at >= $1::timestamp 
        AND created_at < ($1::timestamp + interval '1 day')
    `;
    const creditsParams = [targetDate];
    if (departmentId) {
      creditsQuery += ' AND (from_department_id = $2 OR to_department_id = $2)';
      creditsParams.push(departmentId);
    }
    const credits = await pool.query(creditsQuery, creditsParams);
    const creditsOut = credits.rows.filter(c => c.from_department_id === departmentId).reduce((sum, c) => sum + Number(c.amount), 0);
    const creditsIn = credits.rows.filter(c => c.to_department_id === departmentId).reduce((sum, c) => sum + Number(c.amount), 0);
    
    res.json({
      retailRevenue,
      wholesaleRevenue,
      totalRevenue: retailRevenue + wholesaleRevenue,
      retailCount,
      wholesaleCount,
      totalMlSold,
      totalTransactions: retailCount + wholesaleCount,
      expenses: expenses.rows,
      totalExpenses,
      reconciliations: reconciliations.rows,
      totalDifference,
      voidedSales: voidedPerfumeSales,
      totalVoidedAmount,
      voidedCount: voidedPerfumeSales.length,
      credits: credits.rows,
      creditsOut,
      creditsIn,
      netCredits: creditsIn - creditsOut,
    });
  } catch (error) {
    console.error('Error fetching perfume revenue report:', error);
    res.status(500).json({ error: 'Failed to fetch perfume revenue report' });
  }
});

// Perfume Department Report
app.get('/api/perfume-department-report', authenticateToken, async (req, res) => {
  try {
    const { date, departmentId } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Get sales with perfume items
    let salesQuery = `
      SELECT s.*, 
        json_agg(json_build_object(
          'customer_type', si.customer_type,
          'scent_mixture', si.scent_mixture,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'subtotal', si.subtotal,
          'bottle_cost', si.bottle_cost
        )) as sale_items
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.status != 'voided'
        AND s.created_at >= $1::timestamp
        AND s.created_at < ($1::timestamp + interval '1 day')
    `;
    
    const params = [targetDate];
    if (departmentId) {
      salesQuery += ' AND s.department_id = $2';
      params.push(departmentId);
    }
    salesQuery += ' GROUP BY s.id';
    
    const salesResult = await pool.query(salesQuery, params);
    
    // Calculate metrics
    let retailMl = 0, wholesaleMl = 0;
    let retailRevenue = 0, wholesaleRevenue = 0;
    let totalBottleCosts = 0;
    let retailTransactions = 0, wholesaleTransactions = 0;
    const scentUsage = {};
    
    salesResult.rows.forEach(sale => {
      const hasRetail = sale.sale_items?.some(item => item.scent_mixture && item.customer_type === 'retail');
      const hasWholesale = sale.sale_items?.some(item => item.scent_mixture && item.customer_type === 'wholesale');
      
      if (hasRetail) retailTransactions++;
      if (hasWholesale) wholesaleTransactions++;
      
      sale.sale_items?.forEach(item => {
        if (item.scent_mixture) {
          const ml = item.quantity || 0;
          const revenue = item.subtotal || 0;
          const bottleCost = item.bottle_cost || 0;
          
          if (item.customer_type === 'wholesale') {
            wholesaleMl += ml;
            wholesaleRevenue += revenue;
          } else {
            retailMl += ml;
            retailRevenue += revenue;
          }
          
          totalBottleCosts += bottleCost;
          
          // Parse scent mixture
          try {
            const scents = JSON.parse(item.scent_mixture);
            scents.forEach(scent => {
              scentUsage[scent.name] = (scentUsage[scent.name] || 0) + scent.count;
            });
          } catch (e) {
            const scentNames = item.scent_mixture.split(',').map(s => s.trim());
            scentNames.forEach(name => {
              scentUsage[name] = (scentUsage[name] || 0) + 1;
            });
          }
        }
      });
    });
    
    const topScents = Object.entries(scentUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    // Get internal usage
    let usageQuery = `
      SELECT iu.quantity, iu.reason, p.name as product_name
      FROM internal_stock_usage iu
      LEFT JOIN products p ON iu.product_id = p.id
      WHERE iu.usage_date = $1
    `;
    const usageParams = [targetDate];
    if (departmentId) {
      usageQuery += ' AND iu.department_id = $2';
      usageParams.push(departmentId);
    }
    
    const internalUsage = await pool.query(usageQuery, usageParams);
    const sacrificed = internalUsage.rows.filter(item =>
      item.reason?.toLowerCase().includes('display') || item.reason?.toLowerCase().includes('sacrifice')
    );
    const otherUsage = internalUsage.rows.filter(item =>
      !item.reason?.toLowerCase().includes('display') && !item.reason?.toLowerCase().includes('sacrifice')
    );
    
    res.json({
      retailMl,
      wholesaleMl,
      totalMl: retailMl + wholesaleMl,
      retailRevenue,
      wholesaleRevenue,
      totalRevenue: retailRevenue + wholesaleRevenue,
      totalBottleCosts,
      netRevenue: (retailRevenue + wholesaleRevenue) - totalBottleCosts,
      retailTransactions,
      wholesaleTransactions,
      totalTransactions: retailTransactions + wholesaleTransactions,
      scentUsage,
      topScents,
      internalUsage: {
        totalSacrificed: sacrificed.reduce((sum, item) => sum + (item.quantity || 0), 0),
        totalInternal: otherUsage.reduce((sum, item) => sum + (item.quantity || 0), 0),
        sacrificedItems: sacrificed.length,
        internalItems: otherUsage.length,
      },
    });
  } catch (error) {
    console.error('Error fetching perfume department report:', error);
    res.status(500).json({ error: 'Failed to fetch perfume department report' });
  }
});

// Scent Popularity Tracker
app.get('/api/scent-popularity', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    
    let query = `
      SELECT si.*, s.department_id
      FROM sale_items si
      INNER JOIN sales s ON si.sale_id = s.id
      WHERE si.scent_mixture IS NOT NULL
    `;
    
    const params = [];
    if (departmentId) {
      query += ' AND s.department_id = $1';
      params.push(departmentId);
    }
    
    const result = await pool.query(query, params);
    
    // Parse individual scents from mixtures
    const scentCounts = {};
    
    result.rows.forEach(item => {
      const mixture = item.scent_mixture || '';
      const scentMatches = mixture.match(/([^(+]+)\s*\((\d+(?:\.\d+)?)ml\)/g) || [];
      
      scentMatches.forEach(match => {
        const parts = match.match(/([^(]+)\s*\((\d+(?:\.\d+)?)ml\)/);
        if (parts) {
          const scent = parts[1].trim();
          const ml = parseFloat(parts[2] || '0');
          
          if (!scentCounts[scent]) {
            scentCounts[scent] = { count: 0, totalRevenue: 0, totalMl: 0 };
          }
          scentCounts[scent].count += 1;
          scentCounts[scent].totalRevenue += Number(item.subtotal || 0);
          scentCounts[scent].totalMl += ml;
        }
      });
    });
    
    // Convert to array and sort by count
    const scentData = Object.entries(scentCounts)
      .map(([scent, data]) => ({
        scent,
        count: data.count,
        revenue: data.totalRevenue,
        totalMl: data.totalMl,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    
    res.json(scentData);
  } catch (error) {
    console.error('Error fetching scent popularity:', error);
    res.status(500).json({ error: 'Failed to fetch scent popularity' });
  }
});

// ============= FILE UPLOAD ENDPOINTS (ADDITIONAL) =============

// Upload logo
app.post('/api/upload/logo', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/logos/${req.file.filename}`;
    res.json({ 
      message: 'Logo uploaded successfully', 
      url: fileUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Upload product image
app.post('/api/upload/product', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/products/${req.file.filename}`;
    res.json({ 
      message: 'Product image uploaded successfully', 
      url: fileUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Product image upload error:', error);
    res.status(500).json({ error: 'Failed to upload product image' });
  }
});

// Upload document
app.post('/api/upload/document', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/documents/${req.file.filename}`;
    res.json({ 
      message: 'Document uploaded successfully', 
      url: fileUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Delete uploaded file
app.delete('/api/upload/:type/:filename', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, type, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ============= STOCK MANAGEMENT ENDPOINTS =============

// Check product stock availability
app.post('/api/products/check-stock', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity, trackingType, totalMl } = req.body;

    const { rows } = await pool.query(
      'SELECT current_stock, current_stock_ml FROM products WHERE id = $1',
      [productId]
    );

    if (rows.length === 0) {
      return res.json({ available: false, message: 'Product not found' });
    }

    const product = rows[0];

    if (trackingType === 'milliliter' && totalMl) {
      const availableMl = product.current_stock_ml || 0;
      if (availableMl < totalMl) {
        return res.json({
          available: false,
          message: `Insufficient stock. Available: ${availableMl}ml, Requested: ${totalMl}ml`
        });
      }
    } else {
      const availableStock = product.current_stock || 0;
      if (availableStock < quantity) {
        return res.json({
          available: false,
          message: `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`
        });
      }
    }

    res.json({ available: true });
  } catch (error) {
    console.error('Stock check error:', error);
    res.json({ available: false, message: 'Error checking stock' });
  }
});

// Check variant stock availability
app.post('/api/product-variants/check-stock', authenticateToken, async (req, res) => {
  try {
    const { variantId, quantity } = req.body;

    const { rows } = await pool.query(
      'SELECT current_stock, variant_name FROM product_variants WHERE id = $1',
      [variantId]
    );

    if (rows.length === 0) {
      return res.json({ available: false, message: 'Variant not found' });
    }

    const variant = rows[0];
    const available = variant.current_stock >= quantity;

    res.json({
      available,
      message: available ? undefined : `Insufficient stock for ${variant.variant_name}. Available: ${variant.current_stock}`
    });
  } catch (error) {
    console.error('Variant stock check error:', error);
    res.json({ available: false, message: 'Error checking stock' });
  }
});

// ============= SENSITIVE SERVICE REGISTRATIONS =============

// Get all registrations for a department
app.get('/api/sensitive-registrations', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.query;
    
    if (!departmentId) {
      return res.status(400).json({ error: 'Department ID is required' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM sensitive_service_registrations 
       WHERE department_id = $1
       ORDER BY created_at DESC`,
      [departmentId]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Create new registration
app.post('/api/sensitive-registrations', authenticateToken, async (req, res) => {
  try {
    const {
      service_type,
      customer_name,
      customer_phone,
      customer_id_type,
      customer_id_number,
      customer_address,
      department_id,
      customer_photo_url,
      id_document_url,
      additional_details
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO sensitive_service_registrations (
        service_type, customer_name, customer_phone, customer_id_type,
        customer_id_number, customer_address, department_id, registered_by,
        customer_photo_url, id_document_url, additional_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        service_type, customer_name, customer_phone, customer_id_type,
        customer_id_number, customer_address, department_id, req.user.id,
        customer_photo_url, id_document_url, additional_details
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating registration:', error);
    res.status(500).json({ error: 'Failed to create registration' });
  }
});

// Update registration
app.put('/api/sensitive-registrations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      service_type,
      customer_name,
      customer_phone,
      customer_id_type,
      customer_id_number,
      customer_address,
      customer_photo_url,
      id_document_url,
      additional_details
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE sensitive_service_registrations 
       SET service_type = $1, customer_name = $2, customer_phone = $3,
           customer_id_type = $4, customer_id_number = $5, customer_address = $6,
           customer_photo_url = $7, id_document_url = $8, additional_details = $9,
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        service_type, customer_name, customer_phone, customer_id_type,
        customer_id_number, customer_address, customer_photo_url,
        id_document_url, additional_details, id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

// ============= DATABASE BACKUP ENDPOINT =============

app.post('/api/backup', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(UPLOAD_DIR, 'backups', filename);

    // Execute pg_dump (requires pg_dump to be in PATH)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const command = `pg_dump -h ${process.env.DB_HOST} -p ${process.env.DB_PORT} -U ${process.env.DB_USER} -F p -f "${filepath}" ${process.env.DB_NAME}`;
    
    await execAsync(command, {
      env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
    });

    res.json({ 
      message: 'Backup created successfully',
      filename,
      path: `/uploads/backups/${filename}`
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Start server - this MUST happen to keep the process alive
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/health\n`);
});

// Ensure the server stays running
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port or kill the process using it.`);
  }
  process.exit(1);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    pool.end(() => {
      console.log('✅ Database pool closed');
      process.exit(0);
    });
  });
});
