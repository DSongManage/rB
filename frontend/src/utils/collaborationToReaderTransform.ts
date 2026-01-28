/**
 * Transform Collaboration Data to Reader Format
 *
 * Converts the editor's ComicPage/ComicPanel/SpeechBubble/DividerLine types
 * to the reader's ComicPageData/ComicPanelData/SpeechBubbleData/DividerLineData types.
 *
 * The structures are nearly identical - we mainly drop editor-specific fields
 * like timestamps, project/issue references, and script data.
 */

import {
  ComicPage,
  ComicPanel,
  SpeechBubble,
  DividerLine,
  CollaborativeProject,
} from '../services/collaborationApi';

import {
  ComicReaderData,
  ComicPageData,
  ComicPanelData,
  SpeechBubbleData,
  DividerLineData,
} from '../services/libraryApi';

/**
 * Transform a SpeechBubble (editor format) to SpeechBubbleData (reader format)
 */
export function transformSpeechBubble(bubble: SpeechBubble): SpeechBubbleData {
  return {
    id: bubble.id,
    bubble_type: bubble.bubble_type,
    x_percent: bubble.x_percent,
    y_percent: bubble.y_percent,
    width_percent: bubble.width_percent,
    height_percent: bubble.height_percent,
    z_index: bubble.z_index,
    text: bubble.text,
    font_family: bubble.font_family,
    font_size: bubble.font_size,
    font_color: bubble.font_color,
    font_weight: bubble.font_weight,
    font_style: bubble.font_style,
    text_align: bubble.text_align,
    background_color: bubble.background_color,
    border_color: bubble.border_color,
    border_width: bubble.border_width,
    pointer_direction: bubble.pointer_direction,
    pointer_position: bubble.pointer_position,
    order: bubble.order,
  };
}

/**
 * Transform a DividerLine (editor format) to DividerLineData (reader format)
 */
export function transformDividerLine(line: DividerLine): DividerLineData {
  return {
    id: line.id,
    line_type: line.line_type,
    start_x: line.start_x,
    start_y: line.start_y,
    end_x: line.end_x,
    end_y: line.end_y,
    control1_x: line.control1_x ?? undefined,
    control1_y: line.control1_y ?? undefined,
    control2_x: line.control2_x ?? undefined,
    control2_y: line.control2_y ?? undefined,
    thickness: line.thickness ?? 2,
    color: line.color ?? '#000000',
    order: line.order,
  };
}

/**
 * Transform a ComicPanel (editor format) to ComicPanelData (reader format)
 */
export function transformComicPanel(panel: ComicPanel): ComicPanelData {
  return {
    id: panel.id,
    x_percent: panel.x_percent,
    y_percent: panel.y_percent,
    width_percent: panel.width_percent,
    height_percent: panel.height_percent,
    z_index: panel.z_index,
    border_style: panel.border_style,
    border_width: panel.border_width,
    border_color: panel.border_color,
    border_radius: panel.border_radius,
    background_color: panel.background_color,
    rotation: panel.rotation,
    skew_x: panel.skew_x,
    skew_y: panel.skew_y,
    artwork: panel.artwork,
    artwork_fit: panel.artwork_fit,
    order: panel.order,
    speech_bubbles: panel.speech_bubbles.map(transformSpeechBubble),
  };
}

/**
 * Transform a ComicPage (editor format) to ComicPageData (reader format)
 */
export function transformComicPage(page: ComicPage): ComicPageData {
  return {
    id: page.id,
    page_number: page.page_number,
    page_format: page.page_format,
    canvas_width: page.canvas_width,
    canvas_height: page.canvas_height,
    background_image: page.background_image,
    background_color: page.background_color,
    panels: page.panels.map(transformComicPanel),
    divider_lines: page.divider_lines.map(transformDividerLine),
    // Include line-based layout fields for the renderer
    orientation: page.orientation,
    gutter_mode: page.gutter_mode ? 'on' : 'off',
    default_gutter_width: page.default_gutter_width,
    default_line_color: page.default_line_color,
    layout_version: page.layout_version,
  };
}

/**
 * Transform collaboration project pages to ComicReaderData format
 *
 * @param project - The collaborative project
 * @param pages - Array of comic pages from the editor
 * @returns ComicReaderData suitable for the reader component
 */
export function transformToReaderData(
  project: CollaborativeProject,
  pages: ComicPage[]
): ComicReaderData {
  // Sort pages by page_number to ensure correct order
  const sortedPages = [...pages].sort((a, b) => a.page_number - b.page_number);

  return {
    content_id: project.id,
    title: project.title,
    creator: project.created_by_username,
    total_pages: sortedPages.length,
    pages: sortedPages.map(transformComicPage),
  };
}

/**
 * Get the reading direction from a project
 */
export function getReadingDirection(project: CollaborativeProject): 'ltr' | 'rtl' {
  return project.reading_direction || 'ltr';
}

/**
 * Check if reading direction is RTL (manga-style)
 */
export function isRTLReading(project: CollaborativeProject): boolean {
  return getReadingDirection(project) === 'rtl';
}
