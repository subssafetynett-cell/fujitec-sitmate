const fs = require('fs');
const path = '/Users/jinsiyajasmin/safetyapp/frontend/src/pages/SheqInstallationForm.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/setFormData\(\{\.\.\.formData,\s*/g, "setFormData(prev => ({...prev, ");
content = content.replace(/setHeaderLabels\(\{\.\.\.headerLabels,\s*/g, "setHeaderLabels(prev => ({...prev, ");
content = content.replace(/setDocInfo\(\{\.\.\.docInfo,\s*/g, "setDocInfo(prev => ({...prev, ");

// There's also some with spaces: setFormData({...formData, ...})
content = content.replace(/setFormData\(\{\s*\.\.\.formData,\s*/g, "setFormData(prev => ({...prev, ");
content = content.replace(/setHeaderLabels\(\{\s*\.\.\.headerLabels,\s*/g, "setHeaderLabels(prev => ({...prev, ");
content = content.replace(/setDocInfo\(\{\s*\.\.\.docInfo,\s*/g, "setDocInfo(prev => ({...prev, ");

fs.writeFileSync(path, content, 'utf8');
console.log("File updated successfully.");
