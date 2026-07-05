const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Layanan.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace Button ⬆️
content = content.replace(
  /style=\{\{\s*background:\s*'transparent',\s*border:\s*'none',\s*opacity:\s*(.*?)cursor:\s*(.*?)fontSize:\s*14\s*\}\}\s*title="Naikkan urutan">⬆️<\/button>/g,
  'className="layanan-action-btn" style={{ opacity: $1 cursor: $2 }} title="Naikkan urutan"><ArrowUp size={16} /></button>'
);

// Replace Button ⬇️
content = content.replace(
  /style=\{\{\s*background:\s*'transparent',\s*border:\s*'none',\s*opacity:\s*(.*?)cursor:\s*(.*?)fontSize:\s*14\s*\}\}\s*title="Turunkan urutan">⬇️<\/button>/g,
  'className="layanan-action-btn" style={{ opacity: $1 cursor: $2 }} title="Turunkan urutan"><ArrowDown size={16} /></button>'
);

// Replace Hapus Button
content = content.replace(
  /style=\{\{\s*background:\s*'transparent',\s*border:\s*'none',\s*color:\s*'#ef4444',\s*fontWeight:\s*600,\s*fontSize:\s*12,\s*cursor:\s*'pointer'\s*\}\}>Hapus<\/button>/g,
  'className="layanan-action-btn danger" title="Hapus"><Trash2 size={16} /></button>'
);

content = content.replace(
  /style=\{\{\s*background:\s*'transparent',\s*border:\s*'none',\s*color:\s*'#ef4444',\s*fontSize:\s*12,\s*cursor:\s*'pointer',\s*fontWeight:\s*600\s*\}\}>Hapus<\/button>/g,
  'className="layanan-action-btn danger" title="Hapus"><Trash2 size={16} /></button>'
);

// Replace list item container
content = content.replace(
  /style=\{\{\s*display:\s*'flex',\s*justifyContent:\s*'space-between',\s*alignItems:\s*'center',\s*background:\s*'var\(--bg-card\)',\s*padding:\s*'12px 16px',\s*borderRadius:\s*8,\s*border:\s*'1px solid var\(--border-subtle\)'\s*\}\}/g,
  'className="layanan-list-item"'
);

// Replace input fields
content = content.replace(
  /style=\{\{\s*flex:\s*1,\s*background:\s*'var\(--bg-base\)',\s*border:\s*'1px solid var\(--border-active\)',\s*borderRadius:\s*8,\s*padding:\s*'10px 14px',\s*color:\s*'var\(--text-primary\)',\s*outline:\s*'none',\s*fontSize:\s*14,\s*transition:\s*' border 0\.2s'\s*\}\}/g,
  'className="layanan-input"'
);

// Replace Simpan button
content = content.replace(
  /className="btn btn-primary" style=\{\{\s*padding:\s*'0 20px',\s*borderRadius:\s*8,\s*fontSize:\s*14,\s*fontWeight:\s*600\s*\}\}/g,
  'className="layanan-btn-primary"'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replaced successfully');
