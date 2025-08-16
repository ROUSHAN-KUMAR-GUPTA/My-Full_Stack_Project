import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mandodesk';

const ensureUser = async (name, email, password, role) => {
  let u = await User.findOne({ email });
  if (u) { console.log(`✔ ${role} exists:`, email); return u; }
  const hash = await bcrypt.hash(password, 10);
  u = await User.create({ name, email, password: hash, role });
  console.log(`➕ Created ${role}:`, email);
  return u;
};

const run = async () => {
  await mongoose.connect(uri);
  await ensureUser('Admin', process.env.ADMIN_EMAIL || 'admin@mandodesk.dev', process.env.ADMIN_PASSWORD || 'admin123', 'admin');
  await ensureUser('Agent One', process.env.AGENT_EMAIL || 'agent@mandodesk.dev', process.env.AGENT_PASSWORD || 'agent123', 'agent');
  await ensureUser('Demo Customer', process.env.CUSTOMER_EMAIL || 'customer@mandodesk.dev', process.env.CUSTOMER_PASSWORD || 'customer123', 'customer');
  await mongoose.disconnect();
};

run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
