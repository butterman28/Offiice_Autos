import { fileapi } from '../fileapi.js';
import { showSnackbar } from './uiUtils.js';

export async function showOpenWithModal(filePath, fileName) {
  let apps;
  try {
    apps = await fileapi.listOpenWithApps(filePath);
  } catch (e) {
    showSnackbar("Failed to load applications", "error");
    return;
  }

  if (!apps.length) {
    showSnackbar("No applications found", "warning");
    return;
  }

  const recommended = apps.filter(app => app.is_recommended);
  const others = apps.filter(app => !app.is_recommended);

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 bg-black/50 z-[40000] flex items-center justify-center p-4";

  const modal = document.createElement("div");
  modal.className =
    "bg-gray-800 text-gray-100 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden";

  modal.innerHTML = `
    <div class="px-4 py-3 border-b border-gray-700">
      <h2 class="font-semibold text-base truncate">Open "${fileName}" with</h2>
    </div>

    <!-- Recommended apps -->
    <div class="recommended-section ${recommended.length ? '' : 'hidden'}">
      <div class="px-4 py-2 bg-indigo-900/30 border-b border-indigo-700/30">
        <div class="text-xs font-semibold text-indigo-300 uppercase tracking-wide flex items-center gap-2">
          <i class="fas fa-star text-indigo-400"></i>
          Recommended
        </div>
      </div>
      <div class="recommended-list divide-y divide-gray-700"></div>
    </div>

    <!-- Search -->
    <div class="px-4 py-2 border-b border-gray-700 bg-gray-900/50">
      <input
        type="text"
        placeholder="Search all applications..."
        class="w-full px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>

    <!-- Other apps -->
    <div class="other-section ${others.length ? '' : 'hidden'} flex-1 flex flex-col">
      <div class="px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          All Applications
        </div>
      </div>
      <div class="overflow-y-auto divide-y divide-gray-700 flex-1 other-list max-h-[300px]"></div>
    </div>

    <!-- Cancel button -->
    <div class="px-4 py-2 border-t border-gray-700 bg-gray-900/50 text-right">
      <button class="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 cancel-btn rounded hover:bg-gray-700 transition">
        Cancel
      </button>
    </div>
  `;

  const recommendedListEl = modal.querySelector(".recommended-list");
  const otherListEl = modal.querySelector(".other-list");
  const searchInput = modal.querySelector("input");
  const recommendedSection = modal.querySelector(".recommended-section");
  const otherSection = modal.querySelector(".other-section");

  function createAppButton(app, isRecommended = false) {
    const btn = document.createElement("button");
    btn.className = `w-full text-left px-4 py-3 hover:bg-gray-700 transition flex items-center gap-3`;
    
    btn.innerHTML = `
      <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isRecommended ? 'bg-indigo-900/50 text-indigo-400' : 'bg-gray-700 text-gray-300'
      }">
        <i class="fas fa-rocket text-sm"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate group-hover:text-indigo-300 transition">
          ${app.name}
        </div>
      </div>
      <i class="fas fa-arrow-right text-gray-500 text-sm"></i>
    `;

    btn.addEventListener("click", async () => {
      try {
        console.log(`Attempting to open ${filePath} with ${app.name} (exec: ${app.exec})`);
        await fileapi.openWithApp(app.exec, filePath);
        showSnackbar(`Opening with ${app.name}...`, "success");
      } catch (error) {
        console.error(`Failed to open with ${app.name}:`, error);
        showSnackbar(`Failed to open with ${app.name}`, "error");
      } finally {
        overlay.remove();
      }
    });

    return btn;
  }

  function renderLists(filteredRecommended, filteredOthers) {
    recommendedListEl.innerHTML = "";
    if (filteredRecommended.length) {
      recommendedSection.classList.remove('hidden');
      filteredRecommended.forEach(app => {
        recommendedListEl.appendChild(createAppButton(app, true));
      });
    } else {
      recommendedSection.classList.add('hidden');
    }

    otherListEl.innerHTML = "";
    if (filteredOthers.length) {
      otherSection.classList.remove('hidden');
      filteredOthers.forEach(app => {
        otherListEl.appendChild(createAppButton(app, false));
      });
    } else if (filteredRecommended.length === 0) {
      otherListEl.innerHTML = `
        <div class="px-4 py-8 text-center text-gray-500 text-sm">
          <i class="fas fa-search text-2xl text-gray-600 mb-2"></i>
          <div>No matching applications found</div>
        </div>
      `;
      otherSection.classList.remove('hidden');
    } else {
      otherSection.classList.add('hidden');
    }
  }

  renderLists(recommended, others);

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      renderLists(recommended, others);
      return;
    }
    const filteredRecommended = recommended.filter(app => app.name.toLowerCase().includes(q));
    const filteredOthers = others.filter(app => app.name.toLowerCase().includes(q));
    renderLists(filteredRecommended, filteredOthers);
  });

  modal.querySelector(".cancel-btn").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  searchInput.focus();
}