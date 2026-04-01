# 📁 Project Structure Overview

## Directory Layout

```
LMS_Cloude/
├── backend/                          # Express.js + TypeScript Backend
│   ├── src/
│   │   ├── server.ts                # Server entry point (Telegram bot starts here)
│   │   ├── app.ts                   # Express app configuration
│   │   │
│   │   ├── telegram/                # 🤖 TELEGRAM BOT (NEW)
│   │   │   ├── index.ts             # Bot startup & shutdown
│   │   │   ├── bot.ts               # Grammy bot instance & session config
│   │   │   ├── handlers/            # Feature handlers
│   │   │   │   ├── start.handler.ts    # /start registration & login
│   │   │   │   ├── menu.handler.ts     # Menu navigation
│   │   │   │   ├── schedule.ts         # 📅 Schedule viewing
│   │   │   │   ├── attendance.ts       # ✅ Attendance history
│   │   │   │   ├── grades.ts           # 📊 Grades display
│   │   │   │   ├── payments.ts         # 💰 Payment status
│   │   │   │   ├── coins.ts            # 🪙 Coin system
│   │   │   │   ├── profile.ts          # 👤 Profile info
│   │   │   │   ├── teacher.handler.ts  # 👨‍🏫 Teacher features
│   │   │   │   ├── admin.handler.ts    # 👑 Admin broadcast
│   │   │   │   ├── account.handler.ts  # Account management
│   │   │   │   ├── notifications.ts    # 🔔 Notifications
│   │   │   │   ├── leaderboard.ts      # 🏆 Leaderboard
│   │   │   │   └── index.ts            # Handler registration
│   │   │   ├── services/
│   │   │   │   ├── data.service.ts     # Prisma queries for data
│   │   │   │   └── notify.service.ts   # Telegram notification sender
│   │   │   └── utils/
│   │   │       ├── keyboards.ts        # Inline button builders
│   │   │       └── format.ts           # Data formatting
│   │   │
│   │   ├── controllers/             # API route handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── student.controller.ts
│   │   │   ├── teacher.controller.ts
│   │   │   ├── admin.controller.ts
│   │   │   └── ...
│   │   │
│   │   ├── routes/                  # API route definitions
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── student.routes.ts
│   │   │   └── ...
│   │   │
│   │   ├── middleware/              # Express middleware
│   │   │   ├── auth.middleware.ts   # JWT verification
│   │   │   ├── error.middleware.ts  # Error handling
│   │   │   └── validation.middleware.ts
│   │   │
│   │   ├── services/                # Business logic
│   │   │   ├── io.service.ts        # Socket.io management
│   │   │   └── ...
│   │   │
│   │   ├── socket/                  # Real-time notifications
│   │   │   └── index.ts
│   │   │
│   │   ├── cron/                    # Scheduled jobs
│   │   │   ├── monthly-debt.cron.ts
│   │   │   └── lesson-reminder.cron.ts
│   │   │
│   │   ├── types/                   # TypeScript type definitions
│   │   └── utils/                   # Utility functions
│   │
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (with Telegram fields)
│   │   ├── seed.ts                  # Initial data seeding
│   │   └── migrations/              # Database migrations
│   │       └── 20260307200000_telegram_bot/
│   │
│   ├── Dockerfile                   # Docker image definition
│   ├── package.json                 # Dependencies
│   ├── tsconfig.json                # TypeScript config
│   └── .env                         # Environment variables
│
├── frontend/                         # React + TypeScript Frontend
│   ├── src/
│   │   ├── main.tsx                 # App entry point
│   │   ├── App.tsx                  # Root component
│   │   │
│   │   ├── hooks/
│   │   │   └── useTheme.tsx          # 🌓 DARK MODE HOOK
│   │   │                              # ThemeProvider Context
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── ThemeToggle.tsx    # 🌓 Theme toggle button
│   │   │   │   ├── AIAssistant.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── StudentLayout.tsx
│   │   │   │   ├── TeacherLayout.tsx
│   │   │   │   ├── ParentLayout.tsx
│   │   │   │   ├── Header.tsx        # Header with theme toggle
│   │   │   │   └── Sidebar.tsx
│   │   │   │
│   │   │   └── ...
│   │   │
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   └── LoginPage.tsx     # Login with theme toggle
│   │   │   ├── admin/
│   │   │   ├── student/
│   │   │   ├── teacher/
│   │   │   └── parent/
│   │   │
│   │   ├── index.css                 # 🌓 Dark mode styles
│   │   └── ...
│   │
│   ├── tailwind.config.ts            # 🌓 darkMode: 'class'
│   ├── vite.config.ts                # Vite configuration
│   ├── Dockerfile                    # Docker image
│   ├── package.json                  # Dependencies
│   └── tsconfig.json                 # TypeScript config
│
├── docker-compose.yml                # 🐳 Multi-service deployment
├── .env.example                      # Environment template
│
├── Documentation/
│   ├── SYSTEM_STATUS.md              # Technical status report
│   ├── DEPLOYMENT_QUICK_START.md     # Deployment guide
│   ├── FINAL_SUMMARY.md              # This summary
│   ├── PROJECT_STRUCTURE.md          # This file
│   └── README.md                     # Project readme
│
└── nginx/                            # Nginx configuration
    ├── nginx.conf                    # Server configuration
    └── ssl/                          # SSL certificates (empty)
```

---

## 🌓 Dark Mode Implementation Files

### Key Files for Dark Mode

1. **Frontend Configuration**
   - `frontend/tailwind.config.ts` - Enables `darkMode: 'class'`
   - `frontend/src/index.css` - Dark mode styles for all components

2. **React Hook & Provider**
   - `frontend/src/hooks/useTheme.tsx` - Theme context and hook
   - Used with `<ThemeProvider>` wrapper in `main.tsx`

3. **UI Components**
   - `frontend/src/components/ui/ThemeToggle.tsx` - Toggle button
   - Placed in Header and LoginPage

4. **Layout Updates**
   - All layout files include `dark:bg-gray-900` classes
   - All pages support dark mode styling

---

## 🤖 Telegram Bot Implementation Files

### Complete Telegram Bot Structure

1. **Core Bot Setup**
   - `backend/src/telegram/index.ts` - Bot initialization
   - `backend/src/telegram/bot.ts` - Grammy instance & session

2. **Feature Handlers** (13 total)
   - `handlers/start.handler.ts` - Registration & login flow
   - `handlers/menu.handler.ts` - Navigation menus
   - `handlers/schedule.ts` - Today's lessons
   - `handlers/attendance.ts` - Attendance history
   - `handlers/grades.ts` - Academic grades
   - `handlers/payments.ts` - Payment & balance info
   - `handlers/coins.ts` - Coin system
   - `handlers/profile.ts` - User profile
   - `handlers/teacher.handler.ts` - Teacher features
   - `handlers/admin.handler.ts` - Admin broadcast
   - `handlers/account.handler.ts` - Account management
   - `handlers/notifications.ts` - Notifications
   - `handlers/leaderboard.ts` - Leaderboard view

3. **Support Services**
   - `services/data.service.ts` - Database queries
   - `services/notify.service.ts` - Message sending
   - `utils/keyboards.ts` - Button builders
   - `utils/format.ts` - Data formatting

4. **Database**
   - `prisma/schema.prisma` - Telegram fields in User model
   - `prisma/schema.prisma` - TelegramSession model for OTP
   - `prisma/migrations/20260307200000_telegram_bot/` - Migration

---

## 🗄️ Database Schema (Simplified)

```
User (Users with telegram integration)
├── id, fullName, phone, passwordHash
├── role (ADMIN, TEACHER, STUDENT, PARENT)
├── telegramChatId ← NEW
├── telegramUsername ← NEW
├── telegramLinkedAt ← NEW
│
├── Student
│   ├── coinBalance
│   ├── discountType, discountValue
│   ├── status (LEAD, DEMO, ACTIVE, INACTIVE)
│   └── StudentBalance (balance, debt)
│
├── Teacher
│   ├── specialization
│   ├── salaryType, salaryValue
│   └── TeacherSalary (monthly tracking)
│
└── Parent
    └── ParentStudents (children relationship)

Course
└── Group (multiple per course)
    ├── Schedule (lesson times)
    ├── Lesson (individual classes)
    │   ├── Attendance (student present/absent)
    │   ├── Grade (student scores)
    │   └── LessonMaterial (resources)
    └── GroupStudent (enrollments)

Payment & Finance
├── Payment (payments received)
├── StudentBalance (balance tracking)
├── MonthlyFee (fee calculation)
└── Expense (operational costs)

Coins & Rewards
└── CoinTransaction (rewards & penalties)

Notifications
├── Notification (in-app messages)
└── Announcement (broadcasts)

TelegramSession ← NEW
├── telegramChatId
├── phone
├── otp
├── expiresAt
└── createdAt
```

---

## 🔄 Data Flow

### User Login Flow
```
Mobile/Browser
    ↓
Frontend (React)
    ↓
API (Express)
    ↓
Database (PostgreSQL)
    ↓
JWT Token
    ↓
Frontend (Stored in localStorage)
```

### Telegram Bot Flow
```
Telegram User
    ↓
/start command
    ↓
Bot asks for phone number
    ↓
User sends phone
    ↓
Bot generates 6-digit OTP
    ↓
User sends OTP
    ↓
Bot links Telegram account to User in database
    ↓
Bot shows appropriate menu (Student/Teacher/Parent/Admin)
    ↓
User clicks menu buttons
    ↓
Bot queries database
    ↓
Bot displays formatted data
```

### Real-time Notifications
```
Backend Event (attendance marked, grade given, etc.)
    ↓
Socket.io broadcast
    ↓
Notification to web
    ↓
Telegram message (via notify.service.ts)
```

---

## 🔧 Configuration Files

### Environment Variables (.env)
```env
# Database
POSTGRES_USER=lms_user
POSTGRES_PASSWORD=password
POSTGRES_DB=lms_robotic

# Redis
REDIS_PASSWORD=password
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=secret
JWT_REFRESH_SECRET=secret

# Telegram Bot
TELEGRAM_BOT_TOKEN=token_here
TELEGRAM_ADMIN_ID=7537442767

# Frontend
FRONTEND_URL=http://localhost
VITE_API_BASE_URL=/api/v1

# Server
NODE_ENV=production
PORT=5000
```

### Docker Services
```
postgres:5432        ← Database (PostgreSQL 16)
redis:6379          ← Cache/Sessions (Redis 7)
backend:5000        ← API (Express.js)
frontend:80/443     ← Web (Nginx)
```

---

## 📊 Feature Matrix

| Feature | Backend | Frontend | Telegram | Mobile Ready |
|---------|---------|----------|----------|-------------|
| Dark Mode | - | ✅ | ✅ | ✅ |
| Login | ✅ | ✅ | ✅ | ✅ |
| Schedule | ✅ | ✅ | ✅ | ✅ |
| Attendance | ✅ | ✅ | ✅ | ✅ |
| Grades | ✅ | ✅ | ✅ | ✅ |
| Payments | ✅ | ✅ | ✅ | ✅ |
| Coins | ✅ | ✅ | ✅ | ✅ |
| Profile | ✅ | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ | ✅ |
| Admin Panel | ✅ | ✅ | ✅ | ✅ |

---

## 🚀 Build & Deployment

### Frontend Build
```bash
npm install       # Install dependencies
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview built version
```

### Backend Build
```bash
npm install           # Install dependencies
npm run dev           # Development server
npm run build         # TypeScript compilation
npm start             # Production server
npm run db:migrate    # Run migrations
npm run db:seed       # Seed initial data
```

### Docker Build
```bash
docker-compose build      # Build images
docker-compose up -d      # Start services
docker-compose down       # Stop services
docker-compose logs -f    # View logs
```

---

## 📝 Key Takeaways

1. **Dark Mode**: Implemented with Tailwind CSS class strategy
2. **Telegram Bot**: Full-featured with 13 handlers, OTP authentication
3. **Database**: 24+ models with proper relationships
4. **Backend**: Professional Express.js with TypeScript
5. **Frontend**: React with responsive design
6. **Deployment**: Docker-based with proper configuration
7. **Documentation**: Comprehensive guides included

---

## 🎯 How to Navigate the Code

**Want to understand dark mode?**
→ Start with `frontend/src/hooks/useTheme.tsx`

**Want to understand Telegram bot?**
→ Start with `backend/src/telegram/index.ts` and `bot.ts`

**Want to understand data flow?**
→ Look at `backend/src/routes/` and `controllers/`

**Want to understand styling?**
→ Check `frontend/tailwind.config.ts` and `src/index.css`

**Want to understand database?**
→ Read `backend/prisma/schema.prisma`

---

This project is well-organized, properly typed, and ready for production! 🚀
