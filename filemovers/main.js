const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;

function createWindow() {
    const win = new BrowserWindow({
        width: 1300,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.loadFile("./public/index.html");
}

// ---- IPC API: pick folder ----
ipcMain.handle("pick-folder", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "multiSelections"]
    });
    return result.filePaths;
});

// ---- Read folder contents (ONLY IMMEDIATE CHILDREN) ----
ipcMain.handle('read-folder', async (event, folderPath) => {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    
    const result = items
      .filter(item => {
        if (item.name.startsWith('.')) return false;
        if (item.isSymbolicLink()) return false;
        return item.isFile() || item.isDirectory();
      })
      .map(item => ({
        name: item.name,
        path: path.join(folderPath, item.name),
        isDirectory: item.isDirectory()
      }));

    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

  } catch (err) {
    console.error('📁 read-folder failed:', err);
    return [];
  }
});
// ====== 1. Prompt for folder name (works in any Electron) ======
ipcMain.handle('create-folder-prompt', async (event) => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showInputBox({
    parent: focusedWindow,
    title: 'Create Folder',
    message: 'Enter folder name:',
    defaultInput: 'New Folder',
    // ⚠️ showInputBox only exists in Electron ≥28!
  });
  return result; // null if canceled, else string
});

// ====== 2. Create folder (you already have this ✅) ======
ipcMain.handle('create-folder', async (event, { parentPath, folderName }) => {
  try {
    const newFolderPath = path.join(parentPath, folderName);
    await fs.mkdir(newFolderPath, { recursive: false });
    return { success: true, path: newFolderPath, name: folderName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---- Move a file ----
ipcMain.handle("move-file", async (event, { src, destFolder }) => {
    try {
        const fileName = path.basename(src);
        const destPath = path.join(destFolder, fileName);
        
        await fs.rename(src, destPath);
        return destPath;
    } catch (err) {
        console.error('Move file error:', err);
        throw err;
    }
});

// 
ipcMain.handle('delete-item', async (event, path) => {
    try {
        const stats = await fs.promises.stat(path);
        if (stats.isDirectory()) {
            await fs.promises.rmdir(path, { recursive: true });
        } else {
            await fs.promises.unlink(path);
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});


// ---- Copy a file ----
ipcMain.handle("copy-file", async (event, { src, destFolder }) => {
    try {
        const fileName = path.basename(src);
        const destPath = path.join(destFolder, fileName);
        
        await fs.copyFile(src, destPath);
        return destPath;
    } catch (err) {
        console.error('Copy file error:', err);
        throw err;
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

