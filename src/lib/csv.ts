export function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('ไม่มีข้อมูลสำหรับ Export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    // Header row
    headers.join(','),
    // Data rows
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle strings with commas, dates, etc.
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`; // Escape quotes
        }
        if (value instanceof Date) {
          return `"${value.toISOString().split('T')[0]}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download link
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel Thai support
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
