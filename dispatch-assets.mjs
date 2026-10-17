// Explicit public image allowlist. Never derive image paths from user input.
export const dispatchImageAssets = [
  { path: '/assets/dispatch/hero-v1.webp', file: 'assets/dispatch/hero-v1.webp', type: 'image/webp' },
  { path: '/assets/dispatch/ember-v1.webp', file: 'assets/dispatch/ember-v1.webp', type: 'image/webp' },
  { path: '/assets/dispatch/gale-v1.webp', file: 'assets/dispatch/gale-v1.webp', type: 'image/webp' },
  { path: '/assets/dispatch/terrain-v1.webp', file: 'assets/dispatch/terrain-v1.webp', type: 'image/webp' },
];

const dispatchImagePaths = new Set(dispatchImageAssets.map(asset => asset.path));
const failedDispatchImagePaths = new Set();
export function rememberDispatchImageFailure(path) {
  if (!dispatchImagePaths.has(path)) return false;
  failedDispatchImagePaths.add(path);
  return true;
}
export function dispatchImageHasFailed(path) {
  return dispatchImagePaths.has(path) && failedDispatchImagePaths.has(path);
}
