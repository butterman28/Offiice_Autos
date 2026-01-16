import { showModalPrompt, showConfirm } from "./assets/components/modal.js";

const { open } = window.__TAURI__.dialog;
const { invoke } = window.__TAURI__.core;
const { readBinaryFile } = window.__TAURI__.fs;

const mammoth = window.mammoth;
window.XLSX;

if (!mammoth) {
  console.error("Mammoth failed to load");
}

let templatePath;
let dataPath;
let outputDir;

const templateLabel = document.getElementById("templatePath");
const dataLabel = document.getElementById("dataPathLabel");
const dataFallbackLabel = document.getElementById("dataPath");
const outputLabel = document.getElementById("outputPath");
const previewCard = document.getElementById("previewCard");

// ✅ MOVED UP: Define preview functions EARLY
async function loadDocxPreview(filePath) {
  try {
    const { invoke } = window.__TAURI__.core;
    const base64 = await invoke('read_file_bytes', { path: filePath });
    const binaryString = atob(base64);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = uint8Array.buffer;
    const result = await mammoth.convertToHtml({ arrayBuffer });
    document.getElementById("previewText").innerHTML =
      result.value || "<em>Empty document</em>";
  } catch (err) {
    console.error("Preview error:", err);
    document.getElementById("previewText").innerHTML =
      `<em>Failed to load preview: ${err.message || err}</em>`;
  }
}

async function loadXlsxPreview(filePath) {
  try {
    const tauri = window.__TAURI__;
    if (!tauri?.fs?.readFile) {
      throw new Error("FS plugin not available");
    }
    const uint8 = await tauri.fs.readFile(filePath);
    const workbook = window.XLSX.read(uint8, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const html = window.XLSX.utils.sheet_to_html(sheet, { editable: false });
    document.getElementById("dataPreview").innerHTML = html;
  } catch (err) {
    console.error("XLSX preview error:", err);
    document.getElementById("dataPreview").innerHTML =
      "<em>Failed to load data preview.</em>";
  }
}

///////////////
// Handle "Add to Quick Templates" click
//////////////
const addToQuickBtn = document.getElementById("addToQuickTemplates");
let quickTemplates = JSON.parse(localStorage.getItem("quickTemplates") || "[]");
addToQuickBtn.addEventListener("click", async () => {
  if (!templatePath) return;

  const defaultName = templatePath
    .split(/[\\/]/)
    .pop()
    .replace(/\.docx$/i, "");

  const name = await showModalPrompt("Name this template for quick access:", defaultName);

  if (name && name.trim()) {
    const cleanName = name.trim();
    const exists = quickTemplates.some(t => t.path === templatePath);
    
    if (!exists) {
      quickTemplates.push({ name: cleanName, path: templatePath });
      localStorage.setItem("quickTemplates", JSON.stringify(quickTemplates));
      renderQuickTemplates();
      alert(`✅ "${cleanName}" added to Quick Templates!`);
    } else {
      alert("This template is already in your quick list.");
    }
  }
});

// render quick templates 
const quickTemplatesPanel = document.getElementById("quickTemplatesPanel");
const quickTemplatesListRight = document.getElementById("quickTemplatesListRight");

function renderQuickTemplates() {
  const quickTemplatesPanel = document.getElementById("quickTemplatesPanel");
  const quickTemplatesListRight = document.getElementById("quickTemplatesListRight");
  const pathFallback = document.getElementById("pathFallback");

  if (!quickTemplatesPanel || !quickTemplatesListRight) return;

  const hasTemplates = quickTemplates.length > 0;
  const hasData = quickDataFiles.length > 0;

  if (hasTemplates || hasData) {
    quickTemplatesPanel.classList.remove("hidden");
    quickTemplatesListRight.innerHTML = "";

    if (hasTemplates) {
      const templateHeader = document.createElement("div");
      templateHeader.className = "w-full text-xs font-medium text-gray-500 uppercase tracking-wide mt-2";
      templateHeader.textContent = "Templates";
      quickTemplatesListRight.appendChild(templateHeader);

      quickTemplates.forEach((item, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "flex items-center justify-between group py-1";

        const nameLabel = document.createElement("span");
        nameLabel.className = "text-xs text-blue-800 cursor-pointer truncate flex-1 mr-2";
        nameLabel.textContent = item.name;
        nameLabel.title = item.path;
        nameLabel.onclick = () => loadTemplateFromQuick(item);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "flex items-center gap-6";

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "text-xs text-gray-500 hover:text-blue-600";
        renameBtn.title = "Rename";
        renameBtn.textContent = "✏️";
        renameBtn.onclick = async (e) => {
          e.stopPropagation();
          const newName = await showModalPrompt("Rename template:", item.name);
          if (newName) {
            quickTemplates[index].name = newName;
            localStorage.setItem("quickTemplates", JSON.stringify(quickTemplates));
            renderQuickTemplates();
          }
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "text-xs text-gray-500 hover:text-red-600";
        deleteBtn.title = "Remove from Quick Templates";
        deleteBtn.textContent = "🗑️";
        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          const confirmed = await showConfirm(
            "Remove Template?",
            `Remove "${item.name}"?`
          );
          if (confirmed) {
            quickTemplates = quickTemplates.filter(t => t.path !== item.path);
            localStorage.setItem("quickTemplates", JSON.stringify(quickTemplates));
            renderQuickTemplates();
          }
        };

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        itemDiv.appendChild(nameLabel);
        itemDiv.appendChild(actionsDiv);
        quickTemplatesListRight.appendChild(itemDiv);
      });
    }

    if (hasData) {
      const dataHeader = document.createElement("div");
      dataHeader.className = "w-full text-xs font-medium text-gray-500 uppercase tracking-wide mt-3";
      dataHeader.textContent = "Data Files";
      quickTemplatesListRight.appendChild(dataHeader);

      quickDataFiles.forEach((item, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "flex items-center justify-between group py-1";

        const nameLabel = document.createElement("span");
        nameLabel.className = "text-xs text-green-800 cursor-pointer truncate flex-1 mr-2";
        nameLabel.textContent = item.name;
        nameLabel.title = item.path;
        nameLabel.onclick = () => loadDataFromQuick(item);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "flex items-center gap-6";

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "text-xs text-gray-500 hover:text-green-600";
        renameBtn.title = "Rename";
        renameBtn.textContent = "✏️";
        renameBtn.onclick = async (e) => {
          e.stopPropagation();
          const newName = await showModalPrompt("Rename data file:", item.name);
          if (newName) {
            quickDataFiles[index].name = newName;
            localStorage.setItem("quickDataFiles", JSON.stringify(quickDataFiles));
            renderQuickTemplates();
          }
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "text-xs text-gray-500 hover:text-red-600";
        deleteBtn.title = "Remove from Quick Data";
        deleteBtn.textContent = "🗑️";
        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          const confirmed = await showConfirm(
            "Remove Data File?",
            `Remove "${item.name}"?`
          );
          if (confirmed) {
            quickDataFiles = quickDataFiles.filter(f => f.path !== item.path);
            localStorage.setItem("quickDataFiles", JSON.stringify(quickDataFiles));
            renderQuickTemplates();
          }
        };

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        itemDiv.appendChild(nameLabel);
        itemDiv.appendChild(actionsDiv);
        quickTemplatesListRight.appendChild(itemDiv);
      });
    }
  } else {
    quickTemplatesPanel.classList.add("hidden");
  }

  const hasQuick = hasTemplates || hasData;
  if (pathFallback) {
    pathFallback.classList.toggle("hidden", hasQuick);
  }
}

function loadTemplateFromQuick(item) {
  templatePath = item.path;
  templateLabel.textContent = item.path;
  document.getElementById("compactTemplate").textContent = item.name;
  loadDocxPreview(item.path); // ✅ Now safe!
  previewCard.classList.remove("hidden");
  document.getElementById("addToQuickTemplates").classList.remove("hidden");
  updateGenerateButton();
}

document.getElementById("pickTemplate").addEventListener("click", async () => {
  const newPath = await open({
    filters: [{ name: "DOCX", extensions: ["docx"] }]
  });

  if (newPath) {
    templatePath = newPath;
    templateLabel.textContent = templatePath;
    document.getElementById("compactTemplate").textContent = 
      templatePath.split(/[\\/]/).pop();
    await loadDocxPreview(templatePath); // ✅ Now safe!
    previewCard.classList.remove("hidden");
    addToQuickBtn.classList.remove("hidden");
  } else {
    templatePath = null;
    templateLabel.textContent = "";
    document.getElementById("previewText").innerHTML = "";
    document.getElementById("compactTemplate").textContent = "No template";
    addToQuickBtn.classList.add("hidden");
  }
  updateGenerateButton();
  updatePreviewVisibility();
});

function updateGenerateButton() {
  const generateBtn = document.getElementById("generate");
  generateBtn.disabled = !(templatePath && dataPath && outputDir);
}

document.getElementById("pickData").addEventListener("click", async () => {
  const raw = await open({
    filters: [{ name: "Data", extensions: ["csv", "xlsx"] }]
  });

  const path = Array.isArray(raw) ? raw[0] : raw;
  dataPath = path ?? null;
  dataLabel.textContent = dataPath ?? "";
  dataFallbackLabel.textContent = dataPath ?? "";

  if (dataPath && dataPath.toLowerCase().endsWith(".xlsx")) {
    await loadXlsxPreview(dataPath); // ✅ Now safe!
    previewCard.classList.remove("hidden");
    addToQuickDataBtn.classList.remove("hidden");
  } else {
    document.getElementById("dataPreview").innerHTML = "";
  }

  updateGenerateButton();
  updatePreviewVisibility();
});

document.getElementById("pickOutput").addEventListener("click", async () => {
  outputDir = await open({ directory: true });
  outputLabel.textContent = outputDir ?? "";
  updateGenerateButton();
});

document.getElementById("clearTemplate").addEventListener("click", () => {
  templatePath = null;
  templateLabel.textContent = "";
  document.getElementById("previewText").innerHTML = "";
  document.getElementById("compactTemplate").textContent = "No template";
  document.getElementById("addToQuickTemplates").classList.add("hidden");
  updateGenerateButton();
  updatePreviewVisibility();
});

document.getElementById("clearData").addEventListener("click", () => {
  dataPath = null;
  dataLabel.textContent = "";
  dataFallbackLabel.textContent = "";
  document.getElementById("dataPreview").innerHTML = "";
  document.getElementById("compactData").textContent = "No data";
  document.getElementById("addToQuickData").classList.add("hidden");
  updateGenerateButton();
  updatePreviewVisibility();
});

document.getElementById("generate").addEventListener("click", async () => {
  if (!templatePath || !dataPath || !outputDir) {
    alert("Please select all inputs.");
    return;
  }

  try {
    await invoke("generate_docs", {
      templatePath,
      dataPath,
      outputDir,
    });
    alert("Documents generated successfully.");
  } catch (err) {
    alert("Error: " + err);
  }
});

let quickDataFiles = JSON.parse(localStorage.getItem("quickDataFiles") || "[]");
const addToQuickDataBtn = document.getElementById("addToQuickData");

addToQuickDataBtn.addEventListener("click", async () => {
  if (!dataPath) return;

  const defaultName = dataPath
    .split(/[\\/]/)
    .pop()
    .replace(/\.(xlsx|csv)$/i, "");

  const name = await showModalPrompt("Name this data file for quick access:", defaultName);

  if (name && name.trim()) {
    const cleanName = name.trim();
    const exists = quickDataFiles.some(f => f.path === dataPath);
    
    if (!exists) {
      quickDataFiles.push({ name: cleanName, path: dataPath });
      localStorage.setItem("quickDataFiles", JSON.stringify(quickDataFiles));
      renderQuickTemplates();
      alert(`✅ "${cleanName}" added to Quick Data!`);
    } else {
      alert("This data file is already in your quick list.");
    }
  }
});

function loadDataFromQuick(item) {
  dataPath = item.path;
  dataLabel.textContent = item.path;
  dataFallbackLabel.textContent = item.path;
  document.getElementById("compactData").textContent = item.name;
  if (dataPath.toLowerCase().endsWith(".xlsx")) {
    loadXlsxPreview(dataPath); // ✅ Now safe!
  } else {
    document.getElementById("dataPreview").innerHTML = "";
  }
  addToQuickDataBtn.classList.remove("hidden");
  updateGenerateButton();
  updatePreviewVisibility();
}

function updatePreviewVisibility() {
  const hasTemplate = !!templatePath;
  const hasData = !!dataPath;
  previewCard.classList.toggle("hidden", !hasTemplate && !hasData);
}

renderQuickTemplates();