import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Global error handler
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Error:', err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Prisma unique constraint error
  if (err.message.includes('Unique constraint')) {
    res.status(409).json({
      success: false,
      message: 'Bu ma\'lumot allaqachon mavjud.',
    });
    return;
  }

  // Default server error
  res.status(500).json({
    success: false,
    message: 'Server xatosi yuz berdi. Iltimos, qayta urinib ko\'ring.',
  });
};

// 404 handler
export const notFoundHandler = (
  req: Request,
  res: Response
): void => {
  res.status(404).json({
    success: false,
    message: `Yo'l topilmadi: ${req.method} ${req.originalUrl}`,
  });
};
