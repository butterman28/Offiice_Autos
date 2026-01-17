export function csvToHtml(csvText) {
  if (!csvText.trim()) return "<em>Empty CSV file</em>";

  const lines = csvText.split(/\r\n|\r|\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return "<em>No data</em>";

  let html = '<table class="min-w-full divide-y divide-gray-200">';
  
  // Detect delimiter (support comma, semicolon, tab)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' :
                   firstLine.includes(';') ? ';' : ',';

  lines.forEach((line, i) => {
    const cells = parseCsvLine(line, delimiter);
    const tag = i === 0 ? 'th' : 'td';
    html += '<tr>';
    cells.forEach(cell => {
      html += `<${tag} class="${i === 0 ? 'bg-gray-50' : ''} px-2 py-1 text-left text-xs">${escapeHtml(cell)}</${tag}>`;
    });
    html += '</tr>';
  });

  html += '</table>';
  return html;
}

export function parseCsvLine(line, delimiter) {
  const cells = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++; // skip next quote
    } else if (char === '"' && inQuotes) {
      inQuotes = false;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}