/**
 * NotificationToastContainer Component
 * Manages and displays multiple toast notifications in a stack
 */

import React, { useEffect, useState } from 'react';
import { events, Notification } from '../../services/notificationService';
import NotificationToast from './NotificationToast';

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<Notification[]>([]);

  useEffect(() => {
    // Subscribe to new notifications event
    const unsubscribe = events.on('notifications:new', ({ notifications }) => {
      // Add new notifications to toast queue
      setToasts((prev) => [...prev, ...notifications]);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = (notificationId: number) => {
    setToasts((prev) => prev.filter((n) => n.id !== notificationId));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        {toasts.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => handleDismiss(notification.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default NotificationToastContainer;
