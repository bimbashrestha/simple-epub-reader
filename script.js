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
        this.uploadAnotherBtn = document.getElementById('upload-another-btn');
        this.summarizeBookBtn = document.getElementById('summarize-book-btn');
        this.summaryProgress = document.getElementById('summary-progress');
        this.progressText = document.getElementById('progress-text');
        this.progressFill = document.getElementById('progress-fill');
        this.bookSummaryContainer = document.getElementById('book-summary-container');
        this.bookSummaryContent = document.getElementById('book-summary-content');
        this.closeBookSummaryBtn = document.getElementById('close-book-summary-btn');
    }

    attachEventListeners() {
        this.uploadBtn.addEventListener('click', () => {
            this.epubFileInput.click();
        });

        this.epubFileInput.addEventListener('change', (event) => {
            this.handleFileUpload(event);
        });

        this.backBtn.addEventListener('click', () => {
            this.summaryContainer.style.display = 'none';
            this.showScreen('toc');
        });

        this.tldrBtn.addEventListener('click', () => {
            this.summarizeChapter();
        });

        this.closeSummaryBtn.addEventListener('click', () => {
            this.summaryContainer.style.display = 'none';
        });

        this.uploadAnotherBtn.addEventListener('click', () => {
            this.showScreen('upload');
        });

        this.summarizeBookBtn.addEventListener('click', () => {
            this.summarizeBook();
        });

        this.closeBookSummaryBtn.addEventListener('click', () => {
            this.bookSummaryContainer.style.display = 'none';
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
        // Split text into lines for processing
        const lines = text.split('\n');
        let result = '';
        let currentParagraph = '';
        let listStack = []; // Stack to track nested list levels

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmedLine = line.trim();

            // Skip empty lines
            if (trimmedLine === '') {
                // Close current paragraph if we have one
                if (currentParagraph) {
                    result += '<p>' + currentParagraph.trim() + '</p>\n';
                    currentParagraph = '';
                }
                continue;
            }

            // Handle headings
            if (trimmedLine.match(/^###\s+(.+)$/)) {
                result = this.getResult(result, currentParagraph, listStack);
                currentParagraph = '';
                result += '<h3>' + trimmedLine.replace(/^###\s+/, '') + '</h3>\n';
                continue;
            }

            if (trimmedLine.match(/^##\s+(.+)$/)) {
                result = this.getResult(result, currentParagraph, listStack);
                currentParagraph = '';
                result += '<h2>' + trimmedLine.replace(/^##\s+/, '') + '</h2>\n';
                continue;
            }

            // Handle unordered lists (- or * with optional indentation)
            const unorderedListMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
            if (unorderedListMatch) {
                const indent = unorderedListMatch[1].length;
                const content = unorderedListMatch[2];

                // Close paragraph if we have one
                if (currentParagraph) {
                    result += '<p>' + currentParagraph.trim() + '</p>\n';
                    currentParagraph = '';
                }

                // Handle list nesting
                result = this.handleListItem(result, listStack, indent, content, 'ul');
                continue;
            }

            // Handle numbered lists (1. 2. etc. with optional indentation)
            const numberedListMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
            if (numberedListMatch) {
                const indent = numberedListMatch[1].length;
                const content = numberedListMatch[2];

                // Close paragraph if we have one
                if (currentParagraph) {
                    result += '<p>' + currentParagraph.trim() + '</p>\n';
                    currentParagraph = '';
                }

                // Handle list nesting
                result = this.handleListItem(result, listStack, indent, content, 'ol');
                continue;
            }

            // Regular text line - close any open lists first
            if (listStack.length > 0) {
                result = this.closeAllLists(result, listStack);
            }

            // Add to current paragraph
            const processedLine = this.processInlineFormatting(trimmedLine);
            currentParagraph += (currentParagraph ? ' ' : '') + processedLine;
        }

        // Close any remaining paragraph and lists
        result = this.getResult(result, currentParagraph, listStack);

        return result.trim();
    }

    processInlineFormatting(text) {
        // Convert bold and italic text
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
        return text;
    }

    handleListItem(result, listStack, indent, content, listType) {
        // Determine the level based on indentation (every 2-4 spaces = new level)
        const level = Math.floor(indent / 2);

        // Close lists that are at deeper levels than current
        while (listStack.length > level + 1) {
            const closingTag = listStack.pop();
            result += `</${closingTag}>\n`;
        }

        // Open new list if we're at a new level
        if (listStack.length === level) {
            result += `<${listType}>\n`;
            listStack.push(listType);
        }

        // Add the list item
        const processedContent = this.processInlineFormatting(content);
        result += `<li>${processedContent}</li>\n`;

        return result;
    }

    closeAllLists(result, listStack) {
        while (listStack.length > 0) {
            const closingTag = listStack.pop();
            result += `</${closingTag}>\n`;
        }
        return result;
    }

    getResult(result, currentParagraph, listStack) {
        // Close any open lists
        result = this.closeAllLists(result, listStack);

        // Add current paragraph if exists
        if (currentParagraph) {
            result += '<p>' + currentParagraph.trim() + '</p>\n';
        }

        return result;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async callOpenAIWithRetry(apiKey, payload, context = '', maxRetries = 3) {
        const baseDelay = 2000; // 2 seconds
        const timeout = 30000; // 30 seconds timeout

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0]?.message?.content || 'No content generated.';
                }

                // Handle HTTP errors
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
                error.status = response.status;
                throw error;

            } catch (error) {
                const isLastAttempt = attempt === maxRetries;
                const isTimeout = error.name === 'AbortError';
                const isRateLimited = error.status === 429;
                const isServerError = error.status >= 500;

                console.warn(`OpenAI API attempt ${attempt}/${maxRetries} failed${context ? ` for ${context}` : ''}:`, error.message);

                if (isLastAttempt) {
                    throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
                }

                // Only retry on timeout, rate limiting, or server errors
                if (isTimeout || isRateLimited || isServerError) {
                    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
                    console.log(`Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    // Don't retry on client errors (400-499 except 429)
                    throw error;
                }
            }
        }
    }

    async callOpenAI(apiKey, chapterText) {
        const payload = {
            model: 'gpt-5-nano',
            reasoning_effort: 'minimal',
            messages: [
                {
                    role: 'user',
                    content: `Please provide a well-structured summary of the following chapter. Use only these markdown formats:
- Use ## for main headings
- Use ### for subheadings
- Use **bold text** for emphasis
- Use *italic text* for secondary emphasis
- Use - for bullet points (can be nested with 2-space indentation)
- Use 1. 2. 3. for numbered lists (can be nested with 2-space indentation)
- Use regular paragraphs

Examples of proper list formatting:
- Main point
  - Sub-point
  - Another sub-point
- Another main point

1. First item
  1. Nested numbered item
  2. Another nested item
2. Second item

Do not use code blocks, tables, links, or other markdown formatting. Keep it simple and well-structured.

Chapter content:\n\n${chapterText}`
                }
            ],
            max_completion_tokens: 2000
        };

        return await this.callOpenAIWithRetry(apiKey, payload, 'chapter summary');
    }

    async summarizeBook() {
        if (!this.book) return;

        // Get API key from user
        const apiKey = await this.getOpenAIApiKey();
        if (!apiKey) return;

        // Hide any existing summaries
        this.bookSummaryContainer.style.display = 'none';

        // Show progress and disable button
        this.summaryProgress.style.display = 'block';
        this.summarizeBookBtn.disabled = true;
        this.progressText.textContent = 'Starting book summarization...';
        this.progressFill.style.width = '0%';

        try {
            // Get all chapters from the book
            const navigation = await this.book.loaded.navigation;
            const chapters = navigation.toc;

            if (!chapters || chapters.length === 0) {
                throw new Error('No chapters found in the book');
            }

            const chapterSummaries = [];
            let processed = 0;

            // Process each chapter
            for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];

                // Update progress
                const progress = (processed / chapters.length) * 50; // First 50% for chapter summaries
                this.progressFill.style.width = `${progress}%`;
                this.progressText.textContent = `Summarizing chapter ${i + 1} of ${chapters.length}: ${chapter.label}`;

                try {
                    // Load chapter content
                    const section = this.book.spine.get(chapter.href);
                    const contents = await section.load(this.book.load.bind(this.book));

                    // Get text content
                    const serializer = new XMLSerializer();
                    const htmlString = serializer.serializeToString(contents);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlString;

                    // Remove scripts and links for security
                    tempDiv.querySelectorAll('script, link').forEach(el => el.remove());

                    const chapterText = tempDiv.innerText || tempDiv.textContent;

                    if (chapterText.trim()) {
                        // Summarize the chapter with retry handling
                        const summary = await this.callOpenAIForChapterWithRetryDisplay(apiKey, chapterText, chapter.label, i + 1, chapters.length);
                        chapterSummaries.push({
                            title: chapter.label,
                            summary: summary
                        });
                    }
                } catch (error) {
                    console.error(`Error processing chapter ${chapter.label}:`, error);
                    chapterSummaries.push({
                        title: chapter.label,
                        summary: `Error processing chapter: ${error.message}`
                    });
                }

                processed++;
            }

            // Update progress for final summarization
            this.progressFill.style.width = '75%';
            this.progressText.textContent = 'Creating final book summary...';

            // Create final book summary from chapter summaries
            const combinedSummaries = chapterSummaries
                .map(ch => `**${ch.title}**\n${ch.summary}`)
                .join('\n\n');

            const bookSummary = await this.callOpenAIForBookSummaryWithRetryDisplay(apiKey, combinedSummaries);

            // Complete progress
            this.progressFill.style.width = '100%';
            this.progressText.textContent = 'Book summarization complete!';

            // Hide progress and show summary
            setTimeout(() => {
                this.summaryProgress.style.display = 'none';
                this.bookSummaryContent.innerHTML = this.formatSummary(bookSummary);
                this.bookSummaryContainer.style.display = 'block';
            }, 1000);

        } catch (error) {
            console.error('Error summarizing book:', error);
            this.progressText.textContent = `Error: ${error.message}`;
            setTimeout(() => {
                this.summaryProgress.style.display = 'none';
            }, 3000);
        } finally {
            this.summarizeBookBtn.disabled = false;
        }
    }

    async callOpenAIForChapter(apiKey, chapterText, chapterTitle) {
        const payload = {
            model: 'gpt-5-nano',
            reasoning_effort: 'minimal',
            messages: [
                {
                    role: 'user',
                    content: `Please provide a concise summary of this chapter titled "${chapterTitle}". Keep the summary brief but comprehensive, focusing on key events, character developments, and important plot points.

You may use:
- **bold text** for emphasis
- *italic text* for secondary emphasis
- - for bullet points (can be nested with 2-space indentation)
- 1. 2. 3. for numbered lists (can be nested with 2-space indentation)
- Regular paragraphs

Examples of proper list formatting:
- Main point
  - Sub-point
- Another main point

Keep it well-structured but concise.

Chapter content:\n\n${chapterText}`
                }
            ],
            max_completion_tokens: 400
        };

        return await this.callOpenAIWithRetry(apiKey, payload, `chapter "${chapterTitle}"`);
    }

    async callOpenAIForChapterWithRetryDisplay(apiKey, chapterText, chapterTitle, chapterNum, totalChapters) {
        const payload = {
            model: 'gpt-5-nano',
            reasoning_effort: 'minimal',
            messages: [
                {
                    role: 'user',
                    content: `Please provide a concise summary of this chapter titled "${chapterTitle}". Keep the summary brief but comprehensive, focusing on key events, character developments, and important plot points.

You may use:
- **bold text** for emphasis
- *italic text* for secondary emphasis
- - for bullet points (can be nested with 2-space indentation)
- 1. 2. 3. for numbered lists (can be nested with 2-space indentation)
- Regular paragraphs

Examples of proper list formatting:
- Main point
  - Sub-point
- Another main point

Keep it well-structured but concise.

Chapter content:\n\n${chapterText}`
                }
            ],
            max_completion_tokens: 400
        };

        return await this.callOpenAIWithRetryAndProgress(apiKey, payload, `chapter "${chapterTitle}"`, chapterNum, totalChapters);
    }

    async callOpenAIWithRetryAndProgress(apiKey, payload, context = '', chapterNum = null, totalChapters = null, maxRetries = 3) {
        const baseDelay = 2000; // 2 seconds
        const timeout = 30000; // 30 seconds timeout

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Update progress text to show retry attempt if needed
                if (attempt > 1 && chapterNum && totalChapters) {
                    this.progressText.textContent = `Summarizing chapter ${chapterNum} of ${totalChapters} (attempt ${attempt}/${maxRetries}): ${context}`;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0]?.message?.content || 'No content generated.';
                }

                // Handle HTTP errors
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
                error.status = response.status;
                throw error;

            } catch (error) {
                const isLastAttempt = attempt === maxRetries;
                const isTimeout = error.name === 'AbortError';
                const isRateLimited = error.status === 429;
                const isServerError = error.status >= 500;

                console.warn(`OpenAI API attempt ${attempt}/${maxRetries} failed${context ? ` for ${context}` : ''}:`, error.message);

                if (isLastAttempt) {
                    throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
                }

                // Only retry on timeout, rate limiting, or server errors
                if (isTimeout || isRateLimited || isServerError) {
                    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s

                    // Update progress text to show retry delay
                    if (chapterNum && totalChapters) {
                        this.progressText.textContent = `Retrying chapter ${chapterNum} of ${totalChapters} in ${delay/1000}s (attempt ${attempt + 1}/${maxRetries})...`;
                    }

                    console.log(`Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    // Don't retry on client errors (400-499 except 429)
                    throw error;
                }
            }
        }
    }

    async callOpenAIForBookSummary(apiKey, combinedSummaries) {
        const payload = {
            model: 'gpt-5-nano',
            reasoning_effort: 'minimal',
            messages: [
                {
                    role: 'user',
                    content: `Based on these individual chapter summaries, please create a comprehensive summary of the entire book. Focus on the overall narrative arc, main themes, character development throughout the story, and key conclusions. Use these markdown formats:
- Use ## for main headings
- Use ### for subheadings
- Use **bold text** for emphasis
- Use *italic text* for secondary emphasis
- Use - for bullet points (can be nested with 2-space indentation)
- Use 1. 2. 3. for numbered lists (can be nested with 2-space indentation)
- Use regular paragraphs

Examples of proper list formatting:
- Main theme
  - Supporting evidence
  - Character examples
- Another theme

1. Plot arc overview
  1. Beginning setup
  2. Middle development
  3. Conclusion resolution
2. Character development

Keep it well-structured and comprehensive but concise.

Chapter summaries:\n\n${combinedSummaries}`
                }
            ],
            max_completion_tokens: 2500
        };

        return await this.callOpenAIWithRetry(apiKey, payload, 'final book summary');
    }

    async callOpenAIForBookSummaryWithRetryDisplay(apiKey, combinedSummaries) {
        const payload = {
            model: 'gpt-5-nano',
            reasoning_effort: 'minimal',
            messages: [
                {
                    role: 'user',
                    content: `Based on these individual chapter summaries, please create a comprehensive summary of the entire book. Focus on the overall narrative arc, main themes, character development throughout the story, and key conclusions. Use these markdown formats:
- Use ## for main headings
- Use ### for subheadings
- Use **bold text** for emphasis
- Use *italic text* for secondary emphasis
- Use - for bullet points (can be nested with 2-space indentation)
- Use 1. 2. 3. for numbered lists (can be nested with 2-space indentation)
- Use regular paragraphs

Examples of proper list formatting:
- Main theme
  - Supporting evidence
  - Character examples
- Another theme

1. Plot arc overview
  1. Beginning setup
  2. Middle development
  3. Conclusion resolution
2. Character development

Keep it well-structured and comprehensive but concise.

Chapter summaries:\n\n${combinedSummaries}`
                }
            ],
            max_completion_tokens: 2500
        };

        const baseDelay = 2000; // 2 seconds
        const timeout = 45000; // 45 seconds timeout for final summary (longer than chapters)
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Update progress text to show retry attempt if needed
                if (attempt > 1) {
                    this.progressText.textContent = `Creating final book summary (attempt ${attempt}/${maxRetries})...`;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0]?.message?.content || 'No book summary generated.';
                }

                // Handle HTTP errors
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
                error.status = response.status;
                throw error;

            } catch (error) {
                const isLastAttempt = attempt === maxRetries;
                const isTimeout = error.name === 'AbortError';
                const isRateLimited = error.status === 429;
                const isServerError = error.status >= 500;

                console.warn(`OpenAI API attempt ${attempt}/${maxRetries} failed for final book summary:`, error.message);

                if (isLastAttempt) {
                    throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
                }

                // Only retry on timeout, rate limiting, or server errors
                if (isTimeout || isRateLimited || isServerError) {
                    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s

                    // Update progress text to show retry delay
                    this.progressText.textContent = `Retrying final book summary in ${delay/1000}s (attempt ${attempt + 1}/${maxRetries})...`;

                    console.log(`Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    // Don't retry on client errors (400-499 except 429)
                    throw error;
                }
            }
        }
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
