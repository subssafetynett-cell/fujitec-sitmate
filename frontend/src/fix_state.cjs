const fs = require('fs');
const path = '/Users/jinsiyajasmin/safetyapp/frontend/src/pages/SheqInstallationForm.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/setFormData\(\{\s*\.\.\.formData,\s*([^}]+)\}\)/g, "setFormData(prev => ({ ...prev, $1 }))");
content = content.replace(/setHeaderLabels\(\{\s*\.\.\.headerLabels,\s*([^}]+)\}\)/g, "setHeaderLabels(prev => ({ ...prev, $1 }))");
content = content.replace(/setDocInfo\(\{\s*\.\.\.docInfo,\s*([^}]+)\}\)/g, "setDocInfo(prev => ({ ...prev, $1 }))");

fs.writeFileSync(path, content, 'utf8');
console.log("File updated successfully.");
