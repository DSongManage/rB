/**
 * NotificationSettings Component
 *
 * Manages per-type notification preferences (in-app + email toggles).
 * Fetches current preferences on mount and persists changes optimistically.
 */

import React, { useState, useEffect } from 'react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreference,
} from '../../services/notificationService';

// ── Inline toggle ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: checked ? '#f59e0b' : 'var(--panel-border-strong, #333)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.2s',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

function PrefRow({
  pref,
  onToggle,
}: {
  pref: NotificationPreference;
  onToggle: (type: string, channel: 'in_app' | 'email', value: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid var(--panel-border, #222)',
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>{pref.label}</span>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <ToggleSwitch
          checked={pref.in_app}
          onChange={(v) => onToggle(pref.notification_type, 'in_app', v)}
        />
        <ToggleSwitch
          checked={pref.email}
          onChange={(v) => onToggle(pref.notification_type, 'email', v)}
        />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function NotificationSettings() {
  const [actionItems, setActionItems] = useState<NotificationPreference[]>([]);
  const [engagement, setEngagement] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getNotificationPreferences()
      .then((data) => {
        setActionItems(data.action_items);
        setEngagement(data.engagement);
      })
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (type: string, channel: 'in_app' | 'email', value: boolean) => {
    // Find the current pref so we can send both fields
    const current = [...actionItems, ...engagement].find((p) => p.notification_type === type);
    if (!current) return;

    const updated = { ...current, [channel]: value };

    // Optimistic update
    const apply = (list: NotificationPreference[]) =>
      list.map((p) => (p.notification_type === type ? { ...p, [channel]: value } : p));

    setActionItems(apply);
    setEngagement(apply);

    updateNotificationPreferences([
      { notification_type: type, in_app: updated.in_app, email: updated.email },
    ]).catch(() => {
      // Revert on failure
      const revert = (list: NotificationPreference[]) =>
        list.map((p) => (p.notification_type === type ? { ...p, [channel]: !value } : p));
      setActionItems(revert);
      setEngagement(revert);
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--subtle)' }}>
        Loading preferences...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>{error}</div>
    );
  }

  const columnHeader = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 20,
        paddingBottom: 8,
        marginBottom: 4,
      }}
    >
      <span style={{ width: 40, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--subtle)', textTransform: 'uppercase' }}>
        App
      </span>
      <span style={{ width: 40, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--subtle)', textTransform: 'uppercase' }}>
        Email
      </span>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--subtle)', margin: '0 0 20px 0' }}>
        Choose how you want to be notified for each type of activity.
      </p>

      {/* Action Items */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px 0' }}>
        Action Items
      </h3>
      {columnHeader}
      {actionItems.map((p) => (
        <PrefRow key={p.notification_type} pref={p} onToggle={handleToggle} />
      ))}

      {/* Engagement */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '24px 0 8px 0' }}>
        Engagement
      </h3>
      {columnHeader}
      {engagement.map((p) => (
        <PrefRow key={p.notification_type} pref={p} onToggle={handleToggle} />
      ))}
    </div>
  );
}
