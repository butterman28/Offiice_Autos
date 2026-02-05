// ./assets/states/quickstore.js

const TEMPLATES_KEY = "quickTemplates";
const DATA_KEY = "quickDataFiles";

let quickTemplates = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
let quickDataFiles = JSON.parse(localStorage.getItem(DATA_KEY) || "[]");

// Getters
export function getQuickTemplates() {
  return [...quickTemplates]; // return copy to prevent mutation
}

export function getQuickDataFiles() {
  return [...quickDataFiles];
}

// Template mutations
export function addQuickTemplate(item) {
  if (!item.path || !item.name) return false;
  const exists = quickTemplates.some(t => t.path === item.path);
  if (exists) {
    return false; // already exists
  }
  quickTemplates.push({ ...item });
  persist();
  return true; // added successfully
}

export function removeQuickTemplate(path) {
  quickTemplates = quickTemplates.filter(t => t.path !== path);
  persist();
}

export function renameQuickTemplate(path, name) {
  const item = quickTemplates.find(t => t.path === path);
  if (item) {
    item.name = name.trim();
    persist();
  }
}

// Data mutations
export function addQuickData(item) {
  if (!item.path || !item.name) return false;
  const exists = quickDataFiles.some(f => f.path === item.path);
  if (exists) {
    return false;
  }
  quickDataFiles.push({ ...item });
  persist();
  return true;
}
export function removeQuickData(path) {
  quickDataFiles = quickDataFiles.filter(f => f.path !== path);
  persist();
}

export function renameQuickData(path, name) {
  const item = quickDataFiles.find(f => f.path === path);
  if (item) {
    item.name = name.trim();
    persist();
  }
}

let quickOutputFolders = JSON.parse(localStorage.getItem("quickOutputFolders") || "[]");

export function getQuickOutputFolders() {
  return [...quickOutputFolders];
}

export function addQuickOutput(item) {
  if (!item.path || !item.name) return false;
  const exists = quickOutputFolders.some(f => f.path === item.path);
  if (exists) return false;
  quickOutputFolders.push({ ...item });
  persist();
  return true;
}

export function removeQuickOutput(path) {
  quickOutputFolders = quickOutputFolders.filter(f => f.path !== path);
  persist();
}

export function renameQuickOutput(path, name) {
  const item = quickOutputFolders.find(f => f.path === path);
  if (item) {
    item.name = name.trim();
    persist();
  }
}



function persist() {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(quickTemplates));
  localStorage.setItem(DATA_KEY, JSON.stringify(quickDataFiles));
  localStorage.setItem("quickOutputFolders", JSON.stringify(quickOutputFolders));
}
