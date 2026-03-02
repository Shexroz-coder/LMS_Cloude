// =============================================
// Robotic Edu LMS — TypeScript Types
// =============================================

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
export type Language = 'uz' | 'ru';

export interface User {
  id: number;
  fullName: string;
  phone: string;
  email?: string;
  role: Role;
  avatarUrl?: string;
  language: Language;
  isActive: boolean;
  createdAt: string;
  student?: StudentInfo | null;
  teacher?: TeacherInfo | null;
}

export interface StudentInfo {
  id: number;
  coinBalance: number;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  parent?: { id: number; fullName: string; phone: string } | null;
}

export interface TeacherInfo {
  id: number;
  specialization?: string;
  salaryType?: 'PERCENTAGE_FROM_PAYMENT' | 'PER_LESSON_HOUR';
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Students
export interface Student {
  id: number;
  userId: number;
  parentId?: number;
  birthDate?: string;
  address?: string;
  coinBalance: number;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  notes?: string;
  user: User;
  parent?: User;
}

// Teachers
export interface Teacher {
  id: number;
  userId: number;
  salaryType?: 'PERCENTAGE_FROM_PAYMENT' | 'PER_LESSON_HOUR';
  salaryValue?: number;
  specialization?: string;
  bio?: string;
  user: User;
}

// Courses
export interface Course {
  id: number;
  name: string;
  description?: string;
  monthlyPrice: number;
  perLessonPrice?: number;
  durationMonths?: number;
  isActive: boolean;
  iconUrl?: string;
}

// Groups
export interface Group {
  id: number;
  name: string;
  courseId: number;
  teacherId: number;
  maxStudents: number;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  room?: string;
  course?: Course;
  teacher?: Teacher;
  _count?: { groupStudents: number };
}

// Lessons
export interface Lesson {
  id: number;
  groupId: number;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  homework?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  durationHours: number;
  group?: Group;
}

// Attendance
export interface Attendance {
  id: number;
  lessonId: number;
  studentId: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note?: string;
  markedAt: string;
  student?: Student;
}

// Grades
export interface Grade {
  id: number;
  studentId: number;
  lessonId: number;
  score: number;
  type: 'HOMEWORK' | 'CLASSWORK' | 'EXAM' | 'PROJECT';
  comment?: string;
  givenAt: string;
  lesson?: Lesson;
}

// Payments
export interface Payment {
  id: number;
  studentId: number;
  amount: number;
  month: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'ONLINE';
  status: 'PAID' | 'PARTIAL' | 'PENDING';
  paidAt: string;
  receiptNumber?: string;
  note?: string;
  student?: Student;
}

// Student Balance
export interface StudentBalance {
  studentId: number;
  balance: number;
  debt: number;
  lastUpdated: string;
}

// Monthly Fee
export interface MonthlyFee {
  id: number;
  studentId: number;
  groupId: number;
  month: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  lessonsCount: number;
  attendedCount: number;
}

// Coin Transaction
export interface CoinTransaction {
  id: number;
  studentId: number;
  givenBy?: number;
  amount: number;
  reason?: string;
  type: 'REWARD' | 'PENALTY' | 'BONUS' | 'EXCHANGE';
  createdAt: string;
  giver?: User;
}

// Notification
export interface Notification {
  id: number;
  userId: number;
  title: string;
  body: string;
  type: 'PAYMENT' | 'ATTENDANCE' | 'GRADE' | 'ANNOUNCEMENT' | 'COIN' | 'SYSTEM';
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

// Chat & Message
export interface Chat {
  id: number;
  type: 'DIRECT' | 'GROUP' | 'ANNOUNCEMENT';
  name?: string;
  groupId?: number;
  createdAt: string;
  participants?: User[];
  lastMessage?: Message;
}

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  content?: string;
  fileUrl?: string;
  isRead: boolean;
  createdAt: string;
  sender?: User;
}

// Finance
export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  totalSalaries: number;
  netProfit: number;
  totalDebt: number;
  studentsCount: number;
  teachersCount: number;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  date: string;
  description?: string;
  addedBy?: number;
}

export interface TeacherSalary {
  id: number;
  teacherId: number;
  month: string;
  totalHours: number;
  studentsRevenue: number;
  calculatedSalary: number;
  paidSalary: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL';
  paidAt?: string;
  teacher?: Teacher;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}
