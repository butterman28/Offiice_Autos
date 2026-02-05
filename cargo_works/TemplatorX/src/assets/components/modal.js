// modal.js

let modalInstance = null;

function createModal() {
  if (modalInstance) return modalInstance;

  const backdrop = document.createElement("div");
  backdrop.id = "customModal";
  backdrop.className = "hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50";

  // We'll fill inner content dynamically
  document.body.appendChild(backdrop);
  modalInstance = backdrop;
  return backdrop;
}

// --- New: Confirmation Modal ---
export async function showConfirm(title, message) {
  const modal = createModal();

  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-80 max-w-[90%] shadow-xl">
      <h3 class="text-sm font-medium text-gray-800 mb-2">${title}</h3>
      <p class="text-sm text-gray-600 mb-4">${message}</p>
      <div class="flex justify-end gap-2">
        <button id="modalCancel" class="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">Cancel</button>
        <button id="modalConfirm" class="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">Remove</button>
      </div>
    </div>
  `;

  const cancelBtn = modal.querySelector("#modalCancel");
  const confirmBtn = modal.querySelector("#modalConfirm");

  modal.classList.remove("hidden");

  return new Promise((resolve) => {
    const cleanup = () => {
      modal.classList.add("hidden");
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.onclick = onCancel;
    confirmBtn.onclick = onConfirm;

    // Close on Escape or backdrop click
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    modal.onclick = (e) => {
      if (e.target === modal) onCancel();
    };

    window.addEventListener("keydown", onKey, { once: true });
  });
}

// --- Existing: Input Prompt ---
export async function showModalPrompt(title, defaultValue = "") {
  const modal = createModal();

  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-80 max-w-[90%] shadow-xl">
      <h3 id="modalTitle" class="text-sm font-medium text-gray-800 mb-3">${title}</h3>
      <input
        type="text"
        id="modalInput"
        class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value="${defaultValue.replace(/"/g, '&quot;')}"
        autofocus
      />
      <div class="mt-4 flex justify-end gap-2">
        <button id="modalCancel" class="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">Cancel</button>
        <button id="modalConfirm" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">OK</button>
      </div>
    </div>
  `;

  const inputEl = modal.querySelector("#modalInput");
  const cancelBtn = modal.querySelector("#modalCancel");
  const confirmBtn = modal.querySelector("#modalConfirm");

  modal.classList.remove("hidden");
  inputEl.focus();
  inputEl.select();

  return new Promise((resolve) => {
    const cleanup = () => {
      modal.classList.add("hidden");
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onConfirm = () => {
      const value = inputEl.value.trim();
      cleanup();
      resolve(value || null);
    };

    cancelBtn.onclick = onCancel;
    confirmBtn.onclick = onConfirm;

    const onKey = (e) => {
      if (e.key === "Enter") onConfirm();
      else if (e.key === "Escape") onCancel();
    };

    modal.onclick = (e) => {
      if (e.target === modal) onCancel();
    };

    inputEl.addEventListener("keydown", onKey, { once: true });
  });
}

// --- Snackbar Utility ---
let snackbarInstance = null;

function createSnackbar() {
  if (snackbarInstance) return snackbarInstance;

  const snackbar = document.createElement("div");
  snackbar.id = "snackbar";
  snackbar.className = "hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg text-white font-medium z-50 transition-opacity duration-300";
  document.body.appendChild(snackbar);
  snackbarInstance = snackbar;
  return snackbar;
}

export function showSnackbar(message, type = "info") {
  const snackbar = createSnackbar();

  // Set background color based on type
  const bgColor = {
    success: "bg-green-600",
    error: "bg-red-600",
    warning: "bg-yellow-600",
    info: "bg-blue-600"
  }[type] || "bg-gray-600";

  snackbar.className = snackbar.className
    .replace(/bg-\w+-\d+/g, "") // Remove old bg class
    .trim();
  snackbar.classList.add(...bgColor.split(" "));
  snackbar.textContent = message;

  // Show
  snackbar.classList.remove("hidden");
  snackbar.style.opacity = "1";

  // Auto-hide after 3 seconds
  setTimeout(() => {
    snackbar.style.opacity = "0";
    setTimeout(() => {
      snackbar.classList.add("hidden");
    }, 300); // Match duration
  }, 3000);
}