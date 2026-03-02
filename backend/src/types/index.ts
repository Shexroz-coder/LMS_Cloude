import { Role } from '@prisma/client';
import { Request } from 'express';

// Authenticated request type
export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: Role;
    phone: string;
  };
}

// JWT Payload
export interface JwtPayload {
  userId: number;
  role: Role;
  phone: string;
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

// Pagination
export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Finance summary
export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  totalSalaries: number;
  netProfit: number;
  totalDebt: number;
  studentsCount: number;
  teachersCount: number;
}
