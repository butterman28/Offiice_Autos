# FolderFlow

**Visual folder connection and synchronization tool for desktop**  
*Drag folders → Connect → Execute. No terminals. No scripts. Just flow.*

---

## 🚀 Overview

FolderFlow is a cross-platform desktop application that lets you **visually map relationships between folders** and execute bulk file operations (move, copy) with a single click.

Instead of memorizing `rsync`, `mv`, or `cp` commands, you:
- 📁 Add source/destination folder panels
- 🧵 Drag from one folder’s dot to another to create connections
- ▶️ Click **Execute Move** or **Execute Copy** to run all operations
- 🗑️ Create, delete, and reorganize files/folders inline

Built for developers, researchers, media producers, and anyone who manages large directory structures.

---

## ✨ Key Features

### 🎯 Visual Workflow
- **Draggable folder panels** with expandable trees
- **Purple connection dots** on every folder — drag to link
- **Temporary arrows with ❌ cancel button** during drag
- **Real-time layout updates** — no refresh needed

### ⚙️ Smart Operations
- **Folder-to-folder only** — prevents accidental file-level connections
- **Self-connection guard** — can’t link a folder to itself
- **Arrow management** — clear all or cancel individual connections
- **Batch execution** — process all connections in one operation

### 🛠️ Power User Tools
- **Inline folder creation** (`+` button on any folder)
- **File/folder deletion** (`🗑️` with confirmation)
- **Go-back navigation** (`⬆️ ..` in nested views)
- **Responsive canvas UI** — zoom, pan, scroll

### 🔒 Safe & Reliable
- All destructive operations require explicit confirmation
- File operations run in the main process (secure IPC)
- No auto-execution — you control when to run

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5,tailwindCSS,Vanilla JS |
| **Backend** |Tauri(rust)|
| **Styling** | CSS|


## 📦 Installation

### Prerequisites
- npm or yarn
- rust
### Local Setup
```bash
git clone git@github.com:butterman28/Offiice_Autos.git
cd /cargo_works/FileCanvas
npm install
npm run dev