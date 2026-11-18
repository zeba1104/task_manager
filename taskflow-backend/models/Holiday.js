const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'Holiday date (YYYY-MM-DD) is required'],
      trim: true,
      index: true,
    },
    day: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['National Holiday', 'Gazetted Holiday', 'Restricted Holiday', 'Public Holiday', 'Company Holiday'],
      default: 'Gazetted Holiday',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isMandatory: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate holiday dates with identical names
holidaySchema.index({ date: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
