// fileapi.js.js or similar
const { invoke } = window.__TAURI__.core;

export const fileapi = {
    pickFolder: () => invoke('pick_folder'),
    readFolder: (path) => invoke('read_folder', { folderPath: path }),
     isDir: (path) => invoke('is_dir', { path }), 
    createFolder: (path, folderName) =>
        invoke('create_folder', {
            parentPath: path,
            folderName: folderName,
        }),

    createFile: (parentPath, fileName) =>
        invoke('create_file', {
            parentPath,
            fileName,
        }),
    async openFile(path) {
        return await invoke('open_file', { path });
    },

    async openWith(path) {
        return await invoke('open_with', { path });
    },
    listOpenWithApps: (path) =>
    invoke('list_open_with_apps', { filePath: path }),

    openWithApp: (exec, path) =>
    invoke('open_with_app', { exec, filePath: path }),
    moveFile: (src, destFolder) => 
        invoke('move_file', { src, destFolder  }),
    copyFile: (src, destFolder) => 
        invoke('copy_file', { src, destFolder  }),
    moveFolder: (src, destFolder) =>   // 
        invoke('move_folder', { src, destFolder  }),
    copyFolder: (src, destFolder) =>   //
        invoke('copy_folder', { src, destFolder }),
    deleteItem: (path) => invoke('delete_item', { pathStr: path }),
    renameItem: (oldPath, newName) =>
        invoke('rename_item', { oldPath, newName }),
    getFileInfo: (path) =>
        invoke('get_file_info', { path }),
};
