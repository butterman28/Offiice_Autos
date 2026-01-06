import { showSnackbar } from "./uiUtils.js";
import { showRenameModal } from "./uiUtils.js";
import { showPropertiesModal } from "./uiUtils.js";
import { showOpenWithModal } from "./openWithModal.js";
import { fileapi } from "../fileapi.js";
export function showItemContextMenu(e, item) {
  e.preventDefault();

  const { path, name, is_directory } = item;

  const existing = document.getElementById('item-context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'item-context-menu';
  menu.className =
    'absolute z-[30000] bg-white border border-gray-200 rounded shadow-lg py-1 text-sm min-w-[160px] text-gray-800';
  menu.style.left = `${e.clientX + window.scrollX}px`;
  menu.style.top = `${e.clientY + window.scrollY}px`;

  menu.innerHTML = `
    <button data-action="open" class="menu-btn">
      <i class="fas ${is_directory ? 'fa-folder-open' : 'fa-file-medical'}"></i>
      Open
    </button>

    ${
      !is_directory
        ? `
      <button data-action="open-with" class="menu-btn">
        <i class="fas fa-external-link-alt"></i>
        Open With...
      </button>
      `
        : ''
    }

    <hr class="my-1 border-gray-200">

    <button data-action="rename" class="menu-btn">
      <i class="fas fa-edit"></i>
      Rename
    </button>

    <button data-action="properties" class="menu-btn">
      <i class="fas fa-info-circle"></i>
      Properties
    </button>
  `;

  menu.querySelectorAll('.menu-btn').forEach(btn => {
    btn.classList.add(
      'w-full',
      'text-left',
      'px-4',
      'py-2',
      'hover:bg-indigo-50',
      'flex',
      'items-center',
      'gap-2'
    );
  });

  menu.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    menu.remove();

    try {
      switch (action) {
        case 'open':
          if (is_directory) {
            window.dispatchEvent(
              new CustomEvent('open-folder', { detail: { path } })
            );
          } else {
            await fileapi.openFile(path);
          }
          break;

        case 'open-with':
          showOpenWithModal(path, name);
          break;

        case 'rename':
          showRenameModal(name, async newName => {
            const newPath = await fileapi.renameItem(path, newName);
            showSnackbar(`Renamed to "${newName}"`, 'success');

            window.dispatchEvent(
              new CustomEvent('file-renamed', {
                detail: { oldPath: path, newPath }
              })
            );
          });
          break;

        case 'properties':
          await showItemProperties(path, name);
          break;
      }
    } catch (err) {
      console.error(err);
      showSnackbar(`Action failed on "${name}"`, 'error');
    }
  });

  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  });

  document.body.appendChild(menu);
}

async function showItemProperties(path, name) {
  const info = await fileapi.getFileInfo(path);

  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };
  const content = `
    <div class="text-sm text-gray-700 space-y-1">
      <div><span class="font-medium">Name:</span> ${info.name}</div>
      <div><span class="font-medium">Path:</span> ${info.path}</div>
      <div><span class="font-medium">Type:</span> ${
        info.is_directory ? 'Folder' : 'File'
      }</div>
      <div>
        <span class="font-medium">Size:</span> ${formatBytes(info.size)}
      </div>
      <div><span class="font-medium">Created:</span> ${new Date(
        info.ctime
      ).toLocaleString()}</div>
      <div><span class="font-medium">Modified:</span> ${new Date(
        info.mtime
      ).toLocaleString()}</div>
    </div>
  `;

  showPropertiesModal(content, name);
}
