const mongoose = require('mongoose');

const departmentHistorySchema = new mongoose.Schema({
  fromDepartment: { type: String, default: '' },
  toDepartment: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  firstName: { type: String, trim: true, default: '' },
  lastName: { type: String, trim: true, default: '' },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: { type: String, trim: true, default: '' },
  employeeId: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['Employee', 'Manager', 'Admin'],
    default: 'Employee'
  },
  department: {
    type: String,
    default: 'General'
  },
  departmentHistory: { type: [departmentHistorySchema], default: [] },
  designation: { type: String, trim: true, default: '' },
  responsibilities: { type: String, trim: true, default: '' },
  team: { type: String, trim: true, default: '' },
  teams: { type: [String], default: [] },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Intern'],
    default: 'Full-time'
  },
  employmentStatus: {
    type: String,
    enum: ['Active', 'On Probation', 'Notice Period', 'Terminated'],
    default: 'Active'
  },
  dateOfBirth: { type: Date, default: null },
  joiningDate: { type: Date, default: null },
  profilePicture: { type: String, default: '' },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: { type: Boolean, default: false },
  credentialsSent: { type: Boolean, default: false },
  leaveBalance: {
    annual: { type: Number, default: 12 },
    sick: { type: Number, default: 6 },
    casual: { type: Number, default: 4 },
    maternity_paternity: { type: String, default: 'As applicable' },
    personal: { type: Number, default: 4 },
    other: { type: Number, default: 4 },
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
