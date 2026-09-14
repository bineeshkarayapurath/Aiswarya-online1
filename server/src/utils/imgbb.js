const fs = require('fs');
const path = require('path');
const config = require('../config/constants');

const IMG_BB_API = 'https://api.imgbb.com/1/upload';
const IMG_BB_MAX = 32 * 1024 * 1024;

async function uploadToImgBB({ filePath, mime }) {
  if (!config.IMG_BB_API_KEY) return null;
  const size = fs.statSync(filePath).size;
  if (size > IMG_BB_MAX) return null;
  const fd = new FormData();
  fd.append('image', new Blob([fs.readFileSync(filePath)], { type: mime }), path.basename(filePath));
  const res = await fetch(`${IMG_BB_API}?key=${encodeURIComponent(config.IMG_BB_API_KEY)}`, {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  if (!res.ok || !data || !data.data) {
    throw new Error(data?.error?.message || `ImgBB upload failed (${res.status})`);
  }
  return String(data.data.url || '');
}

module.exports = { uploadToImgBB };