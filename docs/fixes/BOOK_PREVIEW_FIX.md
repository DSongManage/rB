# Book Preview Loading Fix

## Issue Summary
**Date**: October 24, 2025  
**User**: Learn1  
**Content**: "The First Book - Onto Dos" (Chapter 2)

### Problem
When clicking on Chapter 2 from the home page to view its teaser preview:
1. Preview modal showed "Loading preview..." indefinitely
2. When content finally appeared, it was binary gibberish (diamond symbols with question marks)
3. Page became unresponsive

### Root Cause

The issue occurred because Chapter 2 has a **cover image** set for the book:
- `teaser_link` = `/media/book_covers/3F7A1183.jpg` (image file)
- `content_type` = `'book'`
- `teaser_html` = (actual HTML content)

The `ContentDetail` page was passing `teaser_link` directly to `PreviewModal`, which:
1. Fetched the image file as text: `fetch('/media/book_covers/3F7A1183.jpg').then(r => r.text())`
2. Tried to display binary image data as HTML
3. Resulted in gibberish characters and browser hanging

### Why This Happened

When we added the book cover art feature, we updated the `teaser_link` to point to the cover image for display on the home page (as thumbnails). However, we didn't account for the fact that the `PreviewModal` uses `teaser_link` to **fetch the HTML content** for books.

**Conflicting Uses of `teaser_link`**:
- **Home Page/Thumbnails**: Needs image URL (cover art)
- **Preview Modal**: Needs HTML endpoint (`/api/content/:id/teaser/`)

## Fix Applied

Updated `ContentDetail.tsx` to distinguish between content types:

```typescript
// For books, always use the teaser API endpoint (not the cover image)
// For other types (art, film, music), use the teaser_link directly
const teaserUrl = data?.content_type === 'book' 
  ? `/api/content/${id}/teaser/` 
  : data?.teaser_link;
```

**Location**: `frontend/src/pages/ContentDetail.tsx` lines 15-19

### Logic
- **Books**: Always fetch from `/api/content/${id}/teaser/` (returns HTML)
- **Art/Film/Music**: Use `teaser_link` directly (for media preview)

## Verification

After the fix:
1. ✅ Chapter 1 preview: Works (was already working)
2. ✅ Chapter 2 preview: Now loads HTML correctly (no more gibberish)
3. ✅ Home page thumbnails: Still show cover art correctly
4. ✅ Preview modal: Fetches HTML from correct endpoint

## Technical Details

### Before Fix
```typescript
// ContentDetail.tsx (OLD)
<PreviewModal 
  teaserUrl={data?.teaser_link}  // ❌ Points to image file for Chapter 2
  contentType={data?.content_type}
/>
```

**Chapter 2 Data**:
- `teaser_link`: `/media/book_covers/3F7A1183.jpg`
- PreviewModal fetches: Image file as text → gibberish

### After Fix
```typescript
// ContentDetail.tsx (NEW)
const teaserUrl = data?.content_type === 'book' 
  ? `/api/content/${id}/teaser/`      // ✅ Always use API endpoint for books
  : data?.teaser_link;

<PreviewModal 
  teaserUrl={teaserUrl}
  contentType={data?.content_type}
/>
```

**Chapter 2 Data**:
- `teaserUrl`: `/api/content/70/teaser/`
- PreviewModal fetches: HTML content → displays correctly

## Backend Context

The `/api/content/:id/teaser/` endpoint (`ContentTeaserView`) in `backend/rb_core/views.py` returns the `teaser_html` field as an HTTP response:

```python
def get(self, request, pk):
    try:
        content = Content.objects.get(pk=pk)
        html = content.teaser_html or '<p>No preview available</p>'
        return HttpResponse(html, content_type='text/html')
    except Content.DoesNotExist:
        return HttpResponse('<p>Content not found</p>', status=404)
```

This endpoint always returns HTML, regardless of whether the content has a cover image.

## Future Considerations

### Option 1: Separate Fields (Current Approach)
- Keep `teaser_link` for thumbnails/cover art
- Use `/api/content/:id/teaser/` endpoint for HTML content
- Frontend checks `content_type` to decide which to use

### Option 2: Add `cover_image` Field to Content Model
- Add `cover_image` field to `Content` model (separate from `teaser_link`)
- Use `cover_image` for thumbnails
- Use `teaser_link` exclusively for preview endpoints
- More explicit, but requires migration and refactoring

**Current approach (Option 1) is simpler and works well.**

## Files Modified
1. **`frontend/src/pages/ContentDetail.tsx`** - Added content type check for teaserUrl
2. **`frontend/src/components/CreateWizard/ShareStep.tsx`** - Added same content type check for teaser preview in minting wizard

## Testing Checklist
- [x] Chapter 1 (no cover art): Preview loads correctly
- [x] Chapter 2 (with cover art): Preview loads correctly (no gibberish)
- [x] Home page: Both chapters show correct thumbnails
- [x] TEST1 content: Preview works
- [x] ShareStep (minting wizard): Preview loads correctly for books
- [ ] Test with art/film/music content types (when available)

## Additional Fix: ShareStep Preview

The same issue existed in the minting wizard's `ShareStep` component (line 14). When users clicked "Preview Teaser" after minting, it would try to fetch the cover image as HTML.

**Fix Applied** (`ShareStep.tsx` lines 15-18):
```typescript
// For books, use the teaser API endpoint (not the cover image)
const teaserUrl = d?.content_type === 'book' 
  ? `/api/content/${contentId}/teaser/` 
  : d?.teaser_link;
```

## Status
✅ **COMPLETE** - Book preview loading issue fixed in both ContentDetail and ShareStep, no more binary gibberish

