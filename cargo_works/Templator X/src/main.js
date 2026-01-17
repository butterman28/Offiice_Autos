// ./main.js

import { showModalPrompt, showConfirm } from "./assets/components/modal.js";
import { csvToHtml,parseCsvLine,escapeHtml } from "./assets/components/csv2html.js";
import { loadDocxPreview, renderQuickTemplates } from "./assets/components/docx_handler.js";
import {
  addQuickTemplate,
  addQuickData,
  addQuickOutput
} from "./assets/states/quickstore.js";

const { open } = window.__TAURI__.dialog;
const { invoke } = window.__TAURI__.core;
//const {}

// Global state (only what's needed globally)
// In main.js, replace your state with:
export let templatePath = null;
export let dataPath = null;
export let outputDir = null; // ← Start as null

// Track if user has actively selected each
let hasPickedTemplate = false;
let hasPickedData = false;
let hasPickedOutput = false;


function loadTemplateFromQuick(item) {
  templatePath = item.path;
  templateLabel.textContent = item.path;
  document.getElementById("compactTemplate").textContent = item.name;
  loadDocxPreview(item.path);
  previewCard.classList.remove("hidden");
  addToQuickBtn.classList.remove("hidden");
  updateUI();
}
function loadOutputFromQuick(item) {
  outputDir = item.path;
  outputPathLabel.textContent = item.path;
  document.getElementById("compactOutput").textContent = item.name;
  addToQuickOutputBtn.classList.remove("hidden");
  loadOutputFolderContents(item.path);
  updateUI();
}
function loadDataFromQuick(item) {
  dataPath = item.path;
  dataLabel.textContent = item.path;
  //dataFallbackLabel.textContent = item.path;
  document.getElementById("compactData").textContent = item.name;

  const isCsv = dataPath.toLowerCase().endsWith('.csv');
  const isXlsx = dataPath.toLowerCase().endsWith('.xlsx');

  if (isCsv || isXlsx) {
    console.log(dataPath)
    loadXlsxPreview(dataPath);
  } else {
    document.getElementById("dataPreview").innerHTML = "<em>Unsupported file type</em>";
  }

  addToQuickDataBtn.classList.remove("hidden");
  updateUI();
}

// Add to your DOM elements section
const outputPathLabel = document.getElementById("outputPathLabel");
const addToQuickOutputBtn = document.getElementById("addToQuickOutput");


const quickCallbacks = {
  onTemplateClick: loadTemplateFromQuick,
  onDataClick: loadDataFromQuick,
  onOutputClick: loadOutputFromQuick ,
};

// DOM elements
const templateLabel = document.getElementById("templatePath");
const dataLabel = document.getElementById("dataPathLabel");
const dataFallbackLabel = document.getElementById("dataPath");
const outputLabel = document.getElementById("outputPath");
const previewCard = document.getElementById("previewCard");
const addToQuickBtn = document.getElementById("addToQuickTemplates");
const addToQuickDataBtn = document.getElementById("addToQuickData");

// Initialize output
if (outputDir) {
  outputLabel.textContent = outputDir;
  document.getElementById("compactOutput").textContent = outputDir.split(/[\\/]/).pop();
}
updateUI();

// Preview loader for XLSX/CSV
// Preview loader for XLSX/CSV
async function loadXlsxPreview(filePath) {
  try {
    console.log("Work 1");
    
    // ✅ Use the same Rust method as DOCX
    const { invoke } = window.__TAURI__.core;
    const base64 = await invoke('read_file_bytes', { path: filePath });
    
    // Decode base64 to Uint8Array
    const binaryString = atob(base64);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    const uint8 = uint8Array; // SheetJS expects Uint8Array

    console.log("Work 1 after");
    
    if (filePath.toLowerCase().endsWith('.csv')) {
      console.log("Work 2");
      const csv = new TextDecoder().decode(uint8);
      document.getElementById("dataPreview").innerHTML = csvToHtml(csv);
    } else {
      console.log("Work 3");
      const wb = window.XLSX.read(uint8, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      document.getElementById("dataPreview").innerHTML = 
        window.XLSX.utils.sheet_to_html(sheet, { editable: false });
    }
  } catch (err) {
    console.error("XLSX preview error:", err);
    const errorMsg = err?.message || err?.toString() || 'Unknown error';
    document.getElementById("dataPreview").innerHTML = 
      `<em>Preview failed: ${errorMsg}</em>`;
  }
}
// Template picker
document.getElementById("pickTemplate").addEventListener("click", async () => {
  const path = await open({ filters: [{ name: "DOCX", extensions: ["docx"] }] });
  if (path) {
    templatePath = path;
    templateLabel.textContent = path;
    hasPickedTemplate=true;
    document.getElementById("compactTemplate").textContent = path.split(/[\\/]/).pop();
    await loadDocxPreview(path);
    previewCard.classList.remove("hidden");
    addToQuickBtn.classList.remove("hidden");
  } else {
    // handle cancel
  }
  updateUI();
});

// Data picker
document.getElementById("pickData").addEventListener("click", async () => {
  const raw = await open({ filters: [{ name: "Data", extensions: ["csv", "xlsx"] }] });
  const path = Array.isArray(raw) ? raw[0] : raw;
  if (path) {
    dataPath = path;
    hasPickedData =true;
    dataLabel.textContent = path;
    dataFallbackLabel.textContent = path;
    document.getElementById("compactData").textContent = path.split(/[\\/]/).pop();
    await loadXlsxPreview(path);
    addToQuickDataBtn.classList.remove("hidden");
  }
  updateUI();
});

// Output picker
document.getElementById("pickOutput").addEventListener("click", async () => {
  const dir = await open({ directory: true });
  if (dir) {
    outputDir = dir;
    hasPickedOutput = true;
    outputLabel.textContent = dir;
    outputPathLabel.textContent = dir;
    document.getElementById("compactOutput").textContent = dir.split(/[\\/]/).pop();
    localStorage.setItem("lastOutputDir", dir);
    addToQuickOutputBtn.classList.remove("hidden");
    
    // ✅ Load folder contents
    await loadOutputFolderContents(dir);
  } else {
    outputDir = null;
    outputLabel.textContent = "";
    outputPathLabel.textContent = "";
    addToQuickOutputBtn.classList.add("hidden");
    // Clear contents
    document.getElementById("outputFolderContents").innerHTML = 
      '<div class="text-gray-500 italic">No folder selected</div>';
  }
  updateUI();
});

// Clear buttons
document.getElementById("clearTemplate").addEventListener("click", () => {
  templatePath = null;
  hasPickedTemplate = false;
  // reset UI
  updateUI();
});

document.getElementById("clearData").addEventListener("click", () => {
  dataPath = null;
  hasPickedData=false;
  // reset UI
  updateUI();
});

document.getElementById("clearOutput").addEventListener("click", () => {
  outputDir = null;
  outputPathLabel.textContent = "";
  document.getElementById("compactOutput").textContent = "No output";
  addToQuickOutputBtn.classList.add("hidden");
  const contentsContainer = document.getElementById("outputFolderContents");
  if (contentsContainer) {
    contentsContainer.innerHTML = '<div class="text-gray-500 italic">No folder selected</div>';
  }
  
  updateUI();
});
// Add to Quick
// Add to Quick Templates
addToQuickBtn.addEventListener("click", async () => {
  if (!templatePath) return;
  const defaultName = templatePath.split(/[\\/]/).pop().replace(/\.docx$/i, "");
  const name = await showModalPrompt("Name this template:", defaultName);
  if (name) {
    const added = addQuickTemplate({ name: name.trim(), path: templatePath });
    renderQuickTemplates(quickCallbacks);
    if (added) {
      alert(`✅ "${name.trim()}" added to Quick Templates!`);
    } else {
      alert(`ℹ️ This template is already saved.`);
    }
  }
});

// Add to Quick Data
addToQuickDataBtn.addEventListener("click", async () => {
  if (!dataPath) return;
  const ext = dataPath.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';
  const defaultName = dataPath.split(/[\\/]/).pop().replace(new RegExp(`\\.${ext}$`, 'i'), "");
  const name = await showModalPrompt("Name this data file:", defaultName);
  if (name) {
    const added = addQuickData({ name: name.trim(), path: dataPath });
    renderQuickTemplates(quickCallbacks);
    if (added) {
      alert(`✅ "${name.trim()}" added to Quick Data!`);
    } else {
      alert(`ℹ️ This data file is already saved.`);
    }
  }
});

// Add to Quick Output
addToQuickOutputBtn.addEventListener("click", async () => {
  if (!outputDir) return;
  const defaultName = outputDir.split(/[\\/]/).pop();
  const name = await showModalPrompt("Name this output folder:", defaultName);
  if (name) {
    const added = addQuickOutput({ name: name.trim(), path: outputDir });
    renderQuickTemplates(quickCallbacks); // reuses same panel
    if (added) {
      alert(`✅ "${name.trim()}" added to Quick Output!`);
    } else {
      alert(`ℹ️ This output folder is already saved.`);
    }
  }
});

// Generate
// In generate button handler
document.getElementById("generate").addEventListener("click", async () => {
  if (!templatePath || !dataPath || !outputDir) {
    alert("Select all inputs");
    return;
  }
  try {
    await invoke("generate_docs", { templatePath, dataPath, outputDir });
    alert("Success!");
    
    // ✅ Refresh folder contents after generation
    await loadOutputFolderContents(outputDir);
  } catch (err) {
    alert("Error: " + err);
  }
});

// Load and display output folder contents
async function loadOutputFolderContents(folderPath) {
  try {
    const { invoke } = window.__TAURI__.core;
    const files = await invoke('list_directory', { path: folderPath });
    
    const contentsContainer = document.getElementById("outputFolderContents");
    if (!contentsContainer) return;

    if (files.length === 0) {
      contentsContainer.innerHTML = '<div class="text-gray-500 italic">Empty folder</div>';
    } else {
      contentsContainer.innerHTML = files
        .map(file => `<div class="flex items-center gap-2">
          <span class="text-blue-600">📄</span>
          <span class="truncate">${escapeHtml(file)}</span>
        </div>`)
        .join('');
    }
  } catch (err) {
    console.error("Failed to load folder contents:", err);
    const contentsContainer = document.getElementById("outputFolderContents");
    if (contentsContainer) {
      contentsContainer.innerHTML = '<div class="text-red-500 text-sm">Could not read folder</div>';
    }
  }
}

// Helper function to escape HTML
//function escapeHtml(text) {
//  const div = document.createElement('div');
//  div.textContent = text;
//  return div.innerHTML;
//}


// Initial render — PASS CALLBACKS
renderQuickTemplates(quickCallbacks);

function updatePreviewVisibility() {
  const hasTemplate = !!templatePath;
  const hasData = !!dataPath;
  previewCard.classList.toggle("hidden", !hasTemplate && !hasData);
}
function updateGenerateButton() {
  const generateBtn = document.getElementById("generate");
  generateBtn.disabled = !(templatePath && dataPath && outputDir);
}

// UI helpers
function updateUI() {
  const genBtn = document.getElementById("generate");
  genBtn.disabled = !(templatePath && dataPath && outputDir);

  const hasPreview = templatePath || dataPath || outputDir;
  previewCard.classList.toggle("hidden", !hasPreview);

  if (!templatePath) {
    document.getElementById("compactTemplate").textContent = "No template";
    document.getElementById("previewText").innerHTML = "";
    addToQuickBtn.classList.add("hidden");
  }
  if (!dataPath) {
    document.getElementById("compactData").textContent = "No data";
    document.getElementById("dataPreview").innerHTML = "";
    addToQuickDataBtn.classList.add("hidden");
  }
  if (!outputDir) {
    document.getElementById("compactOutput").textContent = "No output";
    addToQuickOutputBtn.classList.add("hidden");
  }
}

// Initial render
renderQuickTemplates(quickCallbacks);