# 🆕 Yangi AWS Serverda Noldan O'rnatish
**Robotic Edu LMS — roboticedu.uz**

Backup fayllaringiz tayyor:
- ✅ `lms_backup_20260803_0814.dump` (database)
- ✅ `lms_uploads_*.tar.gz` (rasmlar/fayllar)

---

## 📍 A QISM — AWS Console'da Yangi Server Ochish

### A.1 — EC2 Instance yaratish

1. AWS Console → **EC2** → **Launch Instance**
2. **Name:** `roboticedu-server`
3. **OS:** Ubuntu Server 24.04 LTS (yoki 22.04 LTS)
4. **Instance type:** `t3.small` (2 GB RAM minimum) yoki `t3.medium` (4 GB — tavsiya)
5. **Key pair:** Yangi profil bilan — yangi key pair yarating yoki `Roboticedu_uz.pem` ni tanlang
   - Yangi yaratasangiz: `.pem` faylni **Downloads** ga saqlang
6. **Storage:** kamida **20 GB** gp3

### A.2 — Security Group (MUHIM!)

**Inbound rules** ga quyidagilarni qo'shing:

| Type | Protocol | Port | Source |
|------|----------|------|--------|
| SSH | TCP | 22 | My IP |
| HTTP | TCP | 80 | 0.0.0.0/0 (Anywhere) |
| HTTPS | TCP | 443 | 0.0.0.0/0 (Anywhere) |

> ⚠️ 80 va 443 **Anywhere** bo'lishi shart — aks holda sayt ochilmaydi.

### A.3 — Elastic IP (statik IP — juda muhim!)

> Domain uchun **o'zgarmas IP** kerak. Elastic IP olmasangiz, server restart bo'lganda IP o'zgaradi va domain buziladi.

1. EC2 → **Elastic IPs** → **Allocate Elastic IP address**
2. **Associate** → yangi instance'ni tanlang
3. Bu **Elastic IP** ni yozib oling — masalan `13.51.xxx.xxx`
   - Bu domain uchun ishlatiladigan IP

### A.4 — Ulanish

Mac terminalda:

```bash
# .pem faylga to'g'ri ruxsat berish (birinchi marta)
chmod 400 ~/Downloads/Roboticedu_uz.pem

# Serverga ulanish (ELASTIC_IP ni haqiqiy IP bilan almashtiring)
ssh -i ~/Downloads/Roboticedu_uz.pem ubuntu@ELASTIC_IP
```

---

## 📍 B QISM — Serverni Tayyorlash

> Endi yangi serverga SSH orqali ulangansiz. Quyidagi buyruqlar **server ichida**.

### B.1 — Tizimni yangilash

```bash
sudo apt update && sudo apt upgrade -y
```

### B.2 — Docker o'rnatish

```bash
# Docker o'rnatish
curl -fsSL https://get.docker.com | sudo sh

# ubuntu foydalanuvchisini docker guruhiga qo'shish (sudo'siz ishlatish uchun)
sudo usermod -aG docker ubuntu

# O'zgarishlar kuchga kirishi uchun qayta ulaning:
exit
```

Keyin qaytadan ulaning:
```bash
ssh -i ~/Downloads/Roboticedu_uz.pem ubuntu@ELASTIC_IP
```

Tekshirish:
```bash
docker --version
docker compose version
docker ps    # xatosiz ishlashi kerak
```

### B.3 — Git va certbot o'rnatish

```bash
sudo apt install git certbot -y
```

---

## 📍 C QISM — Kodni Yuklash

### C.1 — GitHub'dan clone qilish

```bash
cd ~
git clone https://github.com/Shexroz-coder/LMS_Cloude.git
cd LMS_Cloude

# So'nggi commitlarni ko'rish
git log --oneline -5
```

> Agar repo **private** bo'lsa, GitHub token yoki SSH key kerak. Ma'lumot bering, yordam beraman.

### C.2 — .env faylini yaratish

```bash
cat > ~/LMS_Cloude/.env << 'EOF'
POSTGRES_USER=lms_user
POSTGRES_PASSWORD=1234
POSTGRES_DB=lms_robotic

REDIS_PASSWORD=1234

JWT_SECRET=LMS_JWT_SECRET_RandomString123456789ABCDEF
JWT_REFRESH_SECRET=LMS_REFRESH_SECRET_RandomString123456789ABCD

TELEGRAM_BOT_TOKEN=8513268264:AAETiGq1Z2Zd6tXmgo7P0n5lR3GQIq3fl98
TELEGRAM_ADMIN_ID=7537442767

FRONTEND_URL=https://roboticedu.uz
VITE_API_BASE_URL=/api/v1
NODE_ENV=production
EOF

cat ~/LMS_Cloude/.env
```

> `JWT_SECRET` va parollar eski serverdagidek — foydalanuvchilar qayta login qilmasligi uchun.

---

## 📍 D QISM — Backupni Yangi Serverga Yuklash

**Mac terminalda** (yangi tab, server emas):

```bash
# Database dump ni yangi serverga yuklash
scp -i ~/Downloads/Roboticedu_uz.pem \
  ~/lms_backup_20260803_0814.dump \
  ubuntu@ELASTIC_IP:~/LMS_Cloude/

# Uploads arxivini yuklash
scp -i ~/Downloads/Roboticedu_uz.pem \
  ~/lms_uploads_*.tar.gz \
  ubuntu@ELASTIC_IP:~/LMS_Cloude/
```

Server terminalda tekshirish:
```bash
ls -lh ~/LMS_Cloude/lms_backup_*.dump ~/LMS_Cloude/lms_uploads_*.tar.gz
```

---

## 📍 E QISM — SSL Sertifikat Olish

> DNS o'zgarishidan OLDIN sertifikat olamiz (standalone usul).
> Bu qadam uchun domain hali eski serverga ko'rsatib turgani muhim emas —
> `--standalone` port 80 orqali ishlaydi, lekin domain shu serverga ko'rsatishi kerak.

**Ikki variant bor:**

### Variant 1: DNS-01 (domain hali ko'chirilmagan bo'lsa)

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d roboticedu.uz \
  -d www.roboticedu.uz \
  --agree-tos \
  --email admin@roboticedu.uz
```

Certbot TXT record so'raydi → domain DNS panelida `_acme-challenge` TXT qo'shing → Enter.

### Variant 2: Standalone (DNS allaqachon shu serverga ko'rsatsa)

```bash
sudo certbot certonly \
  --standalone \
  -d roboticedu.uz \
  -d www.roboticedu.uz \
  --agree-tos \
  --email admin@roboticedu.uz \
  --non-interactive
```

Tekshirish:
```bash
sudo ls -la /etc/letsencrypt/live/roboticedu.uz/
# fullchain.pem va privkey.pem ko'rinishi kerak
```

---

## 📍 F QISM — Ishga Tushirish

### F.1 — Faqat Database va Redis

```bash
cd ~/LMS_Cloude
docker compose up -d postgres redis

# Postgres tayyor bo'lishini kutish
sleep 15
docker ps
```

### F.2 — Database Restore

```bash
cd ~/LMS_Cloude

# Backup faylni postgres konteyneriga ko'chirish
docker cp lms_backup_20260803_0814.dump lms_postgres:/tmp/backup.dump

# Restore (mavjud bo'sh bazani tozalab tiklaydi)
docker exec -i lms_postgres pg_restore \
  -U lms_user \
  -d lms_robotic \
  --clean \
  --if-exists \
  -F c \
  /tmp/backup.dump

# Tekshirish — jadvallar va ma'lumotlar
docker exec -i lms_postgres psql -U lms_user -d lms_robotic -c "\dt"
docker exec -i lms_postgres psql -U lms_user -d lms_robotic -c "SELECT COUNT(*) FROM \"users\";"
```

> ⚠️ `--clean --if-exists` xatolar ko'rsatishi mumkin (avval jadval yo'q bo'lgani uchun) — bu normal. Asosiysi oxirda jadvallar va ma'lumotlar bo'lsin.

### F.3 — Uploads Restore

```bash
cd ~/LMS_Cloude

docker volume create lms_uploads_data

docker run --rm \
  -v lms_uploads_data:/data \
  -v ~/LMS_Cloude:/backup \
  alpine sh -c "tar xzf /backup/lms_uploads_*.tar.gz -C /data"

# Tekshirish
docker run --rm -v lms_uploads_data:/data alpine ls /data
```

### F.4 — Backend va Frontend

```bash
cd ~/LMS_Cloude

# Barcha servislarni build qilib ishga tushirish
docker compose up -d --build

# Loglarni kuzatish
docker compose logs -f --tail=50
# Ctrl+C bilan chiqing (konteynerlar ishlashda davom etadi)
```

Kutilgan holat:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
# lms_postgres   Up (healthy)
# lms_redis      Up (healthy)
# lms_backend    Up (healthy)
# lms_frontend   Up
```

### F.5 — Tekshirish

```bash
# Backend
curl http://localhost:5000/health

# HTTPS (SSL tayyor bo'lsa)
curl -I https://roboticedu.uz
# HTTP/2 200 ko'rinishi kerak
```

---

## 📍 G QISM — DNS O'zgartirish (ENG OXIRGI QADAM)

> Barcha testlar o'tgandan keyin! Bu qadamdan so'ng trafik yangi serverga o'tadi.

Domain registratori (nic.uz / reg.ru / namecheap) panelida:

```
roboticedu.uz       A    →    ELASTIC_IP
www.roboticedu.uz   A    →    ELASTIC_IP
```

TTL: `300` (5 daqiqa)

Tarqalishni tekshirish (Mac terminalda):
```bash
dig roboticedu.uz +short
nslookup roboticedu.uz
```

---

## ✅ FINAL TEKSHIRUV

```bash
# 1. Sayt ochiladi
curl -I https://roboticedu.uz

# 2. API ishlaydi
curl https://roboticedu.uz/api/v1/health

# 3. Barcha konteynerlar
docker ps

# 4. Foydalanuvchilar soni (data to'g'ri ko'chdimi)
docker exec lms_postgres psql -U lms_user -d lms_robotic -c "SELECT COUNT(*) FROM \"users\";"
```

Brauzerda `https://roboticedu.uz` ochib, login qilib ko'ring.

---

## 🔄 SSL Avtomatik Yangilash

```bash
# Cron qo'shish (har hafta yakshanba 03:00)
sudo crontab -e
# Qo'shing:
0 3 * * 0 certbot renew --quiet && docker exec lms_frontend nginx -s reload
```

---

## 🆘 Muammolar

**Backend ishga tushmaydi:**
```bash
docker logs lms_backend --tail=50
# DATABASE_URL yoki migration xatosini tekshiring
```

**Restore xato berdi (baza to'la emas):**
```bash
docker exec -i lms_postgres psql -U lms_user -c "DROP DATABASE IF EXISTS lms_robotic;"
docker exec -i lms_postgres psql -U lms_user -c "CREATE DATABASE lms_robotic;"
# Keyin F.2 ni qayta bajaring
```

**SSL fayl topilmadi:**
```bash
sudo ls /etc/letsencrypt/live/roboticedu.uz/
# Bo'sh bo'lsa — E qismini qayta bajaring
```

---

## 📋 Qadamlar Ketma-ketligi (qisqa)

```
A. AWS: EC2 + Security Group + Elastic IP
B. Server: apt update → Docker → git → certbot
C. Kod: git clone → .env yaratish
D. Backup: scp bilan dump + uploads yuklash
E. SSL: certbot sertifikat
F. Ishga tushirish: DB up → restore → uploads → build → up
G. DNS: A record → Elastic IP  ← eng oxirgi
```

---

*So'nggi yangilanish: 2026-08-03*
