/**
 * Utility to validate file signatures (magic bytes) to prevent malicious file uploads
 * circumventing client-side MIME type declarations.
 */

export function detectMimeTypeFromBuffer(buffer: Uint8Array): string | null {
  if (buffer.length < 12) return null;
  
  const header = Array.from(buffer.subarray(0, 4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  if (header.startsWith('ffd8')) {
    return 'image/jpeg';
  }
  
  if (header === '89504e47') {
    return 'image/png';
  }
  
  if (header === '25504446') {
    return 'application/pdf';
  }
  
  // WebP magic bytes: "RIFF" (4 bytes), file size (4 bytes), "WEBP" (4 bytes)
  const riffStr = Array.from(buffer.subarray(0, 4)).map(b => String.fromCharCode(b)).join('');
  const webpStr = Array.from(buffer.subarray(8, 12)).map(b => String.fromCharCode(b)).join('');
  if (riffStr === 'RIFF' && webpStr === 'WEBP') {
    return 'image/webp';
  }
  
  return null;
}
