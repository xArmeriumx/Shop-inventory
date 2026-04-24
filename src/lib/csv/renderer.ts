/**
 * Universal CSV Renderer with UTF-8 BOM for Thai Excel support
 * Pure functional utility separated from services.
 */
export function toCSV(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const val = row[header];
                // Escape quotes and wrap in quotes if contains comma
                const escaped = ('' + (val ?? '')).replace(/"/g, '""');
                return (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"'))
                    ? `"${escaped}"`
                    : escaped;
            }).join(',')
        )
    ];
    return '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel Thai support
}
