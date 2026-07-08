import { UPLOADS_BASE_URL } from '../config';

export function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Strip leading slashes, then strip 'uploads/' prefix to avoid double path
  const normalized = path.replace(/^\/+/, '');
  const clean = normalized.startsWith('uploads/') ? normalized.slice('uploads/'.length) : normalized;
  return `${UPLOADS_BASE_URL}/${clean}`;
}
