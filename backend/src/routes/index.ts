import { Router } from 'express';
import authRoutes from './auth.routes';
import studentRoutes from './student.routes';
import groupRoutes from './group.routes';
import teacherRoutes from './teacher.routes';
import courseRoutes from './course.routes';
import paymentRoutes from './payment.routes';
import attendanceRoutes from './attendance.routes';
import dashboardRoutes from './dashboard.routes';
import coinRoutes from './coin.routes';
import gradeRoutes from './grade.routes';
import announcementRoutes from './announcement.routes';
import notificationRoutes from './notification.routes';
import salaryRoutes from './salary.routes';
import expenseRoutes from './expense.routes';
import lessonRoutes from './lesson.routes';
import chatRoutes from './chat.routes';
import aiAssistantRoutes from './ai-assistant.routes';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: '🤖 Robotic Edu LMS API — ishlayapti!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/students', authenticate, studentRoutes);
router.use('/groups', authenticate, groupRoutes);
router.use('/teachers', authenticate, teacherRoutes);
router.use('/courses', authenticate, courseRoutes);
router.use('/payments', authenticate, paymentRoutes);
router.use('/attendance', authenticate, attendanceRoutes);
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/coins', authenticate, coinRoutes);
router.use('/grades', authenticate, gradeRoutes);
router.use('/announcements', authenticate, announcementRoutes);
router.use('/notifications', authenticate, notificationRoutes);
router.use('/salaries', authenticate, salaryRoutes);
router.use('/expenses', authenticate, expenseRoutes);
router.use('/lessons', authenticate, lessonRoutes);
router.use('/chats', authenticate, chatRoutes);
router.use('/ai-assistant', authenticate, aiAssistantRoutes);

export default router;
