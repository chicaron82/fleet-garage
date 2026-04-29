const fs = require('fs');

let content = fs.readFileSync('src/data/mock-audits.ts', 'utf8');

// Replace status: 'PASSED', or status: 'FAILED', with the same plus branchId: 'YWG',
content = content.replace(/status:\s*'(PASSED|FAILED)',/g, "status: '$1',\n    branchId: 'YWG',");

fs.writeFileSync('src/data/mock-audits.ts', content);
console.log('Fixed mock-audits.ts');
