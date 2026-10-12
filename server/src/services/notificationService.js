const AppError = require('../utils/AppError');
const { parsePaging, pageResult } = require('../utils/pagination');
const notificationRepository = require('../repositories/notificationRepository');
const userRepository = require('../repositories/userRepository');
const mailer = require('./mailer');

const dto = (n) => ({ id: String(n._id), type: n.type, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt });

// IPP-F-012: create the in-app notification immediately, then email (with retry/backoff) without blocking the caller on failure.
async function notify({ userId, type, message, link, emailSubject }) {
  await notificationRepository.create({ user: userId, type, message, link });
  const user = await userRepository.findById(userId);
  if (user) await mailer.sendWithRetry({ to: user.email, subject: emailSubject || message, text: message });
}

async function list(user, query) {
  const paging = parsePaging(query, { defaultLimit: 15, maxLimit: 50 });
  const { items, total, unread } = await notificationRepository.listForUser(user._id, { unreadOnly: query.unread === true }, paging);
  return { ...pageResult(items.map(dto), total, paging), unread };
}

async function markRead(user, id) {
  const n = await notificationRepository.markRead(id, user._id);
  if (!n) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  return dto(n);
}

async function markAllRead(user) {
  await notificationRepository.markAllRead(user._id);
  return { status: 'ok' };
}

module.exports = { notify, list, markRead, markAllRead };
