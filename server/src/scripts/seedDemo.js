// Idempotent demo data: verified demo accounts + a catalogue of approved internship listings.
// Usage: npm run seed:demo   (also ensures the admin from ADMIN_EMAIL / ADMIN_PASSWORD exists)
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDb } = require('../config/db');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Question = require('../models/Question');
const Test = require('../models/Test');
const bank = require('./data/questionBank');
const { seedHistory } = require('./seedHistory');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';

const accounts = [
  { name: 'Placement Officer', email: process.env.ADMIN_EMAIL || 'admin@ipp.local', role: 'admin', password: process.env.ADMIN_PASSWORD },
  {
    name: 'Riya Sharma',
    email: 'recruiter@ipp.demo',
    role: 'recruiter',
    profile: {
      companyName: 'Nimbus Technologies',
      companyDescription: 'Nimbus builds cloud-native logistics software used by 400+ retailers across India.',
      website: 'https://nimbus.example.com',
    },
  },
  {
    name: 'Arjun Mehta',
    email: 'recruiter2@ipp.demo',
    role: 'recruiter',
    profile: {
      companyName: 'Pixel & Pine Studio',
      companyDescription: 'A design-led product studio crafting mobile apps for fintech and health start-ups.',
      website: 'https://pixelpine.example.com',
    },
  },
  {
    name: 'Neha Verma',
    email: 'pending.recruiter@ipp.demo',
    role: 'recruiter',
    approvalStatus: 'pending',
    profile: { companyName: 'Orbit Analytics', companyDescription: 'Analytics consultancy (awaiting approval).' },
  },
  {
    name: 'Kavya Nair',
    email: 'student@ipp.demo',
    role: 'student',
    profile: { college: 'PES University', branch: 'Computer Science', graduationYear: 2027, skills: ['JavaScript', 'Python', 'SQL'] },
  },
  {
    name: 'Rohan Das',
    email: 'student2@ipp.demo',
    role: 'student',
    profile: { college: 'PES University', branch: 'Electronics', graduationYear: 2027, skills: ['C', 'Embedded'] },
  },
];

const inDays = (n) => new Date(`${new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)}T23:59:59.999Z`);

const listings = [
  ['recruiter@ipp.demo', 'Backend Engineering Intern', 'Software Development', 'Bengaluru', 25000, 6, ['Node.js', 'MongoDB', 'REST'], 40],
  ['recruiter@ipp.demo', 'Cloud & DevOps Intern', 'Cloud & DevOps', 'Remote', 20000, 4, ['AWS', 'Docker', 'CI/CD'], 25],
  ['recruiter@ipp.demo', 'Data Analyst Intern', 'Data Science', 'Hyderabad', 18000, 3, ['Python', 'SQL', 'Tableau'], 30],
  ['recruiter@ipp.demo', 'Machine Learning Research Intern', 'AI / Machine Learning', 'Bengaluru', 35000, 6, ['PyTorch', 'NLP', 'Python'], 50],
  ['recruiter@ipp.demo', 'Security Operations Intern', 'Cybersecurity', 'Pune', 22000, 3, ['Networking', 'SIEM', 'Linux'], 20],
  ['recruiter@ipp.demo', 'Full Stack Web Intern', 'Web Development', 'Chennai', 15000, 3, ['React', 'Node.js', 'CSS'], 35],
  ['recruiter2@ipp.demo', 'Product Design Intern', 'UI / UX Design', 'Mumbai', 16000, 3, ['Figma', 'Prototyping', 'Research'], 28],
  ['recruiter2@ipp.demo', 'Android Developer Intern', 'Mobile Development', 'Bengaluru', 24000, 5, ['Kotlin', 'Jetpack Compose'], 45],
  ['recruiter2@ipp.demo', 'iOS Developer Intern', 'Mobile Development', 'Remote', 26000, 6, ['Swift', 'SwiftUI'], 15],
  ['recruiter2@ipp.demo', 'Growth Marketing Intern', 'Business & Marketing', 'Delhi', 10000, 2, ['SEO', 'Analytics', 'Copywriting'], 22],
  ['recruiter2@ipp.demo', 'Embedded Systems Intern', 'Core Engineering', 'Pune', 12000, 4, ['C', 'RTOS', 'Microcontrollers'], 60],
  ['recruiter2@ipp.demo', 'Financial Analyst Intern', 'Finance', 'Mumbai', 0, 2, ['Excel', 'Valuation'], 12],
];

const longText = (title, company) =>
  `${company} is looking for a motivated ${title.toLowerCase()} to join the team. You will work on real projects alongside experienced mentors, ` +
  'take ownership of well-scoped tasks, and present your work to the wider team at the end of the internship.\n\n' +
  'Responsibilities: contribute to day-to-day delivery, write clean and tested work, document what you build, and share progress in weekly reviews.';

(async () => {
  await connectDb();
  const byEmail = {};
  for (const a of accounts) {
    if (!a.password && a.role !== 'admin') a.password = DEMO_PASSWORD;
    let user = await User.findOne({ email: a.email.toLowerCase() });
    if (!user) {
      if (!a.password) {
        console.log(`skip ${a.email} (no ADMIN_PASSWORD set)`);
        continue;
      }
      user = await User.create({
        name: a.name,
        email: a.email,
        role: a.role,
        passwordHash: await bcrypt.hash(a.password, config.bcryptRounds),
        emailVerified: true,
        approvalStatus: a.approvalStatus || 'approved',
        profile: a.profile,
      });
      console.log(`created ${a.role}: ${a.email}`);
    }
    byEmail[a.email] = user;
  }

  const admin = byEmail[accounts[0].email];
  for (const [email, title, domain, location, stipend, duration, skills, days] of listings) {
    const recruiter = byEmail[email];
    if (!recruiter || (await Listing.exists({ recruiter: recruiter._id, title }))) continue;
    await Listing.create({
      recruiter: recruiter._id,
      title,
      company: recruiter.profile.companyName,
      description: longText(title, recruiter.profile.companyName),
      domain,
      location,
      stipend,
      duration,
      skills,
      eligibility: 'Pre-final or final year B.E./B.Tech/B.Sc students with a CGPA of 7.0 or above.',
      deadline: inDays(days),
      status: 'approved',
      approvedBy: admin?._id,
      reviewedAt: new Date(),
    });
    console.log(`created listing: ${title}`);
  }

  // Question bank + tests (IPP-F-014), created by the admin if present.
  let addedQuestions = 0;
  for (const q of bank.questions) {
    if (await Question.exists({ text: q.text })) continue;
    await Question.create({ ...q, createdBy: admin?._id });
    addedQuestions += 1;
  }
  for (const t of bank.tests) {
    if (!(await Test.exists({ title: t.title }))) await Test.create({ ...t, createdBy: admin?._id });
  }
  console.log(`questions added: ${addedQuestions}, tests: ${await Test.countDocuments()}`);

  const history = await seedHistory(DEMO_PASSWORD);
  console.log('history:', history.skipped ? 'already seeded' : JSON.stringify(history));

  console.log(`\nDemo password for non-admin accounts: ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
