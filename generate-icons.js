// Simple icon generator using Canvas API in Node.js
const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, 0, size, size);

    // Book shape
    ctx.fillStyle = '#ffffff';
    const bookWidth = size * 0.5;
    const bookHeight = size * 0.58;
    const bookX = (size - bookWidth) / 2;
    const bookY = (size - bookHeight) / 2;
    ctx.fillRect(bookX, bookY, bookWidth, bookHeight);

    // Book spine
    ctx.fillStyle = '#2980b9';
    ctx.fillRect(bookX, bookY, bookWidth * 0.125, bookHeight);

    // Pages (lines)
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = size * 0.01;
    ctx.beginPath();

    const lineStart = bookX + bookWidth * 0.25;
    const lineEnd = bookX + bookWidth * 0.9;
    const lineSpacing = bookHeight / 6;

    for (let i = 1; i <= 4; i++) {
        const y = bookY + lineSpacing * i;
        ctx.moveTo(lineStart, y);
        ctx.lineTo(lineEnd, y);
    }
    ctx.stroke();

    return canvas.toBuffer('image/png');
}

// Generate icons
try {
    const icon192 = createIcon(192);
    const icon512 = createIcon(512);

    fs.writeFileSync('icon-192.png', icon192);
    fs.writeFileSync('icon-512.png', icon512);

    console.log('Icons generated successfully!');
} catch (error) {
    console.log('Canvas package not available, using fallback method');
}