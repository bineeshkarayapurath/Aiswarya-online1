const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', CounterSchema);

async function getNextSequence(key) {
  const counter = await mongoose
    .model('Counter')
    .findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
  return counter ? counter.seq : 1;
}

module.exports.getNextSequence = getNextSequence;