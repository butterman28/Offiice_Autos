import os
import pandas as pd
from docx import Document
from tkinter import Tk, Label, Button, filedialog, messagebox, StringVar, Frame, LEFT, RIGHT, BOTH

def replace_placeholders(doc, data):
    for p in doc.paragraphs:
        for key, value in data.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in p.text:
                inline = p.runs
                for i in range(len(inline)):
                    if placeholder in inline[i].text:
                        inline[i].text = inline[i].text.replace(placeholder, str(value))

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for key, value in data.items():
                    placeholder = f"{{{{{key}}}}}"
                    if placeholder in cell.text:
                        cell.text = cell.text.replace(placeholder, str(value))

def generate_docs(template_path, data_file_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Detect file type
    if data_file_path.endswith(".xlsx"):
        df = pd.read_excel(data_file_path)
    elif data_file_path.endswith(".csv"):
        df = pd.read_csv(data_file_path)
    else:
        raise ValueError("Unsupported file format. Please use CSV or XLSX.")

    for idx, row in df.iterrows():
        doc = Document(template_path)
        replace_placeholders(doc, row.to_dict())
        output_path = os.path.join(output_dir, f"output_{idx + 1}.docx")
        doc.save(output_path)
        print(f"Saved: {output_path}")

    messagebox.showinfo("Success", f"{len(df)} documents created in '{output_dir}'")

def select_template():
    return filedialog.askopenfilename(
        title="Select DOCX Template",
        filetypes=[("Word Documents", "*.docx")]
    )

def select_data_file():
    return filedialog.askopenfilename(
        title="Select Excel or CSV File",
        filetypes=[("Spreadsheet Files", "*.xlsx *.csv")]
    )

def run_app():
    root = Tk()
    root.title("DOCX Generator")
    root.geometry("600x200")

    template_path_var = StringVar()
    data_file_path_var = StringVar()

    # Frame for template selector (left)
    frame_left = Frame(root)
    frame_left.pack(side=LEFT, fill=BOTH, expand=True, padx=10, pady=10)

    Label(frame_left, text="Select DOCX Template:").pack(pady=(0,5))
    Button(frame_left, text="Browse Template", 
           command=lambda: browse_template(template_path_var)).pack()
    Label(frame_left, textvariable=template_path_var, wraplength=250).pack(pady=(5,0))

    # Frame for data file selector (right)
    frame_right = Frame(root)
    frame_right.pack(side=RIGHT, fill=BOTH, expand=True, padx=10, pady=10)

    Label(frame_right, text="Select Excel or CSV File:").pack(pady=(0,5))
    Button(frame_right, text="Browse Data File", 
           command=lambda: browse_data_file(data_file_path_var)).pack()
    Label(frame_right, textvariable=data_file_path_var, wraplength=250).pack(pady=(5,0))

    # Generate button at bottom center
    def on_generate():
        template_path = template_path_var.get()
        data_file_path = data_file_path_var.get()
        if not template_path:
            messagebox.showwarning("Missing File", "Please select a DOCX template file.")
            return
        if not data_file_path:
            messagebox.showwarning("Missing File", "Please select an Excel or CSV data file.")
            return
        output_dir = filedialog.askdirectory(title="Select Output Folder")
        if not output_dir:
            return
        try:
            generate_docs(template_path, data_file_path, output_dir)
        except Exception as e:
            messagebox.showerror("Error", f"An error occurred:\n{e}")

    generate_btn = Button(root, text="Generate Documents", command=on_generate)
    generate_btn.pack(pady=10)

    def browse_template(var):
        path = select_template()
        if path:
            var.set(path)

    def browse_data_file(var):
        path = select_data_file()
        if path:
            var.set(path)

    root.mainloop()

if __name__ == "__main__":
    run_app()
