const Holiday = require('../models/Holiday');

// Default initial government public holidays for 2026 and 2027
const DEFAULT_HOLIDAYS = [
  // 2026 Government Public Holidays
  { name: 'Republic Day', date: '2026-01-26', type: 'National Holiday', description: 'Celebration of the Constitution of India coming into effect' },
  { name: 'Maha Shivratri', date: '2026-02-15', type: 'Gazetted Holiday', description: 'Great night of Lord Shiva observance' },
  { name: 'Holi', date: '2026-03-03', type: 'Gazetted Holiday', description: 'Festival of colors and arrival of spring' },
  { name: 'Eid-ul-Fitr', date: '2026-03-20', type: 'Gazetted Holiday', description: 'Islamic festival marking the end of Ramadan' },
  { name: 'Good Friday', date: '2026-04-03', type: 'Gazetted Holiday', description: 'Christian holiday commemorating the crucifixion of Jesus' },
  { name: 'Dr. Ambedkar Jayanti', date: '2026-04-14', type: 'Gazetted Holiday', description: 'Birthday of Dr. B. R. Ambedkar, architect of the Indian Constitution' },
  { name: 'Mahavir Jayanti', date: '2026-04-30', type: 'Gazetted Holiday', description: 'Birth anniversary of Lord Mahavira' },
  { name: 'Maharashtra Day / Labor Day', date: '2026-05-01', type: 'Public Holiday', description: 'Statehood day of Maharashtra & International Workers Day' },
  { name: 'Buddha Purnima', date: '2026-05-31', type: 'Gazetted Holiday', description: 'Birth anniversary of Gautama Buddha' },
  { name: 'Eid al-Adha (Bakrid)', date: '2026-05-27', type: 'Gazetted Holiday', description: 'Feast of the Sacrifice' },
  { name: 'Muharram', date: '2026-06-26', type: 'Gazetted Holiday', description: 'First month of the Islamic calendar' },
  { name: 'Independence Day', date: '2026-08-15', type: 'National Holiday', description: 'Commemorating independence from British rule' },
  { name: 'Milad-un-Nabi (Id-e-Milad)', date: '2026-08-27', type: 'Gazetted Holiday', description: 'Observance of the birthday of the Islamic prophet Muhammad' },
  { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02', type: 'National Holiday', description: 'Birthday of Mahatma Gandhi, Father of the Nation' },
  { name: 'Dussehra (Vijayadashami)', date: '2026-10-20', type: 'Gazetted Holiday', description: 'Celebration of victory of good over evil' },
  { name: 'Diwali (Deepavali)', date: '2026-11-08', type: 'Gazetted Holiday', description: 'Festival of Lights' },
  { name: 'Guru Nanak Jayanti', date: '2026-11-24', type: 'Gazetted Holiday', description: 'Birth anniversary of Guru Nanak Dev Ji' },
  { name: 'Christmas Day', date: '2026-12-25', type: 'Gazetted Holiday', description: 'Christian holiday celebrating the birth of Jesus Christ' },

  // 2027 Government Public Holidays
  { name: 'Republic Day', date: '2027-01-26', type: 'National Holiday', description: 'Celebration of the Constitution of India coming into effect' },
  { name: 'Maha Shivratri', date: '2027-03-06', type: 'Gazetted Holiday', description: 'Great night of Lord Shiva observance' },
  { name: 'Eid-ul-Fitr', date: '2027-03-10', type: 'Gazetted Holiday', description: 'Islamic festival marking the end of Ramadan' },
  { name: 'Holi', date: '2027-03-22', type: 'Gazetted Holiday', description: 'Festival of colors' },
  { name: 'Good Friday', date: '2027-03-26', type: 'Gazetted Holiday', description: 'Commemoration of the crucifixion of Jesus' },
  { name: 'Dr. Ambedkar Jayanti', date: '2027-04-14', type: 'Gazetted Holiday', description: 'Birthday of Dr. B. R. Ambedkar' },
  { name: 'Mahavir Jayanti', date: '2027-04-19', type: 'Gazetted Holiday', description: 'Birth anniversary of Lord Mahavira' },
  { name: 'Labor Day', date: '2027-05-01', type: 'Public Holiday', description: 'International Workers Day' },
  { name: 'Eid al-Adha', date: '2027-05-17', type: 'Gazetted Holiday', description: 'Feast of the Sacrifice' },
  { name: 'Buddha Purnima', date: '2027-05-20', type: 'Gazetted Holiday', description: 'Birth anniversary of Gautama Buddha' },
  { name: 'Muharram', date: '2027-06-16', type: 'Gazetted Holiday', description: 'Islamic New Year observance' },
  { name: 'Independence Day', date: '2027-08-15', type: 'National Holiday', description: 'Indian Independence Day' },
  { name: 'Milad-un-Nabi', date: '2027-08-16', type: 'Gazetted Holiday', description: 'Birthday of Prophet Muhammad' },
  { name: 'Mahatma Gandhi Jayanti', date: '2027-10-02', type: 'National Holiday', description: 'Birthday of Mahatma Gandhi' },
  { name: 'Dussehra', date: '2027-10-10', type: 'Gazetted Holiday', description: 'Vijayadashami celebration' },
  { name: 'Diwali', date: '2027-10-29', type: 'Gazetted Holiday', description: 'Festival of Lights' },
  { name: 'Guru Nanak Jayanti', date: '2027-11-14', type: 'Gazetted Holiday', description: 'Birth anniversary of Guru Nanak' },
  { name: 'Christmas Day', date: '2027-12-25', type: 'Gazetted Holiday', description: 'Celebration of the birth of Jesus Christ' }
];

const seedHolidaysIfNeeded = async () => {
  try {
    const count = await Holiday.countDocuments();
    if (count === 0) {
      console.log('Seeding initial Government Holidays...');
      const docs = DEFAULT_HOLIDAYS.map((h) => {
        const d = new Date(h.date + 'T00:00:00');
        const day = d.toLocaleDateString('en-US', { weekday: 'long' });
        const year = d.getFullYear();
        return {
          ...h,
          day,
          year,
          isMandatory: true,
        };
      });
      await Holiday.insertMany(docs);
      console.log(`Successfully seeded ${docs.length} government holidays.`);
    }
  } catch (err) {
    console.error('Error auto-seeding holidays:', err.message);
  }
};

// Seed automatically on startup/import
seedHolidaysIfNeeded();

// GET all holidays with filtering
exports.getHolidays = async (req, res) => {
  try {
    await seedHolidaysIfNeeded();

    const { year, type, month, search } = req.query;
    const filter = {};

    if (year) {
      filter.year = Number(year);
    }
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (month) {
      // Month format: 'YYYY-MM' or '1'..'12'
      if (month.includes('-')) {
        filter.date = { $regex: `^${month}` };
      } else {
        const paddedMonth = String(month).padStart(2, '0');
        filter.date = { $regex: `-${paddedMonth}-` };
      }
    }
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET upcoming holiday relative to current date
exports.getUpcomingHoliday = async (req, res) => {
  try {
    await seedHolidaysIfNeeded();
    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = await Holiday.findOne({ date: { $gte: todayStr } }).sort({ date: 1 });
    res.json(upcoming || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create holiday (Admin only)
exports.createHoliday = async (req, res) => {
  try {
    const { name, date, type, description, isMandatory } = req.body;
    if (!name || !date) {
      return res.status(400).json({ message: 'Name and date are required.' });
    }

    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) {
      return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
    }

    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    const year = d.getFullYear();

    const existing = await Holiday.findOne({ date, name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'A holiday with this name and date already exists.' });
    }

    const holiday = await Holiday.create({
      name: name.trim(),
      date,
      day,
      year,
      type: type || 'Gazetted Holiday',
      description: description?.trim() || '',
      isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : true,
      createdBy: req.userId,
    });

    res.status(201).json(holiday);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT update holiday (Admin only)
exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, type, description, isMandatory } = req.body;

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found.' });
    }

    if (name) holiday.name = name.trim();
    if (type) holiday.type = type;
    if (description !== undefined) holiday.description = description.trim();
    if (isMandatory !== undefined) holiday.isMandatory = Boolean(isMandatory);

    if (date && date !== holiday.date) {
      const d = new Date(date + 'T00:00:00');
      if (isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid date format.' });
      }
      holiday.date = date;
      holiday.day = d.toLocaleDateString('en-US', { weekday: 'long' });
      holiday.year = d.getFullYear();
    }

    await holiday.save();
    res.json(holiday);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE holiday (Admin only)
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found.' });
    }
    res.json({ message: 'Holiday deleted successfully.', id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
