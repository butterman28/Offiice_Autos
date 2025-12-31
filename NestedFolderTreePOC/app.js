// ============================================
// POC: DOM Tree inside Konva ForeignObject (Simulated)
// ============================================

window.addEventListener("DOMContentLoaded", () => {
    // --- Setup Konva ---
    const stage = new Konva.Stage({
        container: "container",
        width: window.innerWidth,
        height: window.innerHeight,
    });
    const layer = new Konva.Layer();
    stage.add(layer);

    // --- Sample nested folder data ---
    const sampleData = [
        { name: "Documents", isDirectory: true, path: "/docs", children: [
            { name: "Work", isDirectory: true, path: "/docs/work", children: [
                { name: "Report.pdf", isDirectory: false, path: "/docs/work/report.pdf" },
                { name: "Slides.pptx", isDirectory: false, path: "/docs/work/slides.pptx" }
            ]},
            { name: "Personal", isDirectory: true, path: "/docs/personal", children: [
                { name: "Notes.txt", isDirectory: false, path: "/docs/personal/notes.txt" }
            ]}
        ]},
        { name: "Images", isDirectory: true, path: "/images", children: [
            { name: "Vacation.jpg", isDirectory: false, path: "/images/vacation.jpg" }
        ]},
        { name: "Readme.md", isDirectory: false, path: "/readme.md" }
    ];

    // --- Simulated @tanstack/tree-core logic ---
    // This is a simplified version focusing on rendering and expansion state.
    class TreeSimulator {
        constructor(data) {
            this.data = data;
            this.expandedIds = new Set();
        }

        toggleExpanded(id) {
            if (this.expandedIds.has(id)) {
                this.expandedIds.delete(id);
            } else {
                this.expandedIds.add(id);
            }
        }

        isExpanded(id) {
            return this.expandedIds.has(id);
        }

        // Flatten data for rendering based on expansion state
        getFlattenedNodes(nodes, depth = 0, result = []) {
            nodes.forEach(node => {
                result.push({ ...node, depth });
                if (node.children && this.isExpanded(node.path)) { // Use path as ID
                    this.getFlattenedNodes(node.children, depth + 1, result);
                }
            });
            return result;
        }
    }

    // --- DOM Tree inside ForeignObject (Simulated) ---
    function createDomTreeFolderGroup(x, y, title, items) {
        const group = new Konva.Group({ x, y, draggable: true });

        // Title Bar
        const titleBar = new Konva.Rect({
            width: 300, height: 30, fill: "#2196F3", cornerRadius: [5, 5, 0, 0], stroke: "white", strokeWidth: 2
        });
        const titleText = new Konva.Text({
            text: title, fontSize: 14, fill: "white", x: 10, y: 8, width: 280, ellipsis: true
        });

        // DOM Container for Tree
        const domContainer = document.createElement('div');
        domContainer.className = 'folder-tree';
        domContainer.style.width = '300px';
        domContainer.style.height = '400px';
        domContainer.style.overflow = 'auto';

        // Create TreeSimulator instance
        const treeSim = new TreeSimulator(items);

        // Function to render the tree based on current state
        function renderTree() {
            domContainer.innerHTML = ''; // Clear previous content

            const flattenedNodes = treeSim.getFlattenedNodes(treeSim.data);

            flattenedNodes.forEach(node => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'tree-item';
                itemDiv.style.paddingLeft = `${node.depth * 16}px`;

                const indentSpan = document.createElement('span');
                indentSpan.className = 'tree-item-indent';

                const toggleSpan = document.createElement('span');
                toggleSpan.className = 'tree-item-toggle';
                if (node.isDirectory) {
                    toggleSpan.textContent = treeSim.isExpanded(node.path) ? '▼' : '▶';
                    toggleSpan.onclick = (e) => {
                        e.stopPropagation(); // Prevent triggering item click
                        treeSim.toggleExpanded(node.path);
                        renderTree(); // Re-render after state change
                    };
                } else {
                    toggleSpan.textContent = '  '; // Empty space for files
                }

                const iconSpan = document.createElement('span');
                iconSpan.className = 'tree-item-icon';
                iconSpan.textContent = node.isDirectory ? '📁' : '📄';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = node.name;

                itemDiv.appendChild(indentSpan);
                itemDiv.appendChild(toggleSpan);
                itemDiv.appendChild(iconSpan);
                itemDiv.appendChild(nameSpan);

                // Example item click handler
                itemDiv.onclick = () => {
                    console.log('Clicked item:', node);
                    // You could trigger connection picking here
                };

                domContainer.appendChild(itemDiv);
            });
        }

        // Initial render
        renderTree();

        // Konva ForeignObject (Simulated by absolute positioning)
        const foreignObjectPlaceholder = new Konva.Rect({
            x: 0, y: 30, width: 300, height: 400,
            fill: 'white', // Background
            stroke: '#ccc',
            strokeWidth: 1,
            cornerRadius: [0, 0, 5, 5],
            listening: false // We handle clicks on the DOM element
        });

        // Position the DOM div absolutely relative to the stage
        function updateDomPosition() {
            const stageRect = stage.container().getBoundingClientRect();
            domContainer.style.position = 'absolute';
            domContainer.style.left = `${stageRect.left + group.getAbsolutePosition().x}px`;
            domContainer.style.top = `${stageRect.top + group.getAbsolutePosition().y + 30}px`;
            domContainer.style.zIndex = '1000'; // Ensure it's on top if needed
            domContainer.style.pointerEvents = 'auto'; // Allow interaction
        }

        // Add elements to Konva group
        group.add(titleBar, titleText, foreignObjectPlaceholder);

        // Initial position update
        updateDomPosition();

        // Add group to layer
        layer.add(group);

        // Update DOM position on stage move/resize/group drag
        function updatePosition() {
            updateDomPosition();
        }

        // Listen for group drag events
        group.on('dragmove', updatePosition);
        stage.on('wheel', updatePosition); // Example for zoom/pan if implemented

        // Add DOM element to body (or a container that covers the stage)
        document.body.appendChild(domContainer);

        // Clean up DOM element on group destroy
        group.on('destroy', () => {
             if (domContainer.parentNode) {
                 domContainer.parentNode.removeChild(domContainer);
             }
             stage.off('wheel', updatePosition);
        });

        // Return group for adding to layer
        return group;
    }

    // --- Create Instance ---
    const domGroup = createDomTreeFolderGroup(50, 50, "DOM Tree (Hybrid)", sampleData);

    // Add group to layer and draw
    layer.add(domGroup);
    layer.draw();

    // Handle window resize for DOM element positioning
    window.addEventListener('resize', () => {
        stage.width(window.innerWidth);
        stage.height(window.innerHeight);
        // Trigger position update for the DOM element
        domGroup.fire('dragmove');
        layer.draw(); // Redraw Konva layer
    });

    console.log("POC loaded. DOM Tree Hybrid approach running.");
});
