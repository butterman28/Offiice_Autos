// ============================================
// Main application initialization - UPDATED
// ============================================

window.addEventListener("DOMContentLoaded", () => {
    // Initialize MUI Toolbar
    MUIToolbar.init();
    
    const stage = new Konva.Stage({
        container: "canvas-container",
        width: window.innerWidth,
        height: window.innerHeight - 64,
        draggable: true
    });
    
    const layer = new Konva.Layer();
    stage.add(layer);
    
    //const folderGroupManager = new FolderGroup(layer);
    const folderGroupManager = new FolderGroup(layer, stage);
    // ✅ REMOVED: Old connection tracking - now handled inside ConnectionManager
    // stage.on("mousemove", () => {
    //     ConnectionManager.updateConnectionLine(stage, layer);
    // });
    // 
    // stage.on("mouseup", () => {
    //     ConnectionManager.finalizeConnection(stage, layer);
    //     MUIToolbar.updateStats();
    // });
    
    // Setup zoom
    CanvasManager.setupZoom(stage, layer);
    
    // Toolbar: Add Source
    document.getElementById("add-source").onclick = async () => {
        const folders = await window.api.pickFolder();
        if (!folders?.length) return;
        
        const folderPath = folders[0];
        const items = await window.api.readFolder(folderPath);
        const folderName = folderPath.split(/[/\\]/).pop() || "Source";
        
        const col = AppState.groupCounter % 3;
        const row = Math.floor(AppState.groupCounter / 3);
        
        folderGroupManager.create({
            type: "source",
            x: 50 + col * 320,
            y: 100 + row * 300,
            title: `📁 ${folderName}`,
            items,
            currentPath: folderPath,
            isSource: true
        });
        
        AppState.groupCounter++;
        MUIToolbar.showSnackbar(`Added source folder: ${folderName}`, "success");
        MUIToolbar.updateStats(); // ✅ Add this
    };
    
    // Toolbar: Add Destination
    document.getElementById("add-dest").onclick = async () => {
        const folders = await window.api.pickFolder();
        if (!folders?.length) return;
        
        const folderPath = folders[0];
        const items = await window.api.readFolder(folderPath);
        const folderName = folderPath.split(/[/\\]/).pop() || "Destination";
        
        const col = AppState.groupCounter % 3;
        const row = Math.floor(AppState.groupCounter / 3);
        
        folderGroupManager.create({
            type: "dest",
            x: 50 + col * 320,
            y: 100 + row * 300,
            title: `📂 ${folderName}`,
            items,
            currentPath: folderPath,
            isSource: false
        });
        
        AppState.groupCounter++;
        MUIToolbar.showSnackbar(`Added destination folder: ${folderName}`, "success");
        MUIToolbar.updateStats(); // ✅ Add this
    };
    
    // Toolbar: Execute operations
    document.getElementById("execute-move").onclick = () => {
        FileTransfer.execute("move");
        AppState.clearArrows();
    }
    document.getElementById("execute-copy").onclick = () => {
        FileTransfer.execute("copy");
        AppState.clearArrows();
        layer.batchDraw();
        MUIToolbar.updateStats();
        MUIToolbar.showSnackbar(`Cleared ${count} connection${count !== 1 ? 's' : ''}`, "info");
    }

    
    // Toolbar: Clear arrows
    document.getElementById("clear-arrows").onclick = () => {
        if (AppState.arrows.length === 0) {
            MUIToolbar.showSnackbar("No connections to clear", "info");
            return;
        }
        
        const count = AppState.arrows.length;
        AppState.clearArrows();
        layer.batchDraw();
        MUIToolbar.updateStats();
        MUIToolbar.showSnackbar(`Cleared ${count} connection${count !== 1 ? 's' : ''}`, "info");
    };
    
    // Handle window resize
    window.addEventListener('resize', () => {
        stage.width(window.innerWidth);
        stage.height(window.innerHeight - 64);
        layer.batchDraw();
    });
});