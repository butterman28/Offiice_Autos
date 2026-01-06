// public/assets/components/fileTree.js
import { fileapi } from '../fileapi.js';
import { sortItems } from './sorting.js';
import { showSnackbar, showInputModal, createTrashIcon, isDirectory,showConfirmModal  } from './uiUtils.js';
import { startArrowFrom } from './connections.js';
import { isTransferred } from './transferHistory.js';
import { showOpenWithModal } from './openWithModal.js';
import { showRenameModal } from './uiUtils.js';
import { showItemContextMenu } from './showItemContextMenu.js';
const folderCache = new Map();
import { showPropertiesModal } from './uiUtils.js';
const panelSortOrder = new Map();

export { folderCache, panelSortOrder };
let redrawAllConnections = () => {};

export function setRedrawFn(fn) {
  redrawAllConnections = fn;
}

/////

export async function refreshFolderNode(folderPath, li) {
  let cont = li.querySelector('.subtree-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'subtree-container ml-4';
    li.appendChild(cont);
  }

  try {
    const children = await fileapi.readFolder(folderPath);
    folderCache.set(folderPath, children);
    if (children.length === 0) {
      cont.innerHTML = '<div class="ml-6 text-xs text-slate-400 italic">(empty)</div>';
      return;
    }
    const tree = renderTree(children, fileapi);
    cont.innerHTML = '';
    cont.appendChild(tree);
  } catch (err) {
    cont.textContent = "Refresh failed";
    console.error(err);
  }
}

export async function refreshPanelByRootPath(rootPath, fileapi) {
  document.querySelectorAll('[id^="panel-"]').forEach(async panel => {
    const input = panel.querySelector('input');
    const panelPath = input?.value.trim();
    if (!panelPath || !(rootPath === panelPath || rootPath.startsWith(panelPath + '/'))) return;

    const cont = panel.querySelector('.tree-container');
    if (!cont) return;
    cont.textContent = "Loading...";
    try {
      const children = await fileapi.readFolder(panelPath);
      folderCache.set(panelPath, children);
      const panelId = panel.id;
      const sort = panelSortOrder.get(panelId) || 'name';
      const sorted = sortItems(children, sort);
      cont.textContent = "";
      cont.appendChild(renderTree(sorted, fileapi));
      redrawAllConnections();
    } catch (err) {
      cont.textContent = "Failed to refresh";
      console.error(err);
    }
  });
}

export function renderTree(items) {
  const ul = document.createElement("ul");
  ul.className = "ml-4 mt-2 space-y-1 text-sm";

  for (const item of items) {
    const li = document.createElement("li");
    if (item.is_directory) {
          const row = document.createElement("div");
          row.className = "flex items-center gap-2 group";
    
          // Inside renderTree, for folders:
          const label = document.createElement("div");
          label.dataset.folderPath = item.path;
          label.className = "cursor-pointer font-medium hover:underline truncate max-w-[200px]";
          // ✅ Add highlight class if flagged
          if (isTransferred(item.path)) {
            console.log("true")
            label.classList.add("text-green-600", "font-bold");
          } else {
            label.classList.add("text-indigo-600");
          }
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
            const subtree = renderTree(sortedChildren, fileapi); // 👈 pass sorted list
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
              await refreshFolderNode(item.path, li, fileapi);
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
              await refreshFolderNode(item.path, li, fileapi);
              redrawAllConnections();
    
    
              showSnackbar(`Created file "${name}"`, "success");
            } catch (err) {
              console.error("Failed to create file:", err);
              showSnackbar(`Failed to create file`, "error");
            }
          });
    
          addBtnContainer.append(addBtn, dropdown);
          label.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            showItemContextMenu(e, item);
          });
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
              const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
              folderCache.delete(parentPath);
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
    
          // Inside renderTree, for files:
          const label = document.createElement("div");
          label.className = " truncate max-w-[200px]";
          if (isTransferred(item.path)) {
            console.log("true 1 ")
          label.classList.add("text-green-600", "font-bold");
        } else {
          label.classList.add("text-gray-700");
        }
                  label.textContent = `📄 ${item.name}`;
          label.title = item.path;

        // ✅ Double-click to open with default app
        label.addEventListener("dblclick", async (e) => {
          e.stopPropagation();
          try {
            await fileapi.openFile(item.path);
          } catch (err) {
            console.error("Open failed:", err);
            showSnackbar(`Could not open "${item.name}"`, "error");
          }
        });

        // ✅ Right-click for context menu
        label.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showItemContextMenu(e, item);
        });

          
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
              const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
              folderCache.delete(parentPath);

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
// Auto-refresh panels when a file/folder is renamed
window.addEventListener('file-renamed', async (e) => {
  const { oldPath } = e.detail;
  const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
  if (parentDir) {
    folderCache.delete(parentDir);
    await refreshPanelByRootPath(parentDir, fileapi);
  }
});
window.addEventListener('open-folder', (e) => {
  const { path } = e.detail;
  const label = document.querySelector(`[data-folder-path="${path}"]`);
  label?.click();
});
