import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

type ReadingStatus = 'to_read' | 'reading' | 'completed';

interface BookItem {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  status: ReadingStatus;
  addedAt: string;
}

interface ReadingListDetail {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  items: BookItem[];
}

interface CatalogBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
}

const STATUS_ORDER: ReadingStatus[] = ['to_read', 'reading', 'completed'];
const STATUS_LABELS: Record<ReadingStatus, string> = {
  to_read: 'To Read',
  reading: 'Reading',
  completed: 'Completed',
};
const STATUS_COLORS: Record<ReadingStatus, { bg: string; text: string; border: string }> = {
  to_read: { bg: 'rgba(99,102,241,0.2)', text: '#a5b4fc', border: 'rgba(99,102,241,0.4)' },
  reading: { bg: 'rgba(245,158,11,0.2)', text: '#fcd34d', border: 'rgba(245,158,11,0.4)' },
  completed: { bg: 'rgba(34,197,94,0.2)', text: '#86efac', border: 'rgba(34,197,94,0.4)' },
};
const ALL_FILTERS = ['all', 'to_read', 'reading', 'completed'] as const;
type FilterTab = (typeof ALL_FILTERS)[number];

/** Reading list detail page showing all books with status management. */
export function ReadingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [list, setList] = useState<ReadingListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showAddBook, setShowAddBook] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { void fetchDetail(); }, [id]);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(() => { void searchCatalog(); }, 350);
    return () => clearTimeout(searchDebounce.current);
  }, [searchQuery]);

  /** Loads the full reading list with book items. */
  async function fetchDetail() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<ReadingListDetail>(`/reading-lists/${id}`);
      setList(data);
      setEditTitle(data.title);
      setEditDescription(data.description ?? '');
    } catch {
      showToast('Failed to load reading list.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /** Saves inline title/description edit. */
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editTitle.trim()) return;
    try {
      const updated = await api.patch<ReadingListDetail>(`/reading-lists/${id}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      });
      setList((prev) => prev ? { ...prev, title: updated.title, description: updated.description } : prev);
      setEditing(false);
      showToast('List updated.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update list.');
    }
  }

  /** Cycles item status: to_read → reading → completed → to_read. */
  async function handleCycleStatus(bookId: string, current: ReadingStatus) {
    if (!id) return;
    const idx = STATUS_ORDER.indexOf(current);
    const next: ReadingStatus = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] as ReadingStatus;
    try {
      await api.patch(`/reading-lists/${id}/books/${bookId}`, { status: next });
      setList((prev) =>
        prev
          ? { ...prev, items: prev.items.map((item) => item.bookId === bookId ? { ...item, status: next } : item) }
          : prev
      );
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update status.');
    }
  }

  /** Removes a book from this list. */
  async function handleRemoveBook(bookId: string) {
    if (!id) return;
    try {
      await api.delete(`/reading-lists/${id}/books/${bookId}`);
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((item) => item.bookId !== bookId) } : prev
      );
      showToast('Book removed from list.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to remove book.');
    }
  }

  /** Searches the catalog for books to add. */
  async function searchCatalog() {
    setSearching(true);
    try {
      const data = await api.get<{ hits: CatalogBook[] }>(`/catalog/books?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.hits.slice(0, 8));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  /** Adds a catalog book to this list. */
  async function handleAddBook(book: CatalogBook) {
    if (!id) return;
    try {
      const item = await api.post<BookItem>(`/reading-lists/${id}/books`, { bookId: book.id });
      setList((prev) =>
        prev ? { ...prev, items: [...prev.items, item] } : prev
      );
      setShowAddBook(false);
      setSearchQuery('');
      setSearchResults([]);
      showToast(`"${book.title}" added to list.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to add book.');
    }
  }

  const filteredItems = list?.items.filter((item) => filter === 'all' || item.status === filter) ?? [];

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ height: 16, background: 'rgba(255,255,255,0.15)', borderRadius: 4, width: '60%', marginBottom: 12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} aria-hidden="true" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 8, height: 70 }} />
        ))}
      </div>
    );
  }

  if (!list) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.6)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>😕</div>
        <p>Reading list not found.</p>
        <button onClick={() => navigate('/reading-lists')} style={backBtnStyle}>Back to Lists</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => navigate('/reading-lists')} style={backBtnStyle}>
          ‹ My Lists
        </button>

        {editing ? (
          <form onSubmit={(e) => void handleSaveEdit(e)} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
              style={inputStyle}
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ background: 'white', color: '#4f46e5', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</button>
              <button type="button" onClick={() => setEditing(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: 7, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{list.title}</h1>
              {list.description && (
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0 }}>{list.description}</p>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0, marginLeft: 10 }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Add Book */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowAddBook((v) => !v)}
          style={{ background: 'white', color: '#4f46e5', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {showAddBook ? 'Cancel' : '+ Add Book'}
        </button>

        {showAddBook && (
          <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12 }}>
            <input
              type="search"
              placeholder="Search catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            {searching && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0' }}>Searching...</p>}
            {!searching && searchResults.length === 0 && searchQuery.trim().length > 0 && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0' }}>No results found.</p>
            )}
            {searchResults.map((book) => (
              <button
                key={book.id}
                onClick={() => void handleAddBook(book)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.08)', border: 'none',
                  borderRadius: 7, padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
                  marginBottom: 4, display: 'block',
                }}
              >
                <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{book.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{book.author}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {ALL_FILTERS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              background: filter === tab ? 'white' : 'rgba(255,255,255,0.1)',
              color: filter === tab ? '#4f46e5' : 'rgba(255,255,255,0.7)',
              border: 'none', borderRadius: 20, padding: '5px 12px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {tab === 'all' ? 'All' : STATUS_LABELS[tab as ReadingStatus]}
          </button>
        ))}
      </div>

      {/* Book items */}
      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📖</div>
          <p style={{ margin: 0 }}>
            {filter === 'all' ? 'No books in this list yet.' : `No books with status "${STATUS_LABELS[filter as ReadingStatus]}".`}
          </p>
        </div>
      ) : (
        filteredItems.map((item) => {
          const colors = STATUS_COLORS[item.status];
          return (
            <div key={item.bookId} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {/* Cover */}
                <div style={{
                  width: 40, height: 56, borderRadius: 5, flexShrink: 0,
                  background: item.coverUrl ? `url(${item.coverUrl}) center/cover` : 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!item.coverUrl && <span style={{ fontSize: 18 }}>📕</span>}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 6 }}>{item.author}</div>
                  <button
                    onClick={() => void handleCycleStatus(item.bookId, item.status)}
                    title="Click to change status"
                    style={{
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 5,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {STATUS_LABELS[item.status]}
                  </button>
                </div>

                {/* Remove */}
                <button
                  onClick={() => void handleRemoveBook(item.bookId)}
                  title="Remove from list"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })
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
