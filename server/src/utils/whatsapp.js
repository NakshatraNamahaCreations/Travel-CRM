import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

// Gallabox WhatsApp Business API (per their Postman docs):
//   POST https://server.gallabox.com/devapi/messages/whatsapp
//   headers: apiKey, apiSecret
//   body: { channelId, channelType: 'whatsapp', recipient: { name, phone },
//           whatsapp: { type: 'text', text: { body } } }
// Note: free-form ("session") messages deliver only inside WhatsApp's 24-hour
// customer-service window; first-contact messages need an approved template.
const GALLABOX_URL = 'https://server.gallabox.com/devapi/messages/whatsapp';

export const whatsappEnabled = () =>
  !!(env.gallabox.apiKey && env.gallabox.apiSecret && env.gallabox.channelId);

// "+91 98765 43210" → "919876543210"; bare 10-digit numbers get India's 91.
export const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
};

async function postGallabox(payload) {
  if (!whatsappEnabled()) {
    throw ApiError.badRequest('WhatsApp API is not configured. Set GALLABOX_API_KEY / GALLABOX_API_SECRET / GALLABOX_CHANNEL_ID in server/.env');
  }
  const res = await fetch(GALLABOX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apiKey: env.gallabox.apiKey,
      apiSecret: env.gallabox.apiSecret,
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = data?.message || data?.error || `WhatsApp API error (HTTP ${res.status})`;
    throw ApiError.badRequest(`WhatsApp send failed: ${msg}`);
  }
  return { id: data?.id || data?.messageId || null, status: data?.status || 'accepted' };
}

export async function sendWhatsAppText({ phone, name, text }) {
  const to = normalizePhone(phone);
  if (!to) throw ApiError.badRequest('A valid WhatsApp phone number is required');
  if (!String(text || '').trim()) throw ApiError.badRequest('Nothing to send');

  const result = await postGallabox({
    channelId: env.gallabox.channelId,
    channelType: 'whatsapp',
    recipient: { name: name || 'Guest', phone: to },
    whatsapp: { type: 'text', text: { body: text } },
  });
  return { to, ...result };
}

// Sends a pre-approved WhatsApp template (required for first-contact / any
// message outside the 24-hour session window). `templateName` must match a
// template already created + approved in the Gallabox dashboard; bodyValues
// keys must match that template's {{VariableName}} placeholders exactly.
export async function sendWhatsAppTemplate({ phone, name, templateName, bodyValues }) {
  const to = normalizePhone(phone);
  if (!to) throw ApiError.badRequest('A valid WhatsApp phone number is required');
  if (!String(templateName || '').trim()) throw ApiError.badRequest('A template name is required');

  const result = await postGallabox({
    channelId: env.gallabox.channelId,
    channelType: 'whatsapp',
    recipient: { name: name || 'Guest', phone: to },
    whatsapp: {
      type: 'template',
      template: { templateName, bodyValues: bodyValues || {} },
    },
  });
  return { to, ...result };
}
