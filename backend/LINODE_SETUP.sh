#!/bin/bash

# ============================================
# DOTCOM POS - Complete Backend Setup Script
# Run this on your Linode server
# ============================================

echo "🚀 Starting DotCom POS Backend Setup..."

# Variables - CHANGE THESE
DB_PASSWORD="Zxcvbn#2123fran"
ADMIN_EMAIL="admin@dotcombrothersltd.com"
ADMIN_PASSWORD="Admin123!"
ADMIN_NAME="Admin User"

# Create backend directory
mkdir -p /var/www/dotcom-pos/backend
cd /var/www/dotcom-pos/backend

echo "📦 Creating package.json..."
cat > package.json << 'PACKAGEEOF'
{
  "name": "dotcom-pos-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.3"
  }
}
PACKAGEEOF

echo "🔧 Creating .env file..."
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dotcom_pos
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}
PORT=3001
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
EOF

echo "📁 Creating upload directories..."
mkdir -p uploads/{logos,products,documents,backups}

echo "📥 Installing dependencies..."
npm install

echo "🔐 Creating admin user in database..."

# Generate password hash
HASH=$(node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('${ADMIN_PASSWORD}', 10);
console.log(hash);
")

# Create admin user in PostgreSQL
sudo -u postgres psql -d dotcom_pos << SQLEOF
-- Create profile
INSERT INTO profiles (id, full_name, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), '${ADMIN_NAME}', true, NOW(), NOW())
ON CONFLICT DO NOTHING
RETURNING id;

-- Get the profile ID and create credentials
DO \$\$
DECLARE
    user_uuid UUID;
BEGIN
    -- Check if admin already exists
    SELECT p.id INTO user_uuid 
    FROM profiles p 
    JOIN user_credentials uc ON uc.user_id = p.id 
    WHERE uc.email = '${ADMIN_EMAIL}';
    
    IF user_uuid IS NULL THEN
        -- Create new profile
        INSERT INTO profiles (id, full_name, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), '${ADMIN_NAME}', true, NOW(), NOW())
        RETURNING id INTO user_uuid;
        
        -- Create credentials
        INSERT INTO user_credentials (user_id, email, password_hash)
        VALUES (user_uuid, '${ADMIN_EMAIL}', '${HASH}');
        
        -- Assign admin role
        INSERT INTO user_roles (user_id, role, created_at)
        VALUES (user_uuid, 'admin', NOW());
        
        RAISE NOTICE 'Admin user created successfully!';
    ELSE
        RAISE NOTICE 'Admin user already exists!';
    END IF;
END \$\$;
SQLEOF

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy server.js to this directory (see instructions below)"
echo "2. Start the backend: pm2 start server.js --name dotcom-backend"
echo "3. Test: curl http://localhost:3001/api/health"
echo ""
echo "🔑 Admin Login Credentials:"
echo "   Email: ${ADMIN_EMAIL}"
echo "   Password: ${ADMIN_PASSWORD}"
echo ""
echo "⚠️  IMPORTANT: Change the admin password after first login!"
