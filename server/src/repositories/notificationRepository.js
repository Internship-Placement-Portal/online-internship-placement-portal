const Notification = require('../models/Notification');

const create = (data) => Notification.create(data);

async function listForUser(user, { unreadOnly }, { skip, limit }) {
  const filter = { user, ...(unreadOnly && { read: false }) };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user, read: false }),
  ]);
  return { items, total, unread };
}

const markRead = (id, user) => Notification.findOneAndUpdate({ _id: id, user }, { read: true }, { returnDocument: 'after' });
const markAllRead = (user) => Notification.updateMany({ user, read: false }, { read: true });

module.exports = { create, listForUser, markRead, markAllRead };
