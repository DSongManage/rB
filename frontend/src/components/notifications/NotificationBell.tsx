/**
 * NotificationBell Component
 * Bell icon with unread count badge for navbar
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '../../hooks/useNotifications';
import { events } from '../../services/notificationService';
import { useMobile } from '../../hooks/useMobile';
import NotificationDropdown from './NotificationDropdown';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const { unreadCount } = useUnreadCount();
  const { isMobile } = useMobile();
  const navigate = useNavigate();

  // Animate bell when new notifications arrive
  useEffect(() => {
    const unsubscribe = events.on('notifications:new', () => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    });

    return () => unsubscribe();
  }, []);

  const handleClick = () => {
    // On mobile, navigate directly to the notifications page
    if (isMobile) {
      navigate('/notifications');
    } else {
      // On desktop, toggle the dropdown
      setIsOpen(!isOpen);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={bellRef}
        onClick={handleClick}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="rb-nav-link"
        title="Notifications"
      >
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Bell
            size={20}
            style={{
              animation: isAnimating ? 'ring 1s ease-in-out' : 'none',
              transformOrigin: 'top center',
            }}
          />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 10,
                minWidth: 16,
                textAlign: 'center',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
              }}
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount}
            </span>
          )}
        </span>
        <span>Alerts</span>
      </button>

      <NotificationDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorEl={bellRef.current}
      />

      {/* Keyframes for bell animation */}
      <style>{`
        @keyframes ring {
          0%, 100% { transform: rotate(0deg); }
          10%, 30%, 50%, 70% { transform: rotate(15deg); }
          20%, 40%, 60%, 80% { transform: rotate(-15deg); }
          90% { transform: rotate(5deg); }
        }
      `}</style>
    </div>
  );
}

export default NotificationBell;
