const Test = require('../models/Test');

const create = (data) => Test.create(data);
const findById = (id) => Test.findById(id);
const listActive = () => Test.find({ isActive: true }).sort({ title: 1 });
const save = (doc) => doc.save();

async function list({ skip, limit }) {
  const [items, total] = await Promise.all([Test.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Test.countDocuments()]);
  return { items, total };
}

module.exports = { create, findById, listActive, list, save };
