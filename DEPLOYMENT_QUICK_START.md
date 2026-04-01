# 🚀 Quick Deployment Guide

## 1️⃣ Remote Server Setup

### Step 1: Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose git curl wget
sudo usermod -aG docker ubuntu  # Add user to docker group
sudo systemctl enable docker
sudo systemctl start docker
```

### Step 2: Clone Repository
```bash
cd /home/ubuntu
git clone <your-repo-url> LMS_Cloude
cd LMS_Cloude
```

### Step 3: Create Environment File
```bash
cp .env.example .env
nano .env
```

Edit `.env` with these critical values:
```env
# Database
POSTGRES_USER=lms_user
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
POSTGRES_DB=lms_robotic

# Redis
REDIS_PASSWORD=YOUR_SECURE_REDIS_PASSWORD_HERE

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_SECURE_JWT_SECRET_HERE
JWT_REFRESH_SECRET=YOUR_SECURE_REFRESH_SECRET_HERE

# Telegram Bot
TELEGRAM_BOT_TOKEN=8513268264:AAETiGq1Z2Zd6tXmgo7P0n5lR3GQIq3fl98
TELEGRAM_ADMIN_ID=7537442767

# Frontend
FRONTEND_URL=https://yourdomain.com  # or http://your-ip if no domain

# Backend
NODE_ENV=production
VITE_API_BASE_URL=/api/v1
```

> **⚠️ IMPORTANT:** Change all passwords and secrets!

---

## 2️⃣ Deploy Services

### Step 1: Start Docker Containers
```bash
docker-compose up -d
```

### Step 2: Wait for Services to Be Healthy
```bash
docker-compose ps
# Wait until all services show "healthy" status
```

Monitor logs:
```bash
docker-compose logs -f
```

### Step 3: Run Database Migrations
```bash
docker-compose exec backend npx prisma migrate deploy
```

### Step 4: Seed Initial Data
```bash
docker-compose exec backend npm run db:seed
```

---

## 3️⃣ Verify Deployment

### Check Backend Health
```bash
curl http://localhost:5000/health
# Expected: {"status":"ok",...}
```

### Check Frontend
```bash
curl http://localhost/
# Should return HTML
```

### Check Telegram Bot Status
```bash
docker-compose logs backend | grep "Telegram Bot"
# Should show: "🤖 Telegram Bot ishga tushdi!"
```

---

## 4️⃣ Test Login

### Using Frontend (Recommended)
1. Open browser: `http://your-server-ip` or `https://yourdomain.com`
2. Admin login:
   - **Phone:** +998935422930
   - **Password:** admin123

### Test Other Accounts
```
👨‍🏫 Teacher:
   Phone: +998901234568
   Password: teacher123

🎓 Student:
   Phone: +998901234570
   Password: student123

👨‍👩‍👧 Parent:
   Phone: +998901234569
   Password: parent123
```

---

## 5️⃣ Configure Domain (Optional)

If you have a domain, update the reverse proxy:

### Edit Nginx Config
```bash
sudo nano /etc/nginx/sites-available/lms
```

Add:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Enable SSL (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 6️⃣ Regular Maintenance

### Backup Database
```bash
docker-compose exec postgres pg_dump -U lms_user lms_robotic > backup_$(date +%Y%m%d_%H%M%S).sql
```

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Restart Services
```bash
docker-compose restart backend  # Restart backend only
docker-compose restart          # Restart all
```

### Stop Services
```bash
docker-compose down  # Keep data
docker-compose down -v  # Remove volumes (data loss!)
```

---

## 7️⃣ Troubleshooting

### Container Won't Start
```bash
docker-compose logs <service-name>
# Check error messages
```

### Database Connection Error
```bash
docker-compose exec postgres psql -U lms_user -d lms_robotic
# Test database connection
```

### Port Already in Use
```bash
# Kill process on port 5000
sudo lsof -ti:5000 | xargs kill -9

# Kill process on port 80
sudo lsof -ti:80 | xargs kill -9

# Then restart
docker-compose up -d
```

### Telegram Bot Not Working
1. Verify token in `.env`
2. Check logs: `docker-compose logs backend | grep -i telegram`
3. Ensure `TELEGRAM_BOT_TOKEN` is correct

---

## 📊 System Information

### Service Ports
- **Frontend:** 80, 443 (Nginx)
- **Backend:** 5000
- **PostgreSQL:** 5432
- **Redis:** 6379

### Volume Locations
- **Database:** `lms_postgres_data`
- **Cache:** `lms_redis_data`
- **Uploads:** `lms_uploads_data`

### Docker Network
- **Network Name:** `lms_network`
- **Internal DNS:** Services can reach each other by container name

---

## ✅ Deployment Checklist

- [ ] Installed Docker & Docker Compose
- [ ] Cloned repository
- [ ] Created and configured `.env`
- [ ] Started services with `docker-compose up -d`
- [ ] All services showing "healthy" status
- [ ] Ran migrations: `npx prisma migrate deploy`
- [ ] Ran seed: `npm run db:seed`
- [ ] Verified backend health: `/health` endpoint
- [ ] Tested admin login
- [ ] Tested dark mode toggle
- [ ] Tested Telegram bot `/start` command
- [ ] Configured domain and SSL (if applicable)
- [ ] Created database backup

---

## 🎉 You're Ready!

The Robotic Edu LMS is now live on your server.

**Next Steps:**
1. Create teacher accounts
2. Add courses and groups
3. Enroll students
4. Monitor system via logs
5. Set up regular backups

---

## 📞 Need Help?

Check the main `SYSTEM_STATUS.md` file for detailed architecture and feature information.

**Happy Teaching! 🎓**
