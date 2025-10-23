# Book Editor - Continue Editing Feature

## Overview

Added the ability to return to editing existing book projects from the Profile page. Users can now click "Edit Book" on minted book content to continue working on their books, add new chapters, and publish them.

## What Was Implemented

### Backend Changes

#### 1. New API View (`backend/rb_core/views.py`)
- **BookProjectByContentView**: GET endpoint to retrieve a book project by its published content ID
  - Searches for projects where `published_content_id` matches
  - Also checks if any chapter published that content
  - Returns the full book project with all chapters

#### 2. URL Route (`backend/rb_core/urls.py`)
- Added `/api/book-projects/by-content/<int:content_id>/` route
- Maps to `BookProjectByContentView`

### Frontend Changes

#### 1. API Service (`frontend/src/services/bookApi.ts`)
- **getProjectByContentId()**: New function to fetch book project by content ID
- Used when loading existing projects for editing

#### 2. BookEditor Component (`frontend/src/components/BookEditor/BookEditor.tsx`)
- Added `existingContentId` prop (optional)
- Updated `initializeProject()` to:
  - Load existing project if `existingContentId` is provided
  - Create new project if no `existingContentId`
  - Auto-select first unminted chapter when loading existing project
- Added loading state while fetching project data

#### 3. ChapterList Component (`frontend/src/components/BookEditor/ChapterList.tsx`)
- Added visual "Minted" badge for published chapters
- Greyed out minted chapters (lower opacity)
- Different background color for minted chapters

#### 4. ChapterEditor Component (`frontend/src/components/BookEditor/ChapterEditor.tsx`)
- Made minted chapters **read-only**:
  - Title input disabled
  - ReactQuill editor set to `readOnly={true}`
  - Toolbar hidden for minted chapters
  - Visual indicator: "This chapter has been minted and is read-only"
- Prevented auto-save for minted chapters

#### 5. ProfilePage (`frontend/src/pages/ProfilePage.tsx`)
- Added "Edit Book" button for book content in Inventory section
- Button appears only for `content_type === 'book'`
- Clicking navigates to `/studio?editContent=${contentId}`
- Updated grid layout to accommodate button (3 columns: thumbnail, info, button)

#### 6. StudioPage (`frontend/src/pages/StudioPage.tsx`)
- Reads `editContent` query parameter from URL
- If present, shows `BookEditor` with `existingContentId` instead of `CreateWizard`
- After publishing new chapter, stays in edit mode
- "Back" button clears query param and returns to normal studio

## User Flow

### Continuing an Existing Book

1. User goes to Profile page
2. In "Inventory (Minted)" section, finds a book they've published
3. Clicks "Edit Book" button
4. Navigates to `/studio?editContent=<id>`
5. StudioPage detects query param and shows BookEditor
6. BookEditor loads the existing project via API
7. User sees:
   - All existing chapters (minted ones are greyed out and read-only)
   - First unminted chapter is auto-selected (or first chapter if all minted)
   - Can add new chapters
   - Can edit unminted chapters
   - Cannot edit minted chapters
8. User adds new chapter, writes content (auto-saves)
9. User clicks "Publish" → PublishModal opens
10. User chooses "Publish This Chapter" or "Publish Entire Book"
11. After publishing, stays in edit mode to continue working

### Visual Indicators

- **Minted Chapters**:
  - Green "MINTED" badge in chapter list
  - Greyed out appearance (60% opacity)
  - Read-only banner in editor: "✓ This chapter has been minted and is read-only"
  - Disabled title input
  - No toolbar in editor
  - "Minted" status instead of "Saving..." or "Saved"

- **Unminted Chapters**:
  - Normal appearance
  - Editable title and content
  - Auto-save functionality active
  - Full editor toolbar available

## Technical Details

### Data Flow

1. **Profile → Studio**:
   - User clicks "Edit Book" on content with `id=69`
   - Navigate to `/studio?editContent=69`

2. **Studio → BookEditor**:
   - StudioPage reads `editContent=69` from URL
   - Passes `existingContentId={69}` to BookEditor

3. **BookEditor → API**:
   - Calls `bookApi.getProjectByContentId(69)`
   - Backend finds BookProject linked to content 69
   - Returns project with all chapters (including `is_published` status)

4. **BookEditor → UI**:
   - Loads chapters into state
   - Selects first unminted chapter
   - Renders ChapterList and ChapterEditor
   - ChapterEditor checks `chapter.is_published` to enable/disable editing

### Security

- Only creator can access their own book projects (enforced in backend)
- CSRF protection on all API endpoints
- User authentication required

## Testing Checklist

✅ Click "Edit Book" on a book in Profile → navigates to Studio with book editor
✅ Existing chapters load correctly
✅ Minted chapters show "Minted" badge and are read-only
✅ Can add new chapters to existing book
✅ Can edit unminted chapters (auto-save works)
✅ Cannot edit minted chapters (inputs disabled)
✅ Can publish new chapters
✅ After publishing, stays in edit mode
✅ "Back" button returns to normal studio

## Files Modified

### Backend
- `backend/rb_core/views.py` - Added BookProjectByContentView
- `backend/rb_core/urls.py` - Added route for by-content lookup

### Frontend
- `frontend/src/services/bookApi.ts` - Added getProjectByContentId()
- `frontend/src/components/BookEditor/BookEditor.tsx` - Added existingContentId prop and loading logic
- `frontend/src/components/BookEditor/ChapterList.tsx` - Added minted visual indicators
- `frontend/src/components/BookEditor/ChapterEditor.tsx` - Made minted chapters read-only
- `frontend/src/pages/ProfilePage.tsx` - Added "Edit Book" button
- `frontend/src/pages/StudioPage.tsx` - Added query param handling for edit mode

## Status

✅ **Feature Complete and Ready for Testing**

Both backend and frontend servers are running. The feature is fully functional and ready to use.

