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
        this.tldrBtn = document.getElementById('tldr-btn');
        this.summaryContainer = document.getElementById('summary-container');
        this.summaryContent = document.getElementById('summary-content');
        this.closeSummaryBtn = document.getElementById('close-summary-btn');
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

        this.tldrBtn.addEventListener('click', () => {
            this.summarizeChapter();
        });

        this.closeSummaryBtn.addEventListener('click', () => {
            this.summaryContainer.style.display = 'none';
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

            // Remove or handle CSS links to prevent 404 errors
            const cssLinks = tempDiv.querySelectorAll('link[rel="stylesheet"]');
            cssLinks.forEach((link) => {
                link.remove();
            });

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

    async summarizeChapter() {
        if (this.currentScreen !== 'reading') return;

        // Get API key from user
        const apiKey = await this.getOpenAIApiKey();
        if (!apiKey) return;

        // Show loading state
        this.summaryContainer.style.display = 'block';
        this.summaryContent.innerHTML = '<p>Generating summary...</p>';

        try {
            // Extract text content from the chapter
            const chapterText = this.chapterContent.innerText || this.chapterContent.textContent;

            // Call OpenAI API
            const summary = await this.callOpenAI(apiKey, chapterText);

            // Display the summary with proper formatting
            this.summaryContent.innerHTML = this.formatSummary(summary);
        } catch (error) {
            console.error('Error generating summary:', error);
            this.summaryContent.innerHTML = `<p style="color: red;">Error generating summary: ${error.message}</p>`;
        }
    }

    async getOpenAIApiKey() {
        // Check if we already have a stored API key (for this session)
        if (this.openaiApiKey) {
            return this.openaiApiKey;
        }

        // Prompt user for API key
        const apiKey = prompt('Please enter your OpenAI API key:');
        if (apiKey && apiKey.trim()) {
            this.openaiApiKey = apiKey.trim();
            return this.openaiApiKey;
        }
        return null;
    }

    formatSummary(text) {
        // Convert markdown to HTML
        let html = text;

        // Convert headings
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

        // Convert bold and italic text
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Convert bullet points to unordered lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

        // Wrap consecutive list items in <ul> tags
        html = html.replace(/(<li>.*<\/li>)/gs, function(match) {
            // Split by newlines and process
            const lines = match.split('\n');
            let result = '';
            let inList = false;

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('<li>') && line.endsWith('</li>')) {
                    if (!inList) {
                        result += '<ul>\n';
                        inList = true;
                    }
                    result += line + '\n';
                } else if (inList && line === '') {
                    continue; // Skip empty lines within lists
                } else {
                    if (inList) {
                        result += '</ul>\n';
                        inList = false;
                    }
                    if (line) {
                        result += line + '\n';
                    }
                }
            }

            if (inList) {
                result += '</ul>\n';
            }

            return result;
        });

        // Convert paragraphs (wrap non-tag lines in <p> tags)
        html = html.replace(/\n\n+/g, '\n\n'); // Normalize multiple newlines
        const lines = html.split('\n');
        let result = '';
        let currentParagraph = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines
            if (line === '') {
                if (currentParagraph) {
                    result += '<p>' + currentParagraph.trim() + '</p>\n';
                    currentParagraph = '';
                }
                continue;
            }

            // Check if line is already an HTML tag
            if (line.match(/^<(h[1-6]|ul|li|\/ul)>/)) {
                if (currentParagraph) {
                    result += '<p>' + currentParagraph.trim() + '</p>\n';
                    currentParagraph = '';
                }
                result += line + '\n';
            } else {
                // Add to current paragraph
                currentParagraph += (currentParagraph ? ' ' : '') + line;
            }
        }

        // Handle any remaining paragraph
        if (currentParagraph) {
            result += '<p>' + currentParagraph.trim() + '</p>\n';
        }

        return result.trim();
    }

    async callOpenAI(apiKey, chapterText) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: `Please provide a well-structured summary of the following chapter. Use only these markdown formats:
- Use ## for main headings
- Use ### for subheadings
- Use **bold text** for emphasis
- Use *italic text* for secondary emphasis
- Use - for bullet points (single level only)
- Use regular paragraphs

Do not use code blocks, tables, links, or other markdown formatting. Keep it simple and well-structured.

Chapter content:\n\n${chapterText}`
                    }
                ],
                max_tokens: 600,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'No summary generated.';
    }

}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Initialize the EPUB reader when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new EpubReader();
});