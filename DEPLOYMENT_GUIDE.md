# Robotic Edu LMS — Production Deployment Yo'riqnomasi

> **Loyiha:** Robotic Edu LMS (Express.js + React + PostgreSQL + Telegram Bot)
> **Versiya:** 1.0.0 | **Sana:** 2026-03-08

---

## Mundarija

1. [Server talablari](#1-server-talablari)
2. [Server tayyorlash](#2-server-tayyorlash)
3. [Loyihani serverga ko'chirish](#3-loyihani-serverga-ko'chirish)
4. [Environment sozlash](#4-environment-sozlash)
5. [Database migration strategiyasi](#5-database-migration-strategiyasi)
6. [Docker bilan deploy](#6-docker-bilan-deploy)
7. [SSL sertifikat o'rnatish](#7-ssl-sertifikat-o'rnatish)
8. [Domain va DNS sozlash](#8-domain-va-dns-sozlash)
9. [Telegram Bot sozlash](#9-telegram-bot-sozlash)
10. [Monitoring va loglar](#10-monitoring-va-loglar)
11. [Backup strategiyasi](#11-backup-strategiyasi)
12. [Yangilash (Update) tartibi](#12-yangilash-update-tartibi)
13. [Xatoliklarni bartaraf etish](#13-xatoliklarni-bartaraf-etish)

---

## 1. Server talablari

### Minimal tizim talablari

| Resurs | Minimal | Tavsiya etilgan |
|--------|---------|-----------------|
| CPU | 1 core | 2+ core |
| RAM | 2 GB | 4+ GB |
| Disk | 20 GB SSD | 40+ GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04/24.04 LTS |
| Tarmoq | Statik IP | Statik IP + domain |

### Kerakli portlar

| Port | Xizmat | Izoh |
|------|--------|------|
| 22 | SSH | Server boshqaruvi |
| 80 | HTTP | Web (Nginx) |
| 443 | HTTPS | SSL (Nginx) |
| 5432 | PostgreSQL | Faqat ichki tarmoq (tashqaridan yopiq!) |
| 6379 | Redis | Faqat ichki tarmoq (tashqaridan yopiq!) |

> **MUHIM:** 5432 va 6379 portlarni tashqi dunyodan yoping! Faqat Docker ichki tarmog'ida ochiq bo'lishi kerak.

---

## 2. Server tayyorlash

### 2.1. Serverga kirish

```bash
ssh root@YOUR_SERVER_IP
```

### 2.2. Tizimni yangilash

```bash
apt update && apt upgrade -y
```

### 2.3. Docker o'rnatish

```bash
# Docker rasmiy o'rnatish
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose o'rnatish (V2)
apt install docker-compose-plugin -y

# Tekshirish
docker --version
docker compose version
```

### 2.4. Xavfsizlik: Firewall sozlash

```bash
# UFW firewall o'rnatish
apt install ufw -y

# Asosiy qoidalar
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# MUHIM: DB portlarni OCHMANG!
# ufw allow 5432 — BU XATO BO'LADI!

# Yoqish
ufw enable
ufw status
```

### 2.5. Deploy foydalanuvchi yaratish (ixtiyoriy, tavsiya etiladi)

```bash
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy
su - deploy
```

---

## 3. Loyihani serverga ko'chirish

### 3.1. Git orqali (tavsiya etilgan)

```bash
# Serverda
cd /opt
git clone https://YOUR_REPO_URL/LMS_Cloude.git robotic-edu
cd robotic-edu
```

### 3.2. SCP orqali (Git bo'lmasa)

```bash
# Lokal kompyuterda
scp -r ./LMS_Cloude root@YOUR_SERVER_IP:/opt/robotic-edu
```

### 3.3. Fayl huquqlarini sozlash

```bash
cd /opt/robotic-edu
chmod +x deploy.sh
mkdir -p nginx/ssl
```

---

## 4. Environment sozlash

### 4.1. .env faylini yaratish

```bash
cp .env.example .env
nano .env
```

### 4.2. .env faylini to'ldirish

```env
# ─── DATABASE ────────────────────────────────────────
POSTGRES_DB=lms_robotic
POSTGRES_USER=lms_user
POSTGRES_PASSWORD=KUCHLI_PAROL_KIRITING_123!@#

# ─── REDIS ───────────────────────────────────────────
REDIS_PASSWORD=REDIS_KUCHLI_PAROL_456!@#

# ─── JWT (32+ belgi, tasodifiy!) ─────────────────────
JWT_SECRET=jUd4_kUcHl1_32_bElG1d4n_oRt1q_s1r_kAlIt
JWT_REFRESH_SECRET=b0shQ4_kUcHl1_r3fr3sH_s3cr3t_k4l1t
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ─── APP ─────────────────────────────────────────────
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.uz

# ─── FRONTEND ────────────────────────────────────────
VITE_API_BASE_URL=/api/v1
```

### 4.3. Xavfsiz parol generatsiya qilish

```bash
# JWT secret generatsiya
openssl rand -base64 48

# PostgreSQL parol generatsiya
openssl rand -base64 32

# Redis parol generatsiya
openssl rand -base64 24
```

> **MUHIM:** Hech qachon default parollarni production'da ishlatmang!

---

## 5. Database migration strategiyasi

> **BU BO'LIM ENG MUHIMI!** Database o'tkazish muammolari eng ko'p uchraydigan deploy xatoligidir.

### 5.1. Migration qanday ishlaydi

Loyihada Prisma ORM ishlatiladi. Migrationlar `backend/prisma/migrations/` papkasida saqlanadi:

```
migrations/
├── 20260227174118_init
├── 20260228075355_student_status_materials_expense_category
├── 20260228_add_chat_messagetype
├── 20260302000000_add_payme_transactions
├── 20260302132327_add_payme_transactions
├── 20260303161158_remove_chat_module
├── 20260305095525_reset
├── 20260307000000_payment_soft_delete
├── 20260307100000_holidays_and_forced_lesson
├── 20260307200000_telegram_bot
└── migration_lock.toml
```

### 5.2. Birinchi marta deploy (yangi server)

Yangi serverda database bo'sh bo'ladi. Docker avtomatik migration ishga tushiradi:

```bash
# Backend Dockerfile'da:
# CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
#
# Bu barcha migrationlarni ketma-ket ishga tushiradi
```

**Tekshirish:**

```bash
# Backend container logini ko'ring
docker compose logs backend | grep -i "migration"
```

### 5.3. Mavjud serverda yangilash (eng muhim!)

Agar serverda allaqachon database bor va yangi migration qo'shilgan bo'lsa:

#### A. Xavfsiz migration tartibi

```bash
# 1-QADAM: Avval backup oling!
docker compose exec postgres pg_dump -U lms_user lms_robotic > backup_$(date +%Y%m%d_%H%M%S).sql
echo "✅ Backup tayyor"

# 2-QADAM: Migration holatini tekshiring
docker compose exec backend npx prisma migrate status
# Bu qaysi migrationlar bajarilgan/bajarilmaganini ko'rsatadi

# 3-QADAM: Migration'ni dry-run qiling (faqat SQL ko'rish)
docker compose exec backend npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
# Bu hech narsa o'zgartirmaydi, faqat SQL chiqaradi

# 4-QADAM: Agar hammasi to'g'ri — deploy
docker compose exec backend npx prisma migrate deploy
echo "✅ Migration muvaffaqiyatli"
```

#### B. Migration muammolarini oldini olish

**Muammo 1: "Migration already applied" xatosi**

```bash
# Sabab: migration fayli o'zgargan
# Yechim: HECH QACHON eski migration fayllarni o'zgartirmang!
# Yangi migration yarating:
npx prisma migrate dev --name fix_description
```

**Muammo 2: "Database schema drift" xatosi**

```bash
# Sabab: database qo'lda o'zgartirilgan
# Yechim:
docker compose exec backend npx prisma migrate resolve --applied "migration_nomi"
```

**Muammo 3: "Shadow database" xatosi**

```bash
# Production'da shadow database kerak emas
# prisma migrate deploy ishlatiladi (dev emas!)
# deploy = faqat pending migrationlarni ishga tushiradi
```

### 5.4. Migration golden rules

1. **HECH QACHON** `prisma migrate dev` ni production serverda ishlatmang — faqat `prisma migrate deploy`
2. **HECH QACHON** eski migration fayllarni o'zgartirmang
3. **HAR DOIM** migration'dan oldin backup oling
4. **HAR DOIM** migration statusni tekshiring (`prisma migrate status`)
5. **Yangi migration** faqat development'da yarating, keyin git orqali serverga o'tkazing
6. **Destructive migration** (ustun o'chirish, jadval o'chirish) uchun alohida migration yarating va avval ma'lumotlarni saqlang

### 5.5. Rollback strategiyasi

Prisma'da avtomatik rollback yo'q. Qo'lda tiklash:

```bash
# 1. Backup'dan tiklash (eng xavfsiz)
docker compose exec -T postgres psql -U lms_user lms_robotic < backup_YYYYMMDD.sql

# 2. _prisma_migrations jadvalidan oxirgi migration'ni o'chirish
docker compose exec postgres psql -U lms_user lms_robotic -c \
  "DELETE FROM _prisma_migrations WHERE migration_name = '20260307200000_telegram_bot';"

# 3. Qo'lda SQL bilan orqaga qaytarish
docker compose exec postgres psql -U lms_user lms_robotic -c \
  "ALTER TABLE \"User\" DROP COLUMN IF EXISTS \"telegramChatId\";"
```

---

## 6. Docker bilan deploy

### 6.1. Avtomatik deploy (deploy.sh)

```bash
cd /opt/robotic-edu
chmod +x deploy.sh
./deploy.sh
```

### 6.2. Qo'lda deploy (qadam-baqadam)

```bash
cd /opt/robotic-edu

# 1. Eski containerlarni to'xtatish
docker compose down --remove-orphans

# 2. Yangi imagelar build qilish
docker compose build --no-cache

# 3. Database va Redis ishga tushirish
docker compose up -d postgres redis

# 4. Database tayyor bo'lishini kutish (15-20 sekund)
echo "⏳ Database kutilmoqda..."
sleep 15

# 5. Database sog'lomligini tekshirish
docker compose exec postgres pg_isready -U lms_user -d lms_robotic
# Javob: "accepting connections" bo'lishi kerak

# 6. Backend ishga tushirish (migration avtomatik)
docker compose up -d backend

# 7. Migration logini tekshirish
sleep 10
docker compose logs backend | tail -20

# 8. Backend health check
curl -s http://localhost:5000/health
# Javob: {"status":"ok"} bo'lishi kerak

# 9. Frontend ishga tushirish
docker compose up -d frontend

# 10. Barcha containerlarni tekshirish
docker compose ps
```

### 6.3. Deploy natijasini tekshirish

```bash
# Barcha containerlar "Up (healthy)" bo'lishi kerak:
docker compose ps

# Kutilayotgan natija:
# lms_postgres   Up (healthy)
# lms_redis      Up (healthy)
# lms_backend    Up (healthy)
# lms_frontend   Up
```

### 6.4. Port xavfsizligi (MUHIM!)

`docker-compose.yml` da postgres va redis portlari expose qilingan. Production'da ularni yoping:

```yaml
# docker-compose.yml da quyidagi qatorlarni O'CHIRING yoki kommentga oling:
# postgres:
#   ports:
#     - "5432:5432"   # ← BU QATORNI O'CHIRING

# redis:
#   ports:
#     - "6379:6379"   # ← BU QATORNI O'CHIRING
```

Docker ichki tarmog'ida ular baribir ishlaydi, lekin tashqi dunyodan kirish yo'q bo'ladi.

---

## 7. SSL sertifikat o'rnatish

### 7.1. Let's Encrypt bilan bepul SSL

```bash
# Certbot o'rnatish
apt install certbot -y

# Frontend containerni to'xtatish (80-port kerak)
docker compose stop frontend

# Sertifikat olish
certbot certonly --standalone -d yourdomain.uz -d www.yourdomain.uz

# Sertifikatlarni nusxalash
cp /etc/letsencrypt/live/yourdomain.uz/fullchain.pem /opt/robotic-edu/nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.uz/privkey.pem /opt/robotic-edu/nginx/ssl/
```

### 7.2. Nginx SSL konfiguratsiyasi

`nginx/nginx.conf` da SSL bo'limini yoqing:

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.uz www.yourdomain.uz;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.uz www.yourdomain.uz;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... qolgan location bloklar (api, socket.io, uploads, static)
}
```

### 7.3. SSL avtomatik yangilash (cron)

```bash
# Crontab'ga qo'shish
crontab -e

# Har oyda 1-sanada SSL yangilash:
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.uz/fullchain.pem /opt/robotic-edu/nginx/ssl/ && cp /etc/letsencrypt/live/yourdomain.uz/privkey.pem /opt/robotic-edu/nginx/ssl/ && cd /opt/robotic-edu && docker compose restart frontend
```

---

## 8. Domain va DNS sozlash

### 8.1. DNS A-record

| Tur | Nom | Qiymat | TTL |
|-----|-----|--------|-----|
| A | @ | YOUR_SERVER_IP | 300 |
| A | www | YOUR_SERVER_IP | 300 |

### 8.2. .env yangilash

```env
FRONTEND_URL=https://yourdomain.uz
```

### 8.3. Nginx server_name yangilash

```nginx
server_name yourdomain.uz www.yourdomain.uz;
```

### 8.4. O'zgarishlarni qo'llash

```bash
cd /opt/robotic-edu
docker compose up -d --build backend  # FRONTEND_URL o'zgargani uchun
docker compose restart frontend       # Nginx konfig o'zgargani uchun
```

---

## 9. Telegram Bot sozlash

### 9.1. Bot Token

Bot tokeni backend kodida hardcode qilingan:
```
8513268264:AAETiGq1Z2Zd6tXmgo7P0n5lR3GQIq3fl98
```

> **TAVSIYA:** Tokenni `.env` ga ko'chirib, `process.env.TELEGRAM_BOT_TOKEN` orqali o'qing.

### 9.2. Bot ishlashini tekshirish

```bash
# Backend loglarida Telegram bot xabarlarini ko'ring
docker compose logs backend | grep -i "telegram\|bot\|grammy"
```

### 9.3. Bot long-polling rejimida

Bot webhook emas, long-polling rejimida ishlaydi, shuning uchun:
- Webhook URL sozlash shart emas
- Bot serverda internet bo'lishi kerak (outbound HTTPS)
- Firewall'da outbound trafik ochiq bo'lishi kerak (default ochiq)

---

## 10. Monitoring va loglar

### 10.1. Container loglarini ko'rish

```bash
# Barcha loglar
docker compose logs -f

# Faqat backend
docker compose logs -f backend

# Faqat xatoliklar
docker compose logs backend 2>&1 | grep -i "error\|fail\|crash"

# Oxirgi 100 qator
docker compose logs --tail=100 backend
```

### 10.2. Container holati

```bash
# Hozirgi holat
docker compose ps

# Resurs sarfi (CPU, RAM)
docker stats --no-stream
```

### 10.3. Database monitoring

```bash
# Faol connectionlar
docker compose exec postgres psql -U lms_user lms_robotic -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Database hajmi
docker compose exec postgres psql -U lms_user lms_robotic -c \
  "SELECT pg_size_pretty(pg_database_size('lms_robotic'));"
```

### 10.4. Health check endpoint

```bash
# Backend health
curl -s http://localhost:5000/health

# Tashqaridan (domain bilan)
curl -s https://yourdomain.uz/api/health
```

---

## 11. Backup strategiyasi

### 11.1. Database backup (kundalik)

```bash
# Qo'lda backup
docker compose exec postgres pg_dump -U lms_user lms_robotic | gzip > /opt/backups/db_$(date +%Y%m%d).sql.gz
```

### 11.2. Avtomatik backup script

`/opt/robotic-edu/backup.sh` fayl yarating:

```bash
#!/bin/bash
# ══════════════════════════════════════════
# Robotic Edu LMS — Avtomatik Backup
# ══════════════════════════════════════════

BACKUP_DIR="/opt/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
echo "📦 Database backup..."
docker compose -f /opt/robotic-edu/docker-compose.yml exec -T postgres \
  pg_dump -U lms_user lms_robotic | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Uploads backup
echo "📁 Uploads backup..."
docker cp lms_backend:/app/uploads - | gzip > $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz

# Eski backuplarni o'chirish
echo "🗑️  Eski backuplar tozalanmoqda..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup tayyor: $BACKUP_DIR"
ls -lh $BACKUP_DIR/db_$TIMESTAMP.sql.gz
ls -lh $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz
```

```bash
chmod +x /opt/robotic-edu/backup.sh
```

### 11.3. Crontab bilan kundalik backup

```bash
crontab -e

# Har kuni soat 2:00 da backup
0 2 * * * /opt/robotic-edu/backup.sh >> /var/log/lms_backup.log 2>&1
```

### 11.4. Backup'dan tiklash

```bash
# Database tiklash
gunzip < /opt/backups/db_20260308.sql.gz | docker compose exec -T postgres psql -U lms_user lms_robotic

# Uploads tiklash
gunzip < /opt/backups/uploads_20260308.tar.gz | docker cp - lms_backend:/app/
```

---

## 12. Yangilash (Update) tartibi

### 12.1. Xavfsiz yangilash qadamlari

```bash
cd /opt/robotic-edu

# 1. BACKUP (har doim birinchi!)
./backup.sh

# 2. Yangi kodni olish
git pull origin main

# 3. Migration holatini tekshirish
docker compose exec backend npx prisma migrate status

# 4. Agar yangi migration bor — avval faqat migration
docker compose exec backend npx prisma migrate deploy

# 5. Backend qayta build va ishga tushirish
docker compose up -d --build backend

# 6. Backend sog'lomligini tekshirish
sleep 10
curl -s http://localhost:5000/health

# 7. Frontend qayta build (agar o'zgargan bo'lsa)
docker compose up -d --build frontend

# 8. Yakuniy tekshirish
docker compose ps
```

### 12.2. Zero-downtime deploy (ilg'or)

```bash
# 1. Yangi imageni build qilish (hozirgi ishlayotganiga ta'sir yo'q)
docker compose build backend

# 2. Migration (tez, lekin backend to'xtashi mumkin)
docker compose exec backend npx prisma migrate deploy

# 3. Backend qayta ishga tushirish (5-10 sekund downtime)
docker compose up -d --no-deps backend

# Frontend statik fayl — build va restart
docker compose up -d --build --no-deps frontend
```

### 12.3. Rollback (muammo bo'lsa)

```bash
# 1. Oldingi image'ga qaytish
docker compose down backend
git checkout HEAD~1 -- backend/
docker compose up -d --build backend

# 2. Database rollback (agar migration buzgan bo'lsa)
gunzip < /opt/backups/db_YYYYMMDD.sql.gz | docker compose exec -T postgres psql -U lms_user lms_robotic
```

---

## 13. Xatoliklarni bartaraf etish

### 13.1. Backend ishga tushmayapti

```bash
# Log tekshiring
docker compose logs backend --tail=50

# Ko'p uchraydigan sabablar:
# ❌ DATABASE_URL noto'g'ri → .env tekshiring
# ❌ Migration xatosi → prisma migrate status
# ❌ Port band → lsof -i :5000
# ❌ RAM yetishmayapti → free -h
```

### 13.2. Database ulanish xatosi

```bash
# PostgreSQL ishlayaptimi?
docker compose ps postgres

# Connection test
docker compose exec postgres psql -U lms_user -d lms_robotic -c "SELECT 1;"

# Max connections
docker compose exec postgres psql -U lms_user -d lms_robotic -c "SHOW max_connections;"
```

### 13.3. Nginx 502 Bad Gateway

```bash
# Backend health check
curl -s http://localhost:5000/health

# Nginx loglarini ko'ring
docker compose logs frontend | grep "error"

# Backend container nomi to'g'ri ekanligini tekshiring
docker compose exec frontend cat /etc/nginx/conf.d/default.conf | head -3
# upstream backend { server backend:5000; } bo'lishi kerak
```

### 13.4. Telegram bot ishlamayapti

```bash
# Bot loglarini tekshiring
docker compose logs backend | grep -i "grammy\|telegram\|bot"

# Internet aloqasini tekshiring
docker compose exec backend wget -qO- https://api.telegram.org/bot8513268264:AAETiGq1Z2Zd6tXmgo7P0n5lR3GQIq3fl98/getMe
```

### 13.5. Disk to'lib qolsa

```bash
# Disk holatini ko'rish
df -h

# Docker tozalash (ehtiyotkorlik bilan!)
docker system prune -a --volumes  # ⚠️ Bu BARCHA ishlatilmagan narsalarni o'chiradi

# Faqat eski imagelarni o'chirish (xavfsizroq)
docker image prune -a
```

### 13.6. RAM yetishmayapti

```bash
# RAM holatini ko'rish
free -h

# Qaysi container ko'p RAM ishlatayotganini ko'rish
docker stats --no-stream

# Swap qo'shish (vaqtinchalik yechim)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Tezkor buyruqlar ro'yxati

| Amal | Buyruq |
|------|--------|
| Deploy | `./deploy.sh` |
| Status | `docker compose ps` |
| Backend log | `docker compose logs -f backend` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` |
| Backup | `./backup.sh` |
| Migration status | `docker compose exec backend npx prisma migrate status` |
| Migration deploy | `docker compose exec backend npx prisma migrate deploy` |
| DB console | `docker compose exec postgres psql -U lms_user lms_robotic` |
| Health check | `curl http://localhost:5000/health` |

---

**Robotic Edu LMS** — Muvaffaqiyatli deploy tilaymiz! 🤖
