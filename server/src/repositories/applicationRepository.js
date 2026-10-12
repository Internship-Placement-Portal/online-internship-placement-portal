const Application = require('../models/Application');

const create = (data) => Application.create(data);
const findById = (id) => Application.findById(id);
const findByIdWithResume = (id) => Application.findById(id).select('+resumeKey');
const exists = (student, listing) => Application.exists({ student, listing });

async function listForStudent(student, { skip, limit }) {
  const [items, total] = await Promise.all([
    Application.find({ student })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('listing', 'title company location deadline status stipend duration domain')
      .lean(),
    Application.countDocuments({ student }),
  ]);
  return { items, total };
}

async function listForListing(listing, { status }, { skip, limit }) {
  const filter = { listing, ...(status && { status }) };
  const [items, total] = await Promise.all([
    Application.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('student', 'name email profile').lean(),
    Application.countDocuments(filter),
  ]);
  return { items, total };
}

const save = (doc) => doc.save();

module.exports = { create, findById, findByIdWithResume, exists, listForStudent, listForListing, save };
