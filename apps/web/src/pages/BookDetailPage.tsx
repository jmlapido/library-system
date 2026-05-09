import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, ApiError } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';

interface BookDetail {
  id: string; title: string; author: string; genre: string | null;
  readingLevel: string | null; availableCopies: number; totalCopies: number;
  description: string | null; coverUrl: string | null; isbn: string | null;
  publisher: string | null; publicationYear: number | null; language: string;
  pageCount: number | null; subjectTags: string[] | null;
}
type Tab = 'about' | 'copies' | 'related';

const GENRE_COLORS: Record<string, [string, string]> = {
  Fiction: ['#22c55e', '#16a34a'], Science: ['#3b82f6', '#2563eb'],
  History: ['#f59e0b', '#d97706'], Literature: ['#a855f7', '#9333ea'],
  Math: ['#06b6d4', '#0891b2'], Filipino: ['#ef4444', '#dc2626'],
};

/** Book detail page showing metadata, availability tabs, and checkout/hold actions. */
export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('about');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [holdLoading, setHoldLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!id) return;
    void api.get<BookDetail>(`/catalog/books/${id}`).then(setBook);
  }, [id]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleCheckout() {
    if (!book) return;
    setCheckoutLoading(true);
    try {
      const result = await api.post<{ dueDate: string }>('/circulation/checkout', { bookId: book.id });
      showToast(`Checked out! Due ${new Date(result.dueDate).toLocaleDateString()}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Checkout failed.');
    } finally { setCheckoutLoading(false); }
  }

  async function handlePlaceHold() {
    if (!book) return;
    setHoldLoading(true);
    try {
      const result = await api.post<{ queuePosition: number }>('/circulation/holds', { bookId: book.id });
      showToast(`Hold placed — you are #${result.queuePosition} in line`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Hold failed.');
    } finally { setHoldLoading(false); }
  }

  if (!book) return <div style={{ padding: 16, color: 'white', opacity: 0.5 }}>Loading...</div>;

  const [fromColor, toColor] = GENRE_COLORS[book.genre ?? ''] ?? ['#6366f1', '#4f46e5'];

  return (
    <div style={{ padding: '0 0 80px' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(79,70,229,0.95)',
        backdropFilter: 'blur(8px)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>←</button>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</span>
      </div>
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 14, marginBottom: 16 }}>
        <div style={{ background: `linear-gradient(160deg, ${fromColor}, ${toColor})`, borderRadius: 10, width: 56, height: 76,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
          {book.coverUrl ? <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : '📚'}
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{book.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6 }}>
            {book.author}{book.publicationYear ? ` · ${book.publicationYear}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge available={book.availableCopies} total={book.totalCopies} size="md" />
            {book.genre && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{book.genre}</span>}
            {book.readingLevel && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{book.readingLevel}</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
          {(['about', 'copies', 'related'] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: activeTab === tab ? 'white' : 'transparent',
              color: activeTab === tab ? '#4f46e5' : 'rgba(255,255,255,0.6)',
              fontWeight: activeTab === tab ? 700 : 400, fontSize: 13,
            }}>
              {tab === 'about' ? 'About' : tab === 'copies' ? 'Copies' : 'Related'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        {activeTab === 'about' && (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              {book.description ?? 'No description available.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {book.isbn && <Chip>ISBN: {book.isbn}</Chip>}
              {book.publisher && <Chip>{book.publisher}</Chip>}
              {book.language && <Chip>{book.language}</Chip>}
              {book.pageCount && <Chip>{book.pageCount} pages</Chip>}
            </div>
          </div>
        )}
        {activeTab === 'copies' && (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 12 }}>
              {book.availableCopies} of {book.totalCopies} copies available
            </p>
            <StatusBadge available={book.availableCopies} total={book.totalCopies} size="md" />
          </div>
        )}
        {activeTab === 'related' && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Related books coming soon.</p>
        )}
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={handleCheckout} disabled={book.availableCopies === 0 || checkoutLoading}
          style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none',
            background: book.availableCopies > 0 ? 'white' : 'rgba(255,255,255,0.2)',
            color: book.availableCopies > 0 ? '#4f46e5' : 'rgba(255,255,255,0.4)',
            fontWeight: 700, fontSize: 15, cursor: book.availableCopies > 0 ? 'pointer' : 'not-allowed' }}>
          {checkoutLoading ? '...' : 'Checkout'}
        </button>
        <button onClick={handlePlaceHold} disabled={holdLoading}
          style={{ width: '100%', padding: 14, borderRadius: 10, border: '2px solid rgba(255,255,255,0.5)',
            background: 'transparent', color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
          {holdLoading ? '...' : 'Place Hold'}
        </button>
      </div>
      {toast && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: 'rgba(0,0,0,0.8)',
            color: 'white', borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center' }}>
          {toast}
        </motion.div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)',
      borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>{children}</span>
  );
}
