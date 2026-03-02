#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Robotic Edu LMS — Production Deployment Script
# ══════════════════════════════════════════════════════════

set -e

echo "🚀 Robotic Edu LMS deployment boshlanmoqda..."

# 1. .env faylni tekshirish
if [ ! -f .env ]; then
  echo "❌ .env fayl topilmadi! .env.example dan nusxa oling:"
  echo "   cp .env.example .env"
  echo "   va qiymatlarni kiriting."
  exit 1
fi

# 2. Docker va docker-compose tekshirish
if ! command -v docker &> /dev/null; then
  echo "❌ Docker o'rnatilmagan!"
  exit 1
fi

# 3. Eski containerlarni to'xtatish
echo "⏹️  Eski containerlar to'xtatilmoqda..."
docker-compose down --remove-orphans

# 4. Build
echo "🔨 Build qilinmoqda..."
docker-compose build --no-cache

# 5. Database va Redis ishga tushirish
echo "🗄️  Database va Redis ishga tushirilmoqda..."
docker-compose up -d postgres redis

# 6. Migration kutish
echo "⏳ Database tayyor bo'lishini kutmoqda..."
sleep 10

# 7. Backend ishga tushirish (migration bilan)
echo "⚙️  Backend ishga tushirilmoqda..."
docker-compose up -d backend

# 8. Frontend ishga tushirish
echo "🌐 Frontend ishga tushirilmoqda..."
docker-compose up -d frontend

# 9. Status tekshirish
echo ""
echo "✅ Deployment muvaffaqiyatli yakunlandi!"
echo ""
echo "📊 Container holatlari:"
docker-compose ps

echo ""
echo "🌐 Sayt manzili: http://localhost"
echo "📡 API manzili:  http://localhost/api/v1"
echo ""
echo "📝 Loglarni ko'rish uchun:"
echo "   docker-compose logs -f backend"
echo "   docker-compose logs -f frontend"
