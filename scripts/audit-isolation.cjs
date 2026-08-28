const fs = require('fs');
const path = require('path');

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = scanDir('src');
let issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Check if any non-core file tries to import private internal vertical files directly instead of via registry or core loader
  const isCoreOrVerticalOrTest = file.includes(path.join('src', 'lib', 'core')) || 
                                file.includes(path.join('src', 'lib', 'verticals')) || 
                                file.includes(path.join('src', 'lib', '__tests__'));
  if (!isCoreOrVerticalOrTest) {
    if (content.includes('/verticals/electricista/') || content.includes('/verticals/tecnologia/')) {
      issues.push({ file, issue: 'Direct import from internal vertical folder' });
    }
  }
}

console.log('Total files scanned in src/:', files.length);
console.log('Cross-vertical direct import issues:', issues.length);
if (issues.length > 0) {
  console.log(JSON.stringify(issues, null, 2));
  process.exit(1);
} else {
  console.log('AUDIT RESULT: VERDE (0 dependencias cruzadas detectadas)');
}
