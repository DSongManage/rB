# Book Editor Chapter Addition & Deletion Fix

## Issue
When clicking "Add Chapter" in the book editor, the system threw a `UNIQUE constraint failed: rb_core_chapter.book_project_id, rb_core_chapter.order` error. Additionally, minted chapters could be deleted, which should not be allowed.

## Root Cause
1. **Chapter Order Conflict**: 
   - **Primary Issue**: Python's falsy evaluation bug in order calculation: `(max_order or -1) + 1`
   - When `max_order=0` (first chapter exists), `0 or -1` evaluates to `-1`, so next order = `(-1) + 1 = 0` (duplicate!)
   - **Secondary Issue**: The `ChapterSerializer` had `order` as a writable field, allowing request data to override backend calculations
2. **Minted Chapter Deletion**: There was no check to prevent deletion of published/minted chapters.

## Solution

### Backend Changes

#### 1. Fixed Chapter Order Assignment (`backend/rb_core/serializers.py`)
```python
class ChapterSerializer(serializers.ModelSerializer):
    """Serializer for individual book chapters."""
    class Meta:
        model = Chapter
        fields = ['id', 'title', 'content_html', 'order', 'created_at', 'updated_at', 'is_published']
        read_only_fields = ['created_at', 'updated_at', 'is_published', 'order']  # Added 'order' here
```

**Key Changes**:
- Added `order` to `read_only_fields` in `ChapterSerializer`
- This prevents the serializer from accepting `order` from request data
- The backend always controls the order assignment in the view

#### 2. Fixed Order Calculation Logic (`backend/rb_core/views.py`)
```python
def post(self, request, project_id):
    core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
    try:
        project = BookProject.objects.get(pk=project_id, creator=core_user)
    except BookProject.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Auto-assign order as the next available number
    max_order = project.chapters.aggregate(models.Max('order'))['order__max']
    order = (max_order + 1) if max_order is not None else 0  # ← FIXED: explicit None check
    
    serializer = ChapterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(book_project=project, order=order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

**Key Changes**:
- **CRITICAL FIX**: Changed `(max_order or -1) + 1` to `(max_order + 1) if max_order is not None else 0`
- This prevents Python's falsy evaluation from treating `0` as `False`
- Now correctly calculates: `0 → 1`, `1 → 2`, etc.
- When no chapters exist (`None`), starts at `0`

#### 3. Prevented Minted Chapter Deletion (`backend/rb_core/views.py`)
```python
def delete(self, request, pk):
    chapter = self.get_object(pk, request.user)
    if not chapter:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    if chapter.is_published:
        return Response({'error': 'Cannot delete a minted chapter'}, status=status.HTTP_400_BAD_REQUEST)
    chapter.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
```

**Key Changes**:
- Added check for `chapter.is_published` before deletion
- Returns 400 error with clear message if attempting to delete a minted chapter

### Frontend Changes (`frontend/src/components/BookEditor/BookEditor.tsx`)

#### Disabled Delete Button for Minted Chapters
```typescript
{selectedChapterId && selectedChapter && (
  <button
    onClick={() => handleDeleteChapter(selectedChapterId)}
    disabled={selectedChapter.is_published}
    style={{
      background: 'transparent',
      border: selectedChapter.is_published ? '1px solid #6b7280' : '1px solid #ef4444',
      borderRadius: 8,
      padding: '8px 16px',
      color: selectedChapter.is_published ? '#6b7280' : '#ef4444',
      fontWeight: 600,
      cursor: selectedChapter.is_published ? 'not-allowed' : 'pointer',
      fontSize: 14,
      opacity: selectedChapter.is_published ? 0.5 : 1,
    }}
    title={selectedChapter.is_published ? 'Cannot delete a minted chapter' : 'Delete this chapter'}
  >
    Delete Chapter
  </button>
)}
```

**Key Changes**:
- Button is disabled when `selectedChapter.is_published` is true
- Visual styling changes (grayed out, reduced opacity)
- Cursor changes to `not-allowed`
- Tooltip explains why button is disabled

## Testing
1. ✅ Navigate to Profile page and click "Edit Book" on a book content item
2. ✅ Click "Add Chapter" - should successfully create a new chapter without errors
3. ✅ Select a minted chapter - delete button should be disabled and grayed out
4. ✅ Select an unminted chapter - delete button should be enabled and functional
5. ✅ Attempt to delete a minted chapter via API - should return 400 error

## Files Modified
- `backend/rb_core/serializers.py` - Made `order` field read-only in `ChapterSerializer`
- `backend/rb_core/views.py` - Simplified chapter creation logic and added minted chapter deletion prevention
- `frontend/src/components/BookEditor/BookEditor.tsx` - Disabled delete button UI for minted chapters

## Status
✅ **FIXED** - Users can now add chapters without constraint errors, and minted chapters are protected from deletion.

