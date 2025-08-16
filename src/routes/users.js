import express from 'express';
import User from '../models/User.js';
import { auth, hasRole } from '../middleware/auth.js';
const router = express.Router();

// List users optionally filtered by role (admin only)
router.get('/', auth, hasRole('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    const q = role ? { role } : {};
    const users = await User.find(q).select('_id name email role').sort({ name: 1 });
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
