// Tracks all files/folders transferred during this app session
const transferredPaths = new Set();

/**
 * Record a newly created path (copy/move destination)
 */
export function markTransferred(path) {
  transferredPaths.add(path);
}

/**
 * Check if a path (or its parent) was transferred
 */
export function isTransferred(path) {
  if (transferredPaths.has(path)) return true;

  // Optional: highlight children of transferred folders
  for (const p of transferredPaths) {
    if (path.startsWith(p + '/')) return true;
  }
  return false;
}

/**
 * Clear everything (call on "Clear All" or app reset)
 */
export function clearTransferHistory() {
  transferredPaths.clear();
}
