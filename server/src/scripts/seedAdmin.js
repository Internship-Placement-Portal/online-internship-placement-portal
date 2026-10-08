// Creates (or leaves untouched) the Placement Officer/Admin account. Admins cannot self-register (SAD 4.3).
// Usage: npm run seed:admin   (reads ADMIN_EMAIL / ADMIN_PASSWORD from .env)
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDb } = require('../config/db');
const userRepository = require('../repositories/userRepository');

(async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env');

  await connectDb();
  if (await userRepository.findByEmail(email)) {
    console.log(`Admin ${email} already exists, nothing to do.`);
  } else {
    await userRepository.create({
      name: 'Placement Officer',
      email,
      passwordHash: await bcrypt.hash(password, config.bcryptRounds),
      role: 'admin',
      emailVerified: true,
      approvalStatus: 'approved',
    });
    console.log(`Admin ${email} created.`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
