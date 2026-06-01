import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';

type ClubStatus = 'planning' | 'active' | 'completed';

interface BookClub {
  id: string;
  name: string;
  description: string | null;
  status: ClubStatus;
  memberCount: number;
  maxMembers: number | null;
  bookTitle: string | null;
  bookId: string | null;
  startDate: string | null;
  endDate: string | null;
  organizerId: string;
}

interface CatalogBook {
  id: string;
  title: string;
  author: string;
}

interface NewClubForm {
  name: string;
  description: string;
  bookQuery: string;
  bookId: string;
  bookTitle: string;
  startDate: string;
  endDate: string;
  maxMembers: string;
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

const ALL_STATUSES = ['all', 'planning', 'active', 'completed'] as const;
type StatusFilter = (typeof ALL_STATUSES)[number];

/** Skeleton card for loading state. */
function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 8 }}
    >
      <div style={{ height: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 4, width: '55%', marginBottom: 8 }} />
      <div style={{ height: 9, background: 'rgba(255,255,255,0.08)', borderRadius: 4, width: '80%' }} />
    </div>
  );
}

/** Status badge component. */
function StatusBadge({ status }: { status: ClubStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: 5,
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Single club card. */
function ClubCard({
  club,
  isMember,
  isOrganizer,
  onJoin,
  onLeave,
}: {
  club: BookClub;
  isMember: boolean;
  isOrganizer: boolean;
  onJoin: (id: string) => Promise<void>;
  onLeave: (id: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const canJoin = !isMember && (club.status === 'active' || club.status === 'planning');

  return (
    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <button
          onClick={() => navigate(`/book-clubs/${club.id}`)}
          style={{ flex: 1, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{club.name}</div>
          {club.description && (
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 6 }}>{club.description}</div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={club.status} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
              {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
              {club.maxMembers ? ` / ${club.maxMembers}` : ''}
            </span>
            {club.bookTitle && (
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>· {club.bookTitle}</span>
            )}
          </div>
        </button>

        <div style={{ flexShrink: 0, marginLeft: 10 }}>
          {canJoin && (
            <button
              onClick={() => void onJoin(club.id)}
              style={{
                background: 'white',
                color: '#4f46e5',
                border: 'none',
                borderRadius: 7,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Join
            </button>
          )}
          {isMember && !isOrganizer && (
            <button
              onClick={() => void onLeave(club.id)}
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
                borderRadius: 7,
                padding: '5px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Leave
            </button>
          )}
          {isOrganizer && (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Organizer</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Book clubs list page with All Clubs / My Clubs tabs and create form. */
export function BookClubsPage() {
  const user = useAuthStore((s) => s.user);
  const [allClubs, setAllClubs] = useState<BookClub[]>([]);
  const [myClubs, setMyClubs] = useState<BookClub[]>([]);
  const [myClubIds, setMyClubIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'my'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewClubForm>({
    name: '', description: '', bookQuery: '', bookId: '', bookTitle: '',
    startDate: '', endDate: '', maxMembers: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookResults, setBookResults] = useState<CatalogBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { void fetchData(); }, []);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (!form.bookQuery.trim()) { setBookResults([]); return; }
    searchDebounce.current = setTimeout(() => { void searchBooks(); }, 350);
    return () => clearTimeout(searchDebounce.current);
  }, [form.bookQuery]);

  /** Fetches all clubs and the user's clubs in parallel. */
  async function fetchData() {
    setLoading(true);
    try {
      const [all, my] = await Promise.all([
        api.get<BookClub[]>('/book-clubs'),
        api.get<BookClub[]>('/book-clubs/my'),
      ]);
      setAllClubs(all);
      setMyClubs(my);
      setMyClubIds(new Set(my.map((c) => c.id)));
    } catch {
      showToast('Failed to load clubs.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /** Searches catalog for book autocomplete in create form. */
  async function searchBooks() {
    setSearching(true);
    try {
      const data = await api.get<{ hits: CatalogBook[] }>(
        `/catalog/search?q=${encodeURIComponent(form.bookQuery)}`
      );
      setBookResults(data.hits.slice(0, 6));
    } catch {
      setBookResults([]);
    } finally {
      setSearching(false);
    }
  }

  /** Submits the create-club form. */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const created = await api.post<BookClub>('/book-clubs', {
        name: form.name.trim(),
        description: form.description.trim() || null,
        bookId: form.bookId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        maxMembers: form.maxMembers ? parseInt(form.maxMembers, 10) : null,
      });
      setAllClubs((prev) => [created, ...prev]);
      setMyClubs((prev) => [created, ...prev]);
      setMyClubIds((prev) => new Set([...prev, created.id]));
      setForm({ name: '', description: '', bookQuery: '', bookId: '', bookTitle: '', startDate: '', endDate: '', maxMembers: '' });
      setBookResults([]);
      setShowForm(false);
      showToast('Club created!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to create club.');
    } finally {
      setSubmitting(false);
    }
  }

  /** Joins a club. */
  async function handleJoin(id: string) {
    try {
      await api.post(`/book-clubs/${id}/join`, {});
      setMyClubIds((prev) => new Set([...prev, id]));
      setAllClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberCount: c.memberCount + 1 } : c));
      const joined = allClubs.find((c) => c.id === id);
      if (joined) setMyClubs((prev) => [...prev, { ...joined, memberCount: joined.memberCount + 1 }]);
      showToast('Joined club!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to join club.');
    }
  }

  /** Leaves a club. */
  async function handleLeave(id: string) {
    try {
      await api.post(`/book-clubs/${id}/leave`, {});
      setMyClubIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      setMyClubs((prev) => prev.filter((c) => c.id !== id));
      setAllClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberCount: Math.max(0, c.memberCount - 1) } : c));
      showToast('Left club.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to leave club.');
    }
  }

  const displayedAll = statusFilter === 'all'
    ? allClubs
    : allClubs.filter((c) => c.status === statusFilter);

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: 0 }}>Book Clubs</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            background: 'white',
            color: '#4f46e5',
            border: 'none',
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ Create Club'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <input
            type="text"
            placeholder="Club name (required)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            style={inputStyle}
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
          {/* Book search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search for a book (optional)"
              value={form.bookTitle || form.bookQuery}
              onChange={(e) => {
                setForm((f) => ({ ...f, bookQuery: e.target.value, bookId: '', bookTitle: '' }));
              }}
              style={inputStyle}
            />
            {searching && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0 0' }}>Searching...</p>
            )}
            {bookResults.length > 0 && !form.bookId && (
              <div style={{ background: 'rgba(30,20,80,0.95)', borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                {bookResults.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, bookId: book.id, bookTitle: book.title, bookQuery: '' }));
                      setBookResults([]);
                    }}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{book.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{book.author}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              placeholder="Start date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="date"
              placeholder="End date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <input
            type="number"
            placeholder="Max members (optional)"
            value={form.maxMembers}
            onChange={(e) => setForm((f) => ({ ...f, maxMembers: e.target.value }))}
            min={1}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={submitting || !form.name.trim()}
            style={{
              background: submitting || !form.name.trim() ? 'rgba(255,255,255,0.2)' : 'white',
              color: submitting || !form.name.trim() ? 'rgba(255,255,255,0.4)' : '#4f46e5',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 700,
              fontSize: 14,
              cursor: submitting || !form.name.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Creating...' : 'Create Club'}
          </button>
        </form>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['all', 'my'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? 'white' : 'rgba(255,255,255,0.1)',
              color: tab === t ? '#4f46e5' : 'rgba(255,255,255,0.7)',
              border: 'none', borderRadius: 20, padding: '5px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t === 'all' ? 'All Clubs' : 'My Clubs'}
          </button>
        ))}
      </div>

      {/* Status filter chips — only on All tab */}
      {tab === 'all' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                background: statusFilter === s ? 'white' : 'rgba(255,255,255,0.1)',
                color: statusFilter === s ? '#4f46e5' : 'rgba(255,255,255,0.7)',
                border: 'none', borderRadius: 20, padding: '4px 12px',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s as ClubStatus]}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </>
      ) : tab === 'all' ? (
        displayedAll.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.6)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <p style={{ margin: 0 }}>No clubs found.</p>
          </div>
        ) : (
          displayedAll.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              isMember={myClubIds.has(club.id)}
              isOrganizer={club.organizerId === user?.id}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          ))
        )
      ) : (
        myClubs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.6)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
            <p style={{ margin: 0 }}>You haven't joined any clubs yet.</p>
          </div>
        ) : (
          myClubs.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              isMember={true}
              isOrganizer={club.organizerId === user?.id}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          ))
        )
      )}

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
