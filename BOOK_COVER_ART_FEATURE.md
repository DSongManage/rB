# Book Cover Art Feature

## Overview
Added the ability to upload cover art for book projects. The cover image is automatically used as the thumbnail/teaser image for all published chapters and the complete book.

## Changes Made

### Backend

#### 1. Model Update (`backend/rb_core/models.py`)
Added `cover_image` field to `BookProject` model:
```python
cover_image = models.ImageField(upload_to='book_covers/', null=True, blank=True)
```

**Migration**: `0017_bookproject_cover_image.py` (created and applied)

#### 2. Serializer Update (`backend/rb_core/serializers.py`)
Updated `BookProjectSerializer` to include cover image fields:
- Added `cover_image` field (for upload)
- Added `cover_image_url` computed field (for display with absolute URL)
- Added `get_cover_image_url()` method to build absolute URLs

#### 3. View Updates (`backend/rb_core/views.py`)
Updated publish views to use cover image:

**PublishChapterView**:
- When publishing a chapter, if `book_project.cover_image` exists, use it as `Content.teaser_link`
- Otherwise, fallback to the default teaser link

**PublishBookView**:
- When publishing the complete book, if `project.cover_image` exists, use it as `Content.teaser_link`
- Otherwise, fallback to the default teaser link

### Frontend

#### 4. TypeScript Interface (`frontend/src/services/bookApi.ts`)
Updated `BookProject` interface:
```typescript
export interface BookProject {
  // ... existing fields
  cover_image?: string | null;
  cover_image_url?: string | null;
  // ...
}
```

#### 5. API Service (`frontend/src/services/bookApi.ts`)
Added `uploadCoverImage()` function:
```typescript
async uploadCoverImage(id: number, imageFile: File): Promise<BookProject>
```
- Uses `FormData` to upload the image file
- Sends PATCH request to `/api/book-projects/{id}/`
- Returns updated project with new cover image URL

#### 6. BookEditor Component (`frontend/src/components/BookEditor/BookEditor.tsx`)
Added cover image upload UI:
- **Preview Section**: Shows current cover image or placeholder (120x160px)
- **Upload Button**: Styled file input for selecting images
- **Description**: Explains that the cover will be used for all published content
- **Handler**: `handleCoverImageUpload()` function to upload and update project

**UI Location**: Between error message and chapter list/editor sections

## User Flow

1. User creates or edits a book project
2. User sees "Book Cover Image" section with preview and upload button
3. User clicks "Upload Cover Image" and selects an image file
4. Image is uploaded to `/media/book_covers/` on the server
5. Preview updates to show the new cover image
6. When user publishes a chapter or the complete book:
   - The cover image is automatically used as the content thumbnail
   - Displayed on home page, search results, profile page, etc.

## Technical Details

### File Storage
- Images stored in `/media/book_covers/` directory
- Django's `ImageField` handles file validation and storage
- Absolute URLs generated via `request.build_absolute_uri()`

### Image Display
- Cover image used as `Content.teaser_link` when publishing
- Falls back to default teaser link if no cover image exists
- Supports all standard image formats (JPEG, PNG, GIF, WebP)

### API Endpoints
- **Upload**: `PATCH /api/book-projects/{id}/` with `FormData` containing `cover_image`
- **Retrieve**: Cover image URL included in all book project responses via `cover_image_url` field

## Benefits

1. **Consistent Branding**: All chapters from the same book share the same cover art
2. **Professional Appearance**: Books have recognizable thumbnails on the platform
3. **Easy Management**: Upload once, used everywhere
4. **Flexible**: Can update cover image at any time
5. **Automatic**: No need to manually set cover for each chapter

## Testing Checklist

- [x] Create new book project
- [x] Upload cover image (verify preview updates)
- [x] Publish a chapter (verify cover appears as thumbnail)
- [x] Publish complete book (verify cover appears as thumbnail)
- [x] Edit existing book and change cover (verify updates)
- [x] Publish without cover (verify fallback works)
- [x] View published content on home page (verify cover displays)

## Files Modified

- `backend/rb_core/models.py` - Added `cover_image` field to `BookProject`
- `backend/rb_core/serializers.py` - Added cover image fields to serializer
- `backend/rb_core/views.py` - Updated publish views to use cover image
- `backend/rb_core/migrations/0017_bookproject_cover_image.py` - Database migration
- `frontend/src/services/bookApi.ts` - Added `uploadCoverImage()` function
- `frontend/src/components/BookEditor/BookEditor.tsx` - Added cover image upload UI

## Status
✅ **COMPLETE** - Book cover art feature fully implemented and ready to use!

