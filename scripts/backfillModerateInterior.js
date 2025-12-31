// One-off script to update existing Package documents named 'Moderate' to have interiorCleaning set to '0 per month'
// Usage: node scripts/backfillModerateInterior.js

const mongoose = require('mongoose');
const Package = require('../models/Package');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const res = await Package.updateMany({ name: 'Moderate' }, { $set: { interiorCleaning: '0 per month' } });
    console.log('Update result:', res.nModified, 'documents modified');

    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error('Error in backfill:', err);
    process.exit(1);
  }
}

if (require.main === module) run();

module.exports = run;