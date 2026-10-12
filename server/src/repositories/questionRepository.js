const Question = require('../models/Question');
const { escapeRegex } = require('../utils/pagination');

const create = (data) => Question.create(data);
const findByIdWithKey = (id) => Question.findById(id).select('+correctIndex');
const findByIdsWithKey = (ids) => Question.find({ _id: { $in: ids } }).select('+correctIndex');
const findByIds = (ids) => Question.find({ _id: { $in: ids } });
const save = (doc) => doc.save();
const remove = (id) => Question.deleteOne({ _id: id });

// Ids of active questions eligible for a test (optionally restricted to categories).
const poolIds = async (categories) => {
  const filter = { active: true, ...(categories?.length && { category: { $in: categories } }) };
  return (await Question.find(filter).select('_id').lean()).map((q) => q._id);
};

async function list({ q, category, type, difficulty, active }, { skip, limit }) {
  const filter = {};
  if (q) filter.text = new RegExp(escapeRegex(q), 'i');
  if (category) filter.category = category;
  if (type) filter.type = type;
  if (difficulty) filter.difficulty = difficulty;
  if (active !== undefined) filter.active = active;
  const [items, total] = await Promise.all([
    Question.find(filter).select('+correctIndex').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Question.countDocuments(filter),
  ]);
  return { items, total };
}

const categories = () => Question.distinct('category');

module.exports = { create, findByIdWithKey, findByIdsWithKey, findByIds, save, remove, poolIds, list, categories };
