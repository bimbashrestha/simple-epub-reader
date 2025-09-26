class EpubReader {
    constructor() {
        this.book = null;
        this.currentScreen = 'upload';
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.uploadScreen = document.getElementById('upload-screen');
        this.tocScreen = document.getElementById('toc-screen');
        this.readingScreen = document.getElementById('reading-screen');

        this.uploadBtn = document.getElementById('upload-btn');
        this.epubFileInput = document.getElementById('epub-file');
        this.bookTitle = document.getElementById('book-title');
        this.tocList = document.getElementById('toc-list');
        this.backBtn = document.getElementById('back-btn');
        this.chapterContent = document.getElementById('chapter-content');
        this.copyChapterBtn = document.getElementById('copy-chapter-btn');
        this.copyBookBtn = document.getElementById('copy-book-btn');
    }

    attachEventListeners() {
        this.uploadBtn.addEventListener('click', () => {
            this.epubFileInput.click();
        });

        this.epubFileInput.addEventListener('change', (event) => {
            this.handleFileUpload(event);
        });

        this.backBtn.addEventListener('click', () => {
            this.showScreen('toc');
        });

        this.copyChapterBtn.addEventListener('click', () => {
            this.copyChapterText();
        });

        this.copyBookBtn.addEventListener('click', () => {
            this.copyEntireBook();
        });

        // Handle Cmd+A / Ctrl+A to select chapter content only
        document.addEventListener('keydown', (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
                if (this.currentScreen === 'reading') {
                    event.preventDefault();
                    this.selectChapterText();
                }
            }
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            this.book = ePub(arrayBuffer);

            await this.book.ready;
            await this.loadTableOfContents();
            this.showScreen('toc');
        } catch (error) {
            console.error('Error loading EPUB:', error);
            alert('Error loading EPUB file. Please try again with a valid EPUB file.');
        }
    }

    async loadTableOfContents() {
        try {
            const navigation = await this.book.loaded.navigation;

            // Set book title
            const metadata = await this.book.loaded.metadata;
            this.bookTitle.textContent = metadata.title || 'Table of Contents';

            // Clear existing TOC
            this.tocList.innerHTML = '';

            // Build TOC
            this.buildTocItems(navigation.toc, this.tocList);

        } catch (error) {
            console.error('Error loading table of contents:', error);
            this.tocList.innerHTML = '<p>Error loading table of contents</p>';
        }
    }

    buildTocItems(tocItems, container, level = 0) {
        tocItems.forEach(item => {
            const tocItem = document.createElement('div');
            tocItem.className = 'toc-item' + (level > 0 ? ' sub-chapter' : '');

            const title = document.createElement('h3');
            title.textContent = item.label;
            tocItem.appendChild(title);

            tocItem.addEventListener('click', () => {
                this.loadChapter(item.href);
            });

            container.appendChild(tocItem);

            // Add sub-items if they exist
            if (item.subitems && item.subitems.length > 0) {
                this.buildTocItems(item.subitems, container, level + 1);
            }
        });
    }

    async loadChapter(href) {
        try {
            const section = this.book.spine.get(href);
            const contents = await section.load(this.book.load.bind(this.book));

            // Get the HTML content
            const serializer = new XMLSerializer();
            const htmlString = serializer.serializeToString(contents);

            // Create a temporary div to process the content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlString;

            // Remove script tags for security
            const scripts = tempDiv.querySelectorAll('script');
            scripts.forEach(script => script.remove());

            // Update image sources to work with the EPUB
            const images = tempDiv.querySelectorAll('img');
            images.forEach(async (img) => {
                const src = img.getAttribute('src');
                if (src) {
                    try {
                        const imageUrl = await this.book.archive.createUrl(src, {base64: false});
                        img.src = imageUrl;
                    } catch (error) {
                        console.warn('Could not load image:', src);
                    }
                }
            });

            // Set the chapter content
            this.chapterContent.innerHTML = tempDiv.innerHTML;

            // Show the reading screen
            this.showScreen('reading');

            // Scroll to top
            window.scrollTo(0, 0);

        } catch (error) {
            console.error('Error loading chapter:', error);
            this.chapterContent.innerHTML = '<p>Error loading chapter content.</p>';
            this.showScreen('reading');
        }
    }

    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show the requested screen
        switch (screenName) {
            case 'upload':
                this.uploadScreen.classList.add('active');
                break;
            case 'toc':
                this.tocScreen.classList.add('active');
                break;
            case 'reading':
                this.readingScreen.classList.add('active');
                break;
        }

        this.currentScreen = screenName;
    }

    selectChapterText() {
        if (this.currentScreen !== 'reading') return;

        const selection = window.getSelection();
        const range = document.createRange();

        // Select only the text content within the chapter-content div
        range.selectNodeContents(this.chapterContent);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    async copyChapterText() {
        if (this.currentScreen !== 'reading') return;

        try {
            // Get the plain text content of the chapter
            const chapterText = this.chapterContent.innerText || this.chapterContent.textContent || '';

            // Copy to clipboard using the modern Clipboard API
            await navigator.clipboard.writeText(chapterText);

            // Provide visual feedback
            this.showCopyFeedback(this.copyChapterBtn, 'Chapter Copied!');
        } catch (error) {
            console.error('Failed to copy chapter text:', error);

            // Fallback: select the text so user can manually copy
            this.selectChapterText();
            alert('Could not automatically copy. The text has been selected - please use Cmd+C or Ctrl+C to copy.');
        }
    }

    async copyEntireBook() {
        if (!this.book) return;

        try {
            // Show loading feedback
            const originalText = this.copyBookBtn.textContent;
            this.copyBookBtn.textContent = 'Copying...';
            this.copyBookBtn.disabled = true;

            let fullBookText = '';

            // Get metadata first
            const metadata = await this.book.loaded.metadata;
            if (metadata.title) {
                fullBookText += `${metadata.title}\n`;
                if (metadata.creator) {
                    fullBookText += `by ${metadata.creator}\n`;
                }
                fullBookText += '\n' + '='.repeat(50) + '\n\n';
            }

            // Get all spine items (chapters in reading order)
            const spine = this.book.spine;

            for (let i = 0; i < spine.length; i++) {
                const section = spine.get(i);

                try {
                    const contents = await section.load(this.book.load.bind(this.book));

                    // Create a temporary div to process the content
                    const tempDiv = document.createElement('div');
                    const serializer = new XMLSerializer();
                    tempDiv.innerHTML = serializer.serializeToString(contents);

                    // Remove script tags and other non-text elements
                    const scripts = tempDiv.querySelectorAll('script, style');
                    scripts.forEach(script => script.remove());

                    // Get the text content
                    const chapterText = tempDiv.innerText || tempDiv.textContent || '';

                    if (chapterText.trim()) {
                        fullBookText += chapterText.trim() + '\n\n';
                    }

                    // Add a separator between chapters
                    if (i < spine.length - 1) {
                        fullBookText += '─'.repeat(30) + '\n\n';
                    }
                } catch (error) {
                    console.warn(`Could not load chapter ${i + 1}:`, error);
                }
            }

            // Copy to clipboard
            await navigator.clipboard.writeText(fullBookText);

            // Restore button and show success feedback
            this.copyBookBtn.disabled = false;
            this.showCopyFeedback(this.copyBookBtn, 'Book Copied!', originalText);

        } catch (error) {
            console.error('Failed to copy entire book:', error);

            // Restore button
            this.copyBookBtn.textContent = 'Copy Entire Book';
            this.copyBookBtn.disabled = false;

            alert('Could not copy the entire book. Please try copying individual chapters instead.');
        }
    }

    showCopyFeedback(button, successText, originalText = null) {
        const original = originalText || button.textContent;
        button.textContent = successText;
        button.style.backgroundColor = 'var(--success-color, #27ae60)';

        setTimeout(() => {
            button.textContent = original;
            button.style.backgroundColor = '';
        }, 2000);
    }
}

// Initialize the EPUB reader when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new EpubReader();
});