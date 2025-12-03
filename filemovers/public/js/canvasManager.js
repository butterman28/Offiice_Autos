// ============================================
// Canvas zoom and pan
// ============================================

const CanvasManager = {
    setupZoom(stage, layer) {
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
    }
};