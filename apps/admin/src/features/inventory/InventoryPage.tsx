import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type CopyCondition = 'excellent' | 'good' | 'fair' | 'poor';

interface AuditFoundItem {
  barcode: string;
  title: string;
  callNumber: string | null;
}

interface AuditMissingItem extends AuditFoundItem {
  lastSeen: string | null;
}

interface AuditUnexpectedItem {
  barcode: string;
  title: string;
  status: string;
}

interface AuditResult {
  scannedCount: number;
  expectedCount: number;
  found: AuditFoundItem[];
  missing: AuditMissingItem[];
  unexpected: AuditUnexpectedItem[];
}

interface MissingBookRow {
  copyId: string;
  barcode: string;
  bookTitle: string;
  callNumber: string | null;
  lastStatusChange: string;
  daysSinceActivity: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBarcodes(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Shelf Audit Tab ──────────────────────────────────────────────────────────

function ShelfAuditTab() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<'found' | 'missing' | 'unexpected' | null>(null);

  const auditMutation = useMutation({
    mutationFn: (scannedBarcodes: string[]) =>
      api.post<AuditResult>('/inventory/audit', { scannedBarcodes }),
    onSuccess: (data) => {
      setAuditResult(data);
      setAuditError(null);
    },
    onError: (err) => {
      setAuditError(err instanceof ApiError ? err.message : 'Audit failed');
    },
  });

  function handleRunAudit() {
    const barcodes = parseBarcodes(barcodeInput);
    auditMutation.mutate(barcodes);
  }

  function toggleSection(section: 'found' | 'missing' | 'unexpected') {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan Barcodes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Scan all books currently on shelves, then click Run Audit. Enter barcodes one per line
            or comma-separated.
          </p>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[160px] resize-y"
            placeholder="Scan or paste barcodes here..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
          />
          <Button onClick={handleRunAudit} disabled={auditMutation.isPending}>
            {auditMutation.isPending ? 'Running...' : 'Run Audit'}
          </Button>
          {auditError && <p className="text-sm text-destructive">{auditError}</p>}
        </CardContent>
      </Card>

      {auditResult && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Scanned: <strong>{auditResult.scannedCount}</strong></span>
            <span>Expected on shelf: <strong>{auditResult.expectedCount}</strong></span>
          </div>

          <AuditSection
            label="Found"
            count={auditResult.found.length}
            variant="default"
            open={openSection === 'found'}
            onToggle={() => toggleSection('found')}
          >
            <SimpleTable
              headers={['Barcode', 'Title', 'Call Number']}
              rows={auditResult.found.map((r) => [r.barcode, r.title, r.callNumber ?? '—'])}
            />
          </AuditSection>

          <AuditSection
            label="Missing"
            count={auditResult.missing.length}
            variant="destructive"
            open={openSection === 'missing'}
            onToggle={() => toggleSection('missing')}
          >
            <SimpleTable
              headers={['Barcode', 'Title', 'Call Number', 'Last Seen']}
              rows={auditResult.missing.map((r) => [
                r.barcode,
                r.title,
                r.callNumber ?? '—',
                r.lastSeen ? new Date(r.lastSeen).toLocaleDateString() : '—',
              ])}
            />
          </AuditSection>

          <AuditSection
            label="Unexpected"
            count={auditResult.unexpected.length}
            variant="secondary"
            open={openSection === 'unexpected'}
            onToggle={() => toggleSection('unexpected')}
          >
            <SimpleTable
              headers={['Barcode', 'Title', 'Status']}
              rows={auditResult.unexpected.map((r) => [r.barcode, r.title, r.status])}
            />
          </AuditSection>
        </div>
      )}
    </div>
  );
}

// ─── Audit Section ────────────────────────────────────────────────────────────

interface AuditSectionProps {
  label: string;
  count: number;
  variant: 'default' | 'destructive' | 'secondary';
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AuditSection({ label, count, variant, open, onToggle, children }: AuditSectionProps) {
  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant={variant}>{count}</Badge>
        </div>
      </CardHeader>
      {open && count > 0 && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

// ─── Simple Table ─────────────────────────────────────────────────────────────

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Missing Books Tab ────────────────────────────────────────────────────────

function MissingBooksTab() {
  const qc = useQueryClient();
  const [conditionMap, setConditionMap] = useState<Record<string, CopyCondition>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<MissingBookRow[]>({
    queryKey: ['inventory-missing'],
    queryFn: () => api.get<MissingBookRow[]>('/inventory/missing'),
  });

  function handleConditionChange(copyId: string, val: CopyCondition) {
    setConditionMap((prev) => ({ ...prev, [copyId]: val }));
  }

  async function handleSaveCondition(copyId: string) {
    const condition = conditionMap[copyId];
    if (!condition) return;
    setSavingId(copyId);
    setSaveError(null);
    try {
      await api.patch(`/inventory/copies/${copyId}/condition`, { condition });
      qc.invalidateQueries({ queryKey: ['inventory-missing'] });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Possibly Missing Books
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            (available copies with no activity in 90+ days)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {saveError && <p className="mb-3 text-sm text-destructive">{saveError}</p>}
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No missing books found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Barcode</th>
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 pr-4 font-medium">Call Number</th>
                  <th className="pb-2 pr-4 font-medium">Last Activity</th>
                  <th className="pb-2 pr-4 font-medium">Days Since</th>
                  <th className="pb-2 font-medium">Update Condition</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.copyId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{row.barcode}</td>
                    <td className="py-2 pr-4">{row.bookTitle}</td>
                    <td className="py-2 pr-4">{row.callNumber ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {new Date(row.lastStatusChange).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-destructive">
                      {row.daysSinceActivity}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <select
                          className="rounded border px-2 py-1 text-sm"
                          value={conditionMap[row.copyId] ?? ''}
                          onChange={(e) =>
                            handleConditionChange(row.copyId, e.target.value as CopyCondition)
                          }
                          aria-label="condition"
                        >
                          <option value="">-- select --</option>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="poor">Poor</option>
                        </select>
                        <Button
                          size="sm"
                          disabled={!conditionMap[row.copyId] || savingId === row.copyId}
                          onClick={() => handleSaveCondition(row.copyId)}
                        >
                          {savingId === row.copyId ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * InventoryPage — shelf audit and missing books report for librarians/admins.
 */
export function InventoryPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Inventory Tools</h1>
      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Shelf Audit</TabsTrigger>
          <TabsTrigger value="missing">Missing Books</TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="mt-4">
          <ShelfAuditTab />
        </TabsContent>
        <TabsContent value="missing" className="mt-4">
          <MissingBooksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
