import { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';

interface Checkout {
  id: string;
  book: { title: string; author: string; genre: string | null };
  dueDate: string;
  renewalCount: number;
  maxRenewals: number;
}
interface Hold {
  id: string;
  book: { title: string; author: string };
  queuePosition: number;
  status: string;
  expiresAt: string | null;
}

/** Returns color for due date urgency indicator. */
function dueDateColor(dueDate: string): string {
  const d = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (d < 0) return '#ef4444';
  if (d <= 5) return '#f59e0b';
  return '#22c55e';
}

/** Returns human-readable due date label. */
function dueDateLabel(dueDate: string): string {
  const d = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (d < 0) return `Overdue by ${Math.abs(d)} days`;
  if (d === 0) return 'Due today';
  return `Due in ${d} days`;
}

/** My Books page showing active checkouts and holds with renew/cancel actions. */
export function MyBooksPage() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    void api.get<{ checkouts: Checkout[] }>('/circulation/my/checkouts').then((r) => setCheckouts(r.checkouts));
    void api.get<{ holds: Hold[] }>('/circulation/my/holds').then((r) => setHolds(r.holds));
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleRenew(checkoutId: string) {
    try {
      await api.post('/circulation/renew', { checkoutId });
      const updated = await api.get<{ checkouts: Checkout[] }>('/circulation/my/checkouts');
      setCheckouts(updated.checkouts);
      showToast('Renewed successfully!');
    } catch (err) { showToast(err instanceof ApiError ? err.message : 'Renewal failed.'); }
  }

  async function handleCancelHold(holdId: string) {
    try {
      await api.delete(`/circulation/holds/${holdId}`);
      setHolds((prev) => prev.filter((h) => h.id !== holdId));
      showToast('Hold cancelled.');
    } catch (err) { showToast(err instanceof ApiError ? err.message : 'Cancel failed.'); }
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <Section title="Checked Out">
        {checkouts.length === 0 ? <Empty>No books checked out — explore the catalog!</Empty>
          : checkouts.map((co) => (
            <div key={co.id} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{co.book.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 6 }}>{co.book.author}</div>
                  <span style={{ color: dueDateColor(co.dueDate), fontSize: 11, fontWeight: 600 }}>{dueDateLabel(co.dueDate)}</span>
                </div>
                <button onClick={() => void handleRenew(co.id)} disabled={co.renewalCount >= co.maxRenewals}
                  style={{ background: co.renewalCount < co.maxRenewals ? 'white' : 'rgba(255,255,255,0.15)',
                    color: co.renewalCount < co.maxRenewals ? '#4f46e5' : 'rgba(255,255,255,0.3)',
                    border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    cursor: co.renewalCount < co.maxRenewals ? 'pointer' : 'not-allowed' }}>
                  Renew
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Section title="Holds">
        {holds.length === 0 ? <Empty>No holds placed.</Empty>
          : holds.map((hold) => (
            <div key={hold.id} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{hold.book.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 4 }}>{hold.book.author}</div>
                  {hold.status === 'ready' && hold.expiresAt
                    ? <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>Ready — pick up by {new Date(hold.expiresAt).toLocaleDateString()}</span>
                    : <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>You are #{hold.queuePosition} in line</span>}
                </div>
                <button onClick={() => void handleCancelHold(hold.id)}
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
                  Cancel Hold
                </button>
              </div>
            </div>
          ))}
      </Section>
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: 'rgba(0,0,0,0.8)',
          color: 'white', borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center' }}>{toast}</div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 24 }}><h2 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{title}</h2>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{children}</p>;
}
