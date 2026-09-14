import api from '../api/client';

// Upload images to the backend POST /api/upload endpoint (multipart). The
// server keeps them on local storage (served via /uploads/) or, when an ImgBB
// API key is configured, relays them to ImgBB for free permanent HTTPS hosting.
// Always returns an array of public HTTPS image URLs, empty on failure.
export async function uploadImages(files) {
  if (!files || !files.length) return [];
  const fd = new FormData();
  for (const f of files) fd.append('photos', f);
  const { data } = await api.post('/upload', fd);
  return Array.isArray(data?.urls) ? data.urls : [];
}