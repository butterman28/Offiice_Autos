// Load one folder level from backend
async function loadFolder(path) {
    return await fileapi.readFolder(path);
}

// Convert backend format → generic tree nodes
function toTreeNodes(items) {
    return items.map(i => ({
        name: i.name,
        path: i.path,
        isDir: i.isDirectory
    }));
}

// Pick a root folder
async function pickRootFolder() {
    const paths = await fileapi.pickFolder();
    return paths?.[0] || null;
}

window.fsExplorer = { loadFolder, pickRootFolder, toTreeNodes };
