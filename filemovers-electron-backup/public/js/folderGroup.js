// ============================================
// Folder group creation and management — FIXED
// ============================================

class FolderGroup {
    constructor(layer, config) {
        this.layer = layer;
        this.config = {
            padding: 10,
            lineHeight: 25,
            titleHeight: 35,
            // ✅ Renamed to 'width' for clarity (was 'minminwidth')
            width: 280,
            ...config
        };
    }

    // ✅ NEW: Refresh ALL folder groups (e.g., after move/copy)
static refreshAllGroups(layer) {
    // Snapshot current positions & data before destroy
    const groupSnapshots = AppState.groups.map(g => ({
        type: g.type,
        x: g.group.x(),
        y: g.group.y(),
        title: g.titleText.text(),
        currentPath: g.currentPath,
        isSource: g.isSource
    }));

    // Destroy all groups
    AppState.groups.forEach(g => g.group.destroy());
    AppState.groups = [];

    // Recreate all groups
    const folderGroupManager = new FolderGroup(layer);
    groupSnapshots.forEach(snapshot => {
        (async () => {
            try {
                const items = await fileapi.readFolder(snapshot.currentPath);
                folderGroupManager.create({
                    type: snapshot.type,
                    x: snapshot.x,
                    y: snapshot.y,
                    title: snapshot.title,
                    items,
                    currentPath: snapshot.currentPath,
                    isSource: snapshot.isSource
                });
            } catch (err) {
                console.error("Failed to refresh group:", snapshot.title, err);
                if (MUIToolbar) {
                    MUIToolbar.showSnackbar(`❌ Failed to reload ${snapshot.title}`, "error");
                }
            }
        })();
    });
}
    create({ type, x, y, title, items = [], currentPath, isSource = true }) {
        const group = new Konva.Group({ x, y, draggable: true });
        const { padding, lineHeight, titleHeight, width } = this.config;

        const titleBar = this._createTitleBar(width, titleHeight, isSource);
        const titleText = this._createTitleText(title, padding, titleHeight, width);
        const toggleIcon = this._createToggleIcon(width, titleHeight);

        // ✅ NEW: Close button (X)
        const closeButton = this._createCloseButton(width, titleHeight);
        closeButton.on("click tap", () => {
            if (confirm(`Remove "${title}" from workspace?`)) {
                AppState.removeGroup(group);
                AppState.clearArrows();
                group.destroy();
                ArrowManager.updateAllArrows(this.layer);
                this.layer.batchDraw();
                MUIToolbar.updateStats();
                MUIToolbar.showSnackbar(`Cleared ${count} connection${count !== 1 ? 's' : ''}`, "info");
            }
        });

        // ✅ NEW: Create folder button (+)
        const createFolderButton = this._createFolderButton(width, titleHeight);
        createFolderButton.on("click tap", async () => {
            await this._promptCreateFolder(currentPath, group);
        });

        const bg = this._createBackground(width, titleHeight);

        // Pass layer explicitly
        const { 
            itemList, 
            scrollbarBg, 
            scrollbarThumb, 
            itemElements, 
            fileDots, 
            startIndex,
            updateScrollbar 
        } = this._createItemList(
            items, currentPath, titleHeight, lineHeight, width, isSource, group, this.layer
        );

        // ✅ Fix toggle logic
        const updateGroupLayout = () => {
            const isExpanded = toggleIcon.text() === "▼";
            const maxVisible = 400;
            bg.height(titleHeight + (isExpanded ? maxVisible : 0));
            itemList.visible(isExpanded);
            scrollbarBg.visible(isExpanded);
            scrollbarThumb.visible(isExpanded);
            this.layer.batchDraw();
        };

        // Toggle icon
        titleBar.on("click tap", () => {
            toggleIcon.text(toggleIcon.text() === "▼" ? "►" : "▼");
            updateGroupLayout();
        });

        // Assemble: add scrollableArea FIRST, then scrollbars ON TOP
        group.add(bg, titleBar, titleText, toggleIcon, closeButton, createFolderButton, itemList, scrollbarBg, scrollbarThumb);

        group.on("dragmove", () => ArrowManager.updateAllArrows(this.layer));

        this.layer.add(group);
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
            updateLayout: updateGroupLayout,
            updateScrollbar
        };
        
        // ✅ Purple folder dot on title bar
        const folderDot = new Konva.Circle({
            x: width - 150,
            y: titleHeight / 2,
            radius: 6,
            fill: "#9C27B0",
            stroke: "white",
            strokeWidth: 2,  // ✅ fixed typo
            name: "folder-connector",
            listening: true
        });

        folderDot.on("mousedown", (e) => {
            e.cancelBubble = true;
            ConnectionManager.beginConnection(
                folderDot,
                { 
                    name: title.replace(/^📁\s*/, ''), 
                    path: currentPath,
                    isDirectory: true 
                },
                currentPath,
                this.layer
            );
        });

        folderDot.on("mouseenter", () => {
            folderDot.radius(8);
            folderDot.strokeWidth(3);  // ✅ fixed typo
            this.layer.batchDraw();
        });
        folderDot.on("mouseleave", () => {
            folderDot.radius(6);
            folderDot.strokeWidth(2);  // ✅ fixed typo
            this.layer.batchDraw();
        });

        group.add(folderDot);
        
        AppState.addGroup(groupData);
        return groupData;
    }

    // ✅ NEW: Close button
    _createCloseButton(width, titleHeight) {
        const closeBtn = new Konva.Text({
            text: "✕",
            fontSize: 15,
            fontStyle: "bold",
            fill: "white",
            x: width - 70,
            y: titleHeight / 2 - 9,
            width: 20,  // ✅ was 'minwidth'
            align: "center",
            name: "close-button"
        });

        closeBtn.on("mouseenter", () => {
            closeBtn.fill("#ffcccc");
            this.layer.batchDraw();
        });
        closeBtn.on("mouseleave", () => {
            closeBtn.fill("white");
            this.layer.batchDraw();
        });

        return closeBtn;
    }

    // ✅ NEW: Create folder button
    _createFolderButton(width, titleHeight) {
        const folderBtn = new Konva.Text({
            text: "📁+",
            fontSize: 13,
            fill: "white",
            x: width - 110,
            y: titleHeight / 2 - 8,
            width: 28,  // ✅ was 'minwidth'
            align: "center",
            name: "create-folder-button"
        });

        folderBtn.on("mouseenter", () => {
            folderBtn.fill("#ccffcc");
            this.layer.batchDraw();
        });
        folderBtn.on("mouseleave", () => {
            folderBtn.fill("white");
            this.layer.batchDraw();
        });

        return folderBtn;
    }

    // ✅ NEW: Prompt for folder creation
    async _promptCreateFolder(parentPath, group) {
        const input = document.createElement('input');
        Object.assign(input.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '20000',
            padding: '10px',
            fontSize: '16px',
            border: '2px solid #2196F3',
            borderRadius: '6px',
            outline: 'none',
            backgroundColor: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            width: '280px',  // ✅ was 'minwidth'
            textAlign: 'center',
        });
        input.type = 'text';
        input.placeholder = 'Enter folder name';
        input.value = 'New Folder';
        document.body.appendChild(input);
        input.select();
        input.focus();

        const folderName = await new Promise((resolve) => {
            const cleanup = () => {
                if (input.parentNode) input.parentNode.removeChild(input);
                window.removeEventListener('keydown', onKey);
            };

            const onKey = (e) => {
                if (e.key === 'Enter') {
                    resolve(input.value.trim());
                    cleanup();
                } else if (e.key === 'Escape') {
                    resolve(null);
                    cleanup();
                }
            };

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    resolve(input.value.trim() || null);
                    cleanup();
                }, 150);
            });

            window.addEventListener('keydown', onKey);
        });

        if (!folderName) return;

        try {
            const result = await fileapi.createFolder(parentPath, folderName);

            if (result.success) {
                const newItems = await fileapi.readFolder(parentPath);
                const parentName = parentPath.split(/[/\\]/).pop() || "Root";
                await this.refresh(group, newItems, parentPath, `📁 ${parentName}`);
                
                if (typeof MUIToolbar !== 'undefined') {
                    MUIToolbar.showSnackbar(`✅ Folder "${folderName}" created`, "success");
                }
            } else {
                if (typeof MUIToolbar !== 'undefined') {
                    MUIToolbar.showSnackbar(`❌ ${result.error}`, "error");
                } else {
                    console.error('Create folder failed:', result.error);
                }
            }
        } catch (err) {
            console.error("Create folder error:", err);
            if (typeof MUIToolbar !== 'undefined') {
                MUIToolbar.showSnackbar("❌ Failed to create folder", "error");
            }
        }
    }

    _createTitleBar(width, height, isSource) {
        return new Konva.Rect({
            width, height,  // ✅ was 'minwidth, height'
            fill: isSource ? "#2196F3" : "#4CAF50",
            cornerRadius: [5, 5, 0, 0],
            stroke: "white",
            strokeWidth: 2,  // ✅ was 'strokeminwidth'
            shadowColor: "black",
            shadowBlur: 5,
            shadowOpacity: 0.3
        });
    }
    
    _createTitleText(title, padding, titleHeight, width) {
        return new Konva.Text({
            text: title,
            fontSize: 13,
            fontStyle: "bold",
            fill: "white",
            x: padding,
            y: titleHeight / 2 - 7,
            width: width - 140,  // ✅ was 'minwidth'
            ellipsis: true
        });
    }
    
    _createToggleIcon(width, titleHeight) {
        return new Konva.Text({
            text: "▼",
            fontSize: 13,
            fill: "white",
            x: width - 35,
            y: titleHeight / 2 - 8,
            width: 20,  // ✅ was 'minwidth'
            align: "center"
        });
    }
    
    _createBackground(width, titleHeight) {
        const maxVisibleHeight = 400;
        return new Konva.Rect({
            width,  // ✅ was 'minwidth'
            height: titleHeight + maxVisibleHeight,
            fill: "white",
            stroke: "#ccc",
            strokeWidth: 2,  // ✅ was 'strokeminwidth'
            cornerRadius: [0, 0, 5, 5]
        });
    }   
    
    _createItemList(items, currentPath, titleHeight, lineHeight, width, isSource, group, layerRef) {
        const maxVisibleHeight = 400;
        const scrollbarWidth = 8;  // ✅ renamed

        const viewport = new Konva.Group({
            x: 0,
            y: titleHeight,
            width: width - scrollbarWidth,  // ✅ was 'minwidth'
            height: maxVisibleHeight,
            clip: {
                x: 0,
                y: 0,
                width: width - scrollbarWidth,  // ✅ was 'minwidth'
                height: maxVisibleHeight
            }
        });

        const scrollableContent = new Konva.Group({
            x: 0,
            y: 0
        });
        viewport.add(scrollableContent);

        viewport._scrollOffset = 0;
        viewport._maxHeight = maxVisibleHeight;

        viewport.on("wheel", (e) => {
            e.evt.preventDefault();
            const delta = e.evt.deltaY > 0 ? -30 : 30;
            const oldOffset = viewport._scrollOffset;
            let newOffset = oldOffset + delta;

            let totalHeight = 0;
            scrollableContent.getChildren().forEach(child => {
                if (child.name() === 'back-button-container' || child.name() === 'item-container') {
                    totalHeight += lineHeight;
                    const nested = child.findOne('.nested-group');
                    if (nested && nested.isVisible()) {
                        totalHeight += nested.getChildren().length * lineHeight;
                    }
                }
            });

            const maxScrollDown = Math.max(0, totalHeight - maxVisibleHeight);
            newOffset = Math.max(-maxScrollDown, Math.min(0, newOffset));

            if (newOffset !== oldOffset) {
                viewport._scrollOffset = newOffset;
                let currentY = newOffset;
                scrollableContent.getChildren().forEach(child => {
                    if (child.name() === 'back-button-container' || child.name() === 'item-container') {
                        child.y(currentY);
                        currentY += lineHeight;
                        const nested = child.findOne('.nested-group');
                        if (nested && nested.isVisible()) {
                            currentY += nested.getChildren().length * lineHeight;
                        }
                    }
                });
                layerRef.batchDraw();
            }
        });

        const scrollbarBg = new Konva.Rect({
            x: width - scrollbarWidth,
            y: titleHeight,
            width: scrollbarWidth,  // ✅ was 'minwidth'
            height: maxVisibleHeight,
            fill: '#eee',
            listening: false,
            name: 'scrollbar-bg'
        });

        const scrollbarThumb = new Konva.Rect({
            x: width - scrollbarWidth,
            y: titleHeight,
            width: scrollbarWidth,  // ✅ was 'minwidth'
            height: 20,
            fill: '#888',
            cornerRadius: 4,
            draggable: true,
            name: 'scrollbar-thumb'
        });

        scrollbarThumb.on('dragmove', function () {
            this.x(width - scrollbarWidth);
            const minY = titleHeight;
            const maxY = titleHeight + maxVisibleHeight - this.height();
            let y = Math.max(minY, Math.min(maxY, this.y()));
            this.y(y);

            const thumbTrackHeight = maxVisibleHeight - this.height();
            const scrollRange = Math.max(0, viewport._contentHeight - maxVisibleHeight);
            
            if (scrollRange > 0 && thumbTrackHeight > 0) {
                const ratio = (y - minY) / thumbTrackHeight;
                viewport._scrollOffset = -ratio * scrollRange;

                let currentY = viewport._scrollOffset;
                scrollableContent.getChildren().forEach(child => {
                    if (child.name() === 'back-button-container' || child.name() === 'item-container') {
                        child.y(currentY);
                        currentY += lineHeight;
                        const nested = child.findOne('.nested-group');
                        if (nested && nested.isVisible()) {
                            currentY += nested.getChildren().length * lineHeight;
                        }
                    }
                });
                layerRef.batchDraw();
            }
        });

        const updateScrollbar = () => {
            let totalHeight = 0;
            scrollableContent.getChildren().forEach(child => {
                if (child.name() === 'back-button-container' || child.name() === 'item-container') {
                    totalHeight += lineHeight;
                    const nested = child.findOne('.nested-group');
                    if (nested && nested.isVisible()) {
                        totalHeight += nested.getChildren().length * lineHeight;
                    }
                }
            });

            viewport._contentHeight = totalHeight;
            const ratio = maxVisibleHeight / Math.max(totalHeight, maxVisibleHeight);
            const thumbHeight = Math.max(20, maxVisibleHeight * ratio);
            scrollbarThumb.height(thumbHeight);

            const scrollRange = Math.max(0, totalHeight - maxVisibleHeight);
            const thumbRange = maxVisibleHeight - thumbHeight;
            const thumbY = scrollRange > 0
                ? titleHeight + (-viewport._scrollOffset / scrollRange) * thumbRange
                : titleHeight;

            scrollbarThumb.y(thumbY);
        };

        const parentPath = currentPath ? currentPath.split(/[/\\]/).slice(0, -1).join('/') : null;
        let startIndex = 0;
        if (parentPath) {
            const backButton = ItemRenderer.createBackButton(
                width - scrollbarWidth,
                lineHeight,
                parentPath,
                group,
                layerRef
            );
            scrollableContent.add(backButton.container);
            startIndex = 1;
        }

        const itemElements = [];
        const fileDots = [];
        items.forEach((item, i) => {
            const itemComponents = ItemRenderer.createItem(
                item,
                0,
                lineHeight,
                width - scrollbarWidth,
                isSource,
                currentPath,
                scrollableContent,
                layerRef
            );
            scrollableContent.add(itemComponents.container);
            itemElements.push(itemComponents);
            if (itemComponents.dot) {
                fileDots.push({ dot: itemComponents.dot, item, folderPath: currentPath });
            }
        });

        ItemRenderer.recalculatePositions(scrollableContent, lineHeight);
        updateScrollbar();

        return {
            itemList: viewport,
            scrollbarBg,
            scrollbarThumb,
            itemElements,
            fileDots,
            startIndex,
            updateScrollbar
        };
    }
    
    async refresh(group, newItems, newPath, newTitle) {
        const groupData = AppState.findGroup(group);
        if (!groupData) return;
        
        const x = group.x();
        const y = group.y();
        const isSource = groupData.isSource;
        
        AppState.removeGroup(group);
        group.destroy();
        
        this.create({
            type: groupData.type,
            x, y,
            title: newTitle,
            items: newItems,
            currentPath: newPath,
            isSource
        });
        
        this.layer.batchDraw();
    }
}