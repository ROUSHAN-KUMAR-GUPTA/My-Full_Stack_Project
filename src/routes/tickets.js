import express from 'express';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import { auth, hasRole } from '../middleware/auth.js';
const router = express.Router();

// Create ticket (customer)
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const ticket = await Ticket.create({
      title, description, priority: priority || 'Medium', createdBy: req.user._id
    });
    res.status(201).json(ticket);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tickets (role-based)
router.get('/', auth, async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'customer') {
      q.createdBy = req.user._id;
    } else if (req.user.role === 'agent') {
      q.assignedTo = req.user._id;
    }
    const tickets = await Ticket.find(q)
      .populate('createdBy','name email role')
      .populate('assignedTo','name email role')
      .sort({createdAt:-1});
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get one ticket
router.get('/:id', auth, async (req, res) => {
  try {
    const t = await Ticket.findById(req.params.id)
      .populate('createdBy','name email role')
      .populate('assignedTo','name email role');
    if (!t) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'customer' && String(t.createdBy._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (req.user.role === 'agent' && t.assignedTo && String(t.assignedTo._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(t);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update ticket (assign/status) - agent/admin
router.put('/:id', auth, hasRole('agent','admin'), async (req, res) => {
  try {
    const { status, assignedTo } = req.body;
    const update = {};
    if (status) update.status = status;
    if (assignedTo) update.assignedTo = assignedTo;
    const t = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(t);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const t = await Ticket.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    const allowed = String(t.createdBy) === String(req.user._id) ||
      (t.assignedTo && String(t.assignedTo) === String(req.user._id)) ||
      req.user.role === 'admin' || req.user.role === 'agent';
    if (!allowed) return res.status(403).json({ message: 'Forbidden' });
    t.comments.push({ user: req.user._id, message });
    await t.save();
    res.status(201).json(t);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Stats for admin
router.get('/__stats/summary', auth, hasRole('admin'), async (req, res) => {
  try {
    const tickets = await Ticket.find({});
    const byStatus = { Open:0, 'In Progress':0, Resolved:0, Closed:0 };
    const byAgent = {};
    let totalResolutionMs = 0, resolvedCount = 0;
    tickets.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      if (t.assignedTo) {
        const key = String(t.assignedTo);
        byAgent[key] = (byAgent[key] || 0) + 1;
      }
      if ((t.status === 'Resolved' || t.status === 'Closed') && t.closedAt) {
        totalResolutionMs += (t.closedAt.getTime() - t.createdAt.getTime());
        resolvedCount += 1;
      }
    });
    // expand agent IDs to names
    const agentIds = Object.keys(byAgent);
    const agents = await User.find({ _id: { $in: agentIds } }).select('_id name');
    const map = Object.fromEntries(agents.map(a => [String(a._id), a.name]));
    const byAgentNamed = Object.fromEntries(Object.entries(byAgent).map(([id, c]) => [map[id] || id, c]));
    const avgResolutionTimeHours = resolvedCount ? (totalResolutionMs / resolvedCount) / (1000*60*60) : 0;
    res.json({ byStatus, byAgent: byAgentNamed, avgResolutionHours: Number(avgResolutionTimeHours.toFixed(2)) });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
