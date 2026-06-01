import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';

type ClubStatus = 'planning' | 'active' | 'completed';

interface Member {
  userId: string;
  name: string;
  role: 'organizer' | 'member';
  joinedAt: string;
}

interface ClubBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
}

interface BookClubDetail {
  id: string;
  name: string;
  description: string | null;
  status: ClubStatus;
  memberCount: number;
  maxMembers: number | null;
  bookId: string | null;
  book: ClubBook | null;
  startDate: string | null;
  endDate: string | null;
  organizerId: string;
  members: Member[];
}

const STATUS_LABELS: Record<ClubStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
};

const STATUS_COLORS: Record<ClubStatus, { bg: string; text: string; border: string }> = {
  planning: { bg: 'rgba(245,158,11,0.2)', text: '#fcd34d', border: 'rgba(245,158,11,0.4)' },
  active: { bg: 'rgba(34,197,94,0.2)', text: '#86efac', border: 'rgba(34,197,94,0.4)' },
  completed: { bg: 'rgba(99,102,241,0.2)', text: '#a5b4fc', border: 'rgba(99,102,241,0.4)' },
};

const ALL_STATUSES: ClubStatus[] = ['planning', 'active', 'completed'];

/** Formats an ISO date string to a readable short date. */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Book club detail page. */
export function BookClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [club, setClub] = useState<BookClubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<ClubStatus>('planning');
  const [toast, setToast] = useState('');

  useEffect(() => { void fetchDetail(); }, [id]);

  /** Loads club detail including members. */
  async function fetchDetail() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<BookClubDetail>(`/book-clubs/${id}`);
      setClub(data);
      setEditName(data.name);
      setEditDescription(data.description ?? '');
      setEditStatus(data.status);
      const userId = user?.id;
      setIsMember(data.members.some((m) => m.userId === userId));
    } catch {
      showToast('Failed to load club.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /** Joins this club. */
  async function handleJoin() {
    if (!id) return;
    try {
      await api.post(`/book-clubs/${id}/join`, {});
      setIsMember(true);
      setClub((prev) =>
        prev
          ? {
              ...prev,
              memberCount: prev.memberCount + 1,
              members: [...prev.members, { userId: user!.id, name: user!.name, role: 'member', joinedAt: new Date().toISOString() }],
            }
          : prev
      );
      showToast('Joined club!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to join club.');
    }
  }

  /** Leaves this club. */
  async function handleLeave() {
    if (!id) return;
    try {
      await api.post(`/book-clubs/${id}/leave`, {});
      setIsMember(false);
      setClub((prev) =>
        prev
          ? {
              ...prev,
              memberCount: Math.max(0, prev.memberCount - 1),
              members: prev.members.filter((m) => m.userId !== user?.id),
            }
          : prev
      );
      showToast('Left club.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to leave club.');
    }
  }

  /** Saves inline edit for name / description / status. */
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editName.trim()) return;
    try {
      const updated = await api.patch<BookClubDetail>(`/book-clubs/${id}`, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
      });
      setClub((prev) => prev ? { ...prev, name: updated.name, description: updated.description, status: updated.status } : prev);
      setEditing(false);
      showToast('Club updated.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update club.');
    }
  }

  const isOrganizer = club?.organizerId === user?.id;
  const canJoin = !isMember && (club?.status === 'active' || club?.status === 'planning');
  const canLeave = isMember && !isOrganizer;

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ height: 16, background: 'rgba(255,255,255,0.15)', borderRadius: 4, width: '60%', marginBottom: 12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} aria-hidden="true" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 8, height: 60 }} />
        ))}
      </div>
    );
  }

  if (!club) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.6)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>😕</div>
        <p>Club not found.</p>
        <button onClick={() => navigate('/book-clubs')} style={backBtnStyle}>Back to Clubs</button>
      </div>
    );
  }

  const statusColors = STATUS_COLORS[club.status];

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {/* Back + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => navigate('/book-clubs')} style={backBtnStyle}>
          ‹ Clubs
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {canJoin && (
            <button
              onClick={() => void handleJoin()}
              style={{
                background: 'white', color: '#4f46e5', border: 'none',
                borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Join
            </button>
          )}
          {canLeave && (
            <button
              onClick={() => void handleLeave()}
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
                borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Leave
            </button>
          )}
          {isOrganizer && !editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: 'rgba(255,255,255,0.7)', borderRadius: 7,
                padding: '5px 10px', fontSize: 12, cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Club info / edit form */}
      {editing ? (
        <form
          onSubmit={(e) => void handleSaveEdit(e)}
          style={{
            background: 'rgba(255,255,255,0.1)', borderRadius: 10,
            padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            placeholder="Club name"
            style={inputStyle}
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
          <select
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as ClubStatus)}
            style={{ ...inputStyle }}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              style={{ background: 'white', color: '#4f46e5', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditName(club.name); setEditDescription(club.description ?? ''); setEditStatus(club.status); }}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: 7, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>{club.name}</h1>
            <span
              style={{
                background: statusColors.bg, color: statusColors.text,
                border: `1px solid ${statusColors.border}`,
                borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600,
              }}
            >
              {STATUS_LABELS[club.status]}
            </span>
          </div>
          {club.description && (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 8px' }}>{club.description}</p>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
              {club.maxMembers ? ` / ${club.maxMembers} max` : ''}
            </span>
            {club.startDate && (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Starts {fmtDate(club.startDate)}</span>
            )}
            {club.endDate && (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Ends {fmtDate(club.endDate)}</span>
            )}
          </div>
        </div>
      )}

      {/* Book section */}
      {club.book && (
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Currently Reading
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 44, height: 62, borderRadius: 5, flexShrink: 0,
                background: club.book.coverUrl
                  ? `url(${club.book.coverUrl}) center/cover`
                  : 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {!club.book.coverUrl && <span style={{ fontSize: 20 }}>📕</span>}
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{club.book.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{club.book.author}</div>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          Members ({club.memberCount})
        </div>
        {club.members.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No members yet.</p>
        ) : (
          club.members.map((m) => (
            <div
              key={m.userId}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Avatar placeholder */}
              <div
                style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 14, fontWeight: 700,
                }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              </div>
              {m.role === 'organizer' && (
                <span
                  style={{
                    background: 'rgba(250,204,21,0.2)', color: '#fde68a',
                    border: '1px solid rgba(250,204,21,0.35)',
                    borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                  }}
                >
                  Organizer
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, right: 16,
          background: 'rgba(0,0,0,0.85)', color: 'white',
          borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 14,
  cursor: 'pointer',
  padding: 0,
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: 'white',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
