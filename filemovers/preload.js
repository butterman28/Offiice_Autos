const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("api", {
    pickFolder: () => ipcRenderer.invoke("pick-folder"),
    readFolder: (folder) => ipcRenderer.invoke("read-folder", folder),
    moveFile: (src, destFolder) => ipcRenderer.invoke("move-file", { src, destFolder }),
    copyFile: (src, destFolder) => ipcRenderer.invoke("copy-file", { src, destFolder }),
    createFolder: (parentPath, folderName) => ipcRenderer.invoke("create-folder", { parentPath, folderName }),
    copyFolder: (src, dest) => ipcRenderer.invoke('copy-folder', src, dest),
    moveFolder: (src, dest) => ipcRenderer.invoke('move-folder', src, dest),
    deleteItem: (path) => ipcRenderer.invoke('delete-item', path)

});