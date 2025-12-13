# Step 2: Linode Server Setup - Detailed Guide

## 2.1 Create Your Linode Account & Server

### A. Sign Up for Linode
1. Go to https://www.linode.com
2. Click "Sign Up" or "Get Started"
3. Create account with email and password
4. Add payment method (credit card)

### B. Create Your First Linode (Server)
1. After logging in, click **"Create Linode"** (blue button)
2. Choose these settings:

| Setting | What to Select |
|---------|----------------|
| **Images** | Ubuntu 22.04 LTS |
| **Region** | Choose closest to your users (e.g., London, Frankfurt, Singapore) |
| **Linode Plan** | Shared CPU → **Nanode 1GB** ($5/month) - good for starting |
| **Linode Label** | `dotcom-pos-server` |
| **Root Password** | Create a STRONG password (save it!) |
| **SSH Keys** | Skip for now (optional) |

3. Click **"Create Linode"**
4. Wait 1-2 minutes for server to boot
5. **SAVE THESE DETAILS:**
   - IP Address (shown on dashboard, e.g., `172.105.xxx.xxx`)
   - Root Password (the one you created)

---

## 2.2 Connect to Your Server

### On Windows:
1. Download **PuTTY** from https://www.putty.org
2. Open PuTTY
3. In "Host Name" field, enter your Linode IP address
4. Port: `22`
5. Click "Open"
6. When prompted:
   - Login as: `root`
   - Password: (your root password - it won't show as you type)

### On Mac/Linux:
1. Open Terminal
2. Type:
```bash
ssh root@YOUR_LINODE_IP
```
3. Type `yes` when asked about fingerprint
4. Enter your root password

---

## 2.3 Update Your Server

Once connected, run these commands one by one:

```bash
# Update package list
apt update

# Upgrade all packages (press Y when asked)
apt upgrade -y
```

Wait 1-2 minutes for this to complete.

---

## 2.4 Install Required Software

### A. Install Node.js (for running your app)
```bash
# Install Node.js repository
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node --version
# Should show: v20.x.x

npm --version
# Should show: 10.x.x
```

### B. Install PostgreSQL (your database)
```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql

# Verify it's running
systemctl status postgresql
# Should show "active (running)"
```

### C. Install Nginx (web server)
```bash
# Install Nginx
apt install -y nginx

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Verify it's running
systemctl status nginx
```

### D. Install PM2 (keeps your app running)
```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### E. Install Git (to download your code)
```bash
# Install Git
apt install -y git

# Verify installation
git --version
```

### F. Install Certbot (for SSL/HTTPS)
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx
```

---

## 2.5 Configure Firewall

```bash
# Allow SSH (so you don't lock yourself out!)
ufw allow ssh

# Allow HTTP
ufw allow 80

# Allow HTTPS
ufw allow 443

# Enable firewall
ufw enable
# Type 'y' when asked

# Check status
ufw status
```

---

## 2.6 Create App Directory

```bash
# Create directory for your app
mkdir -p /var/www/dotcombizposuga

# Create directory for uploads
mkdir -p /var/www/uploads

# Set permissions
chown -R www-data:www-data /var/www/uploads
chmod 755 /var/www/uploads
```

---

## 2.7 Verify Everything is Installed

Run this command to check all installations:

```bash
echo "=== Checking Installations ===" && \
echo "Node.js: $(node --version)" && \
echo "NPM: $(npm --version)" && \
echo "PostgreSQL: $(psql --version)" && \
echo "Nginx: $(nginx -v 2>&1)" && \
echo "PM2: $(pm2 --version)" && \
echo "Git: $(git --version)" && \
echo "Certbot: $(certbot --version 2>&1 | head -1)" && \
echo "=== All Done! ==="
```

You should see version numbers for all items.

---

## 2.8 Quick Test - Is Nginx Working?

1. Open your web browser
2. Go to: `http://YOUR_LINODE_IP`
3. You should see "Welcome to nginx!" page

If you see this, your server is ready!

---

## ✅ Step 2 Complete Checklist

Before moving to Step 3, confirm:

- [ ] Linode server created and running
- [ ] Successfully connected via SSH
- [ ] Server updated (`apt update && apt upgrade`)
- [ ] Node.js installed (v20.x.x)
- [ ] PostgreSQL installed and running
- [ ] Nginx installed and running
- [ ] PM2 installed
- [ ] Git installed
- [ ] Certbot installed
- [ ] Firewall configured (SSH, HTTP, HTTPS allowed)
- [ ] App directories created
- [ ] Nginx welcome page visible in browser

---

## 🆘 Troubleshooting

### "Connection refused" when using SSH
- Wait 2-3 minutes after creating Linode
- Make sure you're using the correct IP address
- Check if Linode is running in dashboard

### "Permission denied" password error
- Make sure Caps Lock is off
- Root password is case-sensitive
- Try resetting password in Linode dashboard

### Nginx not showing in browser
- Check firewall: `ufw status`
- Check Nginx: `systemctl status nginx`
- Restart Nginx: `systemctl restart nginx`

### PostgreSQL won't start
```bash
# Check the error
journalctl -u postgresql

# Try restart
systemctl restart postgresql
```

---

## 📝 Save These Details

Create a text file on your computer and save:

```
LINODE SERVER DETAILS
=====================
IP Address: _______________
Root Password: _______________
Region: _______________

Created on: _______________
```

---

## Next Step

Once all items are checked, proceed to **Step 3: PostgreSQL Database Setup**
