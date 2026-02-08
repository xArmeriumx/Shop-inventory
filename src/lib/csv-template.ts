/**
 * CSV Template Generator — Download blank templates for data import
 */

/**
 * Download a product import CSV template with example rows
 */
export function downloadProductTemplate() {
  const headers = 'Name,SKU,Category,CostPrice,SalePrice,Stock,MinStock';
  const example1 = 'มอเตอร์ไซค์ไฟฟ้า รุ่น A,EB-001,EBIKE,25000,35000,5,2';
  const example2 = 'แบตเตอรี่ 60V,BAT-60V,PARTS,3500,5500,10,3';

  const content = [headers, example1, example2].join('\n');

  // Add BOM for Excel Thai support
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'product-import-template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
