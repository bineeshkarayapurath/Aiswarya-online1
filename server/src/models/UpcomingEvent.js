const mongoose = require('mongoose');

// Upcoming sports & cultural events published on the home page.
//
// This is distinct from EventProgram (registration + sub-programs) and from
// ProgramMinutes (the archive of meetings that already happened): it is the
// forward-looking noticeboard the admin fills in from the "Upcoming Events"
// dashboard box, and the home page's "Upcoming Programs" section reads it.
const UpcomingEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    // Free-text so the office can write "10:00 AM", "10:00 AM - 4:00 PM" or a
    // Malayalam phrase without fighting a strict time input.
    time: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['Sports', 'Cultural', 'Other'],
      default: 'Cultural',
      index: true,
    },
    venue: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    // Public HTTPS URL from /api/upload (local /uploads/ path or ImgBB URL).
    posterUrl: { type: String, default: '' },
    // Lets an officer prepare an event and hide it until it is ready.
    isPublished: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

UpcomingEventSchema.index({ isPublished: 1, date: 1 });

module.exports = mongoose.model('UpcomingEvent', UpcomingEventSchema);
