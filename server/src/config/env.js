import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn(`[env] Missing variables: ${missing.join(', ')} — check server/.env`);
}

// CLIENT_URL may hold one or many comma-separated origins. Entries without a
// scheme are assumed https (so "site.netlify.app" → "https://site.netlify.app").
const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
  .map((s) => s.replace(/\/+$/, ''));

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/travel_crm',
  jwtSecret: process.env.JWT_SECRET || 'insecure-dev-secret',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  clientUrls,
  clientUrl: clientUrls[0],
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  chromePath: process.env.CHROME_PATH || '',
  cloudinary: {
    // Either set CLOUDINARY_URL (cloudinary://key:secret@cloud) or the trio below.
    url: process.env.CLOUDINARY_URL || '',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  email: {
    host: process.env.EMAIL_HOST || '',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@andamantravelcare.com',
  },
};
