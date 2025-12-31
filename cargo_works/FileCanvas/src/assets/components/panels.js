// public/assets/components/panels.js

import { folderCache, panelSortOrder, refreshFolderNode, refreshPanelByRootPath, renderTree } from './fileTree.js';
import { showSnackbar, showInputModal, createTrashIcon } from './uiUtils.js';
import { sortItems } from './sorting.js';
import { fileapi } from '../fileapi.js';
import { activeArrow } from './connections.js';
import { getRedrawFn } from './connections.js';
import { connections } from './connections.js';
import { makeResizable } from './resize.js';

const redrawFn =  getRedrawFn()

let panelId = 0;
const Z_INDEX_BASE = 10;
export function makeDraggable(element) {
  let isDragging = false;
  let offsetX, offsetY;

  const handleStart = (e) => {
    if (e.target.closest('input, button, textarea, select, a, .tree-container')) {
      return;
    }
    isDragging = true;
    element.style.zIndex = Z_INDEX_BASE + 1000;
    element.classList.add('ring-2', 'ring-slate-300');
    const rect = element.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    redrawFn();
  };

  const handleEnd = () => {
    if (isDragging) {
      isDragging = false;
      element.classList.remove('shadow-xl', 'ring-2', 'ring-slate-300');
    }
  };

  element.addEventListener('mousedown', handleStart);
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleEnd);
  element.addEventListener('selectstart', (e) => e.preventDefault());
}

export function createPanel(type, value, left, top, fileapi, redrawFn) {
  const id = `panel-${panelId++}`;
  const isSource = type === 'source';
  const bgColor = isSource ? 'bg-indigo-50' : 'bg-blue-50';
  const borderColor = isSource ? 'border-indigo-200' : 'border-blue-200';
  const label = isSource ? '📁 Source' : '📍 Destination';
  const icon = isSource ? 'fa-folder' : 'fa-map-marker-alt';
  const placeholder = isSource 
    ? 'e.g., /home/user/Documents' 
    : 'e.g., D:\\Backup';

  const panel = document.createElement('div');
  panel.id = id;
  panel.dataset.type = type;
  //panel.className = `p-5 w-[420px] rounded-xl border ${borderColor} ${bgColor} shadow-lg absolute cursor-move select-none`;
  panel.className = `p-5 w-[420px] rounded-xl border ${borderColor} ${bgColor} shadow-lg absolute cursor-move select-none overflow-hidden`;
  if (left === null) left = 50 + (panelId * 30) % 300;
  if (top === null) top = 120 + (panelId * 40) % 200;

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.zIndex = Z_INDEX_BASE + panelId;

 // Inside createPanel, replace the panel.innerHTML with this:
panel.innerHTML = `
  <div class="flex items-center drag-handle
        bg-slate-200 border-b border-slate-300
        px-4 py-2 rounded-t-xl cursor-move relative">
    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
      ⋮⋮
    </span>
    <div class="flex items-center gap-3 ml-6">
      <i class="fas ${icon} text-lg ${isSource ? 'text-indigo-600' : 'text-blue-600'}"></i>
      <h2 class="text-lg font-semibold ${isSource ? 'text-indigo-800' : 'text-blue-800'}">
        ${label}
      </h2>
    </div>
    <!-- ✅ ADD THIS: Sort dropdown -->
      <div class="ml-2 relative" id="sort-container-${id}">
        <button class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
          Sort: Name
        </button>
      </div>
    <!-- ✅ ADD THIS: New item button -->
    <div class="ml-2 relative">
      <button
        class="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
        id="add-root-btn-${id}"
        title="Add new item">
        +
      </button>
    </div>
    <div class="ml-auto flex items-center gap-1">
      <button
        class="w-7 h-7 flex items-center justify-center
              rounded-full bg-slate-300 text-slate-700
              hover:bg-slate-400 hover:scale-110
              active:scale-95
              transition-all duration-200
              shadow-inner"
        data-collapse="${id}"
        title="Collapse panel">
        <span class="collapse-icon block transition-transform duration-300">▾</span>
      </button>
      <button
        class="px-2 text-lg font-bold text-gray-600
              hover:text-white hover:bg-red-500
              rounded transition-colors"
        data-close="${id}">
        ×
      </button>
    </div>
  </div>
  <div class="panel-body mt-2 transition-all duration-300">
    <input 
      type="text" 
      value="${value}"
      placeholder="${placeholder}" 
      class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${isSource ? 'indigo' : 'blue'}-500 focus:border-transparent outline-none mt-2"
    />
    <div class="tree-container mt-3 border-t pt-2 pr-8 max-h-[260px] overflow-y-auto overscroll-contain"></div>
    <div class="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 hover:bg-blue-400 transition-colors rounded-tl-lg opacity-50 hover:opacity-100"></div>
  </div>
  
`;
  const dragHandle = panel.querySelector('.drag-handle');
  dragHandle.style.cursor = 'move';

  document.body.appendChild(panel);
  makeDraggable(panel);
  makeResizable(panel);
  
  // ... after document.body.appendChild(panel) ...
  // Inside createPanel, after panel creation:
  panelSortOrder.set(id, 'name');
// ✅ Set up root-level add button
const addRootBtn = panel.querySelector(`#add-root-btn-${id}`);
if (addRootBtn) {
  const dropdown = document.createElement("div");
  dropdown.className = "add-dropdown hidden absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200";
  dropdown.innerHTML = `
    <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-2">
      <i class="fas fa-folder-plus text-indigo-500"></i>
      New Folder
    </button>
    <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-2">
      <i class="fas fa-file-plus text-indigo-500"></i>
      New File
    </button>
  `;
  addRootBtn.parentNode.appendChild(dropdown);

  // Toggle dropdown
  addRootBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener("click", function closeDropdown(e) {
      if (!addRootBtn.closest('.relative').contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    }, { once: true });
  });

  // New Folder at root
  dropdown.children[0].addEventListener("click", async (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    
    const name = await showInputModal("New Folder", "Folder name:", "New Folder");
    if (!name || name.trim() === "") {
      showSnackbar("Folder name cannot be empty", "error");
      return;
    }
    
    try {
      const rootPath = panel.querySelector('input').value.trim();
      await fileapi.createFolder(rootPath, name.trim());
      folderCache.delete(rootPath); // invalidate cache
      const treeContainer = panel.querySelector(".tree-container");
      treeContainer.textContent = "Loading...";
      const tree = await fileapi.readFolder(rootPath);
      folderCache.set(rootPath, tree);
      treeContainer.textContent = "";
      treeContainer.appendChild(renderTree(tree));
      redrawFn();
      showSnackbar(`Created folder "${name}"`, "success");
    } catch (err) {
      console.error("Failed to create folder:", err);
      showSnackbar("Failed to create folder", "error");
    }
  });

  // New File at root
  dropdown.children[1].addEventListener("click", async (e) => {
    e.stopPropagation();
    dropdown.classList.add("hidden");
    
    const name = await showInputModal("New File", "File name:", "untitled.txt");
    if (!name || name.trim() === "") {
      showSnackbar("File name cannot be empty", "error");
      return;
    }
    
    try {
      const rootPath = panel.querySelector('input').value.trim();
      await fileapi.createFile(rootPath, name.trim());
      folderCache.delete(rootPath);
      const treeContainer = panel.querySelector(".tree-container");
      treeContainer.textContent = "Loading...";
      const tree = await fileapi.readFolder(rootPath);
      folderCache.set(rootPath, tree);
      treeContainer.textContent = "";
      treeContainer.appendChild(renderTree(tree));
      redrawFn();
      showSnackbar(`Created file "${name}"`, "success");
    } catch (err) {
      console.error("Failed to create file:", err);
      showSnackbar("Failed to create file", "error");
    }
  });
}
// ✅ Set up sort dropdown
const sortContainer = panel.querySelector(`#sort-container-${id}`);
if (sortContainer) {
  const sortButton = sortContainer.querySelector('button');
  const sortDropdown = document.createElement("div");
  sortDropdown.className = "sort-dropdown hidden absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200";
  sortDropdown.innerHTML = `
    <button data-sort="name" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${panelSortOrder.get(id) === 'name' ? 'font-semibold bg-indigo-50' : ''}">
      Name (A–Z)
    </button>
    <button data-sort="modified" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${panelSortOrder.get(id) === 'modified' ? 'font-semibold bg-indigo-50' : ''}">
      Date Modified (Newest)
    </button>
    <button data-sort="created" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${panelSortOrder.get(id) === 'created' ? 'font-semibold bg-indigo-50' : ''}">
      Date Added (Newest)
    </button>
  `;
  sortContainer.appendChild(sortDropdown);

  sortButton.addEventListener('click', (e) => {
    e.stopPropagation();
    sortDropdown.classList.toggle('hidden');
  });

  // Close dropdown on outside click
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!sortContainer.contains(e.target)) {
        sortDropdown.classList.add('hidden');
      }
    }, { once: true });
  });

  // Handle sort selection
  sortDropdown.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sortBy = btn.dataset.sort;
      panelSortOrder.set(id, sortBy);
      sortDropdown.classList.add('hidden');

      // Update button text
      const labelMap = { name: 'Name', modified: 'Modified', created: 'Added' };
      sortButton.textContent = `Sort: ${labelMap[sortBy]}`;

      // Refresh panel tree with new sort order
      const input = panel.querySelector('input');
      const rootPath = input?.value.trim();
      if (rootPath) {
        const treeContainer = panel.querySelector('.tree-container');
        treeContainer.textContent = 'Loading...';
        try {
          const children = await fileapi.readFolder(rootPath);
          folderCache.set(rootPath, children);
          const sortedChildren = sortItems(children, sortBy);
          treeContainer.textContent = '';
          treeContainer.appendChild(renderTree(sortedChildren));
          redrawFn();
        } catch (err) {
          treeContainer.textContent = 'Failed to load folder';
          console.error(err);
        }
      }
    });
  });
}

  const treeContainer = panel.querySelector('.tree-container');
  if (treeContainer) {
    let scrollDebounce;
    treeContainer.addEventListener('scroll', () => {
      if (activeArrow) {
        activeArrow.path.remove();
        activeArrow = null;
      }
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(redrawFn, 16);
    });
  }

  return panel;
}
// Collapse / Expand panel
// Collapse / Expand panel
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-collapse]");
  if (!btn) return;

  const id = btn.getAttribute("data-collapse");
  const panel = document.getElementById(id);
  if (!panel) return;

  const body = panel.querySelector(".panel-body");
  const icon = btn.querySelector(".collapse-icon");
  if (!body || !icon) return;

  const isCollapsed = body.classList.toggle("hidden");
  icon.style.transform = isCollapsed ? "rotate(-90deg)" : "rotate(0deg)";

  // ✅ IMMEDIATELY update connections: hide individual lines, show summary if needed
  redrawFn(); // This is your global redrawAllConnections
});

// Close panel
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;

  const id = btn.getAttribute("data-close");
  const panel = document.getElementById(id);
  if (!panel) return;

  // ✅ Remove highlight from this panel before removing it
  panel.querySelectorAll('.just-transferred').forEach(el => {
    el.classList.remove('just-transferred');
  });

  // Clean up connections
  for (let i = connections.length - 1; i >= 0; i--) {
    const c = connections[i];
    if (!document.body.contains(c.fromEl) || !document.body.contains(c.toEl)) {
      removeSummaryLine(c.fromEl, c.toEl);
      c.pathEl.remove();
      c.cancelBtn.remove();
      connections.splice(i, 1);
    }
  }
  panel.remove();
});