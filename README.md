# 🤖 Robotic Edu — LMS Tizimi

O'quv markaz boshqaruv tizimi (Learning Management System)

**Versiya:** 1.0.0 | **Holat:** Ishlab chiqilmoqda

---

## ✅ Bajarilgan modullar

| Modul | Backend | Frontend |
|-------|---------|----------|
| Autentifikatsiya (JWT + Refresh) | ✅ | ✅ |
| O'quvchilar boshqaruvi | ✅ | ✅ |
| Guruhlar boshqaruvi | ✅ | ✅ |
| Ustozlar boshqaruvi | ✅ | ✅ |
| Kurslar boshqaruvi | ✅ | ✅ |
| To'lovlar & Moliya | ✅ | ✅ |
| Ustoz oyliqlari | ✅ | ✅ |
| Davomat belgilash | ✅ | ✅ |
| Baholar (Gradebook) | ✅ | ✅ |
| Dashboard & Statistika | ✅ | ✅ |
| Coin tizimi & Reyting | ✅ | ✅ |
| Hisobotlar (CSV export) | — | ✅ |
| Bildirishnomalar | — | ✅ |
| Real-time Chat (Socket.io) | ✅ | 🔄 |
| Docker Deployment | ✅ | ✅ |

---

## 🚀 Tez ishga tushirish (Docker)

```bash
# 1. Loyihani klonlash
git clone <repo-url>
cd LMS_Cloude

# 2. Environment faylini sozlash
cp .env.example .env
# .env faylini oching va parollarni o'zgartiring!

# 3. Deploy skriptini ishga tushirish
chmod +x deploy.sh
./deploy.sh

# Yoki qo'lda:
docker-compose up -d
```

🌐 Sayt: **http://localhost**
📡 API: **http://localhost/api/v1**

---

## 💻 Local Development

### Backend
```bash
cd backend
cp .env.example .env        # .env ni sozlang
npm install
npx prisma migrate dev      # Database migration
npx prisma db seed          # Test ma'lumotlar
npm run dev                 # http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

---

## 🔑 Test Kirish Ma'lumotlari

| Rol | Telefon | Parol |
|-----|---------|-------|
| 👑 Admin | +998901234567 | admin123 |
| 👨‍🏫 Ustoz | +998901234568 | teacher123 |
| 👨‍👩‍👧 Ota-ona | +998901234569 | parent123 |
| 🎓 O'quvchi | +998901234570 | student123 |

---

## 📁 Loyiha Tuzilmasi

```
LMS_Cloude/
├── .env.example             ← Environment o'zgaruvchilari
├── docker-compose.yml       ← Production deployment
├── docker-compose.dev.yml   ← Development overlay
├── deploy.sh                ← Avtomatik deploy skripti
├── .gitignore
├── nginx/
│   └── nginx.conf           ← Nginx reverse proxy config
│
├── backend/                 ← Node.js + Express + TypeScript
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma    ← Database sxema
│   │   └── seed.ts          ← Test ma'lumotlar
│   └── src/
│       ├── controllers/     ← Business logic
│       ├── routes/          ← API endpoints
│       ├── middleware/      ← Auth, error handling
│       ├── socket/          ← Real-time chat
│       └── utils/           ← Helper funksiyalar
│
└── frontend/                ← React 18 + TypeScript
    ├── Dockerfile
    ├── Dockerfile.dev
    └── src/
        ├── pages/
        │   ├── admin/       ← Admin sahifalari
        │   ├── teacher/     ← Ustoz sahifalari
        │   ├── student/     ← O'quvchi sahifalari
        │   ├── parent/      ← Ota-ona sahifalari
        │   └── shared/      ← Umumiy sahifalar
        ├── components/      ← UI komponentlar
        ├── store/           ← Zustand (auth)
        ├── api/             ← Axios instance
        └── i18n/            ← uz.json, ru.json
```

---

## 🛠️ Texnologiya Steki

**Backend:**
- Node.js 20 + Express + TypeScript
- Prisma ORM + PostgreSQL 16
- Socket.io (real-time)
- JWT (access + refresh tokens)
- Redis (cache, sessions)
- bcrypt, multer, zod

**Frontend:**
- React 18 + TypeScript + Vite
- Tailwind CSS
- Zustand (state management)
- React Query v3
- Recharts (grafiklar)
- Socket.io-client
- i18next (uz/ru tarjima)
- react-router-dom v6

**DevOps:**
- Docker + Docker Compose
- Nginx (reverse proxy + static)
- PostgreSQL + Redis (volumes)

---

## 📊 API Endpointlar

| Prefix | Tavsif |
|--------|--------|
| `POST /api/v1/auth/login` | Kirish |
| `GET /api/v1/students` | O'quvchilar ro'yxati |
| `GET /api/v1/teachers` | Ustozlar ro'yxati |
| `GET /api/v1/groups` | Guruhlar ro'yxati |
| `GET /api/v1/courses` | Kurslar ro'yxati |
| `GET /api/v1/payments` | To'lovlar ro'yxati |
| `GET /api/v1/attendance` | Davomat ma'lumotlari |
| `GET /api/v1/grades` | Baholar |
| `GET /api/v1/dashboard/stats` | Dashboard statistika |
| `GET /api/v1/coins/leaderboard` | Coin reytingi |
| `GET /api/v1/payments/summary` | Moliyaviy xulosa |

---

## 🔒 Xavfsizlik

- JWT access token: 15 daqiqa
- JWT refresh token: 30 kun
- Rate limiting: 100 so'rov/15 daqiqa
- Auth endpoint: 10 urinish/15 daqiqa
- bcrypt parol hashlash (rounds: 10)
- Helmet.js security headers
- CORS sozlangan

---

*© 2026 Robotic Edu LMS — Shexroz Dehqonov*
