# 🤖 Robotic Edu LMS — MCP Server

AI agent (Claude Desktop, Cursor, ...) orqali LMS tizimini **to'liq boshqarish**.

## Nima qila oladi

**O'qish:**
- `get_overview` — tizim umumiy holati (o'quvchi, moliya, davomat)
- `get_finance` — moliya xulosasi (davr/filial bo'yicha)
- `list_debtors` — qarzdorlar ro'yxati
- `list_branches` — filiallar statistikasi
- `search_students` — o'quvchilarni qidirish
- `list_groups` — guruhlar

**Yozish (to'liq boshqaruv):**
- `create_payment` — to'lov qabul qilish
- `adjust_debt` — qarz/balans to'g'rilash (voz kechish)
- `send_announcement` — e'lon yuborish
- `create_student` — yangi o'quvchi qo'shish

---

## 1. Backend'da API kalit yaratish

Serverda `.env` fayliga qo'shing (uzun, tasodifiy string):

```env
AGENT_API_KEY=super-secret-random-key-CHANGE-THIS-123456
```

Keyin backend'ni qayta ishga tushiring:
```bash
cd ~/LMS_Cloude && docker compose up -d --build backend
```

Tekshirish:
```bash
curl -H "X-API-Key: super-secret-random-key-CHANGE-THIS-123456" \
  https://roboticedu.uz/api/v1/agent/overview
```

## 2. MCP serverni o'rnatish (o'z kompyuteringizda)

```bash
cd mcp-server
npm install
```

## 3. Claude Desktop'ga ulash

`claude_desktop_config.json` faylini oching:
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Quyidagini qo'shing (yo'lni va kalitni o'zingiznikiga moslang):

```json
{
  "mcpServers": {
    "roboticedu": {
      "command": "node",
      "args": ["/FULL/PATH/TO/LMS_Cloude/mcp-server/index.mjs"],
      "env": {
        "LMS_API_URL": "https://roboticedu.uz/api/v1",
        "LMS_API_KEY": "super-secret-random-key-CHANGE-THIS-123456"
      }
    }
  }
}
```

Claude Desktop'ni qayta ishga tushiring. Endi suhbatda so'rashingiz mumkin:

> "Bugungi umumiy holatni ko'rsat"
> "Eng katta 10 qarzdorni ayt"
> "Ahmad Aliyevdan 660000 so'm naqd to'lov qabul qil"
> "Barcha ota-onalarga 'Ertaga dam olish' e'lonini yubor"

## 4. Cursor / boshqa MCP mijozlari

Xuddi shu `command`, `args`, `env` sozlamalarini mijozning MCP config'iga qo'shing.

---

## Xavfsizlik

- `AGENT_API_KEY` ni hech kimga bermang — u to'liq boshqaruv beradi.
- Kalitni vaqti-vaqti bilan yangilang (`.env` da o'zgartirib, backend'ni restart qiling).
- Faqat HTTPS orqali ishlating (kalit ochiq tarmoqda ketmasin).
- Kalit buzilsa: `.env` da o'zgartiring → `docker compose up -d --build backend`.
