import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import './models/index.js'; // register all Mongoose schemas
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    // Allow whitelisted origins; permit requests with no Origin (curl, server-to-server).
    // Disallowed origins simply get no CORS headers (browser blocks) rather than a 500.
    origin(origin, cb) {
      cb(null, !origin || env.clientUrls.includes(origin));
    },
    credentials: true,
  })
);
// 8mb: org-profile brand images travel as base64 data URIs in JSON.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

// Basic rate limit on the API surface
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// PDF rendering depends on a system Chrome/Chromium binary (puppeteer-core
// bundles none). This reports whether one was found and whether it actually
// launches — so a failing deploy says why instead of "Could not generate the PDF".
app.get('/health/pdf', async (req, res) => {
  const { findChrome, htmlToPdf } = await import('./pdf/renderPdf.js');
  const executablePath = findChrome();
  if (!executablePath) {
    return res.status(503).json({ ok: false, stage: 'find', message: 'No Chrome/Chromium found on this server.' });
  }
  try {
    const pdf = await htmlToPdf('<!doctype html><html><body><h1>ok</h1></body></html>');
    return res.json({ ok: true, executablePath, bytes: pdf.length });
  } catch (err) {
    return res.status(500).json({ ok: false, stage: 'launch', executablePath, message: err.message });
  }
});

app.use('/api', apiRouter);

// In production, serve the built client (client/dist) with an SPA fallback.
if (env.isProd) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.use(notFoundHandler);
}

app.use(errorHandler);

export default app;
