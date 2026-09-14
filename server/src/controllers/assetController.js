const Asset = require('../models/Asset');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toView(a) {
  const o = a.toObject();
  o._id = String(o._id);
  return o;
}

// GET /api/assets?q=&category=&condition=
exports.list = async (req, res) => {
  try {
    const { q, category, condition } = req.query;
    const filter = {};
    if (q && String(q).trim()) {
      filter.itemName = { $regex: escapeRegex(String(q).trim()), $options: 'i' };
    }
    if (category && category !== 'All') filter.category = category;
    if (condition && condition !== 'All') filter.condition = condition;

    const docs = await Asset.find(filter).sort({ createdAt: -1 });
    const items = docs.map(toView);
    const totalItems = items.reduce((s, a) => s + (a.quantity || 0), 0);
    const totalValue = items.reduce((s, a) => s + (a.totalValue || 0), 0);

    return res.json({
      assets: items,
      summary: { totalItems, totalValue },
      total: items.length,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/assets
exports.create = async (req, res) => {
  try {
    const { itemName, category, quantity, unitPrice, condition, purchaseDate, notes } = req.body;
    if (!itemName || !String(itemName).trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }
    if (!Asset.ASSET_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }
    if (condition && !Asset.ASSET_CONDITIONS.includes(condition)) {
      return res.status(400).json({ message: 'Invalid condition' });
    }

    const doc = await Asset.create({
      itemName: String(itemName).trim(),
      category,
      quantity: Math.max(0, parseInt(quantity, 10) || 0),
      unitPrice: Math.max(0, Number(unitPrice) || 0),
      condition: condition || 'Good',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      notes: String(notes || '').trim(),
    });

    return res.status(201).json({ message: 'Asset added', asset: toView(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PUT /api/assets/:id
exports.update = async (req, res) => {
  try {
    const doc = await Asset.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Asset not found' });

    const { itemName, category, quantity, unitPrice, condition, purchaseDate, notes } = req.body;
    if (itemName !== undefined) {
      if (!String(itemName).trim()) return res.status(400).json({ message: 'Item name cannot be empty' });
      doc.itemName = String(itemName).trim();
    }
    if (category !== undefined) {
      if (!Asset.ASSET_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid category' });
      doc.category = category;
    }
    if (quantity !== undefined) doc.quantity = Math.max(0, parseInt(quantity, 10) || 0);
    if (unitPrice !== undefined) doc.unitPrice = Math.max(0, Number(unitPrice) || 0);
    if (condition !== undefined) {
      if (!Asset.ASSET_CONDITIONS.includes(condition)) return res.status(400).json({ message: 'Invalid condition' });
      doc.condition = condition;
    }
    if (purchaseDate !== undefined) doc.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (notes !== undefined) doc.notes = String(notes || '').trim();

    await doc.save();
    return res.json({ message: 'Asset updated', asset: toView(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/assets/:id
exports.deleteAsset = async (req, res) => {
  try {
    const doc = await Asset.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Asset not found' });
    await doc.deleteOne();
    return res.json({ message: 'Asset removed' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};