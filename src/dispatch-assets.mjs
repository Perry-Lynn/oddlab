import { asset } from './hosting.mjs';
// Explicit public image allowlist. Never derive image paths from user input.
export const dispatchImageAssets = [
  { path: '/assets/dispatch/hero-v1.webp', file: 'assets/dispatch/hero-v1.webp', type: 'image/webp' },
  { path: '/assets/dispatch/ember-v1.webp', file: 'assets/dispatch/ember-v1.webp', type: 'image/webp' },
  { path: '/assets/dispatch/gale-v1.webp', file: 'assets/dispatch/gale-v1.webp', type: 'image/webp' },
  { path: '/assets/dispatch/terrain-v1.webp', file: 'assets/dispatch/terrain-v1.webp', type: 'image/webp' },
];

const dispatchImagePaths = new Set(dispatchImageAssets.map(asset => asset.path));
const failedDispatchImagePaths = new Set();
// Deploy-base aware src/href for an allowlisted image.
export function dispatchImageURL(path) {
  return asset(path);
}
// Browsers report the fully resolved src/href, which carries the deploy base path
// (for example /oddlab/assets/dispatch/hero-v1.webp on GitHub Pages). Normalize it
// back to the allowlist key so failure memory keeps working on every host.
export function rememberDispatchImageFailure(path) {
  const value = String(path ?? '');
  let pathname = value;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) { try { pathname = new URL(value).pathname; } catch { return false; } }
  const match = [...dispatchImagePaths].find(candidate => pathname === candidate || pathname.endsWith(candidate));
  if (!match) return false;
  failedDispatchImagePaths.add(match);
  return true;
}
export function dispatchImageHasFailed(path) {
  return dispatchImagePaths.has(path) && failedDispatchImagePaths.has(path);
}
