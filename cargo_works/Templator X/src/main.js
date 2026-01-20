// ./main.js
import { showModalPrompt, showConfirm, showSnackbar } from "./assets/components/modal.js";
import { csvToHtml, parseCsvLine, escapeHtml } from "./assets/components/csv2html.js";
import { loadDocxPreview, renderQuickTemplates } from "./assets/components/docx_handler.js";
import { openFeedbackModal } from "./assets/components/feedback.js";
import {
  addQuickTemplate,
  addQuickData,
  addQuickOutput
} from "./assets/states/quickstore.js";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

const { open } = window.__TAURI__.dialog;
const { invoke } = window.__TAURI__.core;

// Global state
export let templatePath = null;
export let dataPath = null;
export let outputDir = null;
let selectedNameColumn = null;
let availableColumns = [];
let hasPickedTemplate = false;
let hasPickedData = false;
let hasPickedOutput = false;
let selectedFiles = new Set();

// Drag-to-select state (MUST be global for event handlers)
let isDragging = false;
let dragStartIndex = -1;
let dragEndIndex = -1;
let currentFileItems = [];

// Unified drag event handlers (global scope)
function handleMouseDown(e) {
  if (e.button !== 0) return;
  
  // 👇 NEW: If clicking directly on checkbox, let it handle itself
  if (e.target.classList.contains('file-checkbox')) {
    return; // Let normal checkbox behavior happen
  }

  const targetItem = e.target.closest('.output-file-item');
  if (!targetItem) return;

  isDragging = false;
  dragStartIndex = parseInt(targetItem.dataset.index);
  dragEndIndex = dragStartIndex;
  e.preventDefault(); // Only prevent default for non-checkbox clicks
}
function handleMouseMove(e) {
  if (isDragging === false && dragStartIndex !== -1) {
    // First move → start drag mode
    isDragging = true;
    
    // Toggle starting item
    const startItem = currentFileItems[dragStartIndex];
    const startCheckbox = startItem.querySelector('.file-checkbox');
    if (startCheckbox) {
      startCheckbox.checked = !startCheckbox.checked;
      const path = startCheckbox.dataset.path;
      if (startCheckbox.checked) {
        selectedFiles.add(path);
      } else {
        selectedFiles.delete(path);
      }
      updateMultiDeleteUI();
    }
  }

  if (!isDragging) return;
  
  const targetItem = e.target.closest('.output-file-item');
  if (!targetItem) return;

  const currentIndex = parseInt(targetItem.dataset.index);
  if (currentIndex === dragEndIndex) return;

  dragEndIndex = currentIndex;
  const start = Math.min(dragStartIndex, dragEndIndex);
  const end = Math.max(dragStartIndex, dragEndIndex);

  for (let i = start; i <= end; i++) {
    const item = currentFileItems[i];
    const checkbox = item.querySelector('.file-checkbox');
    if (checkbox) {
      checkbox.checked = true;
      selectedFiles.add(checkbox.dataset.path);
    }
  }
  updateMultiDeleteUI();
}

function handleMouseUp() {
  if (isDragging) {
    isDragging = false;
    dragStartIndex = -1;
    dragEndIndex = -1;
  }
}

// Existing functions (unchanged)
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
  document.getElementById("compactData").textContent = item.name;

  const isCsv = dataPath.toLowerCase().endsWith('.csv');
  const isXlsx = dataPath.toLowerCase().endsWith('.xlsx');

  if (isCsv || isXlsx) {
    loadXlsxPreview(dataPath);
  } else {
    document.getElementById("dataPreview").innerHTML = "<em>Unsupported file type</em>";
  }

  addToQuickDataBtn.classList.remove("hidden");
  updateUI();
}

// DOM elements
const outputPathLabel = document.getElementById("outputPathLabel");
const addToQuickOutputBtn = document.getElementById("addToQuickOutput");
const quickCallbacks = {
  onTemplateClick: loadTemplateFromQuick,
  onDataClick: loadDataFromQuick,
  onOutputClick: loadOutputFromQuick,
};
const templateLabel = document.getElementById("templatePath");
const dataLabel = document.getElementById("dataPathLabel");
const dataFallbackLabel = document.getElementById("dataPath");
const outputLabel = document.getElementById("outputPath");
const previewCard = document.getElementById("previewCard");
const addToQuickBtn = document.getElementById("addToQuickTemplates");
const addToQuickDataBtn = document.getElementById("addToQuickData");

if (outputDir) {
  outputLabel.textContent = outputDir;
  document.getElementById("compactOutput").textContent = outputDir.split(/[\\/]/).pop();
}
updateUI();

// Preview loader for XLSX/CSV
async function loadXlsxPreview(filePath) {
  try {
    const { invoke } = window.__TAURI__.core;
    const base64 = await invoke('read_file_bytes', { path: filePath });
    const binaryString = atob(base64);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    const uint8 = uint8Array;

    if (filePath.toLowerCase().endsWith('.csv')) {
      const csv = new TextDecoder().decode(uint8);
      document.getElementById("dataPreview").innerHTML = csvToHtml(csv);
      const lines = csv.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim());
        availableColumns = headers;
        showColumnSelector();
      }
    } else {
      const wb = XLSX.read(uint8, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      document.getElementById("dataPreview").innerHTML = 
        XLSX.utils.sheet_to_html(sheet, { editable: false });
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      const headers = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        const cell = sheet[cellAddress];
        headers.push(cell ? cell.v.toString() : `Column ${C + 1}`);
      }
      availableColumns = headers;
      showColumnSelector();
    }
  } catch (err) {
    console.error("XLSX preview error:", err);
    const errorMsg = err?.message || err?.toString() || 'Unknown error';
    document.getElementById("dataPreview").innerHTML = 
      `<em>Preview failed: ${errorMsg}</em>`;
  }
}

// Button event listeners (unchanged)
document.getElementById("pickTemplate").addEventListener("click", async () => {
  const path = await open({ filters: [{ name: "DOCX", extensions: ["docx"] }] });
  if (path) {
    templatePath = path;
    templateLabel.textContent = path;
    hasPickedTemplate = true;
    document.getElementById("compactTemplate").textContent = path.split(/[\\/]/).pop();
    await loadDocxPreview(path);
    previewCard.classList.remove("hidden");
    addToQuickBtn.classList.remove("hidden");
  }
  updateUI();
});

document.getElementById("pickData").addEventListener("click", async () => {
  const raw = await open({ filters: [{ name: "Data", extensions: ["csv", "xlsx"] }] });
  const path = Array.isArray(raw) ? raw[0] : raw;
  if (path) {
    dataPath = path;
    hasPickedData = true;
    dataLabel.textContent = path;
    dataFallbackLabel.textContent = path;
    document.getElementById("compactData").textContent = path.split(/[\\/]/).pop();
    await loadXlsxPreview(path);
    addToQuickDataBtn.classList.remove("hidden");
  }
  updateUI();
});

document.getElementById("pickOutput").addEventListener("click", async () => {
  const dir = await open({ directory: true });
  if (dir) {
    outputDir = dir;
    hasPickedOutput = true;
    outputPathLabel.textContent = dir;
    document.getElementById("compactOutput").textContent = dir.split(/[\\/]/).pop();
    localStorage.setItem("lastOutputDir", dir);
    addToQuickOutputBtn.classList.remove("hidden");
    await loadOutputFolderContents(dir);
  } else {
    outputDir = null;
    outputPathLabel.textContent = "";
    addToQuickOutputBtn.classList.add("hidden");
    document.getElementById("outputFolderContents").innerHTML = 
      '<div class="text-gray-500 italic">No folder selected</div>';
  }
  updateUI();
});

document.getElementById("clearTemplate").addEventListener("click", () => {
  templatePath = null;
  hasPickedTemplate = false;
  updateUI();
});

document.getElementById("clearData").addEventListener("click", () => {
  dataPath = null;
  hasPickedData = false;
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

// Add to Quick (unchanged)
addToQuickBtn.addEventListener("click", async () => {
  if (!templatePath) return;
  const defaultName = templatePath.split(/[\\/]/).pop().replace(/\.docx$/i, "");
  const name = await showModalPrompt("Name this template:", defaultName);
  if (name) {
    const added = addQuickTemplate({ name: name.trim(), path: templatePath });
    renderQuickTemplates(quickCallbacks);
    if (added) {
      alert(` "${name.trim()}" added to Quick Templates!`);
    } else {
      alert(` This template is already saved.`);
    }
  }
});

addToQuickDataBtn.addEventListener("click", async () => {
  if (!dataPath) return;
  const ext = dataPath.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';
  const defaultName = dataPath.split(/[\\/]/).pop().replace(new RegExp(`\\.${ext}$`, 'i'), "");
  const name = await showModalPrompt("Name this data file:", defaultName);
  if (name) {
    const added = addQuickData({ name: name.trim(), path: dataPath });
    renderQuickTemplates(quickCallbacks);
    if (added) {
      alert(` "${name.trim()}" added to Quick Data!`);
    } else {
      alert(` This data file is already saved.`);
    }
  }
});

addToQuickOutputBtn.addEventListener("click", async () => {
  if (!outputDir) return;
  const defaultName = outputDir.split(/[\\/]/).pop();
  const name = await showModalPrompt("Name this output folder:", defaultName);
  if (name) {
    const added = addQuickOutput({ name: name.trim(), path: outputDir });
    renderQuickTemplates(quickCallbacks);
    if (added) {
      alert(` "${name.trim()}" added to Quick Output!`);
    } else {
      alert(` This output folder is already saved.`);
    }
  }
});

// Generate handler (unchanged)
document.getElementById("generate").addEventListener("click", async () => {
  if (!templatePath || !dataPath || !outputDir) {
    alert("Select all inputs");
    return;
  }
  
  try {
    await invoke("generate_docs", { 
      templatePath, 
      dataPath, 
      outputDir, 
      nameColumn: selectedNameColumn 
    });
    alert("Success!");
    await loadOutputFolderContents(outputDir);
  } catch (err) {
    alert("Error: " + err);
  }
});

// Load output folder contents (UPDATED: uses .output-file-item class)
async function loadOutputFolderContents(folderPath) {
  try {
    const { invoke } = window.__TAURI__.core;
    const files = await invoke('list_directory', { path: folderPath });

    const contentsContainer = document.getElementById("outputFolderContents");
    if (!contentsContainer) return;

    if (files.length === 0) {
      contentsContainer.innerHTML = '<div class="text-gray-500 italic">Empty folder</div>';
      updateMultiDeleteUI();
      return;
    }

    // Render with unique class for drag selection
    contentsContainer.innerHTML = files
      .map(file => {
        const safeFile = escapeHtml(file);
        const fullPath = `${folderPath}/${file}`.replace(/\\/g, '/');
        const isChecked = selectedFiles.has(fullPath) ? 'checked' : '';

        return `
          <div class="output-file-item flex items-center gap-2 py-1 border-b border-gray-100">
            <input type="checkbox" class="mr-2 file-checkbox" data-path="${escapeHtml(fullPath)}" ${isChecked}>
            <button class="flex items-center gap-2 flex-1 text-left truncate hover:bg-gray-50 rounded px-1"
                    data-action="preview" data-path="${escapeHtml(fullPath)}">
              <span class="text-blue-600">📄</span>
              <span class="truncate">${safeFile}</span>
            </button>
            <button class="ml-auto text-red-500 hover:text-red-700 transition-colors"
                    data-action="delete" data-path="${escapeHtml(fullPath)}" data-name="${safeFile}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        `;
      })
      .join('');

    // Sync "Select All" checkbox
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      const allFiles = Array.from(document.querySelectorAll('.file-checkbox'))
        .map(cb => cb.dataset.path);
      const allSelected = allFiles.length > 0 && allFiles.every(p => selectedFiles.has(p));
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = !allSelected && selectedFiles.size > 0;
    }

    attachOutputFileEventListeners(folderPath);
    attachCheckboxListeners(folderPath);
    enableDragSelect(contentsContainer);
    updateMultiDeleteUI();
  } catch (err) {
    console.error("Failed to load folder contents:", err);
    const contentsContainer = document.getElementById("outputFolderContents");
    if (contentsContainer) {
      contentsContainer.innerHTML = '<div class="text-red-500 text-sm">Could not read folder</div>';
    }
    updateMultiDeleteUI();
  }
}

// Checkbox listeners (unchanged)
function attachCheckboxListeners(baseFolderPath) {
  const checkboxes = document.querySelectorAll('.file-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const path = e.target.dataset.path;
      if (e.target.checked) {
        selectedFiles.add(path);
      } else {
        selectedFiles.delete(path);
      }
      updateMultiDeleteUI();
    });
  });
}

// Multi-delete UI (unchanged)
function updateMultiDeleteUI() {
  const count = selectedFiles.size;
  const controlsContainer = document.getElementById("multiDeleteControls");
  
  if (controlsContainer) {
    controlsContainer.classList.toggle("hidden", count === 0);
    const countEl = document.getElementById("selectedCount");
    if (countEl) countEl.textContent = count;
  }
}

// Delete selected files (unchanged)
document.getElementById("deleteSelectedBtn")?.addEventListener("click", async () => {
  if (selectedFiles.size === 0) return;

  const confirmed = await showConfirm(
    `Delete ${selectedFiles.size} file(s)?`,
    "This cannot be undone."
  );

  if (!confirmed) return;

  let successCount = 0;
  let errorCount = 0;

  for (const filePath of selectedFiles) {
    try {
      await invoke('delete_file', { path: filePath });
      successCount++;
    } catch (err) {
      console.error("Delete failed:", err);
      errorCount++;
    }
  }

  selectedFiles.clear();
  if (outputDir) {
    await loadOutputFolderContents(outputDir);
  }

  if (errorCount === 0) {
    showSnackbar(`${successCount} file(s) deleted.`, "success");
  } else {
    showSnackbar(`${successCount} deleted, ${errorCount} failed.`, "warning");
  }
});

// File action listeners (unchanged)
function attachOutputFileEventListeners(baseFolderPath) {
  const container = document.getElementById("outputFolderContents");
  if (!container) return;

  container.addEventListener("click", async (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;

    const filePath = action.dataset.path;
    const fileName = action.dataset.name || filePath.split('/').pop();

    if (action.dataset.action === "preview") {
      await previewFile(filePath);
    } else if (action.dataset.action === "delete") {
      const confirmed = await showConfirm(`Delete "${fileName}"?`, "This cannot be undone.");
      if (confirmed) {
        await deleteFile(filePath, baseFolderPath);
      }
    }
  });
}

// Preview file (unchanged)
async function previewFile(filePath) {
  const modalId = 'filePreviewModal';
  let modal = document.getElementById(modalId);

  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-4 py-3 border-b flex justify-between items-center">
          <h3 class="font-semibold truncate">${escapeHtml(filePath.split('/').pop())}</h3>
          <button id="closePreviewBtn" class="text-gray-500 hover:text-gray-800 text-xl">&times;</button>
        </div>
        <div id="previewContent" class="p-4 overflow-auto flex-1 bg-gray-50">
          <div class="text-center text-gray-500">Loading...</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const closeBtn = modal.querySelector('#closePreviewBtn');
  const contentEl = modal.querySelector('#previewContent');

  const closeModal = () => {
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };
  closeBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  try {
    const extension = filePath.split('.').pop()?.toLowerCase();

    if (['txt', 'log', 'md', 'json', 'csv', 'xml', 'html', 'js', 'css'].includes(extension)) {
      const { invoke } = window.__TAURI__.core;
      const content = await invoke('read_file_bytes', { path: filePath });
      const binaryString = atob(content);
      const text = new TextDecoder().decode(Uint8Array.from(binaryString, c => c.charCodeAt(0)));
      contentEl.innerHTML = `<pre class="whitespace-pre-wrap font-mono text-sm">${escapeHtml(text)}</pre>`;

    } else if (extension === 'docx') {
      const { invoke } = window.__TAURI__.core;
      const base64 = await invoke('read_file_bytes', { path: filePath });
      const binaryString = atob(base64);
      const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      const arrayBuffer = bytes.buffer;
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      const html = result.value;
      if (result.messages.length > 0) {
        console.warn("Mammoth conversion warnings:", result.messages);
      }
      contentEl.innerHTML = html || '<div class="text-gray-500 italic">Empty document</div>';

    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
      const { invoke } = window.__TAURI__.core;
      const base64 = await invoke('read_file_bytes', { path: filePath });
      contentEl.innerHTML = `<img src="data:image/${extension};base64,${base64}" class="max-w-full max-h-[70vh] object-contain" />`;

    } else {
      contentEl.innerHTML = `<div class="text-center text-gray-600 p-4">Preview not supported for .${extension} files.</div>`;
    }
  } catch (err) {
    console.error("Preview failed:", err);
    contentEl.innerHTML = `<div class="text-red-500 text-center p-4">Failed to load preview.<br>${escapeHtml(err.message || String(err))}</div>`;
  }
}

// Delete single file (unchanged)
async function deleteFile(filePath, baseFolderPath) {
  try {
    const { invoke } = window.__TAURI__.core;
    await invoke('delete_file', { path: filePath });
    await loadOutputFolderContents(baseFolderPath);
    showSnackbar("File deleted successfully.", "success");
  } catch (err) {
    console.error("Delete failed:", err);
    showSnackbar("Failed to delete file.", "error");
  }
}

// Initial render
renderQuickTemplates(quickCallbacks);

// UI helpers (unchanged)
function updatePreviewVisibility() {
  const hasTemplate = !!templatePath;
  const hasData = !!dataPath;
  previewCard.classList.toggle("hidden", !hasTemplate && !hasData);
}
function updateGenerateButton() {
  const generateBtn = document.getElementById("generate");
  generateBtn.disabled = !(templatePath && dataPath && outputDir);
}
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
function showColumnSelector() {
  const selectorContainer = document.getElementById("columnSelector");
  const selectElement = document.getElementById("nameColumnSelect");
  
  if (selectorContainer && selectElement && availableColumns.length > 0) {
    selectElement.innerHTML = '<option value="">Auto-detect (filename/name/id)</option>';
    availableColumns.forEach(column => {
      const option = document.createElement("option");
      option.value = column;
      option.textContent = column;
      selectElement.appendChild(option);
    });
    if (selectedNameColumn && availableColumns.includes(selectedNameColumn)) {
      selectElement.value = selectedNameColumn;
    }
    selectorContainer.classList.remove("hidden");
  }
}
document.getElementById("nameColumnSelect")?.addEventListener("change", (e) => {
  selectedNameColumn = e.target.value || null;
});



// Feedback buttons (unchanged)
document.getElementById("reportBugBtn").addEventListener("click", () => openFeedbackModal("bug"));
document.getElementById("suggestBtn").addEventListener("click", () => openFeedbackModal("suggestion"));
// Cancel selection button handler
document.getElementById("cancelSelectionBtn")?.addEventListener("click", () => {
  selectedFiles.clear();
  if (outputDir) {
    loadOutputFolderContents(outputDir);
  }
});
// Select All handler (unchanged)
document.getElementById("selectAllCheckbox")?.addEventListener("change", (e) => {
  const isChecked = e.target.checked;
  const checkboxes = document.querySelectorAll('.file-checkbox');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
    const path = checkbox.dataset.path;
    if (isChecked) {
      selectedFiles.add(path);
    } else {
      selectedFiles.delete(path);
    }
  });
  
  updateMultiDeleteUI();
});

// DRAG-TO-SELECT: Fixed implementation
function enableDragSelect(container) {
  // Remove previous listeners
  container.removeEventListener('mousedown', handleMouseDown);
  container.removeEventListener('mousemove', handleMouseMove);
  container.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mouseup', handleMouseUp);

  // Get current file items
  currentFileItems = Array.from(container.querySelectorAll('.output-file-item'));
  if (currentFileItems.length === 0) return;

  // Set index on each item
  currentFileItems.forEach((item, index) => {
    item.dataset.index = index;
  });

  // Add new listeners
  container.addEventListener('mousedown', handleMouseDown);
  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('mouseup', handleMouseUp);
}

// Initial render
document.addEventListener('DOMContentLoaded', () => {
  const savedOutput = localStorage.getItem("lastOutputDir");
  updateUI();
  renderQuickTemplates(quickCallbacks);
});