const fs = require('fs');
const path = require('path');

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const entry of fs.readdirSync(dir)) {
    if (['node_modules', '.next', '.git'].includes(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) scanDir(fullPath, fileList);
    else if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(entry)) fileList.push(fullPath);
  }
  return fileList;
}

const files = scanDir('src');
const issues = [];
const warnings = [];

const normalized = (p) => p.split(path.sep).join('/');
const runtimeForeignPatterns = [
  { needle: '/autonomo360/', label: 'Import from legacy Autónomo360 namespace' },
  { needle: '../autonomo360/', label: 'Import from legacy Autónomo360 namespace' },
  { needle: '@/lib/autonomo360/', label: 'Import from legacy Autónomo360 namespace' },
  { needle: '/linguafox/', label: 'Import from unrelated LinguaFox namespace' },
  { needle: '/verticals/general/', label: 'Import from General vertical' },
  { needle: '/verticals/barymont/', label: 'Import from Barymont vertical' },
  { needle: '/verticals/tecnologia/', label: 'Import from Tecnologia vertical' },
];

for (const file of files) {
  const rel = normalized(file);
  const content = fs.readFileSync(file, 'utf8');

  // Los módulos legacy pueden existir temporalmente mientras se retiran,
  // pero ningún runtime/test nuevo debe depender de ellos.
  const isLegacyImplementation = rel.startsWith('src/lib/autonomo360/');
  const isForeignVerticalImplementation =
    rel.startsWith('src/lib/verticals/general/') ||
    rel.startsWith('src/lib/verticals/barymont/') ||
    rel.startsWith('src/lib/verticals/tecnologia/');

  if (!isLegacyImplementation && !isForeignVerticalImplementation) {
    for (const pattern of runtimeForeignPatterns) {
      if (content.includes(pattern.needle)) {
        issues.push({ file: rel, issue: pattern.label, pattern: pattern.needle });
      }
    }
  }
}

const legacyPaths = [
  'src/lib/autonomo360',
  'src/lib/linguafox',
  'src/lib/verticals/general',
  'src/lib/verticals/barymont',
];
for (const legacyPath of legacyPaths) {
  if (fs.existsSync(legacyPath)) warnings.push(`Legacy pendiente de retirada: ${legacyPath}`);
}

console.log('Electricista360 standalone isolation audit');
console.log('Total files scanned in src/:', files.length);
console.log('Forbidden cross-product imports:', issues.length);
if (warnings.length) {
  console.log('Transitional warnings:');
  for (const warning of warnings) console.log('-', warning);
}

if (issues.length > 0) {
  console.log(JSON.stringify(issues, null, 2));
  console.log('AUDIT RESULT: ROJO');
  process.exit(1);
}

console.log('AUDIT RESULT: VERDE (runtime sin dependencias cruzadas detectadas)');
