import { useEffect, useRef, useState, useCallback } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ShelvingItemSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string(),
  bookTitle: z.string(),
  coverUrl: z.string().nullable().optional(),
  returnedAt: z.string(),
  stage: z.enum(['returned', 'being_processed']),
  lastActionBy: z.string(),
});

const ShelvingQueueResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ShelvingItemSchema),
});

const AdvanceResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    newStage: z.enum(['being_processed', 'shelved']),
  }),
});

type ShelvingItem = z.infer<typeof ShelvingItemSchema>;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/** Fetches the current shelving queue (returned + being_processed). */
async function fetchShelvingQueue(token: string): Promise<ShelvingItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/circulation/shelving-queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load shelving queue: ${res.status}`);
  const json: unknown = await res.json();
  const parsed = ShelvingQueueResponseSchema.parse(json);
  return parsed.data;
}

/** Advances a book barcode to the next return stage. */
async function advanceStage(
  token: string,
  barcode: string,
): Promise<'being_processed' | 'shelved'> {
  const res = await fetch(`${API_BASE}/api/v1/circulation/return/advance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ barcode }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Advance failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  const parsed = AdvanceResponseSchema.parse(json);
  return parsed.data.newStage;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface QueueCardProps {
  item: ShelvingItem;
  onAdvance: (barcode: string) => void;
  advancing: boolean;
}

/** Single book card displayed in a stage column. */
function QueueCard({ item, onAdvance, advancing }: QueueCardProps) {
  const ts = new Date(item.returnedAt).toLocaleString();

  return (
    <Card className="mb-3">
      <CardContent className="p-3 flex items-start gap-3">
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.bookTitle}
            className="w-8 h-10 object-cover rounded shrink-0"
          />
        ) : (
          <div className="w-8 h-10 bg-muted rounded shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
            N/A
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.bookTitle}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.barcode}</p>
          <p className="text-xs text-muted-foreground">Returned by: {item.lastActionBy}</p>
          <p className="text-xs text-muted-foreground">{ts}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={advancing}
          onClick={() => onAdvance(item.barcode)}
          aria-label={`Advance ${item.barcode}`}
        >
          Advance
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Shelving Queue page — displays books in `returned` and `being_processed`
 * stages. Staff can advance a book via barcode scan or the per-card button.
 */
export function ShelvingQueuePage() {
  const token = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const scanRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<ShelvingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanValue, setScanValue] = useState('');
  const [advancing, setAdvancing] = useState<string | null>(null); // barcode being advanced

  // Autofocus scan input on mount
  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const loadQueue = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchShelvingQueue(token);
      setItems(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load queue';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleAdvance = useCallback(
    async (barcode: string) => {
      if (!token || advancing) return;
      setAdvancing(barcode);
      try {
        const newStage = await advanceStage(token, barcode);
        const label = newStage === 'shelved' ? 'Shelved' : 'Being Processed';
        toast({ title: 'Stage advanced', description: `Advanced to ${label}` });
        await loadQueue();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Advance failed';
        toast({ title: 'Error', description: message, variant: 'destructive' });
      } finally {
        setAdvancing(null);
        scanRef.current?.focus();
      }
    },
    [token, advancing, toast, loadQueue],
  );

  const handleScanKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const barcode = scanValue.trim();
    if (!barcode) return;
    setScanValue('');
    await handleAdvance(barcode);
  };

  const returned = items.filter((i) => i.stage === 'returned');
  const beingProcessed = items.filter((i) => i.stage === 'being_processed');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Shelving Queue</h1>
        <p className="text-sm text-muted-foreground">
          Scan a barcode or click Advance to move a book to the next stage.
        </p>
      </div>

      <Input
        ref={scanRef}
        placeholder="Scan or type barcode, then press Enter..."
        value={scanValue}
        onChange={(e) => setScanValue(e.target.value)}
        onKeyDown={(e) => void handleScanKeyDown(e)}
        className="max-w-md"
        aria-label="Barcode scan input"
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading queue...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Column 1 — Returned */}
          <div>
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2 text-base">
                Returned
                <Badge variant="secondary">{returned.length}</Badge>
              </CardTitle>
            </CardHeader>
            {returned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items</p>
            ) : (
              returned.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  onAdvance={(bc) => void handleAdvance(bc)}
                  advancing={advancing === item.barcode}
                />
              ))
            )}
          </div>

          {/* Column 2 — Being Processed */}
          <div>
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2 text-base">
                Being Processed
                <Badge variant="secondary">{beingProcessed.length}</Badge>
              </CardTitle>
            </CardHeader>
            {beingProcessed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items</p>
            ) : (
              beingProcessed.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  onAdvance={(bc) => void handleAdvance(bc)}
                  advancing={advancing === item.barcode}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
