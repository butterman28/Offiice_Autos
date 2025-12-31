// public/assets/components/blueprint.js
// Blueprint mode for visualizing all panels and connections at once

import { connections } from './connections.js';
import { folderCache } from './fileTree.js';
import { fileapi } from '../fileapi.js';

let blueprintMode = false;
let currentScale = 1;
let minScale = 0.1;
let maxScale = 2;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

export { blueprintMode };

/**
 * Toggle blueprint mode on/off
 */
export function toggleBlueprintMode() {
  blueprintMode = !blueprintMode;
  
  if (blueprintMode) {
    enterBlueprintMode();
  } else {
    exitBlueprintMode();
  }
  
  return blueprintMode;
}

/**
 * Enter blueprint overview mode
 */
function enterBlueprintMode() {
  const body = document.body;
  
  // Create blueprint overlay
  const overlay = document.createElement('div');
  overlay.id = 'blueprint-overlay';
  overlay.className = 'fixed inset-0 bg-slate-900/95 z-[9999] overflow-hidden';
  overlay.style.backdropFilter = 'blur(2px)';
  
  // Create viewport container (for panning)
  const viewport = document.createElement('div');
  viewport.id = 'blueprint-viewport';
  viewport.className = 'w-full h-full relative overflow-hidden';
  viewport.style.cursor = 'grab';
  
  // Create container for scaled content
  const container = document.createElement('div');
  container.id = 'blueprint-container';
  container.className = 'relative w-full h-full p-8';
  container.style.transformOrigin = 'center center';
  
  // Get all panels
  const panels = Array.from(document.querySelectorAll('[id^="panel-"]'));
  
  if (panels.length === 0) {
    overlay.innerHTML = '<div class="text-white text-center text-2xl mt-20">No panels to display</div>';
    body.appendChild(overlay);
    return;
  }
  
  // Calculate bounding box of all panels
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  panels.forEach(panel => {
    const rect = panel.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    
    minX = Math.min(minX, rect.left + scrollX);
    minY = Math.min(minY, rect.top + scrollY);
    maxX = Math.max(maxX, rect.right + scrollX);
    maxY = Math.max(maxY, rect.bottom + scrollY);
  });
  
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const padding = 100;
  
  // Calculate initial scale to fit everything
  const viewportWidth = window.innerWidth - padding;
  const viewportHeight = window.innerHeight - padding;
  const scaleX = viewportWidth / contentWidth;
  const scaleY = viewportHeight / contentHeight;
  currentScale = Math.min(scaleX, scaleY, 1);
  
  // Store original positions
  body.dataset.blueprintMinX = minX;
  body.dataset.blueprintMinY = minY;
  
  // Clone and position panels in blueprint
  panels.forEach(panel => {
    const rect = panel.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    
    const clone = panel.cloneNode(true);
    clone.id = `blueprint-${panel.id}`;
    clone.dataset.originalId = panel.id;
    clone.style.position = 'absolute';
    clone.style.left = `${(rect.left + scrollX - minX) + padding/2}px`;
    clone.style.top = `${(rect.top + scrollY - minY) + padding/2}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.transform = 'none';
    clone.style.cursor = 'pointer';
    clone.style.pointerEvents = 'auto';
    clone.style.opacity = '0.95';
    
    // Make panels interactive - expand all folders
    makeCloneInteractive(clone);
    
    container.appendChild(clone);
  });
  
  // Apply initial scale
  container.style.transform = `scale(${currentScale}) translate(${panX}px, ${panY}px)`;
  
  viewport.appendChild(container);
  overlay.appendChild(viewport);
  body.appendChild(overlay);
  
  // Create blueprint SVG overlay for connections
  const blueprintSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  blueprintSvg.id = "blueprint-connections";
  blueprintSvg.style.position = 'absolute';
  blueprintSvg.style.inset = '0';
  blueprintSvg.style.pointerEvents = 'none';
  blueprintSvg.style.zIndex = '10000';
  blueprintSvg.setAttribute("width", "100%");
  blueprintSvg.setAttribute("height", "100%");
  
  blueprintSvg.innerHTML = `
    <defs>
      <marker id="blueprint-arrowhead" markerWidth="10" markerHeight="7"
        refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#22d3ee" />
      </marker>
    </defs>
  `;
  
  container.appendChild(blueprintSvg);
  
  // Draw all connections in blueprint
  drawBlueprintConnections(blueprintSvg, minX, minY, padding);
  
  // Add minimap
  addMinimap(overlay, panels, minX, minY, contentWidth, contentHeight, padding);
  
  // Add UI controls
  addBlueprintControls(overlay);
  
  // Add pan & zoom handlers
  setupPanAndZoom(viewport, container, blueprintSvg, minX, minY, padding);
  
  // Disable scrolling on main body
  body.style.overflow = 'hidden';
}

/**
 * Make cloned panel interactive - expand folders and show connections
 */
function makeCloneInteractive(clone) {
  // Expand all folders automatically to show all dots
  const folderLabels = clone.querySelectorAll('[data-folder-path]');
  
  folderLabels.forEach(async label => {
    const folderPath = label.dataset.folderPath;
    const li = label.closest('li');
    
    if (!li) return;
    
    // Auto-expand folder if it has a connection
    const hasConnection = connections.some(conn => 
      conn.fromPath === folderPath || 
      conn.toPath === folderPath ||
      conn.fromPath.startsWith(folderPath + '/') ||
      conn.toPath.startsWith(folderPath + '/')
    );
    
    if (hasConnection && !li.querySelector('.subtree-container')) {
      // Create subtree container
      const subtreeContainer = document.createElement('div');
      subtreeContainer.className = 'subtree-container ml-4';
      subtreeContainer.innerHTML = '<div class="text-xs text-slate-500">Loading...</div>';
      li.appendChild(subtreeContainer);
      
      // Load folder contents
      try {
        let children = folderCache.get(folderPath);
        if (!children) {
          children = await fileapi.readFolder(folderPath);
          folderCache.set(folderPath, children);
        }
        
        if (children.length === 0) {
          subtreeContainer.innerHTML = '<div class="ml-6 text-xs text-slate-400 italic">(empty)</div>';
        } else {
          // Simple rendering for blueprint - no full tree functionality
          subtreeContainer.innerHTML = children.map(child => `
            <div class="text-xs py-0.5 ${child.is_directory ? 'text-indigo-600' : 'text-gray-700'}">
              ${child.is_directory ? '📁' : '📄'} ${child.name}
            </div>
          `).join('');
        }
      } catch (err) {
        subtreeContainer.textContent = "Failed to load";
        console.error(err);
      }
    }
  });
}

/**
 * Draw all connection lines in blueprint view
 */
function drawBlueprintConnections(svg, minX, minY, padding) {
  connections.forEach((conn, idx) => {
    const fromPanel = document.querySelector(`#${conn.fromEl.closest('[id^="panel-"]').id}`);
    const toPanel = document.querySelector(`#${conn.toEl.closest('[id^="panel-"]').id}`);
    
    if (!fromPanel || !toPanel) return;
    
    // Try to find exact dot positions in clones
    const fromClone = document.querySelector(`#blueprint-${fromPanel.id}`);
    const toClone = document.querySelector(`#blueprint-${toPanel.id}`);
    
    if (!fromClone || !toClone) return;
    
    // Find corresponding dots in clones
    const fromDot = findDotInClone(fromClone, conn.fromPath);
    const toDot = findDotInClone(toClone, conn.toPath);
    
    let x1, y1, x2, y2;
    
    if (fromDot && toDot) {
      // Dot-to-dot connection
      const fromRect = fromDot.getBoundingClientRect();
      const toRect = toDot.getBoundingClientRect();
      
      x1 = fromRect.left + fromRect.width / 2;
      y1 = fromRect.top + fromRect.height / 2;
      x2 = toRect.left + toRect.width / 2;
      y2 = toRect.top + toRect.height / 2;
    } else {
      // Fallback to panel centers
      const fromRect = fromClone.getBoundingClientRect();
      const toRect = toClone.getBoundingClientRect();
      
      x1 = fromRect.left + fromRect.width / 2;
      y1 = fromRect.top + 40;
      x2 = toRect.left + toRect.width / 2;
      y2 = toRect.top + 40;
    }
    
    // Add glow effect
    const glow = document.createElementNS("http://www.w3.org/2000/svg", "line");
    glow.setAttribute("x1", x1);
    glow.setAttribute("y1", y1);
    glow.setAttribute("x2", x2);
    glow.setAttribute("y2", y2);
    glow.setAttribute("stroke", "#22d3ee");
    glow.setAttribute("stroke-width", "8");
    glow.setAttribute("opacity", "0.2");
    glow.setAttribute("filter", "blur(4px)");
    glow.dataset.connectionId = conn.id;
    svg.appendChild(glow);
    
    // Draw connection line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#22d3ee");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("marker-end", "url(#blueprint-arrowhead)");
    line.setAttribute("opacity", "0.8");
    line.dataset.connectionId = conn.id;
    line.style.cursor = 'pointer';
    line.style.pointerEvents = 'auto';
    
    // Click to jump to connection
    line.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToConnection(conn);
    });
    
    svg.appendChild(line);
    
    // Add connection ID label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", (x1 + x2) / 2);
    text.setAttribute("y", (y1 + y2) / 2 - 5);
    text.setAttribute("fill", "#22d3ee");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-weight", "bold");
    text.setAttribute("text-anchor", "middle");
    text.textContent = `#${conn.id}`;
    text.dataset.connectionId = conn.id;
    text.style.cursor = 'pointer';
    text.style.pointerEvents = 'auto';
    
    text.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToConnection(conn);
    });
    
    svg.appendChild(text);
  });
}

/**
 * Find dot element in cloned panel by path
 */
function findDotInClone(clone, path) {
  const dots = clone.querySelectorAll('[data-folder-path]');
  for (const dot of dots) {
    if (dot.dataset.folderPath === path) {
      return dot;
    }
  }
  return null;
}

/**
 * Jump to connection in normal view
 */
function jumpToConnection(conn) {
  // Exit blueprint mode
  exitBlueprintMode();
  
  // Wait for exit animation
  setTimeout(() => {
    // Find the actual panels
    const fromPanel = conn.fromEl.closest('[id^="panel-"]');
    const toPanel = conn.toEl.closest('[id^="panel-"]');
    
    if (fromPanel) {
      // Scroll to source panel
      fromPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight the connection briefly
      conn.fromEl.style.boxShadow = '0 0 20px 5px rgba(34, 211, 238, 0.8)';
      conn.toEl.style.boxShadow = '0 0 20px 5px rgba(34, 211, 238, 0.8)';
      
      setTimeout(() => {
        conn.fromEl.style.boxShadow = '';
        conn.toEl.style.boxShadow = '';
      }, 2000);
    }
  }, 300);
}

/**
 * Add minimap for navigation
 */
function addMinimap(overlay, panels, minX, minY, contentWidth, contentHeight, padding) {
  const minimap = document.createElement('div');
  minimap.id = 'blueprint-minimap';
  minimap.className = 'fixed top-20 right-4 z-[10001] bg-slate-800/90 backdrop-blur border border-white/20 rounded-lg p-2';
  minimap.style.width = '200px';
  minimap.style.height = '150px';
  
  const minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = 200;
  minimapCanvas.height = 150;
  minimapCanvas.className = 'cursor-pointer';
  
  const ctx = minimapCanvas.getContext('2d');
  
  // Draw panels on minimap
  const scaleX = 180 / contentWidth;
  const scaleY = 130 / contentHeight;
  const minimapScale = Math.min(scaleX, scaleY);
  
  panels.forEach(panel => {
    const rect = panel.getBoundingClientRect();
    const type = panel.dataset.type;
    const color = type === 'source' ? '#6366f1' : '#3b82f6';
    
    const x = ((rect.left + window.scrollX - minX) * minimapScale) + 10;
    const y = ((rect.top + window.scrollY - minY) * minimapScale) + 10;
    const w = rect.width * minimapScale;
    const h = rect.height * minimapScale;
    
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  });
  
  // Draw connections on minimap
  connections.forEach(conn => {
    const fromPanel = conn.fromEl.closest('[id^="panel-"]');
    const toPanel = conn.toEl.closest('[id^="panel-"]');
    
    if (!fromPanel || !toPanel) return;
    
    const fromRect = fromPanel.getBoundingClientRect();
    const toRect = toPanel.getBoundingClientRect();
    
    const x1 = ((fromRect.left + window.scrollX + fromRect.width/2 - minX) * minimapScale) + 10;
    const y1 = ((fromRect.top + window.scrollY + fromRect.height/2 - minY) * minimapScale) + 10;
    const x2 = ((toRect.left + window.scrollX + toRect.width/2 - minX) * minimapScale) + 10;
    const y2 = ((toRect.top + window.scrollY + toRect.height/2 - minY) * minimapScale) + 10;
    
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  
  // Click to focus area
  minimapCanvas.addEventListener('click', (e) => {
    const rect = minimapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 10;
    const y = e.clientY - rect.top - 10;
    
    // Convert minimap coords to world coords
    const worldX = (x / minimapScale) + minX;
    const worldY = (y / minimapScale) + minY;
    
    // Pan to that location
    const container = document.getElementById('blueprint-container');
    panX = -(worldX - window.innerWidth / 2 / currentScale);
    panY = -(worldY - window.innerHeight / 2 / currentScale);
    updateTransform(container);
    redrawBlueprintConnections();
  });
  
  minimap.appendChild(minimapCanvas);
  overlay.appendChild(minimap);
}

/**
 * Setup pan and zoom controls
 */
function setupPanAndZoom(viewport, container, svg, minX, minY, padding) {
  // Panning
  viewport.addEventListener('mousedown', (e) => {
    if (e.target === viewport || e.target === container) {
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      viewport.style.cursor = 'grabbing';
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    updateTransform(container);
    redrawBlueprintConnections();
  });
  
  document.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      viewport.style.cursor = 'grab';
    }
  });
  
  // Zoom with mouse wheel
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom(delta, e.clientX, e.clientY, container);
    redrawBlueprintConnections();
  }, { passive: false });
}

/**
 * Zoom in/out
 */
function zoom(factor, centerX, centerY, container) {
  const newScale = Math.max(minScale, Math.min(maxScale, currentScale * factor));
  
  if (newScale !== currentScale) {
    // Adjust pan to zoom toward cursor
    const scaleDiff = newScale - currentScale;
    panX -= (centerX - window.innerWidth / 2) * scaleDiff / currentScale;
    panY -= (centerY - window.innerHeight / 2) * scaleDiff / currentScale;
    
    currentScale = newScale;
    updateTransform(container);
    
    // Update scale indicator
    const indicator = document.getElementById('blueprint-scale-indicator');
    if (indicator) {
      indicator.textContent = `${(currentScale * 100).toFixed(0)}%`;
    }
  }
}

/**
 * Update container transform
 */
function updateTransform(container) {
  container.style.transform = `scale(${currentScale}) translate(${panX}px, ${panY}px)`;
}

/**
 * Redraw connections after transform
 */
function redrawBlueprintConnections() {
  const svg = document.getElementById('blueprint-connections');
  if (!svg) return;
  
  const minX = parseFloat(document.body.dataset.blueprintMinX);
  const minY = parseFloat(document.body.dataset.blueprintMinY);
  
  // Remove old connections
  const oldElements = svg.querySelectorAll('[data-connection-id]');
  oldElements.forEach(el => el.remove());
  
  // Redraw
  drawBlueprintConnections(svg, minX, minY, 100);
}

/**
 * Add UI controls
 */
function addBlueprintControls(overlay) {
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'fixed top-4 right-4 z-[10001] px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg flex items-center gap-2 transition-all backdrop-blur border border-white/20';
  closeBtn.innerHTML = '<i class="fas fa-times"></i> Exit Blueprint';
  closeBtn.onclick = () => toggleBlueprintMode();
  overlay.appendChild(closeBtn);
  
  // Zoom controls
  const zoomControls = document.createElement('div');
  zoomControls.className = 'fixed top-4 left-4 z-[10001] flex flex-col gap-2';
  
  const zoomIn = document.createElement('button');
  zoomIn.className = 'px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg backdrop-blur border border-white/20 transition-all';
  zoomIn.innerHTML = '<i class="fas fa-plus"></i>';
  zoomIn.onclick = () => {
    const container = document.getElementById('blueprint-container');
    zoom(1.2, window.innerWidth / 2, window.innerHeight / 2, container);
    redrawBlueprintConnections();
  };
  
  const zoomOut = document.createElement('button');
  zoomOut.className = 'px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg backdrop-blur border border-white/20 transition-all';
  zoomOut.innerHTML = '<i class="fas fa-minus"></i>';
  zoomOut.onclick = () => {
    const container = document.getElementById('blueprint-container');
    zoom(0.8, window.innerWidth / 2, window.innerHeight / 2, container);
    redrawBlueprintConnections();
  };
  
  const resetZoom = document.createElement('button');
  resetZoom.className = 'px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg backdrop-blur border border-white/20 transition-all text-sm';
  resetZoom.innerHTML = '<i class="fas fa-expand"></i>';
  resetZoom.onclick = () => {
    currentScale = parseFloat(document.body.dataset.blueprintScale) || 1;
    panX = 0;
    panY = 0;
    const container = document.getElementById('blueprint-container');
    updateTransform(container);
    redrawBlueprintConnections();
  };
  
  zoomControls.append(zoomIn, zoomOut, resetZoom);
  overlay.appendChild(zoomControls);
  
  // Connection count badge
  const badge = document.createElement('div');
  badge.className = 'fixed bottom-4 left-4 z-[10001] px-4 py-2 bg-cyan-500/90 text-white font-semibold rounded-lg backdrop-blur';
  badge.innerHTML = `<i class="fas fa-project-diagram"></i> ${connections.length} Connections`;
  overlay.appendChild(badge);
  
  // Scale indicator
  const scaleIndicator = document.createElement('div');
  scaleIndicator.id = 'blueprint-scale-indicator';
  scaleIndicator.className = 'fixed bottom-4 right-4 z-[10001] bg-white/10 backdrop-blur border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono';
  scaleIndicator.textContent = `${(currentScale * 100).toFixed(0)}%`;
  overlay.appendChild(scaleIndicator);
  
  // Help text
  const help = document.createElement('div');
  help.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/10 backdrop-blur border border-white/20 rounded-lg px-4 py-3 text-white text-sm z-[9998] pointer-events-none opacity-80';
  help.innerHTML = `
    <div class="font-semibold mb-1">Controls:</div>
    <div>🖱️ Click & Drag: Pan around</div>
    <div>🔍 Mouse Wheel: Zoom in/out</div>
    <div>🎯 Click Arrows: Jump to connection</div>
    <div>🗺️ Minimap: Navigate quickly</div>
  `;
  overlay.appendChild(help);
  
  // Fade out help text after 3 seconds
  setTimeout(() => {
    help.style.transition = 'opacity 1s';
    help.style.opacity = '0';
    setTimeout(() => help.remove(), 1000);
  }, 3000);
}

/**
 * Exit blueprint mode
 */
function exitBlueprintMode() {
  const overlay = document.getElementById('blueprint-overlay');
  if (overlay) {
    overlay.remove();
  }
  document.body.style.overflow = '';
  currentScale = 1;
  panX = 0;
  panY = 0;
  delete document.body.dataset.blueprintScale;
  delete document.body.dataset.blueprintMinX;
  delete document.body.dataset.blueprintMinY;
}