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
    name: 'Dev Malhotra',
    email: 'recruiter3@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Zenith Systems', companyDescription: 'Enterprise software and IoT products for manufacturing plants across western India.', website: 'https://zenithsystems.example.com' },
  },
  {
    name: 'Ananya Reddy',
    email: 'recruiter4@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Kestrel Labs', companyDescription: 'Deep-tech lab building high-performance infrastructure and developer tooling.', website: 'https://kestrellabs.example.com' },
  },
  {
    name: 'Dr. Sameer Kulkarni',
    email: 'recruiter5@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Aurora Health Tech', companyDescription: 'Digital health platform connecting clinics, labs and patients across 120 hospitals.', website: 'https://aurorahealthtech.example.com' },
  },
  {
    name: 'Isha Kapoor',
    email: 'recruiter6@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Bluepeak Capital', companyDescription: 'Boutique investment and advisory firm covering equities, credit and risk.', website: 'https://bluepeakcapital.example.com' },
  },
  {
    name: 'Vikram Rao',
    email: 'recruiter7@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Cobalt Robotics', companyDescription: 'Autonomous warehouse robots and the control software that runs them.', website: 'https://cobaltrobotics.example.com' },
  },
  {
    name: 'Meera Iyer',
    email: 'recruiter8@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Lumen Analytics', companyDescription: 'Analytics consultancy turning retail and telecom data into decisions.', website: 'https://lumenanalytics.example.com' },
  },
  {
    name: 'Sanjay Pillai',
    email: 'recruiter9@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Saffron Commerce', companyDescription: 'D2C and marketplace commerce brand with a fast-growing online storefront.', website: 'https://saffroncommerce.example.com' },
  },
  {
    name: 'Tanvi Bhatt',
    email: 'recruiter10@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Tessera Security', companyDescription: 'Managed security provider protecting banks and SaaS companies from threats.', website: 'https://tesserasecurity.example.com' },
  },
  {
    name: 'Rahul Joshi',
    email: 'recruiter11@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Meridian Cloud', companyDescription: 'Cloud consultancy running Kubernetes platforms for scale-ups.', website: 'https://meridiancloud.example.com' },
  },
  {
    name: 'Priya Menon',
    email: 'recruiter12@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Quantum Leaf AI', companyDescription: 'Applied AI start-up shipping vision and language models to enterprises.', website: 'https://quantumleafai.example.com' },
  },
  {
    name: 'Karan Bedi',
    email: 'recruiter13@ipp.demo',
    role: 'recruiter',
    profile: { companyName: 'Harbor Media', companyDescription: 'Digital media house producing video, podcasts and brand content.', website: 'https://harbormedia.example.com' },
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
  ['recruiter3@ipp.demo', 'Java Backend Intern', 'Software Development', 'Pune', 22000, 6, ['Java', 'Spring Boot', 'SQL'], 38],
  ['recruiter4@ipp.demo', 'Systems Programming Intern', 'Software Development', 'Hyderabad', 27000, 5, ['C++', 'Linux', 'Concurrency'], 42],
  ['recruiter11@ipp.demo', 'Site Reliability Intern', 'Cloud & DevOps', 'Hyderabad', 24000, 6, ['Kubernetes', 'Prometheus', 'Linux'], 33],
  ['recruiter11@ipp.demo', 'Kubernetes Platform Intern', 'Cloud & DevOps', 'Remote', 21000, 3, ['Kubernetes', 'Helm', 'Go'], 27],
  ['recruiter8@ipp.demo', 'Business Intelligence Intern', 'Data Science', 'Delhi', 17000, 3, ['Power BI', 'SQL', 'Excel'], 24],
  ['recruiter8@ipp.demo', 'Data Engineering Intern', 'Data Science', 'Remote', 23000, 4, ['Python', 'Airflow', 'Spark'], 36],
  ['recruiter5@ipp.demo', 'Healthcare Data Intern', 'Data Science', 'Bengaluru', 20000, 3, ['Python', 'Pandas', 'Statistics'], 29],
  ['recruiter12@ipp.demo', 'Computer Vision Intern', 'AI / Machine Learning', 'Bengaluru', 38000, 6, ['PyTorch', 'OpenCV', 'Python'], 47],
  ['recruiter12@ipp.demo', 'Generative AI Prototyping Intern', 'AI / Machine Learning', 'Remote', 40000, 4, ['LLMs', 'Python', 'Prompting'], 31],
  ['recruiter10@ipp.demo', 'Penetration Testing Intern', 'Cybersecurity', 'Bengaluru', 25000, 3, ['Burp Suite', 'OWASP', 'Linux'], 26],
  ['recruiter10@ipp.demo', 'Cloud Security Intern', 'Cybersecurity', 'Remote', 26000, 4, ['AWS', 'IAM', 'Networking'], 39],
  ['recruiter9@ipp.demo', 'Frontend Developer Intern', 'Web Development', 'Chennai', 14000, 3, ['React', 'TypeScript', 'CSS'], 34],
  ['recruiter9@ipp.demo', 'Shopify Storefront Intern', 'Web Development', 'Chennai', 12000, 2, ['Shopify', 'Liquid', 'JavaScript'], 21],
  ['recruiter13@ipp.demo', 'Web Experience Intern', 'Web Development', 'Mumbai', 13000, 3, ['HTML', 'CSS', 'Animation'], 44],
  ['recruiter13@ipp.demo', 'Visual Design Intern', 'UI / UX Design', 'Mumbai', 14000, 2, ['Illustrator', 'Figma', 'Typography'], 23],
  ['recruiter5@ipp.demo', 'Healthcare UX Research Intern', 'UI / UX Design', 'Bengaluru', 17000, 3, ['User Research', 'Figma', 'Accessibility'], 32],
  ['recruiter4@ipp.demo', 'Flutter Developer Intern', 'Mobile Development', 'Hyderabad', 22000, 4, ['Flutter', 'Dart', 'Firebase'], 37],
  ['recruiter13@ipp.demo', 'Content & Social Media Intern', 'Business & Marketing', 'Mumbai', 9000, 2, ['Writing', 'Instagram', 'Canva'], 19],
  ['recruiter9@ipp.demo', 'Digital Marketing Intern', 'Business & Marketing', 'Chennai', 10000, 3, ['SEO', 'Google Ads', 'Analytics'], 30],
  ['recruiter8@ipp.demo', 'Business Development Intern', 'Business & Marketing', 'Delhi', 11000, 3, ['Outreach', 'CRM', 'Presentations'], 25],
  ['recruiter7@ipp.demo', 'Robotics Software Intern', 'Core Engineering', 'Pune', 20000, 6, ['ROS', 'C++', 'Python'], 46],
  ['recruiter7@ipp.demo', 'Mechatronics Design Intern', 'Core Engineering', 'Pune', 15000, 4, ['CAD', 'Sensors', 'Arduino'], 41],
  ['recruiter3@ipp.demo', 'IoT Firmware Intern', 'Core Engineering', 'Pune', 18000, 5, ['C', 'MQTT', 'ESP32'], 35],
  ['recruiter6@ipp.demo', 'Equity Research Intern', 'Finance', 'Mumbai', 15000, 3, ['Valuation', 'Excel', 'Financial Modelling'], 28],
  ['recruiter6@ipp.demo', 'Risk Analytics Intern', 'Finance', 'Delhi', 16000, 2, ['Python', 'Statistics', 'Excel'], 18],
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
