// ./assets/components/docx_handler.js

//const mammoth = window.mammoth;
import mammoth from "mammoth";
import {
  getQuickTemplates,
  getQuickDataFiles,
  getQuickOutputFolders
} from "../states/quickstore.js";

import { showConfirm, showModalPrompt } from "./modal.js";

// Export preview function
export async function loadDocxPreview(filePath) {
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
    document.getElementById("previewText").innerHTML = result.value || "<em>Empty document</em>";
  } catch (err) {
    console.error("Preview error:", err);
    document.getElementById("previewText").innerHTML =
      `<em>Failed to load preview: ${err.message || err}</em>`;
  }
}

// Export renderer — now accepts callbacks
// Export renderer — now accepts callbacks
export function renderQuickTemplates({ onTemplateClick, onDataClick, onOutputClick }) {
  const quickTemplatesPanel = document.getElementById("quickTemplatesPanel");
  const quickTemplatesListRight = document.getElementById("quickTemplatesListRight");
  const pathFallback = document.getElementById("pathFallback");

  if (!quickTemplatesPanel || !quickTemplatesListRight) return;

  const templates = getQuickTemplates();
  const dataFiles = getQuickDataFiles();
  const outputFolders = getQuickOutputFolders();

  const hasTemplates = templates.length > 0;
  const hasData = dataFiles.length > 0;
  const hasOutput = outputFolders.length > 0;

  const hasAny = hasTemplates || hasData || hasOutput;

  if (hasAny) {
    quickTemplatesPanel.classList.remove("hidden");
    quickTemplatesListRight.innerHTML = ""; // Clear first

    let sectionCount = 0;

    // Render Templates
    if (hasTemplates) {
      if (sectionCount > 0) {
        // Add divider before this section
        const divider = document.createElement("hr");
        divider.className = "my-4 border-gray-200";
        quickTemplatesListRight.appendChild(divider);
      }
      
      const header = document.createElement("div");
      header.className = "w-full text-xs font-medium text-gray-500 uppercase tracking-wide";
      header.textContent = "Templates";
      quickTemplatesListRight.appendChild(header);

      templates.forEach((item) => {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between group py-1";

        const name = document.createElement("span");
        name.className = "text-xs text-blue-800 cursor-pointer truncate flex-1 mr-2";
        name.textContent = item.name;
        name.title = item.path;
        name.onclick = () => onTemplateClick(item);

        const actions = document.createElement("div");
        actions.className = "flex items-center gap-2";

        const rename = document.createElement("button");
        rename.className = "text-xs text-gray-500 hover:text-blue-600";
        rename.textContent = "✏️";
        rename.onclick = async (e) => {
          e.stopPropagation();
          const newName = await showModalPrompt("Rename template:", item.name);
          if (newName) {
            import("../states/quickstore.js").then(({ renameQuickTemplate }) => {
              renameQuickTemplate(item.path, newName);
              renderQuickTemplates({ onTemplateClick, onDataClick, onOutputClick });
            });
          }
        };

        const del = document.createElement("button");
        del.className = "text-xs text-gray-500 hover:text-red-600";
        del.textContent = "🗑️";
        del.onclick = async (e) => {
          e.stopPropagation();
          const confirmed = await showConfirm("Remove Template?", `Remove "${item.name}"?`);
          if (confirmed) {
            import("../states/quickstore.js").then(({ removeQuickTemplate }) => {
              removeQuickTemplate(item.path);
              renderQuickTemplates({ onTemplateClick, onDataClick, onOutputClick });
            });
          }
        };

        actions.append(rename, del);
        div.append(name, actions);
        quickTemplatesListRight.appendChild(div);
      });
      
      sectionCount++;
    }

    // Render Data Files
    if (hasData) {
      if (sectionCount > 0) {
        const divider = document.createElement("hr");
        divider.className = "my-4 border-gray-200";
        quickTemplatesListRight.appendChild(divider);
      }
      
      const header = document.createElement("div");
      header.className = "w-full text-xs font-medium text-gray-500 uppercase tracking-wide";
      header.textContent = "Data Files";
      quickTemplatesListRight.appendChild(header);

      dataFiles.forEach((item) => {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between group py-1";

        const name = document.createElement("span");
        name.className = "text-xs text-green-800 cursor-pointer truncate flex-1 mr-2";
        name.textContent = item.name;
        name.title = item.path;
        name.onclick = () => onDataClick(item);

        const actions = document.createElement("div");
        actions.className = "flex items-center gap-2";

        const rename = document.createElement("button");
        rename.className = "text-xs text-gray-500 hover:text-green-600";
        rename.textContent = "✏️";
        rename.onclick = async (e) => {
          e.stopPropagation();
          const newName = await showModalPrompt("Rename data file:", item.name);
          if (newName) {
            import("../states/quickstore.js").then(({ renameQuickData }) => {
              renameQuickData(item.path, newName);
              renderQuickTemplates({ onTemplateClick, onDataClick, onOutputClick });
            });
          }
        };

        const del = document.createElement("button");
        del.className = "text-xs text-gray-500 hover:text-red-600";
        del.textContent = "🗑️";
        del.onclick = async (e) => {
          e.stopPropagation();
          const confirmed = await showConfirm("Remove Data File?", `Remove "${item.name}"?`);
          if (confirmed) {
            import("../states/quickstore.js").then(({ removeQuickData }) => {
              removeQuickData(item.path);
              renderQuickTemplates({ onTemplateClick, onDataClick, onOutputClick });
            });
          }
        };

        actions.append(rename, del);
        div.append(name, actions);
        quickTemplatesListRight.appendChild(div);
      });
      
      sectionCount++;
    }

    // Render Output Folders
    if (hasOutput) {
      if (sectionCount > 0) {
        const divider = document.createElement("hr");
        divider.className = "my-4 border-gray-200";
        quickTemplatesListRight.appendChild(divider);
      }
      
      const header = document.createElement("div");
      header.className = "w-full text-xs font-medium text-gray-500 uppercase tracking-wide";
      header.textContent = "Output Folders";
      quickTemplatesListRight.appendChild(header);

      outputFolders.forEach((item) => {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between group py-1";

        const name = document.createElement("span");
        name.className = "text-xs text-purple-800 cursor-pointer truncate flex-1 mr-2";
        name.textContent = item.name;
        name.title = item.path;
        name.onclick = () => onOutputClick(item);

        const actions = document.createElement("div");
        actions.className = "flex items-center gap-2";

        const rename = document.createElement("button");
        rename.className = "text-xs text-gray-500 hover:text-purple-600";
        rename.textContent = "✏️";
        rename.onclick = async (e) => {
          e.stopPropagation();
          const newName = await showModalPrompt("Rename output folder:", item.name);
          if (newName) {
            import("../states/quickstore.js").then(({ renameQuickOutput }) => {
              renameQuickOutput(item.path, newName);
              renderQuickTemplates({ onTemplateClick, onDataClick, onOutputClick });
            });
          }
        };

        const del = document.createElement("button");
        del.className = "text-xs text-gray-500 hover:text-red-600";
        del.textContent = "🗑️";
        del.onclick = async (e) => {
          e.stopPropagation();
          const confirmed = await showConfirm("Remove Output Folder?", `Remove "${item.name}"?`);
          if (confirmed) {
            import("../states/quickstore.js").then(({ removeQuickOutput }) => {
              removeQuickOutput(item.path);
              renderQuickTemplates({ onTemplateClick, onDataClick, onOutputClick });
            });
          }
        };

        actions.append(rename, del);
        div.append(name, actions);
        quickTemplatesListRight.appendChild(div);
      });
    }
  } else {
    quickTemplatesPanel.classList.add("hidden");
  }

  // Update fallback visibility
  if (pathFallback) {
    pathFallback.classList.toggle("hidden", hasAny);
  }
}