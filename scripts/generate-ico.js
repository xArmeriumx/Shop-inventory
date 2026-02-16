/**
 * Generate favicon.ico for Electron app
 * Creates a proper ICO file with multiple sizes (16, 32, 48, 256)
 * using raw BMP encoding - no external dependencies needed.
 */

const fs = require("fs");
const path = require("path");

// ============================================
// ICO File Format Writer (BMP-based)
// ============================================

function createBMPData(size) {
  // Create a simple but recognizable "S" icon at the given size
  const pixels = new Uint8Array(size * size * 4); // BGRA format

  // Background color: #09090b (near black)
  const bgR = 9,
    bgG = 9,
    bgB = 11,
    bgA = 255;
  // Foreground color: white
  const fgR = 255,
    fgG = 255,
    fgB = 255,
    fgA = 255;

  // Fill background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Check if within rounded rect
      const cornerRadius = Math.floor(size * 0.21); // ~21% radius like iOS icons
      if (isInsideRoundedRect(x, y, size, size, cornerRadius)) {
        pixels[idx + 0] = bgB; // B
        pixels[idx + 1] = bgG; // G
        pixels[idx + 2] = bgR; // R
        pixels[idx + 3] = bgA; // A
      } else {
        pixels[idx + 0] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0; // Transparent
      }
    }
  }

  // Draw the "S" shape
  drawS(pixels, size, fgR, fgG, fgB, fgA);

  return pixels;
}

function isInsideRoundedRect(x, y, w, h, r) {
  // Check if point is inside a rounded rectangle
  if (x < r && y < r) {
    return (r - x) * (r - x) + (r - y) * (r - y) <= r * r;
  }
  if (x >= w - r && y < r) {
    return (x - (w - r - 1)) * (x - (w - r - 1)) + (r - y) * (r - y) <= r * r;
  }
  if (x < r && y >= h - r) {
    return (r - x) * (r - x) + (y - (h - r - 1)) * (y - (h - r - 1)) <= r * r;
  }
  if (x >= w - r && y >= h - r) {
    return (
      (x - (w - r - 1)) * (x - (w - r - 1)) +
        (y - (h - r - 1)) * (y - (h - r - 1)) <=
      r * r
    );
  }
  return true;
}

function drawS(pixels, size, r, g, b, a) {
  // Draw a geometric "S" that looks good at all sizes
  const s = size;
  const thick = Math.max(2, Math.floor(s * 0.1)); // Stroke thickness
  const margin = Math.floor(s * 0.22);
  const midY = Math.floor(s * 0.5);

  // The S consists of:
  // 1. Top horizontal bar
  // 2. Right vertical bar (top half)
  // 3. Middle horizontal bar
  // 4. Left vertical bar (bottom half)
  // 5. Bottom horizontal bar

  const left = margin;
  const right = s - margin;
  const top = margin;
  const bottom = s - margin;

  // Top horizontal line
  fillRect(pixels, s, left, top, right - left, thick, r, g, b, a);
  // Right vertical (top half)
  fillRect(
    pixels,
    s,
    right - thick,
    top,
    thick,
    midY - top + Math.floor(thick / 2),
    r,
    g,
    b,
    a,
  );
  // Middle horizontal line
  fillRect(
    pixels,
    s,
    left,
    midY - Math.floor(thick / 2),
    right - left,
    thick,
    r,
    g,
    b,
    a,
  );
  // Left vertical (bottom half)
  fillRect(
    pixels,
    s,
    left,
    midY - Math.floor(thick / 2),
    thick,
    bottom - midY + Math.floor(thick / 2),
    r,
    g,
    b,
    a,
  );
  // Bottom horizontal line
  fillRect(pixels, s, left, bottom - thick, right - left, thick, r, g, b, a);
}

function fillRect(pixels, size, x0, y0, w, h, r, g, b, a) {
  for (let y = y0; y < y0 + h && y < size; y++) {
    for (let x = x0; x < x0 + w && x < size; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const idx = (y * size + x) * 4;
        pixels[idx + 0] = b; // B
        pixels[idx + 1] = g; // G
        pixels[idx + 2] = r; // R
        pixels[idx + 3] = a; // A
      }
    }
  }
}

function createICO(sizes) {
  const entries = [];

  for (const size of sizes) {
    const pixels = createBMPData(size);

    // BMP data for ICO (bottom-up, no file header)
    // BITMAPINFOHEADER (40 bytes)
    const headerSize = 40;
    const imageSize = size * size * 4;
    const bmpHeader = Buffer.alloc(headerSize);

    bmpHeader.writeUInt32LE(headerSize, 0); // biSize
    bmpHeader.writeInt32LE(size, 4); // biWidth
    bmpHeader.writeInt32LE(size * 2, 8); // biHeight (doubled for AND mask)
    bmpHeader.writeUInt16LE(1, 12); // biPlanes
    bmpHeader.writeUInt16LE(32, 14); // biBitCount (32-bit BGRA)
    bmpHeader.writeUInt32LE(0, 16); // biCompression (BI_RGB)
    bmpHeader.writeUInt32LE(imageSize, 20); // biSizeImage
    bmpHeader.writeInt32LE(0, 24); // biXPelsPerMeter
    bmpHeader.writeInt32LE(0, 28); // biYPelsPerMeter
    bmpHeader.writeUInt32LE(0, 32); // biClrUsed
    bmpHeader.writeUInt32LE(0, 36); // biClrImportant

    // Convert pixels to bottom-up order (BMP format)
    const bmpPixels = Buffer.alloc(imageSize);
    for (let y = 0; y < size; y++) {
      const srcRow = y * size * 4;
      const dstRow = (size - 1 - y) * size * 4;
      for (let x = 0; x < size * 4; x++) {
        bmpPixels[dstRow + x] = pixels[srcRow + x];
      }
    }

    // AND mask (1-bit transparency, all zeros = all opaque for 32-bit)
    const andMaskRowSize = Math.ceil(size / 32) * 4;
    const andMask = Buffer.alloc(andMaskRowSize * size, 0);

    entries.push({
      size: size,
      data: Buffer.concat([bmpHeader, bmpPixels, andMask]),
    });
  }

  // ICO file header
  const numImages = entries.length;
  const headerBytes = 6 + numImages * 16; // ICONDIR + ICONDIRENTRYs
  const header = Buffer.alloc(headerBytes);

  // ICONDIR
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images

  let dataOffset = headerBytes;
  for (let i = 0; i < numImages; i++) {
    const entry = entries[i];
    const entryOffset = 6 + i * 16;

    header.writeUInt8(entry.size >= 256 ? 0 : entry.size, entryOffset + 0); // Width
    header.writeUInt8(entry.size >= 256 ? 0 : entry.size, entryOffset + 1); // Height
    header.writeUInt8(0, entryOffset + 2); // Color palette
    header.writeUInt8(0, entryOffset + 3); // Reserved
    header.writeUInt16LE(1, entryOffset + 4); // Color planes
    header.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    header.writeUInt32LE(entry.data.length, entryOffset + 8); // Data size
    header.writeUInt32LE(dataOffset, entryOffset + 12); // Data offset

    dataOffset += entry.data.length;
  }

  return Buffer.concat([header, ...entries.map((e) => e.data)]);
}

// ============================================
// Generate the ICO file
// ============================================
const sizes = [16, 32, 48, 256];
const icoBuffer = createICO(sizes);

const outputPath = path.join(__dirname, "..", "public", "favicon.ico");
fs.writeFileSync(outputPath, icoBuffer);

console.log(`✅ favicon.ico created at: ${outputPath}`);
console.log(`   Sizes included: ${sizes.join(", ")}px`);
console.log(`   File size: ${(icoBuffer.length / 1024).toFixed(1)} KB`);
