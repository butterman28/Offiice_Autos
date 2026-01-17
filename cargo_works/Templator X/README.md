# Tauri + Vanilla

This template should help get you started developing with Tauri in vanilla HTML, CSS and Javascript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## To Run for now 
- donwload the zip or clone which ever your skill level needs
- cd cargo_works/"Templator X"
- npm install 
- npm run dev 

## How to Use

**Templator X** is a desktop application that generates multiple DOCX documents from a single template and a data file (CSV or XLSX). Follow the steps below to get started.

---

### 1. Prepare Your Files

- **Template**  
  Create a `.docx` file containing placeholders such as `{{name}}`, `{{email}}`, etc.

- **Data**  
  Prepare a `.csv` or `.xlsx` file where column headers match the placeholders in your template  
  (for example, a `name` column for `{{name}}`).

---

### 2. Load Your Files

- Click **📄 Template** and select your `.docx` file  
  → A preview appears in the left panel

- Click **📊 Data File** and select your `.csv` or `.xlsx` file  
  → A data preview appears and the **“Choose naming column”** dropdown becomes available

- Click **📁 Output Folder** and select the folder where generated files will be saved

---

### 3. Configure Output Naming (Optional)

- Use the **“Choose naming column”** dropdown to select which data column will be used to name the output files  
  (for example, selecting `id` will generate files like `123.docx`, `456.docx`)

- Leave the option set to **Auto-detect** to automatically use common columns such as `filename`, `name`, or `id`

---

### 4. Generate Documents

- Click **🚀 Generate Documents** once all three inputs are selected
- Generated files will appear in your chosen output folder
- The output folder preview automatically updates to show newly created files

---

### 5. Save for Later (Optional)

- Click **➕ Add Template / Data / Output** to save frequently used files or folders
- Access saved items at any time from the **Quick Access Panel** on the right
- Manage saved items using:
  - **✏️ Rename**
  - **🗑️ Delete**




---------------------------------------
      _  _            _  _
    (  \/  )        (  \/  )
     \    /          \    /
      \  /            \  /
       \/              \/
              <3
### Made with ❤️ by Xamp-Fire Source-rers
---------------------------------------
