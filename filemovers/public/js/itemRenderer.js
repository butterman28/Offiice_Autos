// ============================================
// FILE: public/js/itemRenderer.js
// Item rendering — with working 🗑️ delete button (files & folders)
// ============================================

const ItemRenderer = {
    createBackButton(width, height, parentPath, group, layer) {
        const container = new Konva.Group({ x: 0, y: 0, name: 'back-button-container' });
        const bg = new Konva.Rect({ x: 0, y: 0, width, height, fill: "transparent" });
        const textWidth = Math.max(50, width - 40);
        const text = new Konva.Text({
            text: "  ⬆️ .. (Go Back)",
            fontSize: 12,
            fontStyle: "bold",
            fill: "#666",
            x: 10,
            y: 5,
            width: textWidth,
            ellipsis: true
        });

        bg.on("click", async () => {
            const newItems = await window.api.readFolder(parentPath);
            const parentName = parentPath.split(/[/\\]/).pop() || "Root";
            const folderGroupManager = new FolderGroup(layer);
            await folderGroupManager.refresh(group, newItems, parentPath, `📁 ${parentName}`);
        });
        bg.on("mouseenter", () => { bg.fill("#e0e0e0"); layer.batchDraw(); });
        bg.on("mouseleave", () => { bg.fill("transparent"); layer.batchDraw(); });

        container.add(bg, text);
        return { container, shapes: [bg, text] };
    },

    createItem(item, index, lineHeight, width, isSource, currentPath, listGroup, layer) {
        const isDir = item.isDirectory;
        const itemContainer = new Konva.Group({ x: 0, y: index * lineHeight, name: 'item-container' });
        const bg = new Konva.Rect({ x: 0, y: 0, width, height: lineHeight, fill: "transparent" });

        // Toggle arrow (folders)
        const toggleArrow = isDir ? new Konva.Text({
            text: "▶", fontSize: 12, fill: "#666", x: 5, y: 6, width: 15
        }) : null;

        // Label
        const icon = isDir ? "📁" : "📄";
        const text = new Konva.Text({
            text: `${isDir ? '  ' : '    '}${icon} ${item.name}`,
            fontSize: 12,
            fill: isDir ? "#1976D2" : "#333",
            fontStyle: isDir ? "bold" : "normal",
            x: isDir ? 18 : 10,
            y: 5,
            width: Math.max(50, width - 100),
            ellipsis: true
        });

        // Create folder button (+)
        const createBtn = isDir ? new Konva.Text({
            text: "+", fontSize: 16, fontStyle: "bold", fill: "#4CAF50",
            x: width - 47, y: 3, width: 20, align: "center", name: "create-folder-btn"
        }) : null;

        if (createBtn) {
            createBtn.on("click", async (e) => {
                e.cancelBubble = true;
                await this._createFolderInPath(item.path, listGroup, layer, lineHeight);
            });
            createBtn.on("mouseenter", () => { createBtn.fill("#66BB6A"); createBtn.fontSize(18); layer.batchDraw(); });
            createBtn.on("mouseleave", () => { createBtn.fill("#4CAF50"); createBtn.fontSize(16); layer.batchDraw(); });
        }

        // 🗑️ DELETE BUTTON — for all items (remove `!item.isRoot` if you want root deletable)
        const deleteBtn = new Konva.Text({
            text: "🗑️",
            fontSize: 14,
            fill: "#f44336",
            x: width - 35,
            y: 3,
            width: 20,
            align: "center",
            name: "delete-item-btn"
        });

        deleteBtn.on("click", async (e) => {
            e.cancelBubble = true;
            const type = isDir ? 'folder' : 'file';
            if (!confirm(`Delete ${type} "${item.name}"? This cannot be undone.`)) return;

            try {
                const result = await window.api.deleteItem(item.path);
                if (result.success) {
                    itemContainer.destroy();
                    ItemRenderer.recalculatePositions(listGroup, lineHeight);
                    if (listGroup.updateScrollbar) listGroup.updateScrollbar();
                    AppState.removeArrowsByPath(item.path);
                    layer.batchDraw();
                    MUIToolbar?.showSnackbar(`${type} deleted`, "success");
                } else throw new Error(result.error);
            } catch (err) {
                console.error("Delete failed:", err);
                MUIToolbar?.showSnackbar(`Failed: ${err.message}`, "error");
            }
        });

        deleteBtn.on("mouseenter", () => { deleteBtn.scale({ x: 1.2, y: 1.2 }); layer.batchDraw(); });
        deleteBtn.on("mouseleave", () => { deleteBtn.scale({ x: 1, y: 1 }); layer.batchDraw(); });

        // Dots
        const dot = !isDir ? new Konva.Circle({
            x: isSource ? width - 12 : 12,
            y: lineHeight / 2,
            radius: 5,
            fill: isSource ? "#FF9800" : "#8BC34A",
            stroke: "white",
            strokeWidth: 2,
            name: "file-connector"
        }) : null;

        const folderDot = isDir ? new Konva.Circle({
            x: width - 12,
            y: lineHeight / 2,
            radius: 5,
            fill: "#9C27B0",
            stroke: "white",
            strokeWidth: 2,
            name: "folder-connector"
        }) : null;

        if (dot) {
            dot.on("mousedown", (e) => { e.cancelBubble = true; ConnectionManager.beginConnection(dot, item, currentPath, layer); });
            dot.on("mouseenter", () => { dot.radius(7).strokeWidth(3); layer.batchDraw(); });
            dot.on("mouseleave", () => { dot.radius(5).strokeWidth(2); layer.batchDraw(); });
        }
        if (folderDot) {
            folderDot.on("mousedown", (e) => {
                e.cancelBubble = true;
                ConnectionManager.beginConnection(folderDot, { ...item, isDirectory: true }, currentPath, layer);
            });
            folderDot.on("mouseenter", () => { folderDot.radius(7).strokeWidth(3); layer.batchDraw(); });
            folderDot.on("mouseleave", () => { folderDot.radius(5).strokeWidth(2); layer.batchDraw(); });
        }

        // ✅ Assemble — order matters!
        itemContainer.add(bg, text);
        if (toggleArrow) itemContainer.add(toggleArrow);
        if (createBtn) itemContainer.add(createBtn);
        itemContainer.add(deleteBtn);  // ✅ always added
        if (dot) itemContainer.add(dot);
        if (folderDot) itemContainer.add(folderDot);

        // Hover
        bg.on("mouseenter", () => {
            bg.fill(isDir ? "#e3f2fd" : "#f0f0f0");
            if (dot) dot.radius(7).strokeWidth(3);
            if (folderDot) folderDot.radius(7).strokeWidth(3);
            layer.batchDraw();
        });
        bg.on("mouseleave", () => {
            bg.fill("transparent");
            if (dot) dot.radius(5).strokeWidth(2);
            if (folderDot) folderDot.radius(5).strokeWidth(2);
            layer.batchDraw();
        });

        // Store refs
        itemContainer._dot = dot;
        itemContainer._folderDot = folderDot;
        itemContainer._item = item;

        // ACCORDION
        if (isDir) {
            item._isExpanded = false;
            item._nestedGroup = null;

            const toggleFolder = async () => {
                if (item._isExpanded) {
                    if (item._nestedGroup) { item._nestedGroup.destroy(); item._nestedGroup = null; }
                    if (toggleArrow) toggleArrow.text("▶");
                    item._isExpanded = false;
                } else {
                    const newItems = await window.api.readFolder(item.path);
                    if (newItems.length === 0) {
                        MUIToolbar?.showSnackbar("Folder is empty", "info");
                        return;
                    }

                    const nestedGroup = new Konva.Group({ x: 20, y: lineHeight, name: 'nested-group' });
                    let currentY = 0;
                    newItems.forEach(subItem => {
                        const nestedContainer = ItemRenderer.createNestedItem(
                            subItem, lineHeight, width - 20, isSource, item.path, nestedGroup, layer, 1
                        );
                        nestedContainer.y(currentY);
                        nestedGroup.add(nestedContainer);
                        currentY += lineHeight;
                    });

                    itemContainer.add(nestedGroup);
                    item._nestedGroup = nestedGroup;
                    if (toggleArrow) toggleArrow.text("▼");
                    item._isExpanded = true;
                }

                ItemRenderer.recalculatePositions(listGroup, lineHeight);
                ArrowManager.updateAllArrows(layer);
                if (listGroup.updateScrollbar) listGroup.updateScrollbar();
                layer.batchDraw();
            };

            bg.on("click", toggleFolder);
            if (toggleArrow) toggleArrow.on("click", toggleFolder);
        }

        return { container: itemContainer, shapes: [bg, text], dot, folderDot };
    },

    createNestedItem(item, lineHeight, width, isSource, currentPath, parentGroup, layer, indentLevel) {
        const isDir = item.isDirectory;
        const indent = indentLevel * 15;
        const container = new Konva.Group({ x: 0, y: 0, name: 'nested-item-container' });
        const bg = new Konva.Rect({ x: 0, y: 0, width, height: lineHeight, fill: "transparent" });

        const toggleArrow = isDir ? new Konva.Text({
            text: "▶", fontSize: 10, fill: "#666", x: indent, y: lineHeight / 2 - 6, width: 12, name: 'toggle-arrow'
        }) : null;

        const text = new Konva.Text({
            text: `${isDir ? "📁" : "📄"} ${item.name}`,
            fontSize: 11,
            fill: isDir ? "#1976D2" : "#555",
            fontStyle: isDir ? "bold" : "normal",
            x: indent + (isDir ? 14 : 5),
            y: 5,
            width: Math.max(50, width - indent - 80),
            ellipsis: true
        });

        // Create folder button (+)
        const createBtn = isDir ? new Konva.Text({
            text: "+", fontSize: 14, fontStyle: "bold", fill: "#4CAF50",
            x: width - 45, y: 3, width: 18, align: "center"
        }) : null;

        if (createBtn) {
            createBtn.on("click", async (e) => {
                e.cancelBubble = true;
                await ItemRenderer._createFolderInPath(item.path, parentGroup, layer, lineHeight);
            });
            createBtn.on("mouseenter", () => { createBtn.fill("#66BB6A"); createBtn.fontSize(16); layer.batchDraw(); });
            createBtn.on("mouseleave", () => { createBtn.fill("#4CAF50"); createBtn.fontSize(14); layer.batchDraw(); });
        }

        // 🗑️ DELETE BUTTON — nested items always deletable
        const deleteBtn = new Konva.Text({
            text: "🗑️",
            fontSize: 14,
            fill: "#f44336",
            x: width - 35,
            y: 3,
            width: 20,
            align: "center",
            name: "delete-item-btn"
        });

        deleteBtn.on("click", async (e) => {
            e.cancelBubble = true;
            const type = isDir ? 'folder' : 'file';
            if (!confirm(`Delete ${type} "${item.name}"? This cannot be undone.`)) return;

            try {
                const result = await window.api.deleteItem(item.path);
                if (result.success) {
                    container.destroy();
                    // Refresh parent scroll group
                    let pg = parentGroup;
                    while (pg && !pg.updateScrollbar && pg.getParent()) pg = pg.getParent();
                    const listParent = pg?.getParent?.() || parentGroup;
                    ItemRenderer.recalculatePositions(listParent, lineHeight);
                    if (pg?.updateScrollbar) pg.updateScrollbar();
                    AppState.removeArrowsByPath(item.path);
                    layer.batchDraw();
                    MUIToolbar?.showSnackbar(`${type} deleted`, "success");
                } else throw new Error(result.error);
            } catch (err) {
                console.error("Delete failed:", err);
                MUIToolbar?.showSnackbar(`Failed: ${err.message}`, "error");
            }
        });

        deleteBtn.on("mouseenter", () => { deleteBtn.scale({ x: 1.2, y: 1.2 }); layer.batchDraw(); });
        deleteBtn.on("mouseleave", () => { deleteBtn.scale({ x: 1, y: 1 }); layer.batchDraw(); });

        // Dots
        const dot = !isDir ? new Konva.Circle({
            x: isSource ? width - 12 : 12,
            y: lineHeight / 2,
            radius: 5,
            fill: isSource ? "#FF9800" : "#8BC34A",
            stroke: "white",
            strokeWidth: 2,
            name: "file-connector"
        }) : null;

        const folderDot = isDir ? new Konva.Circle({
            x: width - 12,
            y: lineHeight / 2,
            radius: 5,
            fill: "#9C27B0",
            stroke: "white",
            strokeWidth: 2,
            name: "folder-connector"
        }) : null;

        if (dot) {
            dot.on("mousedown", (e) => { e.cancelBubble = true; ConnectionManager.beginConnection(dot, item, currentPath, layer); });
            dot.on("mouseenter", () => { dot.radius(7).strokeWidth(3); layer.batchDraw(); });
            dot.on("mouseleave", () => { dot.radius(5).strokeWidth(2); layer.batchDraw(); });
        }
        if (folderDot) {
            folderDot.on("mousedown", (e) => {
                e.cancelBubble = true;
                ConnectionManager.beginConnection(folderDot, { ...item, isDirectory: true }, currentPath, layer);
            });
            folderDot.on("mouseenter", () => { folderDot.radius(7).strokeWidth(3); layer.batchDraw(); });
            folderDot.on("mouseleave", () => { folderDot.radius(5).strokeWidth(2); layer.batchDraw(); });
        }

        // ✅ Assemble — correct order
        container.add(bg, text);
        if (toggleArrow) container.add(toggleArrow);
        if (createBtn) container.add(createBtn);
        container.add(deleteBtn);  // ✅ added here
        if (dot) container.add(dot);
        if (folderDot) container.add(folderDot);

        bg.on("mouseenter", () => {
            bg.fill(isDir ? "#e8f5fe" : "#f8f8f8");
            if (dot) dot.radius(dot.radius() + 1).strokeWidth(3);
            if (folderDot) folderDot.radius(folderDot.radius() + 1).strokeWidth(3);
            layer.batchDraw();
        });
        bg.on("mouseleave", () => {
            bg.fill("transparent");
            if (dot) dot.radius(dot.radius() - 1).strokeWidth(2);
            if (folderDot) folderDot.radius(folderDot.radius() - 1).strokeWidth(2);
            layer.batchDraw();
        });

        if (isDir) {
            container._isExpanded = false;
            container._nestedGroup = null;

            const toggleNested = async () => {
                if (container._isExpanded) {
                    if (container._nestedGroup) { container._nestedGroup.destroy(); container._nestedGroup = null; }
                    if (toggleArrow) toggleArrow.text("▶");
                    container._isExpanded = false;
                } else {
                    try {
                        const subItems = await window.api.readFolder(item.path);
                        if (subItems.length === 0) {
                            MUIToolbar?.showSnackbar("Empty folder", "info");
                            return;
                        }
                        const deepNested = new Konva.Group({ x: indent + 20, y: lineHeight, name: 'deep-nested-group' });
                        let y = 0;
                        subItems.forEach(subItem => {
                            const subContainer = ItemRenderer.createNestedItem(
                                subItem, lineHeight, width - indent - 20, isSource, item.path, deepNested, layer, indentLevel + 1
                            );
                            subContainer.y(y);
                            deepNested.add(subContainer);
                            y += lineHeight;
                        });
                        container.add(deepNested);
                        container._nestedGroup = deepNested;
                        if (toggleArrow) toggleArrow.text("▼");
                        container._isExpanded = true;
                    } catch (err) {
                        console.error("Failed to read folder:", err);
                        MUIToolbar?.showSnackbar("Failed to load folder", "error");
                    }
                }

                let g = parentGroup;
                while (g && !g.updateScrollbar && g.getParent()) g = g.getParent();
                ItemRenderer.recalculatePositions(parentGroup, lineHeight);
                ArrowManager.updateAllArrows(layer);
                layer.batchDraw();
            };

            bg.on("click", toggleNested);
            if (toggleArrow) toggleArrow.on("click", toggleNested);
        }

        container._dot = dot;
        container._folderDot = folderDot;
        container._item = item;
        return container;
    },

    async _createFolderInPath(targetPath, listGroup, layer, lineHeight) {
        const input = document.createElement('input');
        Object.assign(input.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '20000', padding: '10px', fontSize: '16px', border: '2px solid #4CAF50',
            borderRadius: '6px', outline: 'none', backgroundColor: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', width: '260px', textAlign: 'center'
        });
        input.type = 'text'; input.placeholder = 'Folder name'; input.value = 'New Folder';
        document.body.appendChild(input); input.select(); input.focus();

        const folderName = await new Promise(resolve => {
            const cleanup = () => { input.remove(); window.removeEventListener('keydown', onKey); };
            const onKey = e => { if (e.key === 'Enter') { resolve(input.value.trim()); cleanup(); } else if (e.key === 'Escape') { resolve(null); cleanup(); } };
            input.addEventListener('blur', () => setTimeout(() => { resolve(input.value.trim() || null); cleanup(); }, 150));
            window.addEventListener('keydown', onKey);
        });

        if (!folderName?.trim()) return;

        try {
            const result = await window.api.createFolder(targetPath, folderName.trim());
            if (result.success) {
                let pg = listGroup;
                while (pg && !pg.getParent()?.findOne) pg = pg.getParent();
                const main = pg?.getParent();
                const gd = AppState.findGroup(main);
                if (gd) {
                    const newItems = await window.api.readFolder(targetPath);
                    const folderGroupManager = new FolderGroup(layer);
                    await folderGroupManager.refresh(main, newItems, targetPath, `📁 ${targetPath.split(/[/\\]/).pop()}`);
                }
                MUIToolbar?.showSnackbar(`Folder "${folderName}" created`, "success");
            } else {
                MUIToolbar?.showSnackbar(`Failed: ${result.error}`, "error");
            }
        } catch (err) {
            console.error("Create folder error:", err);
            MUIToolbar?.showSnackbar("Failed to create folder", "error");
        }
    },

    repositionAllItems(listGroup, lineHeight) {
        let y = 0;
        listGroup.getChildren().forEach(child => {
            if (['item-container', 'back-button-container'].includes(child.name())) {
                child.y(y);
                y += lineHeight;
                const ng = child.findOne('.nested-group');
                if (ng?.isVisible()) y += ng.getChildren().length * lineHeight;
            }
        });
    },

    recalculatePositions(listGroup, lineHeight) {
        let y = listGroup._scrollOffset || 0;
        const calcHeight = c => {
            let h = lineHeight;
            const ng = c.findOne('.nested-group') || c.findOne('.deep-nested-group');
            if (ng?.isVisible()) ng.getChildren().forEach(nc => h += calcHeight(nc));
            return h;
        };
        listGroup.getChildren().forEach(c => {
            if (['back-button-container', 'item-container', 'nested-item-container'].includes(c.name())) {
                c.y(y);
                y += calcHeight(c);
            }
        });
    }
};