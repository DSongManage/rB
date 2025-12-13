import { Chapter } from '../types/reader';

/**
 * Parse HTML content to detect chapter headings (h1, h2, h3)
 * and create a table of contents structure.
 */
export function detectChapters(htmlContent: string): Chapter[] {
  const chapters: Chapter[] = [];

  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Find all heading elements
  const headings = doc.querySelectorAll('h1, h2, h3');

  headings.forEach((heading, index) => {
    const tagName = heading.tagName.toLowerCase();
    const level = parseInt(tagName.charAt(1), 10);
    const title = heading.textContent?.trim() || `Chapter ${index + 1}`;

    // Generate an ID if not present
    const elementId = heading.id || `chapter-${index + 1}`;

    // Add ID to the heading if not present (for navigation)
    if (!heading.id) {
      heading.id = elementId;
    }

    chapters.push({
      id: elementId,
      title,
      level,
      pageIndex: 0, // Will be updated after pagination
      elementId,
    });
  });

  return chapters;
}

/**
 * Update chapter page indices after pagination is calculated.
 * Call this after the content is rendered and pagination is ready.
 */
export function updateChapterPageIndices(
  chapters: Chapter[],
  contentElement: HTMLElement
): Chapter[] {
  const containerWidth = contentElement.clientWidth;

  if (containerWidth === 0) return chapters;

  return chapters.map((chapter) => {
    const element = contentElement.querySelector(`#${CSS.escape(chapter.elementId || chapter.id)}`);

    if (element) {
      // Get the element's position relative to the scrollable container
      const elementRect = element.getBoundingClientRect();
      const containerRect = contentElement.getBoundingClientRect();
      const elementLeft = elementRect.left - containerRect.left + contentElement.scrollLeft;

      // Calculate which page this element is on
      const pageIndex = Math.floor(elementLeft / containerWidth);

      return {
        ...chapter,
        pageIndex,
      };
    }

    return chapter;
  });
}

/**
 * Find the current chapter based on the current page.
 */
export function getCurrentChapter(
  chapters: Chapter[],
  currentPage: number
): Chapter | null {
  if (chapters.length === 0) return null;

  // Find the last chapter that starts at or before the current page
  let currentChapter: Chapter | null = null;

  for (const chapter of chapters) {
    if (chapter.pageIndex <= currentPage) {
      currentChapter = chapter;
    } else {
      break;
    }
  }

  return currentChapter;
}

/**
 * Inject IDs into HTML content for chapters without IDs.
 * Returns modified HTML string with IDs added to headings.
 */
export function injectChapterIds(htmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const headings = doc.querySelectorAll('h1, h2, h3');

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `chapter-${index + 1}`;
    }
  });

  return doc.body.innerHTML;
}
