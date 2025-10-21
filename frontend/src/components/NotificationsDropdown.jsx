import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthStore } from '../app/store';
import { formatCurrency } from '../lib/formatters.js';

export default function NotificationsDropdown() {
  const role = useAuthStore((state) => state.user?.role);
  const { items, unread, markRead, markAll, loading } = useNotifications({ role });
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button aria-label="Notifications" style={bell(unread)} onClick={() => setOpen((v) => !v)}>
        <span style={srOnly}>Notifications</span>
        <BellIcon />
        {unread ? <span style={badge}>{unread}</span> : null}
      </button>
      {open ? (
        <div style={menu}>
          <div style={menuHeader}>
            <strong>Notifications</strong>
            {items.length ? (
              <button style={linkButton} onClick={markAll} disabled={loading}>
                Mark all as read
              </button>
            ) : null}
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {items.length ? (
              items.map((n) => (
                <div key={n._id} style={itemRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{titleFor(n.type)}</div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{messageFor(n)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {linkFor(n) ? (
                      <a href={linkFor(n)} style={linkButton}>
                        Open
                      </a>
                    ) : null}
                    <button style={linkButton} onClick={() => markRead(n._id)}>
                      Read
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '0.75rem', color: '#64748b' }}>No new notifications</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function titleFor(type) {
  switch (type) {
    case 'RECORD_UPDATED':
      return 'Record updated';
    case 'CORRECTION_SUBMITTED':
      return 'Correction submitted';
    case 'CORRECTION_RESOLVED':
      return 'Correction resolved';
    case 'CONFLICT_DETECTED':
      return 'Edit conflict detected';
    case 'INSURANCE_INVALID':
      return 'Insurance invalid';
    case 'PAYMENT_SUCCESS':
      return 'Payment processed';
    case 'PAYMENT_DECLINED':
      return 'Payment declined';
    case 'PAYMENT_ERROR':
      return 'Payment error';
    default:
      return type;
  }
}

function messageFor(notification) {
  const payload = notification?.payload || {};
  if (payload.message) return payload.message;

  if (notification.type?.startsWith('PAYMENT')) {
    const amount =
      typeof payload.amount === 'number' ? formatCurrency(payload.amount) : formatCurrency(0);
    const method = payload.method ? payload.method.toLowerCase() : 'card';
    return `${amount} via ${method}`;
  }

  if (payload.patientId) {
    return `Patient ${payload.patientId}`;
  }

  return new Date(notification.createdAt).toLocaleString();
}

function linkFor(notification) {
  const payload = notification?.payload || {};
  if (notification.type?.startsWith('PAYMENT') && payload.patientId) {
    return `/payments?patientId=${payload.patientId}`;
  }
  if (payload.scope === 'appointment') {
    if (payload.recipient === 'doctor' || notification.audienceRole === 'doctor') {
      return '/appointments';
    }
    if (payload.recipient === 'patient' || notification.audienceRole === 'patient') {
      return '/appointments/view';
    }
  }
  if (payload.patientId) {
    return `/records/${payload.patientId}`;
  }
  return null;
}

const bell = (active) => ({
  position: 'relative',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  width: 36,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: active ? '#0ea5e9' : '#0f172a'
});

const badge = {
  position: 'absolute',
  top: 2,
  right: 2,
  background: '#ef4444',
  color: '#fff',
  borderRadius: '9999px',
  padding: '0 6px',
  fontSize: '0.7rem'
};

const menu = {
  position: 'absolute',
  right: 0,
  top: '120%',
  width: 360,
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  boxShadow: '0 20px 45px rgba(15,23,42,0.15)',
  zIndex: 1000
};

const menuHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid #e2e8f0'
};

const itemRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid #f1f5f9'
};

const linkButton = {
  background: 'transparent',
  border: 'none',
  color: '#2563eb',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0
};

const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  border: 0
};

function BellIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14v-3a6 6 0 10-12 0v3a2 2 0 01-.6 1.6L4 17h5" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  );
}
