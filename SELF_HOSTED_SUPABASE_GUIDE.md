# Self-Hosted Supabase Complete Setup Guide

## Overview

This guide will help you deploy Supabase on your own infrastructure and migrate your existing Lovable Cloud data to your self-hosted instance. This approach keeps your existing code working with minimal changes.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Docker Installation](#docker-installation)
4. [Supabase Self-Hosting Setup](#supabase-self-hosting-setup)
5. [Data Migration](#data-migration)
6. [Frontend Configuration](#frontend-configuration)
7. [Edge Functions Deployment](#edge-functions-deployment)
8. [SSL/HTTPS Setup](#sslhttps-setup)
9. [Maintenance & Backups](#maintenance--backups)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- [ ] A Linux server (Ubuntu 22.04 LTS recommended)
- [ ] Root/sudo access
- [ ] Domain name pointing to your server
- [ ] At least 4GB RAM, 2 vCPUs, 50GB SSD
- [ ] Basic command line knowledge

---

## Server Requirements

### Minimum Specifications
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4GB | 8GB+ |
| Storage | 50GB SSD | 100GB+ SSD |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### Recommended VPS Providers
- **Linode** - $24/month (4GB RAM)
- **DigitalOcean** - $24/month (4GB RAM)
- **Hetzner** - €8/month (4GB RAM) - Best value
- **Vultr** - $24/month (4GB RAM)
- **AWS EC2** - t3.medium (~$30/month)

---

## Docker Installation

### Step 1: Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Docker
```bash
# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add your user to docker group
sudo usermod -aG docker $USER

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### Step 3: Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### Step 4: Log out and back in
```bash
exit
# SSH back in for docker group to take effect
```

---

## Supabase Self-Hosting Setup

### Step 1: Clone Supabase Docker
```bash
cd ~
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### Step 2: Configure Environment Variables
```bash
# Copy example env file
cp .env.example .env

# Generate secure secrets
echo "Generating secure secrets..."

# Generate JWT Secret (32+ characters)
JWT_SECRET=$(openssl rand -base64 32)

# Generate Anon Key
ANON_KEY=$(docker run --rm supabase/gotrue:latest generate-jwt --secret "$JWT_SECRET" --role anon --exp 31536000)

# Generate Service Role Key
SERVICE_ROLE_KEY=$(docker run --rm supabase/gotrue:latest generate-jwt --secret "$JWT_SECRET" --role service_role --exp 31536000)

# Generate Dashboard Password
DASHBOARD_PASSWORD=$(openssl rand -base64 16)

# Generate Database Password
POSTGRES_PASSWORD=$(openssl rand -base64 24)

echo ""
echo "=== SAVE THESE CREDENTIALS SECURELY ==="
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "ANON_KEY=$ANON_KEY"
echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo "DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo ""
echo "========================================"
```

### Step 3: Edit Environment File
```bash
nano .env
```

Update these values in `.env`:

```env
############
# Secrets - CHANGE THESE!
############
POSTGRES_PASSWORD=YOUR_GENERATED_PASSWORD
JWT_SECRET=YOUR_GENERATED_JWT_SECRET
ANON_KEY=YOUR_GENERATED_ANON_KEY
SERVICE_ROLE_KEY=YOUR_GENERATED_SERVICE_ROLE_KEY
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=YOUR_GENERATED_DASHBOARD_PASSWORD

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API Proxy
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# API
############
PGRST_DB_SCHEMAS=public,storage,graphql_public

############
# Auth
############
SITE_URL=https://your-domain.com
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=https://your-domain.com

############
# Studio (Dashboard)
############
STUDIO_DEFAULT_ORGANIZATION=Your Business Name
STUDIO_DEFAULT_PROJECT=dotcom-buzi-pos
STUDIO_PORT=3000
SUPABASE_PUBLIC_URL=https://your-domain.com

############
# Storage
############
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800

############
# Edge Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Analytics (Optional - can disable)
############
LOGFLARE_LOGGER_BACKEND_API_KEY=your-logflare-key
LOGFLARE_API_KEY=your-logflare-key

############
# Email (SMTP)
############
SMTP_ADMIN_EMAIL=admin@your-domain.com
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_SENDER_NAME=Your Business Name
```

### Step 4: Configure Docker Compose
```bash
nano docker-compose.yml
```

Ensure these ports are exposed (modify if needed):
- `8000` - Kong API Gateway (main API endpoint)
- `3000` - Studio Dashboard
- `5432` - PostgreSQL (optional, for direct DB access)

### Step 5: Start Supabase
```bash
# Pull latest images
docker-compose pull

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 6: Verify Installation
```bash
# Check all containers are running
docker ps

# Test API endpoint
curl http://localhost:8000/rest/v1/

# Access Studio Dashboard
# Open browser: http://YOUR_SERVER_IP:3000
```

---

## Data Migration

### Step 1: Export Data from Lovable Cloud

First, export your existing data. Create this script locally:

```javascript
// export-data.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your current Lovable Cloud credentials
const SUPABASE_URL = 'https://ojofufyjehayzozefqca.supabase.co';
const SUPABASE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // Use service role key for full access

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = [
  'departments',
  'categories', 
  'suppliers',
  'customers',
  'customer_preferences',
  'products',
  'product_variants',
  'services',
  'sales',
  'sale_items',
  'expenses',
  'credits',
  'customer_credit_transactions',
  'reconciliations',
  'suspended_revenue',
  'internal_stock_usage',
  'perfume_scents',
  'perfume_pricing_config',
  'settings',
  'department_settings',
  'data_packages',
  'sensitive_service_registrations',
  'profiles',
  'user_roles',
  'inbox',
  'interdepartmental_inbox',
  'landing_page_content',
  'service_showcase'
];

async function exportData() {
  const exportDir = './data-export';
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir);
  }

  for (const table of tables) {
    console.log(`Exporting ${table}...`);
    
    const { data, error } = await supabase
      .from(table)
      .select('*');
    
    if (error) {
      console.error(`Error exporting ${table}:`, error.message);
      continue;
    }
    
    fs.writeFileSync(
      `${exportDir}/${table}.json`,
      JSON.stringify(data, null, 2)
    );
    
    console.log(`  ✓ Exported ${data?.length || 0} rows`);
  }
  
  console.log('\nExport complete! Files saved to ./data-export/');
}

exportData();
```

Run the export:
```bash
node export-data.js
```

### Step 2: Export Storage Files

```javascript
// export-storage.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ojofufyjehayzozefqca.supabase.co';
const SUPABASE_KEY = 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const buckets = ['department-logos'];

async function exportStorage() {
  for (const bucketName of buckets) {
    console.log(`\nExporting bucket: ${bucketName}`);
    
    const dir = `./storage-export/${bucketName}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list();
    
    if (error) {
      console.error(`Error listing ${bucketName}:`, error.message);
      continue;
    }
    
    for (const file of files || []) {
      if (file.name === '.emptyFolderPlaceholder') continue;
      
      console.log(`  Downloading ${file.name}...`);
      
      const { data, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(file.name);
      
      if (downloadError) {
        console.error(`  Error downloading ${file.name}:`, downloadError.message);
        continue;
      }
      
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(path.join(dir, file.name), buffer);
      console.log(`  ✓ Downloaded ${file.name}`);
    }
  }
  
  console.log('\nStorage export complete!');
}

exportStorage();
```

### Step 3: Import Schema to Self-Hosted Supabase

Connect to your self-hosted database:
```bash
# Access the postgres container
docker exec -it supabase-db psql -U postgres

# Or connect from outside
psql -h YOUR_SERVER_IP -p 5432 -U postgres -d postgres
```

Create required extensions and enums:
```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create custom types/enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier', 'staff');
CREATE TYPE public.credit_status AS ENUM ('pending', 'approved', 'partial', 'settled', 'rejected');
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.internal_usage_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'mobile_money', 'credit');
CREATE TYPE public.reconciliation_status AS ENUM ('pending', 'completed', 'discrepancy');
CREATE TYPE public.sale_status AS ENUM ('completed', 'voided', 'pending');
CREATE TYPE public.tracking_type AS ENUM ('quantity', 'ml');
```

Then import your schema. You can use the Supabase Studio (Dashboard) SQL Editor or run the migration files.

### Step 4: Import Data

Create an import script:
```javascript
// import-data.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your SELF-HOSTED Supabase credentials
const SUPABASE_URL = 'http://YOUR_SERVER_IP:8000';
const SUPABASE_KEY = 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Import order matters for foreign key relationships
const importOrder = [
  'departments',
  'categories',
  'suppliers', 
  'customers',
  'customer_preferences',
  'products',
  'product_variants',
  'services',
  'perfume_scents',
  'perfume_pricing_config',
  'settings',
  'department_settings',
  'data_packages',
  'profiles',
  'user_roles',
  'sales',
  'sale_items',
  'expenses',
  'credits',
  'customer_credit_transactions',
  'reconciliations',
  'suspended_revenue',
  'internal_stock_usage',
  'sensitive_service_registrations',
  'inbox',
  'interdepartmental_inbox',
  'landing_page_content',
  'service_showcase'
];

async function importData() {
  for (const table of importOrder) {
    const filePath = `./data-export/${table}.json`;
    
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${table} - no export file`);
      continue;
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!data || data.length === 0) {
      console.log(`Skipping ${table} - no data`);
      continue;
    }
    
    console.log(`Importing ${table} (${data.length} rows)...`);
    
    // Import in batches of 100
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: 'id' });
      
      if (error) {
        console.error(`  Error importing ${table}:`, error.message);
      }
    }
    
    console.log(`  ✓ Imported ${table}`);
  }
  
  console.log('\nData import complete!');
}

importData();
```

### Step 5: Import Storage Files

```javascript
// import-storage.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'http://YOUR_SERVER_IP:8000';
const SUPABASE_KEY = 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const buckets = ['department-logos'];

async function importStorage() {
  for (const bucketName of buckets) {
    console.log(`\nImporting bucket: ${bucketName}`);
    
    // Create bucket if not exists
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    
    if (createError && !createError.message.includes('already exists')) {
      console.error(`Error creating bucket:`, createError.message);
    }
    
    const dir = `./storage-export/${bucketName}`;
    if (!fs.existsSync(dir)) {
      console.log(`  No files to import for ${bucketName}`);
      continue;
    }
    
    const files = fs.readdirSync(dir);
    
    for (const fileName of files) {
      console.log(`  Uploading ${fileName}...`);
      
      const filePath = path.join(dir, fileName);
      const fileBuffer = fs.readFileSync(filePath);
      
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, fileBuffer, {
          upsert: true
        });
      
      if (error) {
        console.error(`  Error uploading ${fileName}:`, error.message);
      } else {
        console.log(`  ✓ Uploaded ${fileName}`);
      }
    }
  }
  
  console.log('\nStorage import complete!');
}

importStorage();
```

### Step 6: Migrate Users (Auth)

Users need special handling. Create users in your self-hosted auth:

```javascript
// migrate-users.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://YOUR_SERVER_IP:8000';
const SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Your existing users (get from profiles table export)
const users = [
  { email: 'admin@yourbusiness.com', password: 'tempPassword123!', role: 'admin' },
  { email: 'cashier@yourbusiness.com', password: 'tempPassword123!', role: 'cashier' },
  // Add more users...
];

async function migrateUsers() {
  for (const user of users) {
    console.log(`Creating user: ${user.email}`);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        role: user.role
      }
    });
    
    if (error) {
      console.error(`  Error creating ${user.email}:`, error.message);
    } else {
      console.log(`  ✓ Created user with ID: ${data.user?.id}`);
    }
  }
  
  console.log('\nUser migration complete!');
  console.log('IMPORTANT: Users should reset their passwords after migration!');
}

migrateUsers();
```

---

## Frontend Configuration

### Step 1: Update Environment Variables

Update your `.env` file (or create `.env.production`):

```env
# Self-Hosted Supabase Configuration
VITE_SUPABASE_URL=https://your-domain.com
VITE_SUPABASE_ANON_KEY=your-generated-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-name
```

### Step 2: Update Supabase Client (if needed)

Your existing client at `src/integrations/supabase/client.ts` should work with just the environment variable changes. But if you need to modify:

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
```

### Step 3: Build for Production

```bash
npm run build
```

---

## Edge Functions Deployment

### Step 1: Copy Edge Functions

Your edge functions are in `supabase/functions/`. Copy them to your server:

```bash
# On your local machine
scp -r supabase/functions/* user@your-server:~/supabase/docker/volumes/functions/
```

### Step 2: Configure Edge Functions

On your server:
```bash
cd ~/supabase/docker

# Create functions volume if not exists
mkdir -p volumes/functions

# Copy your functions here
# Each function should be in its own directory with index.ts
```

### Step 3: Add Function Secrets

Add secrets to the edge functions environment:

```bash
# Edit docker-compose.yml or .env to add:
RESEND_API_KEY=your-resend-api-key
OPENAI_API_KEY=your-openai-key-if-needed
```

### Step 4: Restart Functions Container

```bash
docker-compose restart functions
```

---

## SSL/HTTPS Setup

### Option 1: Using Caddy (Recommended - Auto SSL)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create Caddyfile:
```bash
sudo nano /etc/caddy/Caddyfile
```

```caddyfile
your-domain.com {
    # API and Auth
    reverse_proxy /rest/* localhost:8000
    reverse_proxy /auth/* localhost:8000
    reverse_proxy /storage/* localhost:8000
    reverse_proxy /realtime/* localhost:8000
    reverse_proxy /functions/* localhost:8000
    
    # Studio Dashboard (optional - can restrict access)
    reverse_proxy /project/* localhost:3000
    reverse_proxy localhost:3000
}

# Optional: Separate subdomain for API
api.your-domain.com {
    reverse_proxy localhost:8000
}
```

Start Caddy:
```bash
sudo systemctl start caddy
sudo systemctl enable caddy
```

### Option 2: Using Nginx + Let's Encrypt

```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Configure Nginx
sudo nano /etc/nginx/sites-available/supabase
```

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # API
    location /rest/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /storage/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }

    location /realtime/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /functions/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Studio Dashboard
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Maintenance & Backups

### Automated Database Backups

Create backup script:
```bash
sudo nano /opt/supabase-backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/opt/supabase-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/supabase_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec supabase-db pg_dump -U postgres postgres > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Make executable and schedule:
```bash
sudo chmod +x /opt/supabase-backup.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
```

Add line:
```
0 2 * * * /opt/supabase-backup.sh >> /var/log/supabase-backup.log 2>&1
```

### Monitoring

Check container health:
```bash
# View all container status
docker-compose ps

# View resource usage
docker stats

# View logs
docker-compose logs -f --tail=100
```

### Updates

To update Supabase:
```bash
cd ~/supabase/docker

# Pull latest
git pull origin master

# Pull new images
docker-compose pull

# Restart with new images
docker-compose down
docker-compose up -d
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused
```bash
# Check if containers are running
docker-compose ps

# Check logs
docker-compose logs kong
docker-compose logs rest
```

#### 2. Authentication Errors
```bash
# Verify JWT secret matches in .env and client
# Check auth container logs
docker-compose logs auth
```

#### 3. Database Connection Issues
```bash
# Test database connection
docker exec -it supabase-db psql -U postgres -c "SELECT 1"

# Check database logs
docker-compose logs db
```

#### 4. Storage Upload Fails
```bash
# Check storage container
docker-compose logs storage

# Check disk space
df -h

# Check permissions
ls -la ~/supabase/docker/volumes/storage
```

#### 5. Edge Functions Not Working
```bash
# Check functions container
docker-compose logs functions

# Verify function files exist
ls ~/supabase/docker/volumes/functions/
```

### Reset Everything
If you need to start fresh:
```bash
cd ~/supabase/docker

# Stop and remove all containers and volumes
docker-compose down -v

# Remove all data
rm -rf volumes/

# Start fresh
docker-compose up -d
```

---

## Quick Reference

### Important URLs (after setup)
| Service | URL |
|---------|-----|
| API | https://your-domain.com/rest/v1/ |
| Auth | https://your-domain.com/auth/v1/ |
| Storage | https://your-domain.com/storage/v1/ |
| Realtime | wss://your-domain.com/realtime/v1/ |
| Functions | https://your-domain.com/functions/v1/ |
| Studio | https://your-domain.com/ |

### Docker Commands
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart auth

# Access database
docker exec -it supabase-db psql -U postgres
```

### Useful Endpoints
```bash
# Health check
curl https://your-domain.com/rest/v1/

# Auth status
curl https://your-domain.com/auth/v1/health
```

---

## Support & Resources

- [Supabase Self-Hosting Docs](https://supabase.com/docs/guides/self-hosting)
- [Supabase GitHub](https://github.com/supabase/supabase)
- [Docker Compose Reference](https://github.com/supabase/supabase/tree/master/docker)

---

## Checklist

### Pre-Migration
- [ ] Server provisioned and accessible
- [ ] Docker & Docker Compose installed
- [ ] Domain configured with DNS

### Supabase Setup
- [ ] Supabase cloned and configured
- [ ] Environment variables set
- [ ] All containers running

### Data Migration
- [ ] Data exported from Lovable Cloud
- [ ] Schema created on self-hosted
- [ ] Data imported successfully
- [ ] Storage files imported
- [ ] Users migrated

### Frontend
- [ ] Environment variables updated
- [ ] App tested against self-hosted backend
- [ ] Production build created

### Security
- [ ] SSL/HTTPS configured
- [ ] Strong passwords set
- [ ] Firewall configured
- [ ] Backups scheduled

### Go Live
- [ ] Final testing complete
- [ ] DNS updated (if changing domains)
- [ ] Old cloud disabled (optional)

---

**Congratulations!** 🎉 Your self-hosted Supabase is ready!
