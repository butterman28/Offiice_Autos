// public/assets/components/connections.js
import { fileapi } from "../fileapi.js";


export let showAllConnectionsMode = false;

// Add this new function to connections.js
export function toggleShowAllConnections() {
  showAllConnectionsMode = !showAllConnectionsMode;
  
  if (showAllConnectionsMode) {
    // Expand all folders that contain connected dots
    expandFoldersForConnections();
  }
  
  redrawAllConnections();
  return showAllConnectionsMode;
}
// --- Connection Tooltip Manager ---
let connectionTooltip;

function ensureConnectionTooltip() {
  if (connectionTooltip) return;

  connectionTooltip = document.createElement('div');
  connectionTooltip.className =
    'fixed z-[30001] bg-white border border-gray-300 rounded shadow-lg px-3 py-2 text-xs text-gray-800 pointer-events-none hidden';
  document.body.appendChild(connectionTooltip);
}

function showConnectionTooltip(html, x, y) {
  connectionTooltip.innerHTML = html;
  connectionTooltip.style.left = `${x + 12}px`;
  connectionTooltip.style.top = `${y + 12}px`;
  connectionTooltip.classList.remove('hidden');
}

function hideConnectionTooltip() {
  connectionTooltip?.classList.add('hidden');
}
// Add this helper function to connections.js
function expandFoldersForConnections() {
  connections.forEach(conn => {
    // Ensure both dots are visible by expanding their parent folders
    expandParentFolders(conn.fromEl);
    expandParentFolders(conn.toEl);
  });
}

// Add this helper function to connections.js
function expandParentFolders(dot) {
  let current = dot.closest('li');
  
  while (current) {
    // Find the folder label in this li
    const folderLabel = current.querySelector('[data-folder-path]');
    if (folderLabel && folderLabel !== dot) {
      // Check if this folder is collapsed (no subtree-container)
      let subtreeContainer = current.querySelector('.subtree-container');
      
      if (!subtreeContainer) {
        // Simulate a click to expand it
        folderLabel.click();
      }
    }
    
    // Move up to parent li
    const parentUl = current.parentElement;
    if (parentUl && parentUl.tagName === 'UL') {
      current = parentUl.closest('li');
    } else {
      break;
    }
  }
}

// --- Module State ---
let svg;
export let activeArrow = null;
const connections = [];
const summaryLines = new Map(); // key: "panelA-panelB", value: { line, label, count, group }
let nextConnectionId = 1;

// --- Exports ---
export { connections, summaryLines, redrawAllConnections, startArrowFrom, createCancelButton };

export function getRedrawFn() {
  return redrawAllConnections;
}


// --- Initialization ---
export function initConnectionsLayer() {
  ensureConnectionTooltip();
  if (svg) return; // Prevent duplicate init

  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "connections-layer";
  Object.assign(svg.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "10000"
  });
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
  document.body.appendChild(svg);

  // Resize handling
  window.addEventListener("resize", () => {
    if (svg) {
      svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
      redrawAllConnections();
    }
  }, { passive: true });

  // Scroll handling (hide active arrow)
  window.addEventListener("scroll", () => {
    if (activeArrow) {
      activeArrow.path.remove();
      activeArrow = null;
    }
    redrawAllConnections();
  }, { passive: true });

  // Global mouse handlers
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("mouseover", handleMouseOver);
  document.addEventListener("mouseout", handleMouseOut);
}


function attachConnectionLabel(dot, id) {
  // Avoid duplicate labels
  if (dot.querySelector('.connection-id-label')) return;

  const label = document.createElement('span');
  label.className = 'connection-id-label text-xs font-bold bg-white text-indigo-600 px-1 rounded ml-1';
  label.textContent = `#${id}`;
  label.style.pointerEvents = 'none'; // don't interfere with dragging
  dot.appendChild(label);
}

function removeConnectionLabel(dot, id) {
  const label = dot.querySelector('.connection-id-label');
  if (label && label.textContent === `#${id}`) {
    label.remove();
  }
}
// --- Utility Functions (scoped to this module) ---
function isDotVisibleInPanel(dot) {
  const panel = dot.closest('[id^="panel-"]');
  if (!panel) return false;
  
  const panelBody = panel.querySelector('.panel-body');
  if (!panelBody || panelBody.classList.contains('hidden')) {
    return false; // Panel is collapsed → dot is not visible
  }

  const treeContainer = panel.querySelector('.tree-container');
  if (!treeContainer) return false;

  const dotRect = dot.getBoundingClientRect();
  const containerRect = treeContainer.getBoundingClientRect();

  // Also ensure container is visible (not zero-sized)
  if (containerRect.width === 0 || containerRect.height === 0) {
    return false;
  }

  return (
    dotRect.top >= containerRect.top &&
    dotRect.left >= containerRect.left &&
    dotRect.bottom <= containerRect.bottom &&
    dotRect.right <= containerRect.right
  );
}

function getPanelIdFromDot(dot) {
  return dot.closest('[id^="panel-"]')?.id || null;
}

function getSummaryKey(panelA, panelB) {
  return [panelA, panelB].sort().join('-');
}

function clientToSvg(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// --- Arrow Creation & Interaction ---
 function startArrowFrom(fromPath, fromEl) {
  if (activeArrow) {
    activeArrow.path.remove();
  }

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("stroke", "#4f46e5");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("fill", "none");
  path.setAttribute("marker-end", "url(#arrowhead)");

  svg.appendChild(path);

  activeArrow = { fromPath, fromEl, path };

  // Redraw to position start point immediately
  const fromRect = fromEl.getBoundingClientRect();
  const start = clientToSvg(fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2);
  const end = clientToSvg(fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2);
  path.setAttribute("d", `M ${start.x},${start.y} L ${end.x},${end.y}`);
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

// --- Summary Lines (between panels) ---
function createOrUpdateSummaryLine(fromDot, toDot) {
  const panelFrom = getPanelIdFromDot(fromDot);
  const panelTo = getPanelIdFromDot(toDot);
  if (!panelFrom || !panelTo || panelFrom === panelTo) return;

  const key = getSummaryKey(panelFrom, panelTo);
  
  // Check if summary line already exists
  if (!summaryLines.has(key)) {
    // Create new summary line
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
    
    // Create the summary object
    const summary = { 
      fromPanel: panelFrom, 
      toPanel: panelTo, 
      line, 
      label, 
      count: 0, 
      group 
    };
    
    // Add tooltip handlers
    line.style.pointerEvents = "stroke"; 
    
    const onMouseEnterSummary = (e) => {
      const html = `
        <div class="font-semibold text-indigo-600 mb-1">Panel Connections</div>
        <div>${summary.fromPanel} ↔ ${summary.toPanel}</div>
        <div class="text-gray-600 text-xs mt-1">${summary.count} connection(s)</div>
      `;
      showConnectionTooltip(html, e.clientX, e.clientY);
    };
    
    const onMouseLeaveSummary = hideConnectionTooltip;

    line.addEventListener('mouseenter', onMouseEnterSummary);
    line.addEventListener('mouseleave', onMouseLeaveSummary);

    // Store handlers for cleanup
    summary._tooltipHandlers = { onMouseEnterSummary, onMouseLeaveSummary };
    
    // Store in map
    summaryLines.set(key, summary);
  }

  // Now get the summary and increment count
  const summary = summaryLines.get(key);
  summary.count++;
  if (summary.count > 0) {
    summary.label.textContent = `${summary.count}`;
  }
}


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

function redrawSummaryLines() {
  for (const [key, summary] of summaryLines.entries()) {
    const panelA = document.getElementById(summary.fromPanel);
    const panelB = document.getElementById(summary.toPanel);

    if (!panelA || !panelB) {
      summary.group.remove();
      summaryLines.delete(key);
      continue;
    }

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

// --- Single Connection Redraw ---
function redrawSingleConnection(c) {
  const fromVisible = isDotVisibleInPanel(c.fromEl);
  const toVisible = isDotVisibleInPanel(c.toEl);

  // In "Show All" mode, force visibility
  if (showAllConnectionsMode) {
    c.pathEl.style.display = "block";
    c.cancelBtn.style.display = "block";
    
    // If dots aren't visible, draw to panel centers instead
    if (!fromVisible || !toVisible) {
      const fromPanel = c.fromEl.closest('[id^="panel-"]');
      const toPanel = c.toEl.closest('[id^="panel-"]');
      
      if (fromPanel && toPanel) {
        const aRect = fromPanel.getBoundingClientRect();
        const bRect = toPanel.getBoundingClientRect();
        const start = clientToSvg(aRect.left + aRect.width / 2, aRect.top + 40);
        const end = clientToSvg(bRect.left + bRect.width / 2, bRect.top + 40);
        
        c.pathEl.setAttribute("d", `M ${start.x},${start.y} L ${end.x},${end.y}`);
        c.pathEl.setAttribute("stroke-dasharray", "8,4"); // Dashed for hidden dots
        
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        c.cancelBtn.setAttribute("transform", `translate(${midX}, ${midY})`);
        return;
      }
    }
    
    // Reset to solid line if both visible
    c.pathEl.setAttribute("stroke-dasharray", "none");
  } else {
    // Normal mode - hide if not visible
    if (!fromVisible || !toVisible) {
      c.pathEl.style.display = "none";
      c.cancelBtn.style.display = "none";
      return;
    }
  }

  const a = c.fromEl.getBoundingClientRect();
  const b = c.toEl.getBoundingClientRect();
  const start = clientToSvg(a.left + a.width / 2, a.top + a.height / 2);
  const end = clientToSvg(b.left + b.width / 2, b.top + b.height / 2);

  c.pathEl.setAttribute("d", `M ${start.x},${start.y} L ${end.x},${end.y}`);
  c.pathEl.style.display = "block";
  c.cancelBtn.style.display = "block";

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  c.cancelBtn.setAttribute("transform", `translate(${midX}, ${midY})`);
}

// --- Global Redraw ---
function redrawAllConnections() {
  redrawSummaryLines();
  for (const c of connections) {
    redrawSingleConnection(c);
  }
}

// --- Event Handlers ---
function handleMouseMove(e) {
  if (!activeArrow) return;
  const fromRect = activeArrow.fromEl.getBoundingClientRect();
  const start = clientToSvg(fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2);
  const end = clientToSvg(e.clientX, e.clientY);
  activeArrow.path.setAttribute("d", `M ${start.x},${start.y} L ${end.x},${end.y}`);
}

async function handleMouseUp(e) {
  if (!activeArrow) return;

  // Try to find the dot element - check if the target itself has the attribute first
  let targetDot = e.target.hasAttribute('data-folder-path') ? e.target : e.target.closest("[data-folder-path]");
  
  if (!targetDot) {
    activeArrow.path.remove();
    activeArrow = null;
    return;
  }
  
  // Make sure we didn't release on the same dot we started from
  if (targetDot === activeArrow.fromEl) {
    activeArrow.path.remove();
    activeArrow = null;
    return;
  }

  const toPath = targetDot.dataset.folderPath;
  const fromPath = activeArrow.fromPath;

  // Destination must be a folder
  const isDestFolder = await isDirectory(toPath);
  if (!isDestFolder) {
    showSnackbar("Cannot connect to a file — destination must be a folder", "error");
    activeArrow.path.remove();
    activeArrow = null;
    return;
  }

  // Prevent moving folder into itself
  if (toPath.startsWith(fromPath + '/')) {
    showSnackbar("Cannot move a folder into its own subfolder", "error");
    activeArrow.path.remove();
    activeArrow = null;
    return;
  }

  // Create cancel button
  const cancelBtn = createCancelButton(() => {
    const index = connections.indexOf(connection);
    if (index !== -1) {
      // Clean up tooltip listeners
      const h = connection._tooltipHandlers;
      if (h) {
        connection.pathEl.removeEventListener('mouseenter', h.onMouseEnter);
        connection.pathEl.removeEventListener('mousemove', h.onMouseMove);
        connection.pathEl.removeEventListener('mouseleave', h.onMouseLeave);
      }

      // Clean up labels
      removeConnectionLabel(connection.fromEl, connection.id);
      removeConnectionLabel(connection.toEl, connection.id);

      // Clean up summary line
      removeSummaryLine(connection.fromEl, connection.toEl);

      // Remove elements
      connection.pathEl.remove();
      connection.cancelBtn.remove();

      // Remove from list
      connections.splice(index, 1);
    }
  });

  svg.appendChild(cancelBtn);

  const connectionId = nextConnectionId++;
  const connection = {
    id: connectionId,
    fromPath,
    toPath,
    fromEl: activeArrow.fromEl,
    toEl: targetDot,
    pathEl: activeArrow.path,
    cancelBtn
  };

  // Attach labels to both dots
  attachConnectionLabel(connection.fromEl, connectionId);
  attachConnectionLabel(connection.toEl, connectionId);

  // Attach hover behavior
  connection.pathEl.style.pointerEvents = 'stroke';

  const onMouseEnter = (e) => {
    const fromPanel = getPanelIdFromDot(connection.fromEl);
    const toPanel = getPanelIdFromDot(connection.toEl);
    const html = `
      <div class="font-semibold text-indigo-600 mb-1">Connection #${connection.id}</div>
      <div><span class="font-medium">From:</span> ${connection.fromPath}</div>
      <div><span class="font-medium">To:</span> ${connection.toPath}</div>
      <div class="text-gray-500 text-xs mt-1">${fromPanel} → ${toPanel}</div>
    `;
    showConnectionTooltip(html, e.clientX, e.clientY);
  };

  const onMouseMove = (e) => {
    showConnectionTooltip(connectionTooltip.innerHTML, e.clientX, e.clientY);
  };

  const onMouseLeave = () => {
    hideConnectionTooltip();
  };

  connection.pathEl.addEventListener('mouseenter', onMouseEnter);
  connection.pathEl.addEventListener('mousemove', onMouseMove);
  connection.pathEl.addEventListener('mouseleave', onMouseLeave);

  // Store for cleanup
  connection._tooltipHandlers = { onMouseEnter, onMouseMove, onMouseLeave };

  connections.push(connection);
  createOrUpdateSummaryLine(connection.fromEl, connection.toEl);
  redrawSingleConnection(connection);
  activeArrow = null;
}
function handleMouseOver(e) {
  if (!activeArrow) return;
  const folder = e.target.closest("[data-folder-path]");
  if (folder) folder.classList.add("ring-2", "ring-indigo-400");
}

function handleMouseOut(e) {
  const folder = e.target.closest("[data-folder-path]");
  if (folder) folder.classList.remove("ring-2", "ring-indigo-400");
}

// --- External Dependencies (must be passed in or available globally) ---
// These are kept as-is to avoid coupling, but ideally would be injected
async function isDirectory(path) {
  // Assumes `fileapi` is globally available
  try {
    
    return await fileapi.isDir(path);
  } catch (err) {
    console.warn(`isDirectory failed for ${path}:`, err);
    return false;
  }
}

function showSnackbar(message, type = 'error') {
  // Assumes snackbar DOM exists
  const snackbar = document.getElementById('snackbar');
  if (!snackbar) return;
  snackbar.textContent = message;
  snackbar.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg text-white font-medium z-[20000] opacity-0 pointer-events-none transition-all duration-300 ease-in-out';
  if (type === 'success') {
    snackbar.classList.add('bg-green-500');
  } else if (type === 'warning') {
    snackbar.classList.add('bg-yellow-500', 'text-gray-900');
  } else {
    snackbar.classList.add('bg-red-500');
  }
  setTimeout(() => snackbar.classList.replace('opacity-0', 'opacity-100'), 10);
  setTimeout(() => snackbar.classList.replace('opacity-100', 'opacity-0'), 3000);
}