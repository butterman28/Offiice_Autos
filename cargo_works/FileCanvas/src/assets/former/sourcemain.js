import { fileapi } from "/assets/fileapi.js";

const folderCache = new Map();
const container = document.getElementById('panelsContainer');
if (!container) console.log("broken ");

let panelId = 0;
const Z_INDEX_BASE = 10;

// Add a single global SVG overlay for arrows and stuff 
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svg.id = "connections-layer";
svg.style.position = "fixed";
svg.style.inset = "0";
svg.style.pointerEvents = "none";
svg.style.zIndex = "10000"; // below panels, above background
document.body.appendChild(svg);

// Arrowhead marker
svg.innerHTML = `
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7"
      refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#4f46e5" />
    </marker>
  </defs>
`;

svg.setAttribute("width", "100%");
svg.setAttribute("height", "100%");
svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);

const connections = [];
const summaryLines = new Map(); // key: "panelA-panelB", value: { line, label, count }
const panelSortOrder = new Map();
let activeArrow = null;

// ✅ REPLACED: Check if dot is visible inside its panel's scroll container
function isDotVisibleInPanel(dot) {
  const panel = dot.closest('[id^="panel-"]');
  if (!panel) return false;

  const treeContainer = panel.querySelector('.tree-container');
  if (!treeContainer) return false;

  const dotRect = dot.getBoundingClientRect();
  const containerRect = treeContainer.getBoundingClientRect();

  return (
    dotRect.top >= containerRect.top &&
    dotRect.left >= containerRect.left &&
    dotRect.bottom <= containerRect.bottom &&
    dotRect.right <= containerRect.right
  );
}

// Utility: Accurately check if a path is a directory
async function isDirectory(path) {
  try {
    return await fileapi.isDir(path);
  } catch (err) {
    console.warn(`isDirectory failed for ${path}:`, err);
    return false;
  }
}

// Helper: get panel ID from dot
function getPanelIdFromDot(dot) {
  return dot.closest('[id^="panel-"]')?.id || null;
}

// Helper: get consistent summary key
function getSummaryKey(panelA, panelB) {
  return [panelA, panelB].sort().join('-');
}

// ✅ FIXED: refresh after adding new folder/file
async function refreshFolderNode(folderPath, li) {
  // Find existing subtree container
  let subtreeContainer = li.querySelector('.subtree-container');
  if (!subtreeContainer) {
    // Create container if missing (shouldn't happen, but safety)
    subtreeContainer = document.createElement('div');
    subtreeContainer.className = 'subtree-container ml-4';
    li.appendChild(subtreeContainer);
  }

  try {
    const children = await fileapi.readFolder(folderPath);
    folderCache.set(folderPath, children);

    if (children.length === 0) {
      subtreeContainer.innerHTML = '<div class="ml-6 text-xs text-slate-400 italic">(empty)</div>';
      return;
    }

    const newTree = renderTree(children);
    subtreeContainer.innerHTML = '';
    subtreeContainer.appendChild(newTree);
  } catch (err) {
    console.error("Failed to refresh folder:", err);
    subtreeContainer.textContent = "Refresh failed";
  }
}
// Refresh all top-level items in a panel that shows `rootPath`
function refreshPanelByRootPath(rootPath) {
  // Find all panels where input.value matches rootPath (or is ancestor)
  document.querySelectorAll('[id^="panel-"]').forEach(panel => {
    const input = panel.querySelector('input');
    const panelPath = input?.value.trim();
    if (!panelPath) return;

    // Only refresh if this panel is showing the affected folder (or ancestor)
    if (rootPath === panelPath || rootPath.startsWith(panelPath + '/')) {
      const treeContainer = panel.querySelector('.tree-container');
      if (!treeContainer) return;

      // Re-render top-level tree
      treeContainer.textContent = "Loading...";
      fileapi.readFolder(panelPath)
        .then(children => {
          folderCache.set(panelPath, children);
          treeContainer.textContent = "";
          treeContainer.appendChild(renderTree(children));
          redrawAllConnections(); // Optional: in case dots moved
        })
        .catch(err => {
          treeContainer.textContent = "Failed to refresh";
          console.error(err);
        });
    }
  });
}

function createTrashIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("fill", "none");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("class", "w-4 h-4");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute(
    "d",
    "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79c.34-.059.68-.114 1.022-.166m0 0L6.75 19.5a2.25 2.25 0 002.244 2.25h6.012a2.25 2.25 0 002.244-2.25L17.25 5.79m-10.5 0h10.5M9 5.25V4.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 4.5v.75"
  );

  svg.appendChild(path);
  return svg;
}

function showSnackbar(message, type = 'error') {
  const snackbar = document.getElementById('snackbar');
  if (!snackbar) return;

  // Set message
  snackbar.textContent = message;

  // Set color based on type
  snackbar.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 ' +
    'px-4 py-3 rounded-lg shadow-lg text-white font-medium z-[20000] ' +
    'opacity-0 pointer-events-none transition-all duration-300 ease-in-out ';

  if (type === 'success') {
    snackbar.classList.add('bg-green-500');
  } else if (type === 'warning') {
    snackbar.classList.add('bg-yellow-500', 'text-gray-900');
  } else {
    snackbar.classList.add('bg-red-500');
  }

  // Show
  setTimeout(() => {
    snackbar.classList.replace('opacity-0', 'opacity-100');
    snackbar.classList.replace('pointer-events-none', 'pointer-events-auto');
  }, 10);

  // Hide after 3 seconds
  setTimeout(() => {
    snackbar.classList.replace('opacity-100', 'opacity-0');
    snackbar.classList.replace('pointer-events-auto', 'pointer-events-none');
  }, 3000);
}

function showConfirmModal(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmModalMessage');
    const yesBtn = document.getElementById('confirmModalYes');
    const noBtn = document.getElementById('confirmModalNo');
    
    messageEl.textContent = message;
    modal.classList.remove('hidden');
    
    function handleYes() {
      cleanup();
      resolve(true);
    }
    
    function handleNo() {
      cleanup();
      resolve(false);
    }
    
    function cleanup() {
      modal.classList.add('hidden');
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
    }
    
    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
  });
}

function showInputModal(title, label, defaultValue = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmModalMessage');
    const yesBtn = document.getElementById('confirmModalYes');
    const noBtn = document.getElementById('confirmModalNo');
    
    // Save original content
    const originalMessage = messageEl.innerHTML;
    const originalYesText = yesBtn.textContent;
    const originalNoText = noBtn.textContent;
    
    // Setup input modal
    messageEl.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-2">${label}</label>
      <input type="text" id="inputModalInput" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" value="${defaultValue}" />
    `;
    yesBtn.textContent = "OK";
    noBtn.textContent = "Cancel";
    
    modal.classList.remove('hidden');
    
    const input = document.getElementById('inputModalInput');
    input.focus();
    
    function handleYes() {
      cleanup();
      resolve(input.value);
    }
    
    function handleNo() {
      cleanup();
      resolve(null);
    }
    
    function cleanup() {
      modal.classList.add('hidden');
      messageEl.innerHTML = originalMessage;
      yesBtn.textContent = originalYesText;
      noBtn.textContent = originalNoText;
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
    }
    
    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
  });
}

///Start arrow (source can be file OR folder)
function startArrowFrom(fromPath, fromEl) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", "#4f46e5");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("fill", "none");
  path.setAttribute("marker-end", "url(#arrowhead)");

  svg.appendChild(path);

  activeArrow = {
    fromPath,
    fromEl,
    path
  };
}

function createCancelButton(onClick) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.style.cursor = "pointer";
  g.style.pointerEvents = "auto";

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("r", "8");
  circle.setAttribute("fill", "#ef4444");

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.setAttribute("fill", "white");
  text.setAttribute("font-size", "12");
  text.textContent = "×";

  g.append(circle, text);

  g.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    onClick();
  });

  return g;
}

function clientToSvg(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// NEW: Create or update summary line between panels
function createOrUpdateSummaryLine(fromDot, toDot) {
  const panelFrom = getPanelIdFromDot(fromDot);
  const panelTo = getPanelIdFromDot(toDot);
  if (!panelFrom || !panelTo || panelFrom === panelTo) return;

  const key = getSummaryKey(panelFrom, panelTo);
  if (!summaryLines.has(key)) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "#4f46e5");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-dasharray", "6,4");
    line.setAttribute("opacity", "0.6");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("fill", "#4f46e5");
    label.setAttribute("font-size", "12");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");

    group.append(line, label);
    svg.appendChild(group);

    summaryLines.set(key, {
      fromPanel: panelFrom,
      toPanel: panelTo,
      line,
      label,
      count: 0,
      group
    });
  }

  const summary = summaryLines.get(key);
  summary.count++;
  if (summary.count > 0) {
    summary.label.textContent = `${summary.count}`;
  }
}

// NEW: Remove from summary line count
function removeSummaryLine(fromDot, toDot) {
  const panelFrom = getPanelIdFromDot(fromDot);
  const panelTo = getPanelIdFromDot(toDot);
  if (!panelFrom || !panelTo) return;

  const key = getSummaryKey(panelFrom, panelTo);
  const summary = summaryLines.get(key);
  if (!summary) return;

  summary.count--;
  if (summary.count <= 0) {
    summary.group.remove();
    summaryLines.delete(key);
  } else {
    summary.label.textContent = `${summary.count}`;
  }
}

// NEW: Redraw summary lines (between panels)
function redrawSummaryLines() {
  for (const [key, summary] of summaryLines.entries()) {
    const panelA = document.getElementById(summary.fromPanel);
    const panelB = document.getElementById(summary.toPanel);

    if (!panelA || !panelB) {
      summary.group.remove();
      summaryLines.delete(key);
      continue;
    }

    // Keep using viewport for summary lines (panels may be off-screen globally)
    const aVisible = panelA.getBoundingClientRect().top < window.innerHeight && panelA.getBoundingClientRect().bottom > 0;
    const bVisible = panelB.getBoundingClientRect().top < window.innerHeight && panelB.getBoundingClientRect().bottom > 0;
    summary.group.style.display = (aVisible || bVisible) ? "block" : "none";

    if (!aVisible && !bVisible) continue;

    const aRect = panelA.getBoundingClientRect();
    const bRect = panelB.getBoundingClientRect();

    const start = clientToSvg(aRect.left + aRect.width / 2, aRect.top + 20);
    const end = clientToSvg(bRect.left + bRect.width / 2, bRect.top + 20);

    summary.line.setAttribute("x1", start.x);
    summary.line.setAttribute("y1", start.y);
    summary.line.setAttribute("x2", end.x);
    summary.line.setAttribute("y2", end.y);

    summary.label.setAttribute("x", (start.x + end.x) / 2);
    summary.label.setAttribute("y", (start.y + end.y) / 2 - 10);
  }
}

// ✅ UPDATED: Only show arrow if both dots are visible INSIDE their panels
function redrawSingleConnection(c) {
  const fromVisible = isDotVisibleInPanel(c.fromEl);
  const toVisible = isDotVisibleInPanel(c.toEl);

  if (!fromVisible || !toVisible) {
    c.pathEl.style.display = "none";
    c.cancelBtn.style.display = "none";
    return;
  }

  const a = c.fromEl.getBoundingClientRect();
  const b = c.toEl.getBoundingClientRect();

  const start = clientToSvg(
    a.left + a.width / 2,   // ✅ CENTER of source dot
    a.top + a.height / 2
  );

  const end = clientToSvg(
    b.left + b.width / 2,   // ✅ CENTER of target dot
    b.top + b.height / 2
  );

  c.pathEl.setAttribute("d", `M ${start.x},${start.y} L ${end.x},${end.y}`);
  c.pathEl.style.display = "block";
  c.cancelBtn.style.display = "block";

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  c.cancelBtn.setAttribute("transform", `translate(${midX}, ${midY})`);
}

// Create panel — now absolutely positioned
function createPanel(type, value = '', left = null, top = null) {
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
  panel.className = `p-5 w-[420px] rounded-xl border ${borderColor} ${bgColor} shadow-lg absolute cursor-move select-none`;

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
  </div>
`;
  const dragHandle = panel.querySelector('.drag-handle');
  dragHandle.style.cursor = 'move';

  document.body.appendChild(panel);
  makeDraggable(panel);
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
      redrawAllConnections();
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
      redrawAllConnections();
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
          redrawAllConnections();
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
      scrollDebounce = setTimeout(redrawAllConnections, 16);
    });
  }

  return panel;
}

// UPDATED: redraw summary + detail
function redrawAllConnections() {
  redrawSummaryLines();
  for (const c of connections) {
    redrawSingleConnection(c);
  }
}

// Supported sort types: 'name', 'modified', 'created'
function sortItems(items, sortBy = 'name') {
  return [...items].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'modified') {
      // Most recent first
      return (b.mtime || 0) - (a.mtime || 0);
    } else if (sortBy === 'created') {
      // Most recent first (use ctime if available, fallback to mtime)
      const aTime = a.ctime || a.mtime || 0;
      const bTime = b.ctime || b.mtime || 0;
      return bTime - aTime;
    }
    return 0;
  });
}

//Render file tree
function renderTree(items) {
  const ul = document.createElement("ul");
  ul.className = "ml-4 mt-2 space-y-1 text-sm";

  for (const item of items) {
    const li = document.createElement("li");

    if (item.is_directory) {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 group";

      const label = document.createElement("div");
      label.dataset.folderPath = item.path;
      label.className = "cursor-pointer font-medium text-indigo-700 hover:underline truncate max-w-[200px]";
      label.textContent = `📁 ${item.name}`;
      label.title = item.path;

      // ✅ Use consistent subtree container (no more childContainer variable)
      // Inside renderTree, in the folder click handler:
label.addEventListener("click", async () => {
  const existingContainer = li.querySelector('.subtree-container');
  
  if (existingContainer) {
    existingContainer.remove();
    redrawAllConnections(); // ✅ ADD THIS LINE
    return;
  }

  const subtreeContainer = document.createElement('div');
  subtreeContainer.className = 'subtree-container ml-4';
  subtreeContainer.innerHTML = '<div class="text-sm text-slate-500">Loading...</div>';
  li.appendChild(subtreeContainer);

  // Replace the subtree rendering part with:
    try {
      let children;
      if (folderCache.has(item.path)) {
        children = folderCache.get(item.path);
      } else {
        children = await fileapi.readFolder(item.path);
        folderCache.set(item.path, children);
      }

      // ✅ Get sort order from the panel this folder belongs to
      const panel = li.closest('[id^="panel-"]');
      const panelId = panel?.id;
      const sortBy = panelId ? panelSortOrder.get(panelId) || 'name' : 'name';
      const sortedChildren = sortItems(children, sortBy);

      if (sortedChildren.length === 0) {
        subtreeContainer.innerHTML = '<div class="ml-6 text-xs text-slate-400 italic">(empty)</div>';
      } else {
        const subtree = renderTree(sortedChildren); // 👈 pass sorted list
        subtreeContainer.innerHTML = '';
        subtreeContainer.appendChild(subtree);
      }
    redrawAllConnections(); // ✅ ADD THIS LINE
  } catch (err) {
    subtreeContainer.textContent = "Failed to load folder";
    console.error(err);
  }
});

      // ADD button 
      const addBtnContainer = document.createElement("div");
      addBtnContainer.className = "relative ml-auto";

      const addBtn = document.createElement("button");
      addBtn.className = "text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition";
      addBtn.textContent = "+";
      addBtn.title = "Add new item";
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dropdown = addBtnContainer.querySelector('.add-dropdown');
        dropdown.classList.toggle('hidden');
      });

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

      // Close dropdown when clicking outside
      setTimeout(() => {
        document.addEventListener("click", function closeDropdown(e) {
          if (!addBtnContainer.contains(e.target)) {
            dropdown.classList.add("hidden");
          }
        }, { once: true });
      });

      // New Folder
      dropdown.children[0].addEventListener("click", async (e) => {
        e.stopPropagation();
        dropdown.classList.add("hidden");
        
        const name = await showInputModal("New Folder", "Folder name:", "New Folder");
        if (!name || name.trim() === "") {
          showSnackbar("Folder name cannot be empty", "error");
          return;
        }
        
        try {
          console.log(item.path);
          await fileapi.createFolder(item.path, name.trim());

          // invalidate cache
          folderCache.delete(item.path);

          // refresh UI - now uses li correctly
          await refreshFolderNode(item.path, li);
          redrawAllConnections();

          showSnackbar(`Created folder "${name}"`, "success");
        } catch (err) {
          console.error("Failed to create folder:", err);
          showSnackbar(`Failed to create folder`, "error");
        }
      });

      // New File
      dropdown.children[1].addEventListener("click", async (e) => {
        e.stopPropagation();
        dropdown.classList.add("hidden");
        
        const name = await showInputModal("New File", "File name:", "untitled.txt");
        if (!name || name.trim() === "") {
          showSnackbar("File name cannot be empty", "error");
          return;
        }
        
        try {
          await fileapi.createFile(item.path, name.trim());
          // invalidate cache
          folderCache.delete(item.path);

          // refresh UI
          await refreshFolderNode(item.path, li);
          redrawAllConnections();


          showSnackbar(`Created file "${name}"`, "success");
        } catch (err) {
          console.error("Failed to create file:", err);
          showSnackbar(`Failed to create file`, "error");
        }
      });

      addBtnContainer.append(addBtn, dropdown);

      //Delete Button
      const delBtn = document.createElement("button");
      delBtn.className = "text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition";
      delBtn.textContent = "";
      delBtn.appendChild(createTrashIcon());
      delBtn.title = "Delete folder";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        const confirmed = await showConfirmModal(`Are you sure you want to delete "${item.name}"?\nThis cannot be undone.`);
        if (!confirmed) return;
        try {
          await fileapi.deleteItem(item.path);
          li.remove();
          folderCache.delete(item.path); // safe to delete even if not present
          showSnackbar(`Deleted "${item.name}"`, "success");
        } catch (err) {
          console.error("Failed to delete item:", err);
          showSnackbar(`Failed to delete "${item.name}"`, "error");
        }
      });

      const dot = document.createElement("div");
      dot.dataset.folderPath = item.path;
      dot.className = "w-2.5 h-2.5 rounded-full bg-indigo-400 cursor-crosshair hover:bg-indigo-600 transition";
      dot.title = "Drag to connect";
      dot.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        startArrowFrom(item.path, dot);
      });

      row.append(label, addBtnContainer, delBtn, dot);
      li.appendChild(row);
    } else {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 group";

      const label = document.createElement("div");
      label.className = "text-gray-700 truncate max-w-[200px]";
      label.textContent = `📄 ${item.name}`;
      label.title = item.path;

      const delBtn = document.createElement("button");
      delBtn.className = "ml-auto text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition";
      delBtn.textContent = "";
      delBtn.appendChild(createTrashIcon());
      delBtn.title = "Delete file";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        const confirmed = await showConfirmModal(`Are you sure you want to delete "${item.name}"?\nThis cannot be undone.`);
        if (!confirmed) return;
        try {
          await fileapi.deleteItem(item.path);
          li.remove();
          showSnackbar(`Deleted "${item.name}"`, "success");
        } catch (err) {
          console.error("Failed to delete item:", err);
          showSnackbar(`Failed to delete "${item.name}"`, "error");
        }
      });

      const dot = document.createElement("div");
      dot.dataset.folderPath = item.path;
      dot.className = "w-2.5 h-2.5 rounded-full bg-gray-400 cursor-crosshair hover:bg-gray-600 transition-colors";
      dot.title = "Drag to connect";
      dot.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        startArrowFrom(item.path, dot);
      });

      row.append(label, delBtn, dot);
      li.appendChild(row);
    }
    ul.appendChild(li);
  }
  return ul;
}

// Make any element freely draggable
function makeDraggable(element) {
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
    redrawAllConnections();
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

document.addEventListener("mouseover", (e) => {
  if (!activeArrow) return;
  const folder = e.target.closest("[data-folder-path]");
  if (folder) folder.classList.add("ring-2", "ring-indigo-400");
});

document.addEventListener("mouseout", (e) => {
  const folder = e.target.closest("[data-folder-path]");
  if (folder) folder.classList.remove("ring-2", "ring-indigo-400");
});

document.addEventListener("mouseup", async (e) => {
  if (!activeArrow) return;

  const targetDot = e.target.closest("div[data-folder-path]");
  if (!targetDot) {
    activeArrow.path.remove();
    activeArrow = null;
    return;
  }

  const toPath = targetDot.dataset.folderPath;
  const isDestFolder = await isDirectory(toPath);
  console.log(isDestFolder)

  // ✅ Only enforce: destination must be a folder (files can't receive drops)
  if (!isDestFolder) {
    showSnackbar("Cannot connect to a file — destination must be a folder", "error");
    activeArrow.path.remove();
    activeArrow = null;
    return;
  }
  // ensuure your not moving folder into is own subfolder 
  const fromPath = activeArrow.fromPath;
    if (toPath.startsWith(fromPath + '/')) {
      console.warn("Cannot move a folder into its own subfolder");
      activeArrow.path.remove();
      activeArrow = null;
      return;
    }

  // ✅ Allow same-panel connections (e.g., reorganize within one tree)

  const cancelBtn = createCancelButton(() => {
    const index = connections.indexOf(connection);
    if (index !== -1) {
      removeSummaryLine(connection.fromEl, connection.toEl);
      connection.pathEl.remove();
      connection.cancelBtn.remove();
      connections.splice(index, 1);
    }
  });

  svg.appendChild(cancelBtn);

  const connection = {
    fromPath: activeArrow.fromPath,
    toPath,
    fromEl: activeArrow.fromEl,
    toEl: targetDot,
    pathEl: activeArrow.path,
    cancelBtn
  };

  connections.push(connection);
  createOrUpdateSummaryLine(connection.fromEl, connection.toEl);
  redrawSingleConnection(connection);
  activeArrow = null;
});

document.addEventListener("mousemove", (e) => {
  if (!activeArrow) return;

  const fromRect = activeArrow.fromEl.getBoundingClientRect();
  const start = clientToSvg(
    fromRect.left + fromRect.width / 2,
    fromRect.top + fromRect.height / 2
  );
  const end = clientToSvg(e.clientX, e.clientY);
  activeArrow.path.setAttribute("d", `M ${start.x},${start.y} L ${end.x},${end.y}`);
});

// Close panel
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;

  const id = btn.getAttribute("data-close");
  const panel = document.getElementById(id);
  if (!panel) return;

  for (let i = connections.length - 1; i >= 0; i--) {
    const c = connections[i];
    if (!document.body.contains(c.fromEl) || !document.body.contains(c.toEl)) {
      removeSummaryLine(c.fromEl, c.toEl); // ✅ clean up summary
      c.pathEl.remove();
      c.cancelBtn.remove();
      connections.splice(i, 1);
    }
  }
  panel.remove();
});

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
});

// create panel with tree
async function createPanelWithTree(type) {
  const paths = await fileapi.pickFolder();
  if (!paths || paths.length === 0) return;

  const path = paths[0];
  const panel = createPanel(type, path);
  const treeContainer = panel.querySelector(".tree-container");
  treeContainer.textContent = "Loading...";

  try {
    const tree = await fileapi.readFolder(path);
    folderCache.set(path, tree);
    
    // ✅ Apply current sort (default is 'name')
    const sortedTree = sortItems(tree, panelSortOrder.get(panel.id) || 'name');
    
    treeContainer.textContent = "";
    treeContainer.appendChild(renderTree(sortedTree));
    console.log("Sample file item:", tree[0]);
  } catch (err) {
    treeContainer.textContent = "Failed to load folder contents.";
    console.error(err);
  }
  
}

// Buttons
document.getElementById("addSourceBtn")?.addEventListener("click", () => createPanelWithTree("source"));
document.getElementById("addDestinationBtn")?.addEventListener("click", () => createPanelWithTree("destination"));

document.getElementById('clearAllBtn')?.addEventListener('click', () => {
  document.querySelectorAll('[id^="panel-"]').forEach(el => el.remove());
  for (const c of connections) {
    c.pathEl.remove();
    c.cancelBtn?.remove();
  }
  connections.length = 0;
  // Clear summary lines
  for (const summary of summaryLines.values()) {
    summary.group.remove();
  }
  summaryLines.clear();
  if (activeArrow) {
    activeArrow.path.remove();
    activeArrow = null;
  }
});

document.getElementById('clearAllarr')?.addEventListener('click', () => {
  //document.querySelectorAll('[id^="panel-"]').forEach(el => el.remove());
  for (const c of connections) {
    c.pathEl.remove();
    c.cancelBtn?.remove();
  }
  connections.length = 0;
  // Clear summary lines
  for (const summary of summaryLines.values()) {
    summary.group.remove();
  }
  summaryLines.clear();
  if (activeArrow) {
    activeArrow.path.remove();
    activeArrow = null;
  }
});

// COPY button
document.getElementById('copy')?.addEventListener('click', async () => {
  await executeTransfers('copy');
});

// MOVE button (you'll need to give it an ID or use querySelector)
const moveBtn = document.querySelector('#move button:first-child');
moveBtn?.addEventListener('click', async () => {
  await executeTransfers('move');
});

async function executeTransfers(mode) {
  if (connections.length === 0) {
    alert("No connections to transfer!");
    return;
  }

  const operation = mode === 'move' ? 'Moving' : 'Copying';
  let successCount = 0;
  let errorCount = 0;

  // ✅ Track unique paths to refresh later
  const sourcePaths = new Set();
  const destPaths = new Set();

  for (const conn of connections) {
    const { fromPath, toPath } = conn;

    // Collect panel root paths
    const fromPanel = conn.fromEl.closest('[id^="panel-"]');
    const toPanel = conn.toEl.closest('[id^="panel-"]');

    if (fromPanel) {
      const input = fromPanel.querySelector('input');
      if (input) sourcePaths.add(input.value.trim());
    }

    if (toPanel) {
      const input = toPanel.querySelector('input');
      if (input) destPaths.add(input.value.trim());
    }

    try {
      const isSrcFolder = await isDirectory(fromPath);
      const isDestFolder = await isDirectory(toPath);

      if (!isDestFolder) {
        console.error(`❌ Destination is not a folder: ${toPath}`);
        errorCount++;
        continue;
      }

      if (mode === 'move') {
        if (isSrcFolder) {
          await fileapi.moveFolder(fromPath, toPath);
        } else {
          await fileapi.moveFile(fromPath, toPath);
        }
      } else {
        if (isSrcFolder) {
          await fileapi.copyFolder(fromPath, toPath);
        } else {
          await fileapi.copyFile(fromPath, toPath);
        }
      }

      console.log(`✅ ${operation} ${fromPath} → ${toPath}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to ${mode} ${fromPath} → ${toPath}:`, err);
      errorCount++;
    }
  }

  // ✅ REFRESH AFFECTED PANELS
  for (const path of sourcePaths) {
    refreshPanelByRootPath(path);
  }
  for (const path of destPaths) {
    refreshPanelByRootPath(path);
  }

  // ✅ CLEAR ALL ARROWS & CONNECTIONS
  for (const c of connections) {
    c.pathEl?.remove();
    c.cancelBtn?.remove();
  }
  connections.length = 0;

  // ✅ CLEAR SUMMARY LINES
  for (const summary of summaryLines.values()) {
    summary.group?.remove();
  }
  summaryLines.clear();

  // ✅ Final redraw to clean up any remnants
  redrawAllConnections();

  alert(
    `${operation} complete!\n` +
    `✅ Success: ${successCount}\n` +
    `❌ Errors: ${errorCount}`
  );
}
// Optional: get all panel states
window.getPanelStates = () => {
  return Array.from(document.querySelectorAll('[id^="panel-"]')).map(el => {
    const input = el.querySelector('input');
    const rect = el.getBoundingClientRect();
    return {
      id: el.id,
      type: el.dataset.type,
      path: input.value.trim(),
      left: Math.round(rect.left + window.scrollX),
      top: Math.round(rect.top + window.scrollY)
    };
  });
};

window.addEventListener("scroll", () => {
  if (activeArrow) {
    activeArrow.path.remove();
    activeArrow = null;
  }
  redrawAllConnections();
}, { passive: true });

// FIXED: Only one resize listener
window.addEventListener("resize", () => {
  svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
  redrawAllConnections();
});