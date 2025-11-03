# Collaborative Editor Component

A comprehensive real-time collaborative editing interface for multi-creator projects.

## Component: CollaborativeEditor

### Features

#### 1. **Multi-Panel Layout**
- **Left Sidebar**: Collaborators list, approval status, and comments
- **Right Editor Area**: Sections with content-type-specific editors

#### 2. **Content Type Support**
The editor supports four content types with different section types:

**Book Projects:**
- 📝 Text sections (rich text editor)
- 🖼️ Image sections (image upload/display)

**Music Projects:**
- 🎵 Audio sections (audio upload/player)
- 📝 Text sections (lyrics/notes)

**Video Projects:**
- 🎬 Video sections (video upload/player)
- 🎵 Audio sections (background music)
- 📝 Text sections (script/dialogue)

**Art Projects:**
- 🖼️ Image sections (artwork uploads)
- 📝 Text sections (descriptions)

#### 3. **Permission System**
- **Granular Permissions**: Each collaborator has permissions for specific section types
- **Section Ownership**: Users can only edit sections they own (unless they're the project creator)
- **Visual Indicators**: Locked sections show who owns them and display read-only
- **Permission-Based UI**: Add Section buttons are disabled for types users can't create

#### 4. **Collaboration Features**

**Collaborators Panel:**
- Shows all collaborators with their roles and revenue percentages
- Online/offline status indicators (green = accepted, gray = invited)
- Current user highlighted in blue
- Invite button (only visible to project creator)
- Individual approval status for each collaborator

**Comments System:**
- Real-time comment feed
- Add, view, and manage comments
- Timestamp with "time ago" formatting
- Inline comment input with Post/Cancel actions

**Approval Workflow:**
- Visual approval status panel showing X of Y collaborators approved
- "Approve Version" button for users who haven't approved yet
- Green indicator when fully approved
- Yellow indicator when awaiting approvals
- "Ready to Mint" button appears when all approvals are in

#### 5. **Section Management**

**Add Sections:**
- Four types available: Text, Image, Audio, Video
- Color-coded buttons by section type
- Permission-checked (disabled if user can't create that type)
- Sections numbered sequentially

**Edit Sections:**
- **Text Sections**: Rich text editor with ReactQuill
  - Headers (H1, H2, H3)
  - Bold, Italic, Underline, Strikethrough
  - Ordered and bullet lists
  - Blockquotes and code blocks
  - Links
  - Auto-save with 3-second debounce

- **Media Sections** (Image/Audio/Video):
  - Upload interface with file type validation
  - Preview of uploaded media
  - Replace media functionality
  - Inline media player for audio/video

**Section Features:**
- Editable title field
- Delete button (only for section owner or project creator)
- Color-coded borders by section type
- Owner attribution
- Lock icon for sections user can't edit

#### 6. **Auto-Save System**
- Debounced auto-save (3 seconds after last edit)
- "Saving..." indicator while saving
- "Saved X ago" timestamp after successful save
- Works for both title and content changes

#### 7. **Status & Indicators**

**Project Header:**
- Project title
- Content type (Book, Music, Video, Art)
- Current status (draft, active, ready_for_mint, etc.)
- Preview button
- Approve Version button (if user hasn't approved)
- Ready to Mint button (when fully approved)

**Error Handling:**
- Dismissible error messages
- Red error banner at top
- Specific error messages from API

**Visual Feedback:**
- Section type icons and colors
- Approval status colors (green = approved, yellow = pending)
- Locked section indicators
- Online/offline status dots

### Props Interface

```typescript
interface CollaborativeEditorProps {
  project: CollaborativeProject;        // Full project data
  currentUser: User;                    // Current logged-in user
  onSectionUpdate?: (section: ProjectSection) => void;  // Callback when section updates
  onCommentAdd?: (comment: ProjectComment) => void;     // Callback when comment added
  onProjectUpdate?: (project: CollaborativeProject) => void; // Callback when project updates
}
```

### Usage Example

```typescript
import { CollaborativeEditor } from './components/collaboration';

function ProjectPage() {
  const [project, setProject] = useState<CollaborativeProject>(/* ... */);
  const currentUser = { id: 1, username: 'angela' };

  return (
    <CollaborativeEditor
      project={project}
      currentUser={currentUser}
      onSectionUpdate={(section) => {
        console.log('Section updated:', section);
      }}
      onCommentAdd={(comment) => {
        console.log('Comment added:', comment);
      }}
      onProjectUpdate={(updatedProject) => {
        setProject(updatedProject);
      }}
    />
  );
}
```

### Section Editor Sub-Component

The `SectionEditor` component is an internal sub-component that handles individual section rendering and editing. It includes:

- Section type icon and color coding
- Owner information
- Permission-based edit/view modes
- Content editor based on section type
- Delete functionality
- Auto-save for text content
- Media upload for image/audio/video sections

### API Integration

The component uses the `collaborationApi` service for all backend operations:

- `getProjectSections()` - Load sections
- `getComments()` - Load comments
- `createProjectSection()` - Add new section
- `updateProjectSection()` - Update section content
- `deleteProjectSection()` - Remove section
- `addComment()` - Post comment
- `approveCurrentVersion()` - Approve for minting

### Styling

The component uses:
- Inline styles for maximum portability
- CSS variables for theming (`var(--panel)`, `var(--text)`, etc.)
- Consistent with existing app styling patterns
- Responsive layout with flex containers
- Color-coded section types

### Dependencies

- `react` - Core React library
- `react-quill` - Rich text editor for text sections
- `collaborationApi` - Backend API integration

### Future Enhancements

Potential improvements for future versions:

1. **Real-time Collaboration**
   - WebSocket integration for live updates
   - Show who's currently editing which section
   - Cursor positions and selections

2. **Advanced Features**
   - Section reordering with drag-and-drop
   - Section comments (comment on specific sections)
   - Comment threading and replies
   - Version history and rollback
   - Conflict resolution

3. **UI Improvements**
   - Modal for invite collaborator flow
   - Preview modal for project preview
   - Keyboard shortcuts
   - Mobile-responsive layout

4. **Performance**
   - Virtual scrolling for large section lists
   - Optimistic updates
   - Better caching

### Notes

- The component handles all permission checking on the frontend
- Backend validation ensures security (frontend checks are for UX only)
- All timestamps use the `formatTimeAgo()` utility function
- Media uploads use FormData for proper file handling
- ReactQuill editor includes text wrapping fixes from App.css
