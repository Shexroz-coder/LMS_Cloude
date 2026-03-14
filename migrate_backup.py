#!/usr/bin/env python3
"""
Backup.sql dan hozirgi database'ga xavfsiz ma'lumot ko'chirish scripti.
Ustunlar farqini inobatga oladi.
"""
import re
import sys

BACKUP_FILE = '/home/ubuntu/LMS_Cloude/backup.sql'
OUTPUT_FILE = '/home/ubuntu/LMS_Cloude/import_data.sql'

# Qaysi jadvallarni import qilish kerak (tartib muhim - foreign key bog'liqliklari)
TABLES_TO_IMPORT = [
    'users',
    'courses',
    'teachers',
    'students',
    'groups',
    'group_students',
    'schedules',
    'lessons',
    'attendance',
    'grades',
    'payments',
    'expenses',
    'coin_transactions',
    'student_balances',
    'teacher_salaries',
]

# O'tkazib yuboriladigan jadvallar
SKIP_TABLES = [
    '_prisma_migrations',  # Migratsiya tarixi - hozirgi holat to'g'ri
    'refresh_tokens',      # Eski tokenlar kerak emas
    'notifications',       # Bo'sh
    'announcements',       # Bo'sh
    'holidays',            # Bo'sh
    'lesson_materials',    # Bo'sh
    'monthly_fees',        # Bo'sh
    'chat_participants',   # Hozirgi DB'da yo'q
    'chats',               # Hozirgi DB'da yo'q
    'messages',            # Hozirgi DB'da yo'q
    'payme_transactions',  # Yangi jadval, backupda yo'q
    'telegram_sessions',   # Yangi jadval, backupda yo'q
]

def parse_copy_blocks(sql_content):
    """COPY ... FROM stdin bloklarini parse qilish"""
    blocks = {}
    lines = sql_content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('COPY public.'):
            # Parse: COPY public.tablename (col1, col2, ...) FROM stdin;
            match = re.match(r'COPY public\.(\w+)\s*\(([^)]+)\)\s*FROM stdin;', line)
            if match:
                table = match.group(1)
                columns = [c.strip() for c in match.group(2).split(',')]
                data_lines = []
                i += 1
                while i < len(lines) and lines[i] != '\\.':
                    if lines[i].strip():
                        data_lines.append(lines[i])
                    i += 1
                blocks[table] = {
                    'columns': columns,
                    'data': data_lines
                }
        i += 1
    return blocks

def parse_sequence_sets(sql_content):
    """SEQUENCE SET qiymatlarini olish"""
    sequences = {}
    for match in re.finditer(r"SELECT pg_catalog\.setval\('public\.(\w+)',\s*(\d+),\s*(true|false)\);", sql_content):
        sequences[match.group(1)] = int(match.group(2))
    return sequences

def generate_import_sql(blocks, sequences):
    """Import SQL generatsiya qilish"""
    sql_parts = []

    sql_parts.append("-- =============================================")
    sql_parts.append("-- BACKUP MA'LUMOTLARINI IMPORT QILISH")
    sql_parts.append("-- =============================================")
    sql_parts.append("BEGIN;")
    sql_parts.append("")

    # 1. Eski ma'lumotlarni o'chirish (teskari tartibda - foreign key)
    sql_parts.append("-- 1. Eski ma'lumotlarni tozalash")
    for table in reversed(TABLES_TO_IMPORT):
        sql_parts.append(f"DELETE FROM {table};")
    sql_parts.append("")

    # 2. Har bir jadval uchun COPY
    for table in TABLES_TO_IMPORT:
        if table not in blocks:
            sql_parts.append(f"-- {table}: backup'da topilmadi, o'tkazib yuborildi")
            continue

        block = blocks[table]
        if not block['data']:
            sql_parts.append(f"-- {table}: ma'lumot yo'q (0 qator)")
            continue

        backup_cols = block['columns']

        # Ustunlar ro'yxati (backupdagi ustunlar bilan)
        cols_str = ', '.join(backup_cols)

        sql_parts.append(f"-- {table}: {len(block['data'])} qator")
        sql_parts.append(f"COPY {table} ({cols_str}) FROM stdin;")
        for data_line in block['data']:
            sql_parts.append(data_line)
        sql_parts.append("\\.")
        sql_parts.append("")

    # 3. Sequence'larni yangilash
    sql_parts.append("-- 3. Sequence'larni yangilash")
    for table in TABLES_TO_IMPORT:
        seq_name = f"{table}_id_seq"
        if seq_name in sequences:
            val = sequences[seq_name]
            sql_parts.append(f"SELECT setval('{seq_name}', {val}, true);")
        elif table == 'student_balances':
            # student_balances has no id column, skip
            pass
        else:
            # Calculate max id from data
            if table in blocks and blocks[table]['data']:
                cols = blocks[table]['columns']
                if 'id' in cols:
                    id_idx = cols.index('id')
                    max_id = 0
                    for line in blocks[table]['data']:
                        parts = line.split('\t')
                        if len(parts) > id_idx:
                            try:
                                max_id = max(max_id, int(parts[id_idx]))
                            except ValueError:
                                pass
                    if max_id > 0:
                        sql_parts.append(f"SELECT setval('{seq_name}', {max_id}, true);")

    sql_parts.append("")
    sql_parts.append("COMMIT;")
    sql_parts.append("")
    sql_parts.append("-- Import tugadi!")

    return '\n'.join(sql_parts)

def main():
    print("Backup faylni o'qish...")
    with open(BACKUP_FILE, 'r') as f:
        content = f.read()

    print("COPY bloklarni parse qilish...")
    blocks = parse_copy_blocks(content)

    print(f"\nTopilgan jadvallar ({len(blocks)}):")
    for table, block in blocks.items():
        status = "IMPORT" if table in TABLES_TO_IMPORT else "SKIP"
        print(f"  {table}: {len(block['data'])} qator [{status}]")

    print("\nSequence qiymatlarni olish...")
    sequences = parse_sequence_sets(content)

    print("\nImport SQL generatsiya qilish...")
    sql = generate_import_sql(blocks, sequences)

    with open(OUTPUT_FILE, 'w') as f:
        f.write(sql)

    print(f"\nImport fayl yaratildi: {OUTPUT_FILE}")
    print(f"Fayl hajmi: {len(sql)} bayt")
    print(f"\nImport qilish uchun:")
    print(f"  docker compose exec -T postgres psql -U lms_user -d lms_robotic < {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
