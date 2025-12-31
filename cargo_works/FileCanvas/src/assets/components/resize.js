// Add this function to panels.js
import { getRedrawFn } from "./connections.js";
export function makeResizable(panel) {
const redrawFn =  getRedrawFn()
  const resizeHandle = panel.querySelector('.resize-handle');
  if (!resizeHandle) return;

  let isResizing = false;
  let startX, startY, startWidth, startHeight;

  const handleResizeStart = (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panel.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
    
    // Add visual feedback
    panel.classList.add('ring-2', 'ring-blue-300');
    resizeHandle.classList.add('bg-blue-400');
    
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeMove = (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(300, startWidth + deltaX);  // Min width 300px
    const newHeight = Math.max(200, startHeight + deltaY); // Min height 200px
    
    panel.style.width = `${newWidth}px`;
    panel.style.height = `${newHeight}px`;
    
    // Adjust tree container max-height to fit new panel size
    const treeContainer = panel.querySelector('.tree-container');
    if (treeContainer) {
      const panelBody = panel.querySelector('.panel-body');
      const input = panel.querySelector('input');
      const availableHeight = newHeight - 180; // Account for header and input
      treeContainer.style.maxHeight = `${Math.max(150, availableHeight)}px`;
    }
    
    redrawFn();
  };

  const handleResizeEnd = () => {
    if (isResizing) {
      isResizing = false;
      panel.classList.remove('ring-2', 'ring-blue-300');
      resizeHandle.classList.remove('bg-blue-400');
      redrawFn();
    }
  };

  resizeHandle.addEventListener('mousedown', handleResizeStart);
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
}

// Update the createPanel function to call makeResizable
// Add this after makeDraggable(panel) and before the sort setup:

export function createPanel(type, value, left, top, fileapi, redrawFn) {
  // ... existing code up to document.body.appendChild(panel) ...
  
  document.body.appendChild(panel);
  makeDraggable(panel);
  makeResizable(panel); // ✅ ADD THIS LINE
  
  // ... rest of the existing code ...
}

// Also update the panel.innerHTML to make the resize handle more visible:
// Replace the resize-handle div at the bottom with:

//`<div class="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 hover:bg-blue-400 transition-colors rounded-tl-lg opacity-50 hover:opacity-100"></div>`

// And add these styles to make the panel respect the new dimensions:
// In the panel creation, update the className to include overflow-hidden:

//panel.className = `p-5 w-[420px] rounded-xl border ${borderColor} ${bgColor} shadow-lg absolute cursor-move select-none overflow-hidden`;