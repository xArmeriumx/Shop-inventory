const fs = require('fs');

const files = [
  'src/services/purchase.service.ts',
  'src/services/sale.service.ts',
  'src/services/finance.service.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/entityType/g, 'targetType');
  content = content.replace(/entityId/g, 'targetId');
  content = content.replace(/metadata/g, 'afterSnapshot');
  fs.writeFileSync(file, content);
}
