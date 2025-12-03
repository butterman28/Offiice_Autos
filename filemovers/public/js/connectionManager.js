// ============================================
// FILE: public/js/connectionManager.js
// ✅ Fixed: Cancel + individual arrow delete (❌ on arrows)
// ============================================

const ConnectionManager = {
    tempArrow: null,
    cancelButton: null,
    startDot: null,
    startItem: null,
    startFolderPath: null,
    activeLayer: null,

    beginConnection(dot, item, folderPath, layer) {
        if (this.tempArrow || this.cancelButton) {
            this._cancelConnectionNow(layer);
        }

        this.startDot = dot;
        this.startItem = item;
        this.startFolderPath = folderPath;
        this.activeLayer = layer;

        const startPos = dot.getAbsolutePosition();
        const stage = layer.getStage();

        this.cancelButton = new Konva.Text({
            text: '❌',
            fontSize: 16,
            fill: '#f44336',
            x: startPos.x + 10,
            y: startPos.y - 12,
            name: 'cancel-arrow-btn',
            listening: true
        });

        this.cancelButton.on('click', (e) => {
            e.cancelBubble = true;
            console.log("gbams 12345")
            this._cancelConnectionNow(layer);
        });

        this.cancelButton.on('mouseenter', () => {
            this.cancelButton.scale({ x: 1.2, y: 1.2 });
            layer.batchDraw();
        });
        this.cancelButton.on('mouseleave', () => {
            this.cancelButton.scale({ x: 1, y: 1 });
            layer.batchDraw();
        });

        this.tempArrow = new Konva.Arrow({
            points: [startPos.x, startPos.y, startPos.x, startPos.y],
            stroke: '#FF5722',
            strokeWidth: 3,
            fill: '#FF5722',
            pointerLength: 10,
            pointerWidth: 10,
            dash: [10, 5],
            listening: false,
            name: 'temp-arrow'
        });

        layer.add(this.cancelButton, this.tempArrow);
        this.tempArrow.moveToTop();

        const onMouseMove = (e) => {
            if (!this.tempArrow) return;
            const pos = stage.getPointerPosition();
            const startPos = this.startDot.getAbsolutePosition();
            this.tempArrow.points([startPos.x, startPos.y, pos.x, pos.y]);
            layer.batchDraw();
        };

        const onMouseUp = (e) => {
            const pointerPos = stage.getPointerPosition();
            const targetShape = stage.getIntersection(pointerPos);

            let validConnection = false;
            if (targetShape && targetShape.name() === 'folder-connector' && targetShape !== this.startDot) {
                const destInfo = this._findDestination(targetShape, pointerPos, stage);
                if (destInfo && this.startItem.path !== destInfo.destFolderPath) {
                    validConnection = true;
                    this._createArrow(
                        this.startDot,
                        destInfo.destDot,
                        this.startItem,
                        this.startFolderPath,
                        destInfo.destFolderPath,
                        destInfo.destItem,
                        layer
                    );

                    if (MUIToolbar) {
                        const srcLabel = this.startItem.isDirectory ? `📁 ${this.startItem.name}` : `📄 ${this.startItem.name}`;
                        MUIToolbar.showSnackbar(`✅ Connected ${srcLabel} → 📁 ${destInfo.destItem.name}`, "success");
                    }
                } else if (MUIToolbar) {
                    MUIToolbar.showSnackbar("❌ Cannot connect to self", "error");
                }
            } else if (MUIToolbar) {
                MUIToolbar.showSnackbar("❌ Can only connect to folders", "error");
            }

            this._cancelConnectionNow(layer);
        };

        stage.on('mousemove', onMouseMove);
        stage.on('mouseup', onMouseUp);
    },

    _cancelConnectionNow(layer) {
        if (this.tempArrow) {
            this.tempArrow.destroy();
            this.tempArrow = null;
        }
        if (this.cancelButton) {
            this.cancelButton.destroy();
            this.cancelButton = null;
        }

        this.startDot = null;
        this.startItem = null;
        this.startFolderPath = null;
        this.activeLayer = null;

        const stage = layer.getStage();
        stage.off('mousemove');
        stage.off('mouseup');

        layer.batchDraw();

        if (MUIToolbar) {
            MUIToolbar.showSnackbar("Connection cancelled", "info");
        }
    },

    _findDestination(target, pos, stage) {
        let parent = target.getParent();
        while (parent && !['item-container', 'nested-item-container'].includes(parent.name())) {
            parent = parent.getParent();
            if (!parent || parent.name() === 'Konva') break;
        }

        if (parent && parent._item?.isDirectory) {
            return {
                destFolderPath: parent._item.path,
                destDot: target,
                destItem: parent._item
            };
        }

        let group = target.getParent();
        while (group && !AppState.groups.some(g => g.group === group)) {
            group = group.getParent();
            if (!group || group.name() === 'Konva') break;
        }
        const groupData = AppState.groups.find(g => g.group === group);
        if (groupData) {
            return {
                destFolderPath: groupData.currentPath,
                destDot: target,
                destItem: { name: groupData.titleText.text().replace(/^📁\s*/, ''), path: groupData.currentPath, isDirectory: true }
            };
        }

        return null;
    },

    _createArrow(startDot, destDot, startItem, sourceFolderPath, destFolderPath, destItem, layer) {
        const srcPos = startDot.getAbsolutePosition();
        const dstPos = destDot.getAbsolutePosition();

        const arrow = new Konva.Arrow({
            points: [srcPos.x, srcPos.y, dstPos.x, dstPos.y],
            stroke: "#FF5722",
            fill: "#FF5722",
            strokeWidth: 2,
            pointerLength: 10,
            pointerWidth: 10,
            listening: false,
            name: 'connection-arrow'
        });

        const midX = (srcPos.x + dstPos.x) / 2;
        const midY = (srcPos.y + dstPos.y) / 2;

        const deleteBtn = new Konva.Text({
            text: "❌",
            fontSize: 18,
            fill: "#f44336",
            x: midX - 9,
            y: midY - 9,
            name: "delete-arrow-btn",
            listening: true,
            opacity: 1,
            shadowColor: 'white',
            shadowBlur: 4,
            shadowOffset: { x: 0, y: 0 },
            shadowOpacity: 0.8
        });
        deleteBtn.on("click", (e) => {
            e.cancelBubble = true;
            this._deleteArrow(arrow, layer);  // ✅ correct `this` binding
        });

        deleteBtn.on("mouseenter", () => {
            deleteBtn.fill("#ff0000");
            deleteBtn.opacity(1);
            layer.batchDraw();
        });

        deleteBtn.on("mouseleave", () => {
            deleteBtn.fill("#f44336");
            deleteBtn.opacity(0.7);
            layer.batchDraw();
        });

        const arrowGroup = new Konva.Group({ name: 'arrow-group' });
        arrowGroup.add(arrow, deleteBtn);
        layer.add(arrowGroup);

        AppState.addArrow({
            arrowGroup,
            arrow,
            srcFile: startItem,
            srcPath: startItem.path,
            destFolderPath: destFolderPath,
            srcDot: startDot,
            destDot: destDot,
            deleteBtn
        });

        layer.batchDraw();
    },

    _deleteArrow(arrowOrGroup, layer) {
        
    let targetGroup = arrowOrGroup;
    if (arrowOrGroup && arrowOrGroup.name && arrowOrGroup.name() === 'connection-arrow') {
        targetGroup = arrowOrGroup.getParent();
    }
    console.log("error is here 1")
    //if (!targetGroup || targetGroup.className !== 'Group') return;
    console.log("error is here 2 ")
    // ✅ Use new removeArrow (only removes from array)
    AppState.removeArrow(targetGroup);
    console.log("error is here 3")

    // ✅ Then destroy (safe — not in array anymore)
    targetGroup.destroy();
    console.log("error is here 4")

    if (MUIToolbar) {
        MUIToolbar.showSnackbar("✅ Connection deleted", "success");
        MUIToolbar.updateStats();
    }

    layer.batchDraw();
},
};

const ArrowManager = {
    updateAllArrows(layer) {
        AppState.arrows?.forEach(a => {
            if (a.srcDot && a.destDot && a.arrowGroup) {
                const s = a.srcDot.getAbsolutePosition();
                const d = a.destDot.getAbsolutePosition();
                const arrow = a.arrowGroup.findOne('.connection-arrow');
                const deleteBtn = a.arrowGroup.findOne('.delete-arrow-btn');
                if (arrow) {
                    arrow.points([s.x, s.y, d.x, d.y]);
                }
                if (deleteBtn) {
                    const midX = (s.x + d.x) / 2;
                    const midY = (s.y + d.y) / 2;
                    deleteBtn.position({ x: midX - 8, y: midY - 8 });
                }
            }
        });
        layer.batchDraw();
    },
};