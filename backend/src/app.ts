import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes';

const app = express();

// ── Xavfsizlik middleware'lari ─────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate Limiting ──────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 100, // 100 so'rov
  message: {
    success: false,
    message: 'Juda ko\'p so\'rov yuborildingiz. 15 daqiqadan so\'ng urinib ko\'ring.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Login uchun 10 urinish
  message: {
    success: false,
    message: 'Juda ko\'p kirish urinishlari. 15 daqiqadan so\'ng urinib ko\'ring.',
  },
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/', limiter);

// ── Body parsers ───────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Statik fayllar ─────────────────────────────
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads', {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// ── Health Check (Docker healthcheck uchun) ────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────
app.use('/api/v1', routes);

// ── Error handlers ─────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
