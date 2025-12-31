
import { fileapi } from "/assets/fileapi.js";
  const folderCache = new Map();
  const container = document.getElementById('panelsContainer');
  if (!container) console.log("broken ");

  let panelId = 0;
  const Z_INDEX_BASE = 10;
//Add a single global SVG overlay for arrows and stuff 
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
let activeArrow = null;
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


function redrawSingleConnection(c) {
  const a = c.fromEl.getBoundingClientRect();
  const b = c.toEl.getBoundingClientRect();

  const start = clientToSvg(
    a.left + a.width / 2,
    a.top + a.height / 2
  );

  const end = clientToSvg(
    b.left,
    b.top + b.height / 2
  );

  c.pathEl.setAttribute(
    "d",
    `M ${start.x},${start.y} L ${end.x},${end.y}`
  );

  // Position cancel button at midpoint
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  c.cancelBtn.setAttribute(
    "transform",
    `translate(${midX}, ${midY})`
  );
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
    //////////
    // Default staggered position if not provided
    //////////
    if (left === null) left = 50 + (panelId * 30) % 300;
    if (top === null) top = 120 + (panelId * 40) % 200;

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.zIndex = Z_INDEX_BASE + panelId;
/////////
// FIle Panel Html 
/////////      
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

            <!-- RIGHT CONTROLS -->
            <div class="ml-auto flex items-center gap-1">
            <!---- dramatic collapse button you can use in code ---->
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
              <!---- close button ---->
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

    // Make only the header draggable (better UX)
    const dragHandle = panel.querySelector('.drag-handle');
    dragHandle.style.cursor = 'move';

    document.body.appendChild(panel); // ← append to body, not container!
    makeDraggable(panel);

    // ➕ NEW: Listen to scroll inside this panel's tree
    const treeContainer = panel.querySelector('.tree-container');
    if (treeContainer) {
      let scrollDebounce;
      treeContainer.addEventListener('scroll', () => {
        // Optional: cancel active arrow when scrolling (clean UX)
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


  function redrawAllConnections() {
      for (const c of connections) {
        redrawSingleConnection(c);
      }
    }
//////////////
//Render file tree
/////////////
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
  label.className =
    "cursor-pointer font-medium text-indigo-700 hover:underline truncate max-w-[200px]";
  label.textContent = `📁 ${item.name}`;
  label.title = item.path;

  let expanded = false;
  let childContainer = null;
///////////
//Expand folder section of code 
///////////
  label.addEventListener("click", async () => {
  expanded = !expanded;

  if (!expanded) {
    if (childContainer) {
      childContainer.remove();
      childContainer = null;
    }
    return;
  }

  childContainer = document.createElement("div");
  childContainer.className = "ml-4 text-sm text-slate-500";
  childContainer.textContent = "Loading...";
  li.appendChild(childContainer);

  try {
    let children;

    if (folderCache.has(item.path)) {
      children = folderCache.get(item.path);
    } else {
      children = await fileapi.readFolder(item.path);
      folderCache.set(item.path, children);
    }

    if (children.length === 0) {
        const empty = document.createElement("div");
        empty.className = "ml-6 text-xs text-slate-400 italic select-none";
        empty.textContent = "(empty)";
        childContainer.replaceWith(empty);
        childContainer = empty;
      } else {
        const subtree = renderTree(children);
        childContainer.replaceWith(subtree);
        childContainer = subtree;
      }

  } catch (err) {
    childContainer.textContent = "Failed to load folder";
    console.error(err);
  }
});


  // ➕ Add inside folder
  const addBtn = document.createElement("button");
  addBtn.className =
    "ml-auto text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 " +
    "hover:bg-indigo-200 transition";

  addBtn.textContent = "+";
  addBtn.title = "Add inside folder";

  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    console.log("Create inside folder:", item.path);
  });

  // 🗑 Delete folder
  const delBtn = document.createElement("button");
  delBtn.className =
    "text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 " +
    "hover:bg-red-200 transition";
  delBtn.textContent = "×";
  delBtn.title = "Delete folder";

  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    console.log("Delete folder:", item.path);
  });

  // ● Arrow anchor
  const dot = document.createElement("div");
  dot.dataset.folderPath = item.path;
  dot.className =
    "w-2.5 h-2.5  rounded-full bg-indigo-400 cursor-crosshair  " +
    "hover:bg-indigo-600 transition";

  dot.title = "Drag to connect";

  dot.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    startArrowFrom(item.path, dot);
  });

  row.append(label, addBtn, delBtn, dot);
  li.appendChild(row);
}
 else {
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 group ml-4";

  const label = document.createElement("div");
  label.className =
    "text-gray-700 truncate max-w-[200px]";
  label.textContent = `📄 ${item.name}`;
  label.title = item.path;

  // 🗑 Delete file
  const delBtn = document.createElement("button");
  delBtn.className =
    "ml-auto text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 " +
    "hover:bg-red-200 transition";
  delBtn.textContent = "×";
  delBtn.title = "Delete file";

  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    console.log("Delete file:", item.path);
  });

  // ● Arrow anchor
  const dot = document.createElement("div");
  dot.dataset.folderPath = item.path;
  dot.className =
  "w-2.5 h-2.5 rounded-full bg-gray-400 cursor-crosshair " +
  "hover:bg-gray-600 transition-colors";

  dot.title = "Drag to connect";

  dot.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    startArrowFrom(item.path, dot);
  });

  row.append(label, delBtn, dot);
  li.appendChild(row);
}
    li

    ul.appendChild(li);
  }

  return ul;
}

const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
folderCache.delete(parentPath);



  // 🔧 Make any element freely draggable
  function makeDraggable(element) {
    let isDragging = false;
    let offsetX, offsetY;

    const handleStart = (e) => {
        if (
          e.target.closest('input, button, textarea, select, a, .tree-container')
        ) {
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

    // Bind events
    element.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    // Prevent text selection during drag
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

  document.addEventListener("mouseup", (e) => {
  if (!activeArrow) return;

  const targetDot = e.target.closest("div[data-folder-path]");

  // ❌ Invalid drop → cancel arrow
  if (!targetDot) {
    activeArrow.path.remove();
    activeArrow = null;
    return;
  }

  // ✅ Valid folder drop
  const toPath = targetDot.dataset.folderPath;

  const cancelBtn = createCancelButton(() => {
  connection.pathEl.remove();
  connection.cancelBtn.remove();
  connections.splice(connections.indexOf(connection), 1);
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
  redrawSingleConnection(connection);

  activeArrow = null; // ✅ RELEASE CURSOR
});



document.addEventListener("mousemove", (e) => {
  if (!activeArrow) return;

  const fromRect = activeArrow.fromEl.getBoundingClientRect();

  const start = clientToSvg(
    fromRect.left + fromRect.width / 2,
    fromRect.top + fromRect.height / 2
  );

  const end = clientToSvg(e.clientX, e.clientY);

  activeArrow.path.setAttribute(
    "d",
    `M ${start.x},${start.y} L ${end.x},${end.y}`
  );
});


  // Close panel (window-style)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;

  const id = btn.getAttribute("data-close");
  const panel = document.getElementById(id);
  if (!panel) return;

  // Remove related connections
  for (let i = connections.length - 1; i >= 0; i--) {
    const c = connections[i];
    if (!document.body.contains(c.fromEl) || !document.body.contains(c.toEl)) {
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

  // Rotate arrow
  icon.style.transform = isCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
});

  //create panel with tree
  async function createPanelWithTree(type) {
  const paths = await fileapi.pickFolder();
  if (!paths || paths.length === 0) return;

  const path = paths[0]; // must be a string

  // ✅ CREATE THE PANEL
  const panel = createPanel(type, path);

  // ✅ GET TREE CONTAINER FROM THAT PANEL
  const treeContainer = panel.querySelector(".tree-container");
  treeContainer.textContent = "Loading...";

  try {
    // ✅ LOAD TREE ONCE
    const tree = await fileapi.readFolder(path);

    // ✅ RENDER TREE
    treeContainer.textContent = "";
    treeContainer.appendChild(renderTree(tree));
  } catch (err) {
    treeContainer.textContent = "Failed to load folder contents.";
    console.error(err);
  }
}



  // ➕ Buttons
  document.getElementById("addSourceBtn")
  ?.addEventListener("click", () => createPanelWithTree("source"));

document.getElementById("addDestinationBtn")
  ?.addEventListener("click", () => createPanelWithTree("destination"));



  document.getElementById('clearAllBtn')?.addEventListener('click', () => {
  // Remove panels
  document.querySelectorAll('[id^="panel-"]').forEach(el => el.remove());

  // Remove all connections (paths + cancel buttons)
  for (const c of connections) {
    c.pathEl.remove();
    c.cancelBtn?.remove();
  }

  connections.length = 0; // clear array

  // Cancel any in-progress arrow
  if (activeArrow) {
    activeArrow.path.remove();
    activeArrow = null;
  }
});


  // Optional: get all panel states (position + value)
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
    // Cancel active arrow on page scroll
    if (activeArrow) {
      activeArrow.path.remove();
      activeArrow = null;
    }
    redrawAllConnections();
  }, { passive: true });

  window.addEventListener("resize", () => {
    svg.setAttribute(
      "viewBox",
      `0 0 ${window.innerWidth} ${window.innerHeight}`
    );
    redrawAllConnections();
  });


  window.addEventListener("resize", () => {
  svg.setAttribute(
    "viewBox",
    `0 0 ${window.innerWidth} ${window.innerHeight}`
  );
  redrawAllConnections();
});

