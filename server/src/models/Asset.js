const mongoose = require('mongoose');

const ASSET_CATEGORIES = ['Furniture', 'Electronics', 'Library Shelves', 'Appliances', 'Other'];
const ASSET_CONDITIONS = ['Good', 'Needs Repair', 'Disposed'];

const AssetSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    category: { type: String, enum: ASSET_CATEGORIES, required: true },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    condition: { type: String, enum: ASSET_CONDITIONS, default: 'Good' },
    purchaseDate: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-calculated valuation: quantity x unit price (never stored, always derived).
AssetSchema.virtual('totalValue').get(function () {
  return Math.round((this.quantity || 0) * (this.unitPrice || 0) * 100) / 100;
});

AssetSchema.set('toJSON', { virtuals: true });
AssetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Asset', AssetSchema);
module.exports.ASSET_CATEGORIES = ASSET_CATEGORIES;
module.exports.ASSET_CONDITIONS = ASSET_CONDITIONS;