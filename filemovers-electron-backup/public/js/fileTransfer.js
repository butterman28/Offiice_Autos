// ============================================
// File transfer operations
// ============================================

const FileTransfer = {
    async execute(operation) {
        if (AppState.arrows.length === 0) {
            MUIToolbar.showSnackbar("No file connections! Wire files first.", "warning");
            return;
        }
        
        const btn = document.getElementById(operation === "move" ? "execute-move" : "execute-copy");
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="mui-icon">⏳</span><span>${operation === "move" ? "Moving" : "Copying"}...</span>`;
        
        let success = 0;
        let failed = 0;
        
        for (const conn of AppState.arrows) {
            try {
                // 🔍 Detect if source is a folder or file
                const isFolder = conn.srcFile.isDirectory;

                if (operation === "move") {
                if (isFolder) {
                    await fileapi.moveFolder(conn.srcPath, conn.destFolderPath);
                } else {
                    await fileapi.moveFile(conn.srcPath, conn.destFolderPath);
                }
                } else { // copy
                if (isFolder) {
                    await fileapi.copyFolder(conn.srcPath, conn.destFolderPath);
                } else {
                    await fileapi.copyFile(conn.srcPath, conn.destFolderPath);
                }
                }

                success++;
                conn.arrow.stroke("#4CAF50");
            } catch (err) {
                console.error(`Transfer failed (${conn.srcFile.name}):`, err);
                failed++;
                conn.arrow.stroke("#F44336");
            }
            }
        
        btn.disabled = false;
        btn.innerHTML = originalText;
        
        if (failed === 0) {
            MUIToolbar.showSnackbar(`✅ Successfully transferred ${success} file${success !== 1 ? 's' : ''}`, "success");
        } else {
            MUIToolbar.showSnackbar(`⚠️ ${success} succeeded, ${failed} failed`, "warning");
        }
        
        MUIToolbar.updateStats();
    }
};

