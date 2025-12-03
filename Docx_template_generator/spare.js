 _createItemList(items, currentPath, titleHeight, lineHeight, minwidth, isSource, group) {
    const maxVisibleHeight = 400; // Max visible content height
    
    const itemList = new Konva.Group({ 
        y: titleHeight,
        clipX: 0,
        clipY: 0,
        clipwidth: minwidth,
        clipHeight: maxVisibleHeight
    });

    itemList._maxHeight = maxVisibleHeight;
    itemList._scrollOffset = 0;
    // Scrolling with mouse wheel
    itemList.on("wheel", (e) => {
        e.evt.preventDefault();

        const delta = e.evt.deltaY > 0 ? 20 : -20; // Scroll amount
        itemList._scrollOffset += delta;

        // Calculate total content height dynamically
        const allChildren = itemList.getChildren();
        let totalHeight = 0;
        
        allChildren.forEach(child => {
            if (child.name() === 'back-button-container' || child.name() === 'item-container') {
                totalHeight += lineHeight;
                
                // Add height of expanded nested groups
                if (child.name() === 'item-container') {
                    const nestedGroup = child.findOne('.nested-group');
                    if (nestedGroup) {
                        totalHeight += nestedGroup.getChildren().length * lineHeight;
                    }
                }
            }
        });

        // Calculate scroll bounds
        const maxScroll = 0;
        const minScroll = Math.min(0, -(totalHeight - itemList._maxHeight));

        // Clamp scroll offset
        itemList._scrollOffset = Math.max(minScroll, Math.min(maxScroll, itemList._scrollOffset));

        // Apply scroll by moving all children
        let currentY = itemList._scrollOffset;
        
        allChildren.forEach(child => {
            if (child.name() === 'back-button-container' || child.name() === 'item-container') {
                child.y(currentY);
                currentY += lineHeight;
                
                // Account for nested items
                if (child.name() === 'item-container') {
                    const nestedGroup = child.findOne('.nested-group');
                    if (nestedGroup) {
                        currentY += nestedGroup.getChildren().length * lineHeight;
                    }
                }
            }
        });

        this.layer.batchDraw();
    });

    const itemElements = [];
    const fileDots = [];
    
    let startIndex = 0;
    const parentPath = currentPath ? currentPath.split(/[/\\]/).slice(0, -1).join('/') : null;
    
    // Add back button if in subfolder
    if (parentPath) {
        const backButton = ItemRenderer.createBackButton(
            minwidth, lineHeight, parentPath, group, this.layer
        );
        itemList.add(backButton.container);
        startIndex = 1;
    }
    
    // Add items
    items.forEach((item, i) => {
        const itemComponents = ItemRenderer.createItem(
            item,
            i + startIndex,
            lineHeight,
            minwidth,
            isSource,
            currentPath,
            itemList,
            this.layer
        );

        itemList.add(itemComponents.container);
        itemElements.push(itemComponents);
        
        if (itemComponents.container._dot) {
            fileDots.push({ 
                dot: itemComponents.container._dot, 
                item, 
                folderPath: currentPath 
            });
        }
    });
    
    return { itemList, itemElements, fileDots, startIndex };
}