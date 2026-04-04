import React from 'react';
import { LayoutDashboard, FileText, Users, MessageSquare, Rocket, ScrollText, Layers, Image, BookOpen, Hammer } from 'lucide-react';
import { useMobile } from '../../../hooks/useMobile';

export type TabId = 'overview' | 'workspace' | 'script' | 'content' | 'team' | 'activity' | 'publish';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  badges?: {
    activity?: number;
    team?: number;
  };
  isFullyApproved?: boolean;
  contentType?: 'comic' | 'book' | 'art';
  isSolo?: boolean;
}

function getTabs(contentType?: 'comic' | 'book' | 'art', isSolo?: boolean): Tab[] {
  const baseTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  ];

  // Add content-specific tabs based on content type
  if (contentType === 'comic') {
    // Comic: unified Workspace tab (replaces separate Script + Comic tabs)
    baseTabs.push(
      { id: 'workspace', label: 'Workspace', icon: <Hammer size={18} /> }
    );
  } else if (contentType === 'book') {
    // Book: has Editor tab (writer's editor) - no Script
    baseTabs.push(
      { id: 'content', label: 'Editor', icon: <BookOpen size={18} /> }
    );
  } else if (contentType === 'art') {
    // Art: has Gallery tab (image uploads) - no Script or Comic
    baseTabs.push(
      { id: 'content', label: 'Gallery', icon: <Image size={18} /> }
    );
  } else {
    // Fallback - show workspace for unknown content types
    baseTabs.push(
      { id: 'workspace', label: 'Workspace', icon: <Hammer size={18} /> }
    );
  }

  // Add common tabs
  baseTabs.push(
    { id: 'team', label: 'Team', icon: <Users size={18} /> }
  );

  // Only show Activity tab for collaborative projects (not solo)
  if (!isSolo) {
    baseTabs.push({ id: 'activity', label: 'Activity', icon: <MessageSquare size={18} /> });
  }

  baseTabs.push({ id: 'publish', label: 'Publish', icon: <Rocket size={18} /> });

  return baseTabs;
}

export default function TabNavigation({
  activeTab,
  onTabChange,
  badges = {},
  isFullyApproved = false,
  contentType,
  isSolo = false,
}: TabNavigationProps) {
  const tabs = getTabs(contentType, isSolo);
  const { isPhone, isMobile } = useMobile();

  return (
    <div style={{
      display: 'flex',
      gap: isPhone ? 2 : 4,
      background: 'var(--panel)',
      padding: isPhone ? 3 : 4,
      borderRadius: isPhone ? 8 : 12,
      border: '1px solid var(--panel-border)',
      overflowX: isMobile ? 'auto' : undefined,
      WebkitOverflowScrolling: 'touch' as any,
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const badge = tab.id === 'activity' ? badges.activity :
                     tab.id === 'team' ? badges.team : undefined;

        // Highlight publish tab when ready
        const isPublishReady = tab.id === 'publish' && isFullyApproved;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={isPhone ? tab.label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isPhone ? 0 : 8,
              padding: isPhone ? '10px 12px' : '10px 16px',
              background: isActive
                ? 'var(--bg)'
                : isPublishReady
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'transparent',
              border: isActive
                ? '1px solid var(--panel-border)'
                : isPublishReady
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid transparent',
              borderRadius: 8,
              color: isActive
                ? 'var(--text)'
                : isPublishReady
                  ? '#10b981'
                  : '#94a3b8',
              cursor: 'pointer',
              fontSize: isPhone ? 13 : 14,
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              position: 'relative',
              flexShrink: 0,
              minHeight: 44,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
            {!isPhone && <span>{tab.label}</span>}
            {badge !== undefined && badge > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 10,
                minWidth: 18,
                textAlign: 'center',
                ...(isPhone ? { position: 'absolute', top: 2, right: 2, padding: '1px 4px', fontSize: 8, minWidth: 14 } : {}),
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
