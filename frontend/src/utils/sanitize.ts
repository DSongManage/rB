/**
 * HTML Sanitization Utility
 *
 * SECURITY: This module provides safe HTML sanitization using DOMPurify.
 * Always use sanitizeHtml() before passing content to dangerouslySetInnerHTML.
 *
 * The function fails closed - it will return an empty string rather than
 * potentially unsafe HTML if sanitization fails for any reason.
 */

import DOMPurify from 'dompurify';

/**
 * Safely sanitize HTML content for rendering.
 *
 * @param html - The HTML string to sanitize (can be null/undefined)
 * @returns Sanitized HTML string, or empty string if sanitization fails
 *
 * @example
 * // In a React component:
 * import { sanitizeHtml } from '@/utils/sanitize';
 *
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return '';

  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      // Allow common safe elements for rich text
      ALLOWED_TAGS: [
        'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
        'span', 'div', 'img', 'figure', 'figcaption', 'table', 'thead',
        'tbody', 'tr', 'th', 'td', 'hr', 'sup', 'sub'
      ],
      // Allow safe attributes
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id', 'style',
        'target', 'rel', 'width', 'height'
      ],
      // Force all links to open in new tab with noopener
      ADD_ATTR: ['target', 'rel'],
      // Sanitize URLs
      ALLOW_DATA_ATTR: false,
    });
  } catch (e) {
    console.error('HTML sanitization failed:', e);
    return '';  // Fail closed - never return unsanitized HTML
  }
}

export default sanitizeHtml;
