// public/main.js
import { fileapi } from './assets/fileapi.js';
import { createPanel, makeDraggable } from './assets/components/panels.js';
import { sortItems } from './assets/components/sorting.js';
import { initConnectionsLayer, redrawAllConnections, connections, summaryLines } from './assets/components/connections.js';
import { folderCache, panelSortOrder, refreshPanelByRootPath, renderTree } from './assets/components/fileTree.js';
import { showSnackbar, showConfirmModal, showInputModal } from './assets/components/uiUtils.js';
import { refreshFolderNode } from './assets/components/fileTree.js';
import { markTransferred } from './assets/components/transferHistory.js';
import { activeArrow } from './assets/components/connections.js';
import { toggleShowAllConnections } from './assets/components/connections.js';
import { toggleBlueprintMode } from './assets/components/blueprint.js';

// Initialize global state
initConnectionsLayer();
window.redrawAllConnections = redrawAllConnections; // For legacy compatibility

// --- Top-level app functions (must stay in main.js) ---

async function createPanelWithTree(type) {
  const paths = await fileapi.pickFolder();
  if (!paths || paths.length === 0) return;

  const path = paths[0];
  const panel = createPanel(type, path, null, null, fileapi, redrawAllConnections);
  const treeContainer = panel.querySelector(".tree-container");
  treeContainer.textContent = "Loading...";

  try {
    const tree = await fileapi.readFolder(path);
    folderCache.set(path, tree);
    const sortedTree = sortItems(tree, panelSortOrder.get(panel.id) || 'name');
    treeContainer.textContent = "";
    treeContainer.appendChild(renderTree(sortedTree, fileapi));
  } catch (err) {
    treeContainer.textContent = "Failed to load folder contents.";
    console.error(err);
  }
}

async function executeTransfers(mode) {
  if (connections.length === 0) {
    alert("No connections to transfer!");
    return;
  }

  const operation = mode === 'move' ? 'Moving' : 'Copying';
  let successCount = 0;
  let errorCount = 0;

  // Track ALL affected paths (source items + dest folders + their parents)
  const pathsToRefresh = new Set();

  // 🔴 removed: newlyCreatedPaths

  for (const conn of connections) {
    const { fromPath, toPath } = conn;

    const fromParent =
      fromPath.substring(0, fromPath.lastIndexOf('/')) || '/';
    pathsToRefresh.add(fromParent);
    pathsToRefresh.add(toPath);

    const fromPanel = conn.fromEl.closest('[id^="panel-"]');
    const toPanel = conn.toEl.closest('[id^="panel-"]');

    if (fromPanel) {
      const root = fromPanel.querySelector('input')?.value.trim();
      if (root) pathsToRefresh.add(root);
    }
    if (toPanel) {
      const root = toPanel.querySelector('input')?.value.trim();
      if (root) pathsToRefresh.add(root);
    }

    try {
      const isSrcFolder = await fileapi.isDir(fromPath);
      const isDestFolder = await fileapi.isDir(toPath);

      if (!isDestFolder) {
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
      // After move/copy succeeds
      const srcParent = fromPath.substring(0, fromPath.lastIndexOf('/')) || '/';
      const destParent = toPath;
       // ✅ Record transferred path globally
      const newItemName = fromPath.split('/').pop();
      const newItemPath = toPath + '/' + newItemName;
      markTransferred(newItemPath);

      // Invalidate all affected cache entries
      folderCache.delete(fromPath);
      folderCache.delete(srcParent);
      folderCache.delete(destParent);
      folderCache.delete(newItemPath);
      
      await refreshPanelByRootPath(srcParent, fileapi);
      await refreshPanelByRootPath(destParent, fileapi);


      successCount++;
    } catch (err) {
      console.error(`❌ Failed to ${mode} ${fromPath} → ${toPath}:`, err);
      errorCount++;
    }
  } 

  // Clear connections (unchanged)
  for (const c of connections) {
    c.pathEl?.remove();
    c.cancelBtn?.remove();
  }
  connections.length = 0;
  for (const summary of summaryLines.values()) summary.group?.remove();
  summaryLines.clear();

  redrawAllConnections();
  alert(`${operation} complete!\n✅ Success: ${successCount}\n❌ Errors: ${errorCount}`);
}

// --- Button Event Listeners ---
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

document.getElementById('copy')?.addEventListener('click', () => executeTransfers('copy'));
document.querySelector('#move button:first-child')?.addEventListener('click', () => executeTransfers('move'));

// Add button handler (place with your other event listeners)
document.getElementById('showAllConnectionsBtn')?.addEventListener('click', () => {
  const isActive = toggleShowAllConnections();
  const btn = document.getElementById('showAllConnectionsBtn');
  
  if (isActive) {
    btn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
    btn.classList.add('bg-green-600', 'hover:bg-green-700');
    btn.innerHTML = `
      <i class="fas fa-eye"></i>
      Showing All (${connections.length})
    `;
  } else {
    btn.classList.remove('bg-green-600', 'hover:bg-green-700');
    btn.classList.add('bg-purple-600', 'hover:bg-purple-700');
    btn.innerHTML = `
      <i class="fas fa-eye-slash"></i>
      Show All Connections
    `;
  }
});


// Add the blueprint button handler with your other event listeners
document.getElementById('blueprintBtn')?.addEventListener('click', () => {
  toggleBlueprintMode();
});

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
