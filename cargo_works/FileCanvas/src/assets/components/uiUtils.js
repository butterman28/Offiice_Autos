// public/assets/components/uiUtils.js

export function showSnackbar(message, type = 'error') {
  const snackbar = document.getElementById('snackbar');
  if (!snackbar) return;

  snackbar.textContent = message;
  snackbar.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg text-white font-medium z-[20000] opacity-0 pointer-events-none transition-all duration-300 ease-in-out';

  const types = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500 text-gray-900',
    error: 'bg-red-500'
  };
  snackbar.classList.add(...types[type]?.split(' ') || types.error.split(' '));

  setTimeout(() => snackbar.classList.replace('opacity-0', 'opacity-100'), 10);
  setTimeout(() => snackbar.classList.replace('opacity-100', 'opacity-0'), 3000);
}

export function showConfirmModal(message) {
  return new Promise((resolve) => {
    const m = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmModalMessage');
    const yes = document.getElementById('confirmModalYes');
    const no = document.getElementById('confirmModalNo');
    
    msg.textContent = message;
    m.classList.remove('hidden');

    const cleanup = () => {
      m.classList.add('hidden');
      yes.removeEventListener('click', handleYes);
      no.removeEventListener('click', handleNo);
    };
    const handleYes = () => { cleanup(); resolve(true); };
    const handleNo = () => { cleanup(); resolve(false); };

    yes.addEventListener('click', handleYes);
    no.addEventListener('click', handleNo);
  });
}

export function showInputModal(title, label, defaultValue = "") {
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
export function createTrashIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("class", "w-4 h-4");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79c.34-.059.68-.114 1.022-.166m0 0L6.75 19.5a2.25 2.25 0 002.244 2.25h6.012a2.25 2.25 0 002.244-2.25L17.25 5.79m-10.5 0h10.5M9 5.25V4.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 4.5v.75");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

export async function isDirectory(path, fileapi) {
  try {
    return await fileapi.isDir(path);
  } catch (err) {
    console.warn(`isDirectory failed for ${path}:`, err);
    return false;
  }
}

// uiUtils.js (or wherever appropriate)
export function showPropertiesModal(contentHtml, fileName) {
  // Remove any existing modal to avoid duplicates
  const existing = document.getElementById('properties-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'properties-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/40 z-[40000] flex items-center justify-center p-4';

  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
      <div class="px-5 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800">Properties: <span class="font-medium text-indigo-600">${fileName}</span></h3>
      </div>
      
      <div class="p-5 overflow-y-auto text-sm text-gray-700 max-h-[50vh]">
        ${contentHtml}
      </div>
      
      <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 text-right">
        <button id="close-properties-btn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shadow-sm">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Handle close button
  const closeButton = overlay.querySelector('#close-properties-btn');
  closeButton.addEventListener('click', () => {
    overlay.remove();
  });

  // Close on outside click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Optional: Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      window.removeEventListener('keydown', handleEscape);
    }
  };
  window.addEventListener('keydown', handleEscape);
}

// uiUtils.js
export function showRenameModal(originalName, onSubmit) {
  // Remove any existing modal
  const existing = document.getElementById('rename-modal-overlay');
  if (existing) existing.remove();

  // Determine if it's a file (has extension)
  let namePart = originalName;
  let extPart = '';
  const lastDotIndex = originalName.lastIndexOf('.');
  if (lastDotIndex > 0 && lastDotIndex < originalName.length - 1) {
    namePart = originalName.substring(0, lastDotIndex);
    extPart = originalName.substring(lastDotIndex);
  }

  const overlay = document.createElement('div');
  overlay.id = 'rename-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/40 z-[41000] flex items-center justify-center p-4';

  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-lg w-full max-w-sm border border-gray-200">
      <div class="px-5 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800">Rename Item</h3>
      </div>
      
      <div class="p-5">
        <label class="block text-sm font-medium text-gray-700 mb-2">New name</label>
        <div class="flex">
          <input 
            type="text" 
            id="rename-input"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value="${namePart}"
          />
          ${extPart ? `<div class="bg-gray-100 px-3 py-2 border-t border-b border-r border-gray-300 rounded-r-lg text-gray-500">${extPart}</div>` : ''}
        </div>
        <p id="rename-error" class="mt-2 text-sm text-red-500 hidden"></p>
      </div>
      
      <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
        <button id="rename-cancel" class="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
          Cancel
        </button>
        <button id="rename-submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shadow-sm">
          Rename
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#rename-input');
  const errorEl = overlay.querySelector('#rename-error');
  const submitBtn = overlay.querySelector('#rename-submit');
  const cancelBtn = overlay.querySelector('#rename-cancel');

  // Auto-select filename (not extension)
  input.setSelectionRange(0, input.value.length);

  // Invalid characters for most filesystems
  const INVALID_CHARS = /[\\/:*?"<>|]/;

  function validate(name) {
    if (!name.trim()) {
      return 'Name cannot be empty';
    }
    if (INVALID_CHARS.test(name)) {
      return 'Name contains invalid characters: \\ / : * ? " < > |';
    }
    if (name.trim() === originalName) {
      return null; // Allow same name (no-op), but we'll handle this in caller
    }
    return null;
  }

  function handleClose() {
    overlay.remove();
    window.removeEventListener('keydown', handleKeydown);
  }

  function handleSubmit() {
    const newName = extPart ? input.value.trim() + extPart : input.value.trim();
    const error = validate(input.value.trim());
    
    if (error) {
      errorEl.textContent = error;
      errorEl.classList.remove('hidden');
      return;
    }

    if (newName === originalName) {
      // No change — just close
      handleClose();
      return;
    }

    handleClose();
    onSubmit(newName);
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  }

  // Events
  submitBtn.addEventListener('click', handleSubmit);
  cancelBtn.addEventListener('click', handleClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });
  window.addEventListener('keydown', handleKeydown);

  // Focus input
  input.focus();
}