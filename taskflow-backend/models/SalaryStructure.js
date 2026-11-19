const mongoose = require('mongoose');

const allowanceItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0, default: 0 }
}, { _id: false });

const deductionItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0, default: 0 },
  type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' }
}, { _id: false });

const bankDetailsSchema = new mongoose.Schema({
  accountHolderName: { type: String, trim: true, default: '' },
  accountNumber: { type: String, trim: true, default: '' },
  ifsc: { type: String, trim: true, uppercase: true, default: '' },
  bankName: { type: String, trim: true, default: '' },
  upiId: { type: String, trim: true, default: '' }
}, { _id: false });

const salaryStructureSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  basicSalary: {
    type: Number,
    required: true,
    min: 0,
    default: 30000
  },
  allowances: {
    type: [allowanceItemSchema],
    default: [
      { name: 'House Rent Allowance (HRA)', amount: 12000 },
      { name: 'Special Allowance', amount: 5000 },
      { name: 'Conveyance Allowance', amount: 2000 },
      { name: 'Medical Allowance', amount: 1500 }
    ]
  },
  bonus: {
    type: Number,
    min: 0,
    default: 0
  },
  deductions: {
    type: [deductionItemSchema],
    default: [
      { name: 'Provident Fund (PF)', amount: 1800, type: 'fixed' },
      { name: 'Professional Tax (PT)', amount: 200, type: 'fixed' },
      { name: 'TDS / Income Tax', amount: 0, type: 'fixed' }
    ]
  },
  bankDetails: {
    type: bankDetailsSchema,
    default: () => ({})
  },
  paymentSchedule: {
    type: String,
    enum: ['monthly', 'bi-weekly', 'last_day'],
    default: 'monthly'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);
