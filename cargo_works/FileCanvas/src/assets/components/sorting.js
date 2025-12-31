// public/assets/components/sorting.js

export function sortItems(items, sortBy = 'name') {
  return [...items].sort((a, b) => {
    // 🔑 Only apply "folders first" for 'name' sort
    if (sortBy === 'name') {
      if (a.is_directory !== b.is_directory) {
        return a.is_directory ? -1 : 1; // folders first
      }
      return a.name.localeCompare(b.name);
    }

    // 🔑 For date sorts: ignore folder/file type — sort by timestamp only
    if (sortBy === 'modified') {
      return (b.mtime || 0) - (a.mtime || 0); // newest first
    }
    if (sortBy === 'created') {
      const aT = a.ctime || a.mtime || 0;
      const bT = b.ctime || b.mtime || 0;
      return bT - aT; // newest first
    }

    // Fallback (should not happen)
    return 0;
  });
}