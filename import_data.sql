BEGIN;

-- Tozalash
DELETE FROM teacher_salaries;
DELETE FROM student_balances;
DELETE FROM coin_transactions;
DELETE FROM expenses;
DELETE FROM payments;
DELETE FROM grades;
DELETE FROM attendance;
DELETE FROM lessons;
DELETE FROM schedules;
DELETE FROM group_students;
DELETE FROM groups;
DELETE FROM students;
DELETE FROM teachers;
DELETE FROM courses;
DELETE FROM users;

-- users: 34 qator
COPY users (id, full_name, phone, email, password_hash, role, avatar_url, language, is_active, created_at, updated_at) FROM stdin;
1	Super Admin	+998901234567	\N	$2a$12$10fg/MDv/keaC6j4PrTQ4.XHjl7PR7uctBBd6NTlF584ay3t88Q.2	ADMIN	\N	uz	t	2026-02-28 01:53:14.27	2026-02-28 01:53:14.27
3	Jasur Toshmatov	+998901234569	\N	$2a$12$DP.8/fALj0A1FkaGNrjDaeHu52UK9DIep6fLUAjussK9TB4LpH0ku	PARENT	\N	uz	t	2026-02-28 01:53:14.871	2026-02-28 01:53:14.871
6	Sardor raximov (Ota-ona)	+998907865748	\N	$2a$12$yKNDnjDYt7KoiJJzW7LTueKtN6BnKuIA/6q3fLyoAzJzxmILyk8Dq	PARENT	\N	uz	t	2026-02-28 01:56:41.956	2026-02-28 01:56:41.956
9	Sardor Raximov (Ota-ona)	+998945643526	\N	$2a$12$ePQi//GTx6rTvdgqKUZoY.tGlBHpZvZnSvV53P1xDOLJ77G8HGaj.	PARENT	\N	uz	t	2026-02-28 02:01:11.941	2026-02-28 02:01:11.941
34	Irkinov Mirmuhammad	+998935656628	\N	$2a$12$S.L4YTOFz2KTUsFb3ojryOya2vLJONTw9DmcqPhy6zGM12wqKGI4S	STUDENT	\N	uz	t	2026-02-28 09:40:03.84	2026-02-28 09:40:03.84
35	Olamjonov Odilbek	+998946331731	\N	$2a$12$SZ6hN6LBKbJ5ncWGOnrI2.u5VV744xYK8U/a1CXE3KAQLkesRE8wq	STUDENT	\N	uz	t	2026-02-28 09:41:37.133	2026-02-28 09:41:37.133
36	Muxidinov Salim	+998933527737	\N	$2a$12$PzFfRprdmP9jMRtWQSy0U.QJy/DcnzrTE5yYX0MNHIzFsxbU1ETxy	STUDENT	\N	uz	t	2026-02-28 09:42:30.865	2026-02-28 09:42:30.865
37	Ibragimov Bexruz	+998337700708	\N	$2a$12$d6PrjWR9nLFdKB2a9nlxleO54b6abXuxThWew/iL1RUi3JJH9zPya	STUDENT	\N	uz	t	2026-02-28 09:43:22.682	2026-02-28 09:43:22.682
15	To'lqinov Timur	+998935422930	subhonova@gmail.com	$2a$12$30NKbSQ4/eI/tbpRa7AcDeTCDQw3fgCFGIWFagqz/EyiJoEJSHJru	STUDENT	\N	uz	f	2026-02-28 02:27:37.893	2026-02-28 09:07:47.943
14	Muhammadyusuf Tillaboyev	+998907657856	muhammad@gmail.com	$2a$12$aWJdOkZ0BVO14lAuWuPVbeUPpKQmQZSMwHUI8Sj3OceCWs0Y..Lkm	STUDENT	\N	uz	f	2026-02-28 02:06:45.347	2026-02-28 09:07:50.023
13	Sardor raximov	+998903425162	sgfbvc@mail.ru	$2a$12$K6SkzVcbbc1M8mxKouDLh.tebLRD2ASU17RrRFesY27clr26BjCOq	STUDENT	\N	uz	f	2026-02-28 02:05:13.342	2026-02-28 09:07:52.522
4	Bobur Toshmatov	+998901234570	\N	$2a$12$VSps1GfbLO7.2gguV9zts.m0wHHOT6uZ8SxoSXPzwY54c7RbB1Ive	STUDENT	\N	uz	f	2026-02-28 01:53:15.149	2026-02-28 09:07:54.685
16	Raximov Sardorbek (Ota-ona)	+998971844222	\N	$2a$12$Ss8QOFrz7w4Uq3TsyRTs8OG7sHk0bVEAlR5QnUcwryj3X37KPV7bi	PARENT	\N	uz	t	2026-02-28 09:09:48.093	2026-02-28 09:09:48.093
19	Muxtorov Mustafo	94-021-74-47	\N	$2a$12$0lbOHCRnvaKpRv6zOQpLRO2ln7bs2CmZs7HiznKCPRGkF494T/rom	STUDENT	\N	uz	t	2026-02-28 09:14:54.749	2026-02-28 09:15:06.384
18	Sardorbek Raximov	971844222	\N	$2a$12$KhMB2ry6zZEIkLkeuiPhC.G4DdSg7ukwxo8c7nmi7HTk5f7F1m7Vi	STUDENT	\N	uz	t	2026-02-28 09:13:31.835	2026-02-28 09:15:14.575
20	Tillaboyev Muhammadyusuf	97-737-37-93	\N	$2a$12$cUMHWnvOoZXfAQJfRDgrzO2MYRPIeQhFy2aIpiC7U4AQN7XGGJZP.	STUDENT	\N	uz	t	2026-02-28 09:17:01.404	2026-02-28 09:17:01.404
2	Shexroz Dehqonov	+998935412930	shexrozdehqonov@gmail.com	$2a$12$2bo1D8F.7KB.GMEjVGh0p.wZHPW/K6y6snjL5bldvRZefgWmI0z3q	TEACHER	\N	uz	t	2026-02-28 01:53:14.58	2026-02-28 09:18:14.665
22	Mamajonov Ali	+998901365005	\N	$2a$12$Yxxtoo8AvpbEMp1v1I0h6uO2wbSovjOiIYvCC5XI9D9zCClhtgXfO	STUDENT	\N	uz	t	2026-02-28 09:23:48.61	2026-02-28 09:23:48.61
23	Naymanov Bexruz	+998949560536	\N	$2a$12$hxYoAhdFxWYjbfBRjt.EaeYnr9RDkDW4N0MDtmxjCTYPzl.j7rSVG	STUDENT	\N	uz	t	2026-02-28 09:25:13.547	2026-02-28 09:25:13.547
24	Ismoilov Maqsud (Ota-ona)	+998909310708	\N	$2a$12$.6RCpY1b23.WTZyIYMqun.lkfzYWC3cxewKZk.AIeageTIUiq01Se	PARENT	\N	uz	t	2026-02-28 09:27:04.86	2026-02-28 09:27:04.86
25	Ismoilov Maqsud	+998909370708	\N	$2a$12$jOyq94ftO.uWMrqYnHjbRuXPIzlLTfxVKN.0S5DIaJZCHy3FrGwji	STUDENT	\N	uz	t	2026-02-28 09:27:05.143	2026-02-28 09:27:05.143
26	Shoxakimov Shomansur	+998946007181	\N	$2a$12$wiAb2P7rJ6Nf9t8eLBtrhOixSAAOjyH10UyNKOM3.mX5S4Xd.H0oW	STUDENT	\N	uz	t	2026-02-28 09:33:30.295	2026-02-28 09:33:30.295
27	Eshonqulov Abdurahmon	+998938449385	\N	$2a$12$94NI.aYpxKavhWT.TZjPYOegjSmsz9hfdzjb0GXI/kIJXEsDASDXa	STUDENT	\N	uz	t	2026-02-28 09:34:58.394	2026-02-28 09:34:58.394
28	Eshonqulov Mahmudjon (Ota-ona)	+99898449385	\N	$2a$12$NapGEP48bqEAO3ksMTT.J.NjaaBQ3FWbmnk/ywUIFQR78MG/5U4/i	PARENT	\N	uz	t	2026-02-28 09:36:23.546	2026-02-28 09:36:23.546
30	Eshonqulov Mahmudjon	+99898449386	\N	$2a$12$RCkLNIhDtpfcpo9Xk9P.A.lb2PvhO8Z6xQp.6m9Hiqh.AHt7.o3b.	STUDENT	\N	uz	t	2026-02-28 09:36:28.423	2026-02-28 09:36:28.423
31	Komilova Sarvinoz	+998935859403	\N	$2a$12$O2rZdfzq/7iX3iJLzttsi.s6MJO51pMhAVLkqtnZZiAy/4JzYBIsK	STUDENT	\N	uz	t	2026-02-28 09:37:51.61	2026-02-28 09:37:51.61
32	Abdumalikov Abbosxon (Ota-ona)	+998770198085	\N	$2a$12$7T1VSl/.GHiA0wpi/MC9CO/5FssyDD/uEixiudQ.gGZPCCWhoYab.	PARENT	\N	uz	t	2026-02-28 09:39:01.252	2026-02-28 09:39:01.252
33	Abdumalikov Abbosxon	+998770198580	\N	$2a$12$Int24PetnOB6mi8z01GbIOMmovoNhIM4VQX.uIK4C4Q7lPb2nksHa	STUDENT	\N	uz	t	2026-02-28 09:39:01.531	2026-02-28 09:39:01.531
39	Muratov Imron	+998935988808	\N	$2a$12$gVLQCZ79YlQY59YZAERK9OprEnt7j33atDtTxeuu3/rGqqUhenOW.	STUDENT	\N	uz	t	2026-02-28 09:48:15.828	2026-02-28 09:48:15.828
40	Jo'rayev Jaxongir	+998945633900		$2a$12$zmpt4XGxKvPQ5azlwqsjwODLYLqF.05H1GQVKRXcGRyuNLnVAdaUe	TEACHER	\N	uz	t	2026-02-28 10:06:30.982	2026-02-28 10:07:09.372
21	Dilovar Murodova	+998909910795		$2a$12$nQVAtMlPohfTgQHYkEOK9esysqZNljIhP243ZS1iN1wNKs1kOaqbG	TEACHER	\N	uz	t	2026-02-28 09:19:47.984	2026-03-01 16:32:43.613
38	Satorov Iskandar	+998991111171	\N	$2a$12$AXLZmLGgKuB9cYNTYJD5L.l9GGnzb/l.SNb2Zljj7Gpm9f5sXkX/O	STUDENT	\N	uz	t	2026-02-28 09:45:57.985	2026-03-03 04:20:57.713
41	To'lqinov Firdavs (Ota-ona)	+998998704700	\N	$2a$12$oYL6Nff8NcB170YlfHfIuOmH3pM8P82SSQv2vydcHJQX29p1dkil2	PARENT	\N	uz	t	2026-03-03 10:41:17.479	2026-03-03 10:41:17.479
43	To'lqinov Firdavs	+998998282090	\N	$2a$12$LN0N8xxaJh4UZ2hS5V7DA.TPQOUXZMnWE0MwkOFO6lv5myquNjWUe	STUDENT	\N	uz	t	2026-03-03 11:12:19.045	2026-03-03 18:35:20.851
\.

-- courses: 3 qator
COPY courses (id, name, description, monthly_price, per_lesson_price, duration_months, is_active, icon_url, created_at) FROM stdin;
2	Lego WeDo 	Lego guruhlari uchun	660000.00	\N	3	t	\N	2026-02-28 09:11:24.518
3	English	Ingliz tili boshlang'ich 	450000.00	\N	9	t	\N	2026-02-28 09:12:07.998
1	Robotika va Arduino	Robotika asoslari, Arduino dasturlash, loyiha yaratish	660000.00	50000.00	6	t	\N	2026-02-28 01:53:15.157
\.

-- teachers: 3 qator
COPY teachers (id, user_id, salary_type, salary_value, specialization, bio) FROM stdin;
1	2	PERCENTAGE_FROM_PAYMENT	50.00	Robotika va Arduino	\N
3	40	PER_LESSON_HOUR	120000.00	\N	\N
2	21	PERCENTAGE_FROM_PAYMENT	50.00	\N	\N
\.

-- students: 22 qator
COPY students (id, user_id, parent_id, birth_date, address, coin_balance, discount_type, discount_value, notes, status, demo_date, left_at, left_reason, payment_due_day, payment_remind_days_before) FROM stdin;
1	4	3	\N	\N	50	PERCENTAGE	10.00	\N	LEAD	\N	\N	\N	\N	3
2	13	\N	2010-02-11	Toshkent, Yangihayot	0	\N	\N		LEAD	\N	\N	\N	\N	3
3	14	\N	2019-06-03	Toshkent, Yangihayot	0	\N	\N		LEAD	\N	\N	\N	\N	3
4	15	\N	2024-04-17	Toshkent Sergeli	0	\N	\N		LEAD	\N	\N	\N	\N	3
7	20	\N	2016-01-01	Toshkent sh, Yangihayot t	0	FIXED_AMOUNT	59996.00		ACTIVE	\N	\N	\N	\N	3
10	25	24	2016-01-01	Toshkent sh, Yangihayot tumani	0	FIXED_AMOUNT	100000.00		ACTIVE	\N	\N	\N	\N	3
11	26	\N	2016-01-01	Toshkent sh, Yangihayot tuman	0	\N	\N		ACTIVE	\N	\N	\N	\N	3
13	30	28	2016-01-01	Toshkent sh, Yangihayot t	0	FIXED_AMOUNT	100000.00		ACTIVE	\N	\N	\N	\N	3
17	35	\N	\N	Toshkent sh, Yangihayot tumani	0	\N	\N		ACTIVE	\N	\N	\N	\N	3
18	36	\N	\N	Toshkent sh, Yangihayot tuman	0	\N	\N		ACTIVE	\N	\N	\N	\N	3
6	19	\N	2020-09-21	Toshkent sh, Yangihayot	2	FIXED_AMOUNT	60000.00		ACTIVE	\N	\N	\N	\N	3
8	22	\N	2016-01-01	Toshkent sh, Yangihayot t	5	FIXED_AMOUNT	60000.00		ACTIVE	\N	\N	\N	\N	3
20	38	38	\N	Toshkent sh, Yangihayot t	5	\N	\N		DEMO	2026-02-20	\N	\N	\N	3
16	34	\N	\N	Toshkent sh, Yangihayot tuman.	8	\N	\N		ACTIVE	\N	\N	\N	\N	3
19	37	\N	\N	Toshkent sh, Yangihayot tuman	7	\N	\N		ACTIVE	\N	\N	\N	\N	3
12	27	\N	2016-01-01	Toshkent sh, Yangihayot tuman	8	FIXED_AMOUNT	100000.00		ACTIVE	\N	\N	\N	\N	3
15	33	32	\N	Toshkent sh, Yangihayot tuman	10	\N	\N		ACTIVE	\N	\N	\N	\N	3
21	39	\N	\N	Toshkent sh, Yangihayot tuman	8	\N	\N		DEMO	2026-02-26	\N	\N	\N	3
14	31	\N	2016-01-01	Toshkent sh, Yangihayot tuman	8	\N	\N		ACTIVE	\N	\N	\N	\N	3
5	18	\N	2021-02-12	Toshkent sh, Yangihayot	5	\N	\N		ACTIVE	\N	\N	\N	\N	3
9	23	\N	2016-01-01	Toshkent sh, Yangihayot t	3	FIXED_AMOUNT	160000.00		ACTIVE	\N	\N	\N	\N	3
22	43	\N	\N	Toshkent sh, Yangihayot tuman	10	FIXED_AMOUNT	60000.00		ACTIVE	\N	\N	\N	\N	3
\.

-- groups: 8 qator
COPY groups (id, name, course_id, teacher_id, max_students, start_date, end_date, status, room, created_at) FROM stdin;
1	Arduino 1	1	1	15	2026-02-01	2026-08-31	COMPLETED	106	2026-02-28 02:07:34.671
4	Lego yoshlar	2	3	10	2026-02-01	2026-05-31	ACTIVE	106	2026-02-28 10:07:54.634
3	English_one	3	2	10	2026-02-10	2026-12-31	ACTIVE	106	2026-02-28 09:49:32.843
2	Arduino_01	1	1	10	2026-02-01	2026-08-31	ACTIVE	106	2026-02-28 09:27:57.271
5	Lego_bepul	2	3	10	2026-02-01	2026-04-30	ACTIVE	106	2026-02-28 10:10:56.527
6	Lego_ertalabgi	2	1	10	2026-02-01	2026-04-30	ACTIVE	106	2026-02-28 11:45:34.177
7	Lego_kattalar	2	1	10	2026-02-01	2026-04-30	ACTIVE	106	2026-02-28 11:48:37.318
8	English_two	3	2	10	2026-02-10	2026-12-31	ACTIVE	106	2026-02-28 15:38:49.485
\.

-- group_students: 25 qator
COPY group_students (id, group_id, student_id, joined_at, status) FROM stdin;
1	1	4	2026-02-28	LEFT
2	1	3	2026-02-28	LEFT
3	2	5	2026-02-28	ACTIVE
4	2	7	2026-02-28	ACTIVE
5	2	8	2026-02-28	ACTIVE
6	2	9	2026-02-28	ACTIVE
7	2	10	2026-02-28	ACTIVE
8	3	12	2026-02-28	ACTIVE
9	3	16	2026-02-28	ACTIVE
10	3	19	2026-02-28	ACTIVE
11	4	6	2026-02-28	ACTIVE
12	4	20	2026-02-28	ACTIVE
13	5	13	2026-02-28	ACTIVE
14	5	11	2026-02-28	ACTIVE
15	5	17	2026-02-28	ACTIVE
16	6	12	2026-02-28	ACTIVE
17	6	16	2026-02-28	ACTIVE
18	6	19	2026-02-28	ACTIVE
19	7	14	2026-02-28	ACTIVE
20	7	21	2026-02-28	ACTIVE
21	7	15	2026-02-28	ACTIVE
22	7	18	2026-02-28	ACTIVE
23	8	13	2026-02-28	ACTIVE
24	8	21	2026-02-28	ACTIVE
25	7	22	2026-03-03	ACTIVE
\.

-- schedules: 7 qator
COPY schedules (id, group_id, days_of_week, start_time, end_time, room) FROM stdin;
3	2	{2,4,6}	17:30	19:00	106
4	3	{2,4,6}	10:30	12:00	106
5	4	{1,3,5}	16:00	17:30	106
6	5	{1,3,5}	18:00	19:30	106
7	6	{2,4,6}	09:00	10:30	106
8	7	{2,4,6}	16:00	17:30	106
9	8	{2,4,6}	14:30	16:00	106
\.

-- lessons: 11 qator
COPY lessons (id, group_id, date, start_time, end_time, topic, homework, status, duration_hours, created_at) FROM stdin;
1	3	2026-02-28	10:30	12:00	\N	\N	COMPLETED	1.50	2026-02-28 09:53:20.805
2	3	2026-02-28	10:30	12:00	Fasllar	\N	COMPLETED	1.50	2026-02-28 09:53:36.362
3	3	2026-02-28	10:30	12:00	Fasllar	\N	COMPLETED	1.50	2026-02-28 09:53:45.43
4	8	2026-03-01	14:30	16:00	\N	\N	COMPLETED	1.50	2026-03-01 08:21:17.266
5	8	2026-03-01	09:00	10:00	\N	\N	SCHEDULED	1.00	2026-03-01 08:21:17.286
6	8	2026-03-02	09:00	10:00	\N	\N	SCHEDULED	1.00	2026-03-02 09:20:41.791
7	5	2026-02-27	09:00	10:00	\N	\N	SCHEDULED	1.00	2026-03-02 10:02:04.557
8	3	2026-03-03	10:30	12:00	\N	\N	COMPLETED	1.50	2026-03-03 10:43:55.047
9	3	2026-03-03	09:00	10:00	\N	\N	SCHEDULED	1.00	2026-03-03 10:43:55.253
10	8	2026-03-03	14:30	16:00	\N	\N	COMPLETED	1.50	2026-03-03 10:44:20.057
11	8	2026-03-03	09:00	10:00	\N	\N	SCHEDULED	1.00	2026-03-03 10:44:20.242
\.

-- attendance: 15 qator
COPY attendance (id, lesson_id, student_id, status, note, marked_at) FROM stdin;
2	1	12	PRESENT	\N	2026-03-01 03:12:33.842
1	1	19	PRESENT	\N	2026-03-01 03:12:33.851
3	1	16	PRESENT	\N	2026-03-01 03:12:33.854
4	5	21	PRESENT	\N	2026-03-01 08:21:17.29
5	5	13	PRESENT	\N	2026-03-01 08:21:17.298
6	6	13	PRESENT	\N	2026-03-02 09:20:41.797
7	6	21	PRESENT	\N	2026-03-02 09:20:41.815
8	7	11	PRESENT	\N	2026-03-02 10:02:04.561
9	7	17	PRESENT	\N	2026-03-02 10:02:04.561
10	7	13	PRESENT	\N	2026-03-02 10:02:04.561
11	9	16	PRESENT	\N	2026-03-03 10:43:55.259
12	9	12	PRESENT	\N	2026-03-03 10:43:55.26
13	9	19	PRESENT	\N	2026-03-03 10:43:55.279
14	11	13	PRESENT	\N	2026-03-03 10:44:20.245
15	11	21	PRESENT	\N	2026-03-03 10:44:20.245
\.

-- grades: 3 qator
COPY grades (id, student_id, lesson_id, score, type, comment, given_at) FROM stdin;
1	11	7	5.00	CLASSWORK	\N	2026-03-02 10:02:04.564
2	13	7	5.00	CLASSWORK	\N	2026-03-02 10:02:04.565
3	17	7	5.00	CLASSWORK	\N	2026-03-02 10:02:04.566
\.

-- payments: 10 qator
COPY payments (id, student_id, amount, month, payment_method, status, paid_at, received_by, receipt_number, note, transaction_id, provider, provider_order_id) FROM stdin;
1	4	600000.00	2026-02-01	CASH	PAID	2026-02-28 02:39:40.09	1	\N	\N	\N	\N	\N
2	3	600000.00	2026-02-01	CASH	PAID	2026-02-28 03:01:58.368	1	\N	\N	\N	\N	\N
3	15	1980000.00	2026-03-01	ONLINE	PENDING	2026-03-01 12:57:16.508	\N	\N	UZUM orqali to'lov	\N	UZUM	LMS-1772369836507-15
4	16	103846.00	2026-03-01	ONLINE	PENDING	2026-03-01 16:16:15.416	\N	\N	PAYME orqali to'lov	\N	PAYME	LMS-1772381775415-16
5	8	660000.00	2026-03-01	CARD	PAID	2026-03-02 14:35:52.776	1	\N		\N	\N	\N
6	17	650000.00	2026-03-01	CARD	PAID	2026-03-03 03:00:35.208	1	\N		\N	\N	\N
7	19	600000.00	2026-03-01	CASH	PAID	2026-03-03 03:00:59.575	1	\N		\N	\N	\N
8	5	600000.00	2026-03-01	CARD	PAID	2026-03-03 09:43:34.758	1	\N		\N	\N	\N
9	15	660000.00	2026-03-01	CASH	PAID	2026-03-03 10:38:36.01	1	\N		\N	\N	\N
10	22	600000.00	2026-03-01	CARD	PAID	2026-03-03 11:12:36.094	1	\N		\N	\N	\N
\.

-- expenses: 2 qator
COPY expenses (id, amount, date, description, added_by, created_at, category) FROM stdin;
1	200000.00	2026-02-28	Dilovar ustozga avans	1	2026-02-28 09:57:26.829	SALARY
2	50000.00	2026-02-28	Qog'oz olindi	1	2026-02-28 12:57:25.245	SUPPLIES
\.

-- coin_transactions: 19 qator
COPY coin_transactions (id, student_id, given_by, amount, reason, type, created_at) FROM stdin;
1	19	21	5	Uyga vazifani bajargani uchun	REWARD	2026-02-28 09:52:44.847
2	6	40	2		BONUS	2026-02-28 10:58:15.831
3	8	21	5		BONUS	2026-03-01 04:17:14.287
4	20	1	5		REWARD	2026-03-03 04:17:24.3
5	16	21	3		REWARD	2026-03-03 05:34:36.256
6	16	21	5		REWARD	2026-03-03 05:34:42.805
7	19	21	2		REWARD	2026-03-03 05:35:17.284
8	12	21	3		REWARD	2026-03-03 05:35:31.914
9	12	21	5		BONUS	2026-03-03 05:37:31.94
10	22	1	5		REWARD	2026-03-03 11:12:48.165
11	22	1	5		BONUS	2026-03-03 11:12:55.586
12	15	1	5		REWARD	2026-03-03 11:13:06.054
13	15	1	5		REWARD	2026-03-03 11:13:12.455
14	21	1	3		REWARD	2026-03-03 11:13:21.813
15	21	1	5		BONUS	2026-03-03 11:13:29.013
16	14	1	3		REWARD	2026-03-03 11:13:44.28
17	14	1	5		REWARD	2026-03-03 11:13:52.919
18	5	1	5		REWARD	2026-03-03 12:43:42.44
19	9	1	3		BONUS	2026-03-03 12:44:04.503
\.

-- student_balances: 21 qator
COPY student_balances (student_id, balance, debt, last_updated) FROM stdin;
2	0.00	0.00	2026-02-28 02:05:13.353
4	600000.00	0.00	2026-02-28 02:27:37.904
3	600000.00	0.00	2026-02-28 02:06:45.359
6	0.00	0.00	2026-02-28 09:14:54.756
7	0.00	0.00	2026-02-28 09:17:01.408
9	0.00	0.00	2026-02-28 09:25:13.554
10	0.00	0.00	2026-02-28 09:27:05.151
11	0.00	0.00	2026-02-28 09:33:30.308
12	0.00	0.00	2026-02-28 09:34:58.402
13	0.00	0.00	2026-02-28 09:36:28.429
14	0.00	0.00	2026-02-28 09:37:51.615
16	0.00	0.00	2026-02-28 09:40:03.847
18	0.00	0.00	2026-02-28 09:42:30.869
20	0.00	0.00	2026-02-28 09:45:57.998
21	0.00	0.00	2026-02-28 09:48:15.835
8	660000.00	0.00	2026-02-28 09:23:48.618
17	650000.00	0.00	2026-02-28 09:41:37.139
19	600000.00	0.00	2026-02-28 09:43:22.685
5	600000.00	0.00	2026-02-28 09:13:31.846
15	660000.00	0.00	2026-02-28 09:39:01.542
22	600000.00	0.00	2026-03-03 11:12:19.062
\.

-- teacher_salaries: 2 qator
COPY teacher_salaries (id, teacher_id, month, total_hours, students_revenue, calculated_salary, paid_salary, status, paid_at) FROM stdin;
1	2	2026-01-31	0.00	0.00	200000.00	200000.00	PAID	2026-02-28 10:09:47.104
2	1	2026-01-31	0.00	0.00	600000.00	600000.00	PAID	2026-02-28 15:41:06.311
\.

-- Sequence'larni yangilash
SELECT setval('users_id_seq', 43, true);
SELECT setval('courses_id_seq', 3, true);
SELECT setval('teachers_id_seq', 3, true);
SELECT setval('students_id_seq', 22, true);
SELECT setval('groups_id_seq', 8, true);
SELECT setval('group_students_id_seq', 25, true);
SELECT setval('schedules_id_seq', 9, true);
SELECT setval('lessons_id_seq', 11, true);
SELECT setval('attendance_id_seq', 15, true);
SELECT setval('grades_id_seq', 3, true);
SELECT setval('payments_id_seq', 10, true);
SELECT setval('expenses_id_seq', 2, true);
SELECT setval('coin_transactions_id_seq', 19, true);
SELECT setval('teacher_salaries_id_seq', 2, true);

COMMIT;