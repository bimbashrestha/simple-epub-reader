# Simple EPUB Reader

A simple, web-based EPUB reader that allows you to upload and read EPUB files directly in your browser.

## Features

- Upload and read EPUB files
- Interactive table of contents navigation
- Clean, responsive reading interface
- Image support within EPUB files
- Security-focused (strips potentially harmful scripts)

## Usage

1. Open `index.html` in your web browser
2. Click "Select EPUB File" to upload an EPUB file
3. Browse the table of contents
4. Click on any chapter to start reading

## Files

- `index.html` - Main HTML structure
- `script.js` - EPUB reader functionality
- `style.css` - Styling and layout

## Dependencies

- [JSZip](https://stuk.github.io/jszip/) - For handling EPUB file format
- [Epub.js](https://github.com/futurepress/epub.js/) - EPUB parsing and rendering

Dependencies are loaded from CDN, so an internet connection is required.

## License

MIT License - see LICENSE file for details.
