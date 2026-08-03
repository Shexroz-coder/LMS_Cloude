# 🚀 LMS Server Ko'chirish Qo'llanmasi
**roboticedu.uz → Yangi Server**

---

## 📋 Umumiy Rejа

```
ESKI SERVER          YANGI SERVER
─────────────        ─────────────
1. Backup DB    →    3. Serverni tayyorlash
2. .env + fayllar →  4. Kodni ko'chirish
                     5. DB restore
                     6. SSL sertifikat
                     7. DNS o'zgartirish  ← oxirgi qadam
```

**Taxminiy vaqt:** 30–60 daqiqa  
**Down time:** DNS yangilanish paytida 5–15 daqiqa (ixtiyoriy: zero-downtime usuli ham bor)

---

## 🔴 1-QADAM: ESKI SERVERDAN BACKUP OLISH

> **Buni ishga tushurishdan oldin qiling — eng muhim qadam!**

### 1.1 — SSH orqali eski serverga kiring

```bash
ssh root@ESKI_SERVER_IP
```

### 1.2 — Loyiha papkasiga o'ting

```bash
cd /var/www/lms   # yoki loyiha qayerda bo'lsa
# Tekshirish:
ls    # backend, frontend, docker-compose.yml ko'rinishi kerak
```

### 1.3 — PostgreSQL backup (eng muhim!)

```bash
# Docker ichidagi postgres konteyneridan to'liq dump oling
docker exec lms_postgres pg_dump \
  -U lms_user \
  -d lms_robotic \
  --no-password \
  -F c \
  -f /tmp/lms_backup_$(date +%Y%m%d_%H%M).dump

# Dump faylini host ga ko'chiring
docker cp lms_postgres:/tmp/lms_backup_*.dump ./lms_backup.dump

# Hajmini tekshiring (0 bo'lmasin!)
ls -lh lms_backup.dump
```

### 1.4 — Uploads papkasini arxivlash (rasmlar, fayllar)

```bash
# Uploads volume qayerda ekanini topish
docker volume inspect lms_uploads_data

# Arxivlash
docker run --rm \
  -v lms_uploads_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/lms_uploads.tar.gz -C /data .

ls -lh lms_uploads.tar.gz
```

### 1.5 — .env faylini saqlash

```bash
# .env faylini ko'rish (parollar bor, ehtiyot bo'ling)
cat .env

# Faylni backup papkasiga nusxalash
cp .env env_backup.txt
```

### 1.6 — Barcha backup fayllarni lokal kompyuterga yuklab olish

**Lokal terminalda (yangi tab oching):**

```bash
# Lokal kompyuterga yuklab olish
scp root@ESKI_SERVER_IP:/var/www/lms/lms_backup.dump ./
scp root@ESKI_SERVER_IP:/var/www/lms/lms_uploads.tar.gz ./
scp root@ESKI_SERVER_IP:/var/www/lms/env_backup.txt ./

# Tekshirish
ls -lh lms_backup.dump lms_uploads.tar.gz env_backup.txt
```

---

## 🟡 2-QADAM: YANGI SERVERNI TAYYORLASH

> Yangi serverga SSH orqali kiring: `ssh root@YANGI_SERVER_IP`

### 2.1 — Tizimni yangilash

```bash
apt update && apt upgrade -y
```

### 2.2 — Docker va Docker Compose o'rnatish

```bash
# Docker o'rnatish skripti
curl -fsSL https://get.docker.com | sh

# Docker compose plugin tekshirish (v2 — yangi versiya)
docker compose version
# Agar ishlamasa:
apt install docker-compose-plugin -y

# Docker servisini ishga tushirish
systemctl enable docker
systemctl start docker

# Tekshirish
docker --version
docker compose version
```

### 2.3 — Git o'rnatish

```bash
apt install git -y
git --version
```

### 2.4 — Certbot (Let's Encrypt SSL) o'rnatish

```bash
apt install certbot -y
certbot --version
```

---

## 🟢 3-QADAM: KODNI YANGI SERVERGA O'RNATISH

### 3.1 — Loyiha papkasini yaratish

```bash
mkdir -p /var/www/lms
cd /var/www/lms
```

### 3.2 — Git repozitoriyadan clone qilish

```bash
git clone https://github.com/SIZNING_USERNAME/LMS_Cloude.git .
# yoki SSH bilan:
git clone git@github.com:SIZNING_USERNAME/LMS_Cloude.git .

# Tekshirish
ls    # backend, frontend, docker-compose.yml ko'rinishi kerak
git log --oneline -5   # so'nggi commitlar ko'rinishi kerak
```

> **Agar git repozitoriya yo'q bo'lsa**, lokal kompyuterdan papkani ko'chiring:
> ```bash
> # Lokal terminalda:
> scp -r /path/to/LMS_Cloude root@YANGI_SERVER_IP:/var/www/lms/
> ```

### 3.3 — .env faylini yaratish

```bash
# .env.example dan nusxa oling
cp .env.example .env

# Tahrirlash
nano .env
```

**.env ichidagi qiymatlarni o'zgartiring:**

```env
# ─── Database ─────────────────────────────────────────────
POSTGRES_DB=lms_robotic
POSTGRES_USER=lms_user
POSTGRES_PASSWORD=KUCHLI_PAROL_KIRITING   # eski serverdagini yozing

# ─── Redis ────────────────────────────────────────────────
REDIS_PASSWORD=REDIS_PAROL_KIRITING

# ─── JWT Secrets ──────────────────────────────────────────
JWT_SECRET=ESKI_SERVERDAGI_JWT_SECRET     # muhim: xuddi shu bo'lsin!
JWT_REFRESH_SECRET=ESKI_SERVERDAGI_REFRESH_SECRET

# ─── Domain ───────────────────────────────────────────────
FRONTEND_URL=https://roboticedu.uz
VITE_API_BASE_URL=/api/v1

# ─── Telegram ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=8513268264:AAETiGq1Z2Zd6tXmgo7P0n5lR3GQIq3fl98
TELEGRAM_ADMIN_ID=7537442767
```

> ⚠️ **JWT_SECRET eski serverdagidek bo'lishi shart!** Aks holda barcha foydalanuvchilar login qilishi kerak bo'ladi.

---

## 🔵 4-QADAM: BACKUP FAYLLARNI YANGI SERVERGA YUKLASH

**Lokal terminalda:**

```bash
# Backup fayllarni yangi serverga yuklash
scp lms_backup.dump root@YANGI_SERVER_IP:/var/www/lms/
scp lms_uploads.tar.gz root@YANGI_SERVER_IP:/var/www/lms/
```

---

## 🟣 5-QADAM: SSL SERTIFIKAT OLISH (DNS dan oldin)

### Usul: DNS-01 challenge (server hali ko'rsatilmagan holatda)

> Bu usul DNS yangilanishidan OLDIN sertifikat olish imkonini beradi.

```bash
# DNS-01 challenge orqali sertifikat olish
certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d roboticedu.uz \
  -d www.roboticedu.uz \
  --agree-tos \
  --email SIZNING_EMAIL@gmail.com
```

Certbot sizga bunday narsa ko'rsatadi:
```
Please deploy a DNS TXT record under the name:
_acme-challenge.roboticedu.uz
with the following value: XXXXXXXXXXXXXXXXXXXXX
```

**Domain registratoringizga (namecheap, reg.ru, nic.uz) kiring:**
1. roboticedu.uz DNS sozlamalari → TXT record qo'shing
2. Name: `_acme-challenge.roboticedu.uz`
3. Value: certbot ko'rsatgan random matn
4. 2–5 daqiqa kuting → keyin certbot'da Enter bosing

Muvaffaqiyatli bo'lsa:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/roboticedu.uz/fullchain.pem
Key is saved at: /etc/letsencrypt/live/roboticedu.uz/privkey.pem
```

### Agar sertifikat allaqachon eski serverda bo'lsa (alternativ):

```bash
# Eski serverda (backup olish)
tar czf letsencrypt_backup.tar.gz /etc/letsencrypt/

# Lokal kompyuterga
scp root@ESKI_SERVER_IP:~/letsencrypt_backup.tar.gz ./

# Yangi serverga
scp letsencrypt_backup.tar.gz root@YANGI_SERVER_IP:~/

# Yangi serverdad
tar xzf ~/letsencrypt_backup.tar.gz -C /
```

---

## ⚙️ 6-QADAM: DOCKER BILAN ISHGA TUSHIRISH

### 6.1 — Faqat Database konteynerini ishga tushirish (restore uchun)

```bash
cd /var/www/lms

# Faqat postgres va redisni ishga tushirish
docker compose up -d postgres redis

# Postgres tayyor bo'lishini kutish (~10 sek)
sleep 15

# Tekshirish
docker ps
docker logs lms_postgres | tail -5
```

### 6.2 — Database restore

```bash
# Backup faylni postgres konteyneri ichiga ko'chirish
docker cp lms_backup.dump lms_postgres:/tmp/lms_backup.dump

# Restore qilish
docker exec -i lms_postgres pg_restore \
  -U lms_user \
  -d lms_robotic \
  --clean \
  --if-exists \
  -F c \
  /tmp/lms_backup.dump

# Tekshirish — jadvallar ko'rinishi kerak
docker exec -i lms_postgres psql \
  -U lms_user \
  -d lms_robotic \
  -c "\dt"
```

Muvaffaqiyatli bo'lsa:
```
              List of relations
 Schema |       Name        | Type  |  Owner   
--------+-------------------+-------+----------
 public | Attendance        | table | lms_user
 public | Course            | table | lms_user
 public | Group             | table | lms_user
 public | Payment           | table | lms_user
 public | Student           | table | lms_user
 ...
```

### 6.3 — Uploads fayllarini tiklash

```bash
# Uploads volume yaratish va fayllarni restore qilish
docker volume create lms_uploads_data

docker run --rm \
  -v lms_uploads_data:/data \
  -v /var/www/lms:/backup \
  alpine tar xzf /backup/lms_uploads.tar.gz -C /data

# Tekshirish
docker run --rm -v lms_uploads_data:/data alpine ls /data
```

### 6.4 — Barcha servislarni ishga tushirish

```bash
docker compose up -d --build

# Barcha konteynerlar ko'rinishi kerak
docker ps

# Loglarni kuzating
docker compose logs -f --tail=50
```

**Kutilgan natija:**
```
✅ lms_postgres    — running
✅ lms_redis       — running
✅ lms_backend     — running
✅ lms_frontend    — running
```

### 6.5 — Backend health check

```bash
curl http://localhost:5000/health
# {"status":"ok","db":"connected"} ko'rinishi kerak

# Yoki:
docker exec lms_backend wget -qO- http://localhost:5000/health
```

### 6.6 — HTTPS tekshirish (ssl tayyor bo'lsa)

```bash
curl -I https://roboticedu.uz
# HTTP/2 200 ko'rinishi kerak
```

---

## 🌐 7-QADAM: DNS O'ZGARTIRISH (eng oxirgi qadam)

> **Bu qadamdan keyin eski server ishlashni to'xtatadi!**  
> **Barcha testlar o'tgandan keyin qiling.**

### Domain registratoringizga kiring va:

**A record o'zgartiring:**
```
roboticedu.uz     A    →    YANGI_SERVER_IP
www.roboticedu.uz A    →    YANGI_SERVER_IP
```

**TTL:** 300 (5 daqiqa) qilib qo'ying — tezroq tarqaladi

### Tarqalishni tekshirish:

```bash
# Mahalliy terminalda
nslookup roboticedu.uz

# yoki
dig roboticedu.uz +short
# Yangi IP ko'rinishi kerak
```

> DNS tarqalishi 5 daqiqadan 48 soatgacha ketishi mumkin (odatda 5–30 daqiqa).

---

## ✅ 8-QADAM: FINAL TEKSHIRUVLAR

```bash
# 1. Sayt ishlayaptimi?
curl -I https://roboticedu.uz

# 2. API ishlayaptimi?
curl https://roboticedu.uz/api/v1/health

# 3. SSL sertifikat amal qilish muddati
openssl s_client -connect roboticedu.uz:443 -servername roboticedu.uz 2>/dev/null \
  | openssl x509 -noout -dates

# 4. Barcha konteynerlar ishlayaptimi?
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 5. Database ulanishi
docker exec lms_postgres psql -U lms_user -d lms_robotic -c "SELECT COUNT(*) FROM \"User\";"
```

---

## 🔧 MUAMMOLAR VA YECHIMLAR

### Problem: `docker compose up` ishlamaydi

```bash
# Docker versiyasini tekshirish
docker --version    # 20+ bo'lishi kerak
docker compose version   # v2+ bo'lishi kerak

# Eski usul bilan:
docker-compose up -d --build
```

### Problem: SSL fayllar topilmadi

```bash
ls /etc/letsencrypt/live/roboticedu.uz/
# Agar bo'sh: certbot ni qayta ishga tushiring (5-qadam)

# docker-compose.yml dagi ssl yo'llarini tekshiring:
grep letsencrypt docker-compose.yml
```

### Problem: Database restore xato berdi

```bash
# Avval bazani tozalang
docker exec -i lms_postgres psql -U lms_user -c "DROP DATABASE IF EXISTS lms_robotic;"
docker exec -i lms_postgres psql -U lms_user -c "CREATE DATABASE lms_robotic;"

# Keyin restore qaytadan
docker exec -i lms_postgres pg_restore \
  -U lms_user -d lms_robotic --clean --if-exists -F c /tmp/lms_backup.dump
```

### Problem: Backend "Database connection failed"

```bash
# .env faylini tekshiring
cat .env | grep POSTGRES

# DATABASE_URL to'g'ri formatda bo'lishi kerak
# postgresql://lms_user:PAROL@postgres:5432/lms_robotic

# Backend loglarini ko'ring
docker logs lms_backend --tail=50
```

### Problem: Eski server hali ham SSL fayllarni ushlab turibdi

```bash
# Yangi serverda certbot yangilash avtomatlashtirilgan
crontab -e
# Qo'shing:
0 3 * * 1 certbot renew --quiet && docker exec lms_frontend nginx -s reload
```

---

## 📌 MUHIM ESLATMALAR

| Narsa | Eski server | Yangi server |
|-------|-------------|--------------|
| Kod | `/var/www/lms` | `/var/www/lms` |
| DB backup | `lms_backup.dump` | restore qilinadi |
| SSL | `/etc/letsencrypt` | certbot qaytadan |
| `.env` | asl faylni ko'chiring | tahrirlang |
| DNS | eski IP | **yangi IP ga o'zgartiring** |

---

## 🆘 FAVQULODDA: Eski serverga qaytish

Agar yangi serverda muammo bo'lsa:

```bash
# DNS ni tezda eski serverga qaytaring
# Domain registratorida A record → ESKI_SERVER_IP
# TTL 300 bo'lgani uchun 5 daqiqada ta'sir qiladi
```

---

*So'nggi yangilanish: 2026-08-03*
