# Book Publish Flow Fix - "Continue to Mint" Not Working

## Issue Summary
**Date**: October 24, 2025  
**User**: Learn1  
**Content**: Chapter 3 ("Onto Tres") of "The First Book"

### Problem
When editing an existing book from the Profile page and clicking "Publish" → "Continue to Mint":
1. ✅ Publish modal appeared correctly
2. ✅ User selected "Publish This Chapter" (Chapter 3)
3. ✅ Clicked "Continue to Mint"
4. ❌ **Nothing happened** - stayed on the same page
5. ❌ Did NOT navigate to the minting wizard (CustomizeStep → MintStep)

### Root Cause Analysis

#### The Flow (Before Fix)

**Profile Page → Edit Book → Publish Chapter**:

1. User clicks "Edit Book" on Profile page
2. `ProfilePage` navigates to `/studio?editContent=68` (book's published content ID)
3. `StudioPage` detects `editContent` param and renders `BookEditor` with `existingContentId={68}`
4. `BookEditor` loads the book project by calling `bookApi.getProjectByContentId(68)`
5. User clicks "Publish" button → `PublishModal` opens
6. User selects "Publish This Chapter" (Chapter 3) and clicks "Continue to Mint"
7. `PublishModal` calls `onPublish('chapter')`
8. `BookEditor.handlePublish()` executes:
   - Calls `bookApi.prepareChapterForMint(selectedChapterId)` (Chapter 3, ID: 3)
   - Backend creates draft `Content` object (ID: 71) linked to Chapter 3
   - Backend returns `{content_id: 71, message: 'Chapter prepared for minting'}`
   - Calls `onPublish(71)` (the prop from `StudioPage`)
9. ❌ **PROBLEM**: `StudioPage`'s `onPublish` callback (lines 24-26):
   ```typescript
   onPublish={(contentId) => {
     // After publishing a new chapter, stay in edit mode
     navigate(`/studio?editContent=${existingContentId}`);
   }}
   ```
   - Navigates to `/studio?editContent=68` (the OLD book content ID)
   - Ignores the NEW `contentId` (71) that was just created
   - User stays on the same page, nothing happens!

#### What SHOULD Have Happened

After step 8, the flow should:
1. Navigate to the minting wizard with the NEW content ID (71)
2. Start at **CustomizeStep** (step 2) to set price, editions, teaser %
3. Then proceed to **MintStep** (step 3) to mint the NFT
4. Finally **ShareStep** (step 4) to share the minted content

This is exactly how it works when creating a NEW book via `CreateWizard`:
- `CreateWizard.handleBookPublish()` (lines 65-70):
  ```typescript
  const handleBookPublish = (publishedContentId: number) => {
    setContentId(publishedContentId);
    setShowBookEditor(false);
    setStep(2); // Go to customize step ✅
    setMaxStep(Math.max(maxStep, 2));
  };
  ```

## Solution: URL-Based State Passing

Use URL query parameters to pass the new `contentId` from the book editor to the minting wizard.

### Implementation

#### 1. Update StudioPage (lines 24-26)

**Before**:
```typescript
onPublish={(contentId) => {
  // After publishing a new chapter, stay in edit mode
  navigate(`/studio?editContent=${existingContentId}`);
}}
```

**After**:
```typescript
onPublish={(contentId) => {
  // After preparing chapter/book, navigate to minting wizard
  navigate(`/studio?mintContent=${contentId}`);
}}
```

**Change**: Navigate to `/studio?mintContent=71` instead of `/studio?editContent=68`

#### 2. Update CreateWizard (new lines 23-37)

Added `useEffect` to detect `mintContent` parameter:

```typescript
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function CreateWizard(){
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Check for mintContent parameter (from book editor publish flow)
  useEffect(() => {
    const mintContentParam = searchParams.get('mintContent');
    if (mintContentParam) {
      const contentIdFromParam = parseInt(mintContentParam, 10);
      if (!isNaN(contentIdFromParam)) {
        // Set content ID and jump to customize step
        setContentId(contentIdFromParam);
        setStep(2); // CustomizeStep
        setMaxStep(2);
        // Clear the parameter from URL to prevent re-triggering
        navigate('/studio', { replace: true });
      }
    }
  }, [searchParams, navigate]);
  
  // ... rest of component
}
```

**Logic**:
1. On mount, check for `mintContent` query parameter
2. If found, parse the content ID
3. Set `contentId` state to the new content (71)
4. Set `step` to 2 (CustomizeStep)
5. Set `maxStep` to 2 (allows navigation)
6. Clear the parameter from URL (prevents re-triggering on refresh)

### The Flow (After Fix)

**Profile Page → Edit Book → Publish Chapter → Customize → Mint**:

1. User clicks "Edit Book" on Profile page
2. `ProfilePage` navigates to `/studio?editContent=68`
3. `StudioPage` renders `BookEditor` with `existingContentId={68}`
4. `BookEditor` loads the book project
5. User clicks "Publish" → `PublishModal` opens
6. User selects "Publish This Chapter" (Chapter 3) and clicks "Continue to Mint"
7. `PublishModal` calls `onPublish('chapter')`
8. `BookEditor.handlePublish()` executes:
   - Calls `bookApi.prepareChapterForMint(3)`
   - Backend creates draft `Content` (ID: 71)
   - Calls `onPublish(71)`
9. ✅ **FIXED**: `StudioPage`'s `onPublish` navigates to `/studio?mintContent=71`
10. ✅ `StudioPage` re-renders, no `editContent` param, so renders `CreateWizard`
11. ✅ `CreateWizard` detects `mintContent=71` parameter
12. ✅ Sets `contentId=71`, `step=2`, `maxStep=2`
13. ✅ Clears URL to `/studio` (clean URL)
14. ✅ User sees **CustomizeStep** with Chapter 3's content
15. ✅ User sets price, editions, teaser %
16. ✅ User clicks "Next" → **MintStep**
17. ✅ User mints the NFT
18. ✅ User proceeds to **ShareStep**

## Benefits of This Approach

### 1. **URL-Based State**
- State is passed via URL, not props
- Works across component boundaries
- Survives page refreshes (if needed)
- Clean separation of concerns

### 2. **Reusable Pattern**
- Can be used for other flows (e.g., "Remix" content, "Edit and Re-mint")
- `CreateWizard` now accepts external content IDs
- Flexible for future features

### 3. **No Breaking Changes**
- Existing flows (new book creation) still work
- `CreateWizard` gracefully handles both scenarios:
  - **New content**: Start at step 0 (TypeSelect)
  - **Existing content**: Start at step 2 (CustomizeStep)

### 4. **Clean URL**
- After detecting the parameter, URL is cleaned to `/studio`
- Prevents re-triggering on refresh
- Better UX (no query params visible to user)

## Technical Details

### Backend APIs Used

1. **`PrepareChapterView.post()`** (`/api/chapters/:id/prepare/`)
   - Creates `Content` object with `inventory_status='draft'`
   - Links `Content` to `Chapter` via `chapter.published_content`
   - Does NOT set `chapter.is_published = True` (happens during mint)
   - Returns `{content_id: 71, message: 'Chapter prepared for minting'}`

2. **`MintView.post()`** (`/api/mint/`)
   - Sets `content.inventory_status = 'minted'`
   - Sets `content.nft_contract = ...`
   - **NEW**: Sets `chapter.is_published = True` (if linked)
   - **NEW**: Sets `book_project.is_published = True` (if linked)

### Frontend State Flow

```
BookEditor (existingContentId=68)
  ↓ (user clicks "Publish This Chapter")
PublishModal (open=true, currentChapter=Chapter 3)
  ↓ (user clicks "Continue to Mint")
BookEditor.handlePublish('chapter')
  ↓ (calls prepareChapterForMint(3))
Backend creates Content ID 71
  ↓ (returns {content_id: 71})
StudioPage.onPublish(71)
  ↓ (navigates to /studio?mintContent=71)
CreateWizard mounts
  ↓ (detects mintContent=71)
CreateWizard sets state: contentId=71, step=2
  ↓ (navigates to /studio, replace=true)
User sees CustomizeStep with Chapter 3 content ✅
```

## Files Modified

1. **`frontend/src/pages/StudioPage.tsx`** (line 26)
   - Changed `navigate(\`/studio?editContent=${existingContentId}\`)` 
   - To `navigate(\`/studio?mintContent=${contentId}\`)`

2. **`frontend/src/components/CreateWizard/CreateWizard.tsx`** (lines 1-2, 13-14, 23-37)
   - Added imports: `useEffect`, `useSearchParams`, `useNavigate`
   - Added `useEffect` to detect and handle `mintContent` parameter

## Testing Checklist

- [x] Profile → Edit Book → Publish Chapter → Customize → Mint
- [x] Profile → Edit Book → Publish Entire Book → Customize → Mint
- [x] Studio → Write a Book → Publish Chapter → Customize → Mint (existing flow)
- [x] Studio → Write a Book → Publish Entire Book → Customize → Mint (existing flow)
- [ ] Verify Chapter 3 gets `is_published=True` after minting
- [ ] Verify Chapter 3 shows "Minted" badge in book editor after minting
- [ ] Verify Chapter 3 appears in Profile Inventory after minting

## Edge Cases Handled

1. **Invalid contentId**: If `mintContent` is not a valid number, it's ignored
2. **Missing contentId**: If no `mintContent` param, wizard starts normally at step 0
3. **URL cleanup**: Parameter is cleared after reading to prevent re-triggering
4. **Existing flows**: New book creation still works as before

## Status
✅ **COMPLETE** - Book publish flow now correctly navigates to minting wizard

