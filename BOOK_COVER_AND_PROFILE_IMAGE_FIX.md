# Book Cover & Profile Image Upload Fixes

## Issues Fixed

### 1. Book Cover Not Displaying on Home Page
**Problem**: After uploading a book cover, it wasn't showing on the home page for already-published chapters.

**Root Cause**: The cover image was only applied to `Content.teaser_link` when **publishing new chapters**. Existing published chapters still had the old `teaser_link` value.

**Solution**: Updated `BookProjectDetailView.patch()` to automatically update all published chapters' `teaser_link` when a cover image is uploaded.

### 2. Profile Picture Upload Failing
**Problem**: Uploading profile pictures with long filenames caused error:
```
Storage can not find an available filename for "avatars/DALLE_2024-12-23_11_54VFmoS.36.15_-_A_sleek_and_minimalist_top-down_logo_design_for_renaissBlock..."
```

**Root Cause**: Django's `ImageField` has a default `max_length=100` for the filename, but some generated filenames (especially from AI tools like DALL-E) can be much longer.

**Solution**: Increased `max_length` to `255` for both `avatar_image` and `banner_image` fields.

## Changes Made

### Backend

#### 1. Model Update (`backend/rb_core/models.py`)
```python
# Before
avatar_image = models.ImageField(upload_to='avatars/', blank=True, null=True)
banner_image = models.ImageField(upload_to='banners/', blank=True, null=True)

# After
avatar_image = models.ImageField(upload_to='avatars/', blank=True, null=True, max_length=255)
banner_image = models.ImageField(upload_to='banners/', blank=True, null=True, max_length=255)
```

#### 2. View Update (`backend/rb_core/views.py`)
Updated `BookProjectDetailView.patch()` to cascade cover image updates:

```python
def patch(self, request, pk):
    project = self.get_object(pk, request.user)
    if not project:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if cover_image is being updated
    cover_image_updated = 'cover_image' in request.FILES
    
    serializer = BookProjectSerializer(project, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        updated_project = serializer.save()
        
        # If cover image was updated, update all published chapters' teaser_link
        if cover_image_updated and updated_project.cover_image:
            published_chapters = updated_project.chapters.filter(is_published=True)
            for chapter in published_chapters:
                if chapter.published_content:
                    chapter.published_content.teaser_link = updated_project.cover_image.url
                    chapter.published_content.save(update_fields=['teaser_link'])
            
            # Also update the book's published content if it exists
            if updated_project.published_content:
                updated_project.published_content.teaser_link = updated_project.cover_image.url
                updated_project.published_content.save(update_fields=['teaser_link'])
        
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

**Key Features**:
- Detects when `cover_image` is in the uploaded files
- Automatically updates `teaser_link` for all published chapters
- Also updates the book's published content (if the entire book was published)
- Uses `update_fields` for efficient database updates

#### 3. Migration (`backend/rb_core/migrations/0018_alter_userprofile_avatar_image_and_more.py`)
Created and applied migration to increase `max_length` for image fields.

## How It Works

### Book Cover Update Flow

1. **User uploads cover image** in book editor
2. **Frontend** sends PATCH request with `cover_image` file
3. **Backend** saves the new cover image to `BookProject`
4. **Backend** automatically updates all related `Content` records:
   - Finds all published chapters (`is_published=True`)
   - Updates their `published_content.teaser_link` to new cover URL
   - Updates book's `published_content.teaser_link` if book was published
5. **Home page** now displays the new cover for all published chapters

### Profile Picture Upload Flow

1. **User uploads profile picture** (even with long filename)
2. **Django** can now store filenames up to 255 characters
3. **Upload succeeds** and image is saved to `/media/avatars/`
4. **Profile page** displays the new avatar

## Benefits

### Book Cover
- ✅ **Retroactive Updates**: Existing published chapters automatically get the new cover
- ✅ **Consistency**: All chapters from the same book show the same cover
- ✅ **No Re-publishing**: No need to re-publish chapters to update their cover
- ✅ **Efficient**: Uses `update_fields` to minimize database writes

### Profile Images
- ✅ **Supports Long Filenames**: AI-generated images with descriptive names work fine
- ✅ **Future-Proof**: 255 characters is more than enough for any reasonable filename
- ✅ **No Data Loss**: Existing images continue to work normally

## Testing

### Book Cover
1. ✅ Create a book with multiple chapters
2. ✅ Publish a chapter (without cover)
3. ✅ Upload a cover image
4. ✅ Check home page → cover should now display
5. ✅ Publish another chapter → should use the new cover
6. ✅ Upload a different cover → all chapters update

### Profile Picture
1. ✅ Go to profile page
2. ✅ Upload an image with a very long filename (e.g., DALL-E generated)
3. ✅ Upload should succeed
4. ✅ Avatar should display correctly

## Files Modified

- `backend/rb_core/models.py` - Increased `max_length` for image fields
- `backend/rb_core/views.py` - Added cover image cascade update logic
- `backend/rb_core/migrations/0018_alter_userprofile_avatar_image_and_more.py` - Database migration

## Status
✅ **FIXED** - Both book cover display and profile picture upload now work perfectly!

