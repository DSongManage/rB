# Real-Time Notification System

A comprehensive notification service for collaboration and activity tracking in renaissBlock.

## Overview

The notification system provides real-time updates for collaboration activities including:
- Collaboration invitations
- Invitation responses (accepted/declined)
- Project section updates
- Comments on projects
- Approval status changes
- Revenue split proposals
- Project minting readiness

## Architecture

### Core Components

1. **`notificationService.ts`** - Service layer for notification management
2. **`useNotifications.ts`** - React hook for component integration
3. **`NotificationPanel.tsx`** - UI component for displaying notifications

### Features

- ✅ Real-time polling (30-second intervals)
- ✅ Event-driven architecture
- ✅ Automatic retry logic with exponential backoff
- ✅ Local state caching
- ✅ Unread count tracking
- ✅ Mark as read functionality
- ✅ Notification deletion
- ✅ Type-safe TypeScript interfaces
- ✅ Responsive UI with proper accessibility

## Usage

### 1. Service Layer (Direct API Calls)

```typescript
import notificationService from './services/notificationService';

// Fetch all notifications
const notifications = await notificationService.getNotifications();

// Get unread count
const count = await notificationService.getUnreadCount();

// Mark notification as read
await notificationService.markNotificationRead(notificationId);

// Mark all as read
await notificationService.markAllNotificationsRead();

// Delete a notification
await notificationService.deleteNotification(notificationId);

// Start/Stop polling
notificationService.startPolling();
notificationService.stopPolling();

// Get cached data (no API call)
const cached = notificationService.getCachedNotifications();
const cachedCount = notificationService.getCachedUnreadCount();
```

### 2. React Hook (Recommended for Components)

```typescript
import { useNotifications } from './hooks/useNotifications';

function MyComponent() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isPolling,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    startPolling,
    stopPolling,
  } = useNotifications({ autoStart: true });

  return (
    <div>
      <h2>Notifications ({unreadCount})</h2>
      {notifications.map(notif => (
        <div key={notif.id} onClick={() => markAsRead(notif.id)}>
          {notif.title}
        </div>
      ))}
    </div>
  );
}
```

### 3. Simple Unread Count Hook

```typescript
import { useUnreadCount } from './hooks/useNotifications';

function NotificationBadge() {
  const { unreadCount, refresh } = useUnreadCount(true);

  return (
    <button onClick={refresh}>
      🔔 {unreadCount > 0 && <span>{unreadCount}</span>}
    </button>
  );
}
```

### 4. Event Subscription

```typescript
import { events } from './services/notificationService';

// Subscribe to new notifications
const unsubscribe = events.on('notifications:new', ({ notifications, count }) => {
  console.log(`${count} new notifications received`, notifications);
  // Show toast notification, play sound, etc.
});

// Available events:
// - 'notifications:updated' - Full notification list updated
// - 'notifications:unread-count' - Unread count changed
// - 'notifications:new' - New notifications received
// - 'notifications:polling-started' - Polling started
// - 'notifications:polling-stopped' - Polling stopped
// - 'notifications:polling-error' - Polling error occurred

// Cleanup
unsubscribe();
```

## TypeScript Interfaces

### Notification

```typescript
interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  project_id?: number;
  from_user: {
    id: number;
    username: string;
    avatar?: string;
  };
  created_at: string;
  read: boolean;
  action_url?: string;
}
```

### Notification Types

```typescript
type NotificationType =
  | 'invitation'          // Collaboration invitation received
  | 'invitation_response' // Response to your invitation
  | 'comment'            // New comment on project
  | 'approval'           // Project approval status changed
  | 'section_update'     // Collaborator updated a section
  | 'revenue_proposal'   // New revenue split proposal
  | 'mint_ready';        // Project ready for minting
```

## Configuration

### Polling Interval

```typescript
import notificationService from './services/notificationService';

// Change polling interval (default: 30000ms = 30 seconds)
notificationService.setPollingInterval(60000); // 60 seconds
```

### Retry Settings

Edit `notificationService.ts`:

```typescript
const CONFIG = {
  POLLING_INTERVAL: 30000,  // Polling interval
  MAX_RETRIES: 3,           // Max retry attempts
  RETRY_DELAY: 5000,        // Delay between retries
  REQUEST_TIMEOUT: 10000,   // Request timeout
};
```

## Integration with App.tsx

The notification system is integrated into the main App component:

```typescript
import { useUnreadCount } from './hooks/useNotifications';
import notificationService from './services/notificationService';
import NotificationPanel from './components/NotificationPanel';

function Header() {
  const { unreadCount } = useUnreadCount();
  const [showPanel, setShowPanel] = useState(false);

  // Start polling when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      notificationService.startPolling();
    } else {
      notificationService.stopPolling();
      notificationService.reset();
    }
  }, [isAuthenticated]);

  return (
    <nav>
      <button onClick={() => setShowPanel(!showPanel)}>
        🔔 {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>
      <NotificationPanel
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
      />
    </nav>
  );
}
```

## UI Components

### NotificationPanel

Displays notifications in a dropdown panel:

```typescript
<NotificationPanel
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  anchorEl={buttonRef.current}  // Optional: anchor element for positioning
/>
```

Features:
- Click outside to close
- ESC key to close
- Mark individual notifications as read
- Mark all as read
- Delete notifications
- Navigate to related content
- Shows notification icons and colors by type
- Time ago formatting
- Empty state

## Helper Functions

### Time Formatting

```typescript
import { getTimeAgo } from './services/notificationService';

const timeAgo = getTimeAgo('2024-01-01T12:00:00Z');
// Returns: "2d ago", "5h ago", "just now", etc.
```

### Notification Icons

```typescript
import { getNotificationIcon } from './services/notificationService';

const icon = getNotificationIcon('invitation');
// Returns: "📬"
```

### Notification Colors

```typescript
import { getNotificationColor } from './services/notificationService';

const color = getNotificationColor('invitation');
// Returns: "#3b82f6" (blue)
```

## Backend API Requirements

The notification service expects these backend endpoints:

### GET `/api/notifications/`
Returns array of notifications for current user.

**Response:**
```json
[
  {
    "id": 1,
    "type": "invitation",
    "title": "Collaboration Invitation",
    "message": "John invited you to join 'My Novel'",
    "project_id": 5,
    "from_user": {
      "id": 2,
      "username": "john",
      "avatar": "/avatars/john.jpg"
    },
    "created_at": "2024-01-01T12:00:00Z",
    "read": false,
    "action_url": "/studio/5"
  }
]
```

### POST `/api/notifications/{id}/mark-read/`
Marks a notification as read.

**Headers:**
```
X-CSRFToken: {token}
```

### POST `/api/notifications/mark-all-read/`
Marks all notifications as read.

**Headers:**
```
X-CSRFToken: {token}
```

### DELETE `/api/notifications/{id}/`
Deletes a notification.

**Headers:**
```
X-CSRFToken: {token}
```

## Error Handling

The service includes comprehensive error handling:

1. **Network Errors**: Automatic retry with exponential backoff
2. **API Errors**: Logged to console, emitted as events
3. **Polling Errors**: After max retries, polling stops and error event is emitted
4. **State Preservation**: Cached state is maintained during errors

## Performance Considerations

1. **Polling**: 30-second interval balances freshness with server load
2. **Caching**: Local state reduces API calls
3. **Event System**: Efficient component updates without prop drilling
4. **Cleanup**: Automatic cleanup on logout and unmount
5. **Request Timeout**: 10-second timeout prevents hanging requests

## Testing

```typescript
import notificationService from './services/notificationService';

// Mock notifications for testing
const mockNotifications = [
  {
    id: 1,
    type: 'invitation',
    title: 'Test Notification',
    message: 'Test message',
    from_user: { id: 1, username: 'test' },
    created_at: new Date().toISOString(),
    read: false,
  },
];

// Test event system
const spy = jest.fn();
const unsubscribe = notificationService.events.on('notifications:new', spy);

// Emit event
notificationService.events.emit('notifications:new', {
  notifications: mockNotifications,
  count: 1,
});

expect(spy).toHaveBeenCalledWith({
  notifications: mockNotifications,
  count: 1,
});

unsubscribe();
```

## Future Enhancements

Potential improvements for future versions:

1. **WebSocket Support**: Replace polling with WebSocket for true real-time updates
2. **Push Notifications**: Browser push notifications when app is in background
3. **Sound Alerts**: Optional sound effects for new notifications
4. **Notification Preferences**: User settings for notification types
5. **Batch Operations**: Mark multiple notifications as read at once
6. **Infinite Scroll**: Load older notifications on demand
7. **Search/Filter**: Search and filter notifications by type, date, etc.
8. **Notification Groups**: Group related notifications together
9. **Snooze Feature**: Temporarily dismiss notifications
10. **Notification History**: Archive of all past notifications

## Troubleshooting

### Notifications not appearing

1. Check if user is authenticated
2. Verify polling is started: `notificationService.isPolling()`
3. Check browser console for errors
4. Verify backend API is responding correctly

### Unread count incorrect

1. Call `refresh()` from useUnreadCount hook
2. Check backend response format matches expected interface
3. Verify mark-as-read API calls are succeeding

### Polling stops unexpectedly

1. Check console for polling errors
2. Verify network connectivity
3. Check if max retries was reached
4. Restart polling: `notificationService.startPolling()`

## License

Part of renaissBlock platform. All rights reserved.
