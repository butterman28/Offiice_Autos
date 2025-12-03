window.addEventListener("DOMContentLoaded", () => {
    const stage = new Konva.Stage({
        container: "canvas-container",
        width: window.innerWidth,
        height: window.innerHeight,
        draggable: true
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    let groups = [];
    let arrows = [];
    let connectFrom = null;
    let connectionLine = null;

    // ====== Create Expandable Folder Group ======
    function createFolderGroup({ type, x, y, title, items = [], currentPath, isSource = true }) {
        const group = new Konva.Group({ x, y, draggable: true });

        const padding = 10;
        const lineHeight = 25;
        const titleHeight = 35;
        const minwidth = 280;

        // Title bar
        const titleBar = new Konva.Rect({
            width: minwidth,
            height: titleHeight,
            fill: isSource ? "#2196F3" : "#4CAF50",
            cornerRadius: [5, 5, 0, 0],
            stroke: "white",
            strokeWidth: 2,
            shadowColor: "black",
            shadowBlur: 5,
            shadowOpacity: 0.3
        });

        const titleText = new Konva.Text({
            text: title,
            fontSize: 13,
            fontStyle: "bold",
            fill: "white",
            x: padding,
            y: titleHeight / 2 - 7,
            width: minwidth - 50,
            ellipsis: true
        });

        const toggleIcon = new Konva.Text({
            text: "▼",
            fontSize: 14,
            fill: "white",
            x: minwidth - 30,
            y: titleHeight / 2 - 8,
            width: 20,
            align: "center"
        });

        // Item list container
        const itemList = new Konva.Group({ y: titleHeight });
        const itemElements = [];
        const fileDots = [];

        // Back button if we're in a subfolder
        const parentPath = currentPath ? currentPath.split(/[/\\]/).slice(0, -1).join('/') : null;
        let startIndex = 0;

        if (parentPath) {
            const backBg = new Konva.Rect({
                x: 0,
                y: 0,
                width: minwidth,
                height: lineHeight,
                fill: "#f5f5f5"
            });

            const backText = new Konva.Text({
                text: "  ⬆️ .. (Go Back)",
                fontSize: 12,
                fontStyle: "bold",
                fill: "#666",
                x: padding,
                y: 5,
                width: minwidth - 40
            });

            backBg.on("click", async () => {
                const newItems = await window.api.readFolder(parentPath);
                const parentName = parentPath.split(/[/\\]/).pop() || "Root";
                await refreshGroup(group, newItems, parentPath, `📁 ${parentName}`);
            });

            backBg.on("mouseenter", () => {
                backBg.fill("#e0e0e0");
                layer.batchDraw();
            });

            backBg.on("mouseleave", () => {
                backBg.fill("#f5f5f5");
                layer.batchDraw();
            });

            itemList.add(backBg);
            itemList.add(backText);
            startIndex = 1;
        }

        items.forEach((item, i) => {
            const y = (i + startIndex) * lineHeight;
            const isDir = item.isDirectory;

            // Item background
            const itemBg = new Konva.Rect({
                x: 0,
                y: y,
                width: minwidth,
                height: lineHeight,
                fill: "transparent"
            });

            // Icon + name
            const icon = isDir ? "📁" : "📄";
            const itemText = new Konva.Text({
                text: `  ${icon} ${item.name}`,
                fontSize: 12,
                fill: isDir ? "#1976D2" : "#333",
                fontStyle: isDir ? "bold" : "normal",
                x: padding,
                y: y + 5,
                width: minwidth - 60,
                ellipsis: true
            });

            // Connector dot (only for files)
            let itemDot = null;
            if (!isDir) {
                itemDot = new Konva.Circle({
                    x: isSource ? minwidth - 12 : 12,
                    y: y + lineHeight / 2,
                    radius: 5,
                    fill: isSource ? "#FF9800" : "#8BC34A",
                    stroke: "white",
                    strokeWidth: 2,
                    name: "file-connector"
                });

                itemList.add(itemDot);
            }

            // Double-click to navigate into folder
            if (isDir) {
                itemBg.on("dblclick", async () => {
                    const folderPath = item.path;
                    const newItems = await window.api.readFolder(folderPath);
                    await refreshGroup(group, newItems, folderPath, `📁 ${item.name}`);
                });
            }

            // Hover effects
            itemBg.on("mouseenter", () => {
                itemBg.fill(isDir ? "#e3f2fd" : "#f0f0f0");
                if (itemDot) {
                    itemDot.radius(7);
                    itemDot.strokeWidth(3);
                }
                layer.batchDraw();
            });

            itemBg.on("mouseleave", () => {
                itemBg.fill("transparent");
                if (itemDot) {
                    itemDot.radius(5);
                    itemDot.strokeWidth(2);
                }
                layer.batchDraw();
            });

            // Start file connection (only for source files)
            if (!isDir && isSource && itemDot) {
                itemDot.on("mousedown", (e) => {
                    e.cancelBubble = true;
                    beginFileConnection(group, itemDot, item, currentPath);
                });
            }

            itemList.add(itemBg);
            itemList.add(itemText);

            itemElements.push({ bg: itemBg, text: itemText, dot: itemDot, item });
            if (itemDot) {
                fileDots.push({ dot: itemDot, item, folderPath: currentPath });
            }
        });

        // Background
        const bg = new Konva.Rect({
            width: minwidth,
            height: titleHeight,
            fill: "white",
            stroke: "#ccc",
            strokeWidth: 2,
            cornerRadius: [0, 0, 5, 5]
        });

        function updateGroupLayout() {
            const isExpanded = toggleIcon.text() === "▼";
            const contentHeight = isExpanded ? (itemElements.length + startIndex) * lineHeight + 5 : 0;
            const totalHeight = titleHeight + contentHeight;

            bg.height(totalHeight);
            itemList.visible(isExpanded);
            layer.batchDraw();
        }

        titleBar.on("click tap", () => {
            const wasExpanded = toggleIcon.text() === "▼";
            toggleIcon.text(wasExpanded ? "►" : "▼");
            updateGroupLayout();
        });

        // Assemble group
        group.add(bg);
        group.add(titleBar);
        group.add(titleText);
        group.add(toggleIcon);
        group.add(itemList);

        group.on("dragmove", () => updateArrows());

        layer.add(group);
        updateGroupLayout();

        const groupData = {
            group,
            type,
            currentPath,
            items,
            itemElements,
            fileDots,
            isSource,
            titleText,
            updateLayout: updateGroupLayout
        };

        groups.push(groupData);
        return groupData;
    }

    // ====== Refresh Group Content ======
    async function refreshGroup(group, newItems, newPath, newTitle) {
        const groupData = groups.find(g => g.group === group);
        if (!groupData) return;

        // Remove old content
        group.destroyChildren();

        // Rebuild group
        const x = group.x();
        const y = group.y();
        const isSource = groupData.isSource;

        // Remove from groups array
        const index = groups.indexOf(groupData);
        if (index > -1) groups.splice(index, 1);

        // Destroy and recreate
        group.destroy();

        createFolderGroup({
            type: groupData.type,
            x, y,
            title: newTitle,
            items: newItems,
            currentPath: newPath,
            isSource
        });

        layer.batchDraw();
    }

    // ====== File-to-File Connection Logic ======
    function beginFileConnection(group, dot, item, folderPath) {
        connectFrom = { group, dot, item, folderPath };

        const pos = dot.getAbsolutePosition();
        connectionLine = new Konva.Line({
            points: [pos.x, pos.y, pos.x, pos.y],
            stroke: "#FF5722",
            strokeWidth: 3,
            dash: [8, 4],
            listening: false
        });
        layer.add(connectionLine);
        layer.batchDraw();
    }

    stage.on("mousemove", () => {
        if (!connectFrom || !connectionLine) return;
        const pos = stage.getPointerPosition();
        const startPos = connectFrom.dot.getAbsolutePosition();
        connectionLine.points([startPos.x, startPos.y, pos.x, pos.y]);
        layer.batchDraw();
    });

    stage.on("mouseup", () => {
        if (!connectFrom) return;

        const pos = stage.getPointerPosition();
        const target = stage.getIntersection(pos);

        let destGroup = null;
        let destDot = null;
        let destFolderPath = null;

        if (target && target.name() === "file-connector") {
            for (const g of groups) {
                if (!g.isSource) {
                    for (const fd of g.fileDots) {
                        if (fd.dot === target) {
                            destGroup = g;
                            destDot = target;
                            destFolderPath = fd.folderPath;
                            break;
                        }
                    }
                }
                if (destGroup) break;
            }
        }

        // Also allow dropping on any destination folder (not just files)
        if (!destGroup && target) {
            const targetGroup = target.getParent().getParent();
            for (const g of groups) {
                if (!g.isSource && g.group === targetGroup) {
                    destGroup = g;
                    destFolderPath = g.currentPath;
                    // Create a virtual destination point
                    destDot = { getAbsolutePosition: () => stage.getPointerPosition() };
                    break;
                }
            }
        }

        if (destGroup && destFolderPath) {
            const srcPos = connectFrom.dot.getAbsolutePosition();
            const dstPos = destDot.getAbsolutePosition();

            const arrow = new Konva.Arrow({
                points: [srcPos.x, srcPos.y, dstPos.x, dstPos.y],
                stroke: "#FF5722",
                fill: "#FF5722",
                strokeWidth: 2,
                pointerLength: 10,
                pointerwidth: 10,
                listening: false
            });

            layer.add(arrow);
            arrows.push({
                arrow,
                srcFile: connectFrom.item,
                srcPath: connectFrom.item.path,
                destFolderPath,
                srcDot: connectFrom.dot,
                destDot
            });
        }

        connectFrom = null;
        connectionLine?.destroy();
        connectionLine = null;
        layer.batchDraw();
    });

    function updateArrows() {
        arrows.forEach(a => {
            const srcPos = a.srcDot.getAbsolutePosition();
            const dstPos = a.destDot.getAbsolutePosition();
            a.arrow.points([srcPos.x, srcPos.y, dstPos.x, dstPos.y]);
        });
        layer.batchDraw();
    }

    // ====== Execute Move/Copy ======
    async function executeTransfers(operation) {
        if (arrows.length === 0) {
            alert("No file connections! Wire files from source to destination first.");
            return;
        }

        const btn = document.getElementById(operation === "move" ? "execute-move" : "execute-copy");
        btn.disabled = true;
        btn.textContent = `${operation === "move" ? "Moving" : "Copying"}...`;

        let success = 0;
        let failed = 0;

        for (const conn of arrows) {
            try {
                const srcPath = conn.srcPath;
                const destFolderPath = conn.destFolderPath;

                if (operation === "move") {
                    await window.api.moveFile(srcPath, destFolderPath);
                } else {
                    await window.api.copyFile(srcPath, destFolderPath);
                }

                success++;
                conn.arrow.stroke("#4CAF50");
            } catch (err) {
                console.error("Transfer failed:", err);
                failed++;
                conn.arrow.stroke("#F44336");
            }
        }

        layer.batchDraw();
        btn.disabled = false;
        btn.textContent = operation === "move" ? "Move Files" : "Copy Files";

        alert(`✅ ${success} transferred\n❌ ${failed} failed`);
    }

    // ====== Toolbar ======
    let groupCounter = 0;

    document.getElementById("add-source").onclick = async () => {
        const folders = await window.api.pickFolder();
        if (!folders?.length) return;

        const folderPath = folders[0];
        const items = await window.api.readFolder(folderPath);
        const folderName = folderPath.split(/[/\\]/).pop() || "Source";

        const col = groupCounter % 3;
        const row = Math.floor(groupCounter / 3);
        const x = 50 + col * 320;
        const y = 100 + row * 300;

        createFolderGroup({
            type: "source",
            x, y,
            title: `📁 ${folderName}`,
            items: items,
            currentPath: folderPath,
            isSource: true
        });

        groupCounter++;
    };

    document.getElementById("add-dest").onclick = async () => {
        const folders = await window.api.pickFolder();
        if (!folders?.length) return;

        const folderPath = folders[0];
        const items = await window.api.readFolder(folderPath);
        const folderName = folderPath.split(/[/\\]/).pop() || "Destination";

        const col = groupCounter % 3;
        const row = Math.floor(groupCounter / 3);
        const x = 50 + col * 320;
        const y = 100 + row * 300;

        createFolderGroup({
            type: "dest",
            x, y,
            title: `📂 ${folderName}`,
            items: items,
            currentPath: folderPath,
            isSource: false
        });

        groupCounter++;
    };

    document.getElementById("execute-move").onclick = () => executeTransfers("move");
    document.getElementById("execute-copy").onclick = () => executeTransfers("copy");

    document.getElementById("clear-arrows").onclick = () => {
        arrows.forEach(a => a.arrow.destroy());
        arrows = [];
        layer.batchDraw();
    };

    // ====== Zoom ======
    stage.on("wheel", (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.05;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        const clampedScale = Math.max(0.3, Math.min(3, newScale));

        stage.scale({ x: clampedScale, y: clampedScale });

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale
        };

        stage.position({
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale
        });

        layer.batchDraw();
    });
});