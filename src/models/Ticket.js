import mongoose from 'mongoose';
const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['Open','In Progress','Resolved','Closed'], default: 'Open' },
  priority: { type: String, enum: ['Low','Medium','High'], default: 'Medium' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date },
  comments: [commentSchema]
}, { timestamps: true });

// track closedAt when status changes to Resolved/Closed
ticketSchema.pre('save', function(next){
  if ((this.isModified('status') || this.isNew) && (this.status === 'Resolved' || this.status === 'Closed')) {
    this.closedAt = this.closedAt || new Date();
  }
  next();
});

export default mongoose.model('Ticket', ticketSchema);
