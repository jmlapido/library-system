import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

interface ReadingList {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
}

interface NewListForm {
  title: string;
  description: string;
  isPublic: boolean;
}

/** Returns a skeleton row for loading state. */
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

/** Reading lists page — shows all personal reading lists with create/delete actions. */
export function ReadingListsPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewListForm>({ title: '', description: '', isPublic: false });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => { void fetchLists(); }, []);

  /** Fetches all reading lists for the authenticated user. */
  async function fetchLists() {
    setLoading(true);
    try {
      const data = await api.get<ReadingList[]>('/reading-lists');
      setLists(data);
    } catch {
      showToast('Failed to load reading lists.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /** Submits the new list form. */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const created = await api.post<ReadingList>('/reading-lists', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        isPublic: form.isPublic,
      });
      setLists((prev) => [created, ...prev]);
      setForm({ title: '', description: '', isPublic: false });
      setShowForm(false);
      showToast('List created!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to create list.');
    } finally {
      setSubmitting(false);
    }
  }

  /** Deletes a reading list after confirmation. */
  async function handleDelete(id: string) {
    try {
      await api.delete(`/reading-lists/${id}`);
      setLists((prev) => prev.filter((l) => l.id !== id));
      setConfirmDeleteId(null);
      showToast('List deleted.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to delete list.');
    }
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: 0 }}>My Reading Lists</h1>
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
          {showForm ? 'Cancel' : '+ New List'}
        </button>
      </div>

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
            placeholder="List title (required)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            Make this list public
          </label>
          <button
            type="submit"
            disabled={submitting || !form.title.trim()}
            style={{
              background: submitting || !form.title.trim() ? 'rgba(255,255,255,0.2)' : 'white',
              color: submitting || !form.title.trim() ? 'rgba(255,255,255,0.4)' : '#4f46e5',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontWeight: 700,
              fontSize: 14,
              cursor: submitting || !form.title.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Creating...' : 'Create List'}
          </button>
        </form>
      )}

      {loading ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </>
      ) : lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <p style={{ margin: 0 }}>No reading lists yet. Create your first list!</p>
        </div>
      ) : (
        lists.map((list) => (
          <div
            key={list.id}
            style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <button
                onClick={() => navigate(`/reading-lists/${list.id}`)}
                style={{ flex: 1, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{list.title}</div>
                {list.description && (
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 6 }}>{list.description}</div>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                    {list.itemCount} {list.itemCount === 1 ? 'book' : 'books'}
                  </span>
                  {list.isPublic && (
                    <span style={{
                      background: 'rgba(34,197,94,0.2)',
                      color: '#86efac',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: 10,
                      fontWeight: 600,
                      border: '1px solid rgba(34,197,94,0.3)',
                    }}>
                      Public
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setConfirmDeleteId(list.id)}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                  borderRadius: 7,
                  padding: '5px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginLeft: 10,
                }}
              >
                Delete
              </button>
            </div>

            {confirmDeleteId === list.id && (
              <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 10 }}>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: '0 0 8px' }}>
                  Delete "{list.title}"? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => void handleDelete(list.id)}
                    style={{ background: '#ef4444', border: 'none', color: 'white', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
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
