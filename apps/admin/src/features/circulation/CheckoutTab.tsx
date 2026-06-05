import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useBarcodeInput } from '@/hooks/useBarcodeInput';
import { api, ApiError } from '@/lib/api';

interface StudentResult {
  id: string;
  fullName: string;
  studentId: string | null;
  gradeLevel: string | null;
}

interface CopyResult {
  copy: { id: string; barcode: string; copyNumber: number | null; status: string; location: string | null };
  book: { title: string; author: string; isbn: string | null; deweyDecimal: string | null };
}

interface CheckoutResult {
  id: string;
  dueDate: string;
}

type Stage = 'student' | 'book' | 'confirm';

/** Checkout tab — 3-stage wizard: identify student → scan book → confirm. */
export function CheckoutTab() {
  const [stage, setStage] = useState<Stage>('student');
  const [student, setStudent] = useState<StudentResult | null>(null);
  const [copy, setCopy] = useState<CopyResult | null>(null);
  const [studentInput, setStudentInput] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [studentError, setStudentError] = useState('');
  const [bookError, setBookError] = useState('');
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);

  async function lookupStudent(query: string) {
    if (!query.trim()) return;
    setStudentLoading(true);
    setStudentError('');
    setShowDropdown(false);
    try {
      const results = await api.get<StudentResult[]>(
        `/admin/students?search=${encodeURIComponent(query)}&limit=10`
      );
      if (!results || results.length === 0) {
        setStudentError(`No student found for "${query}"`);
      } else if (results.length === 1) {
        setStudent(results[0]);
        setStage('book');
      } else {
        setSearchResults(results);
        setShowDropdown(true);
      }
    } catch {
      setStudentError('Failed to look up student.');
    } finally {
      setStudentLoading(false);
    }
  }

  async function lookupBook(barcode: string) {
    if (!barcode.trim()) return;
    setBookLoading(true);
    setBookError('');
    try {
      const result = await api.get<CopyResult>(`/copies/barcode/${barcode}`);
      setCopy(result);
      setStage('confirm');
      setCameraOpen(false);
    } catch (err) {
      setBookError(
        err instanceof ApiError
          ? `No book found for barcode: ${barcode}`
          : 'Failed to look up barcode.'
      );
    } finally {
      setBookLoading(false);
    }
  }

  const checkoutMutation = useMutation({
    mutationFn: () =>
      api.post<CheckoutResult>('/circulation/checkout', {
        barcode: copy!.copy.barcode,
        userId: student!.id,
      }),
  });

  const handleScan = useCallback(
    (barcode: string) => {
      if (stage === 'student') {
        setStudentInput(barcode);
        lookupStudent(barcode);
      } else if (stage === 'book') {
        setBarcodeInput(barcode);
        lookupBook(barcode);
      }
    },
    [stage]
  );

  useBarcodeInput({ onScan: handleScan });

  function reset() {
    setStage('student');
    setStudent(null);
    setCopy(null);
    setStudentInput('');
    setBarcodeInput('');
    setStudentError('');
    setBookError('');
    setSearchResults([]);
    setShowDropdown(false);
    checkoutMutation.reset();
  }

  if (checkoutMutation.isSuccess) {
    return (
      <div className="mt-4 space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Checkout successful!</strong>{' '}
            {checkoutMutation.data?.dueDate
              ? `Due: ${new Date(checkoutMutation.data.dueDate).toLocaleDateString()}`
              : 'Book checked out.'}
          </AlertDescription>
        </Alert>
        <Button onClick={reset}>Next Checkout</Button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6 max-w-lg">
      {/* Step 1 — Student */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Step 1 — Student
        </p>
        {student ? (
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
            <div>
              <p className="font-medium">{student.fullName}</p>
              <p className="text-sm text-muted-foreground">
                ID: {student.studentId ?? '—'} · Grade {student.gradeLevel ?? '—'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStudent(null); setStage('student'); setCopy(null); }}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-2 relative">
            <Label htmlFor="student-input">Student ID or Name</Label>
            <div className="flex gap-2">
              <Input
                id="student-input"
                placeholder="Scan student ID or type name…"
                value={studentInput}
                onChange={(e) => setStudentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setShowDropdown(false); lookupStudent(studentInput); }
                }}
                autoFocus
              />
              <Button
                variant="outline"
                disabled={studentLoading || !studentInput.trim()}
                onClick={() => { setShowDropdown(false); lookupStudent(studentInput); }}
              >
                {studentLoading ? '…' : 'Find'}
              </Button>
            </div>
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full border rounded-md bg-card shadow-md">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted"
                    onClick={() => { setStudent(s); setStage('book'); setShowDropdown(false); }}
                  >
                    {s.fullName}
                    <span className="text-muted-foreground ml-2">
                      {s.studentId ?? ''} · Grade {s.gradeLevel ?? ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {studentError && <p className="text-sm text-destructive">{studentError}</p>}
          </div>
        )}
      </div>

      {/* Step 2 — Book (only after student selected) */}
      {stage !== 'student' && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Step 2 — Book
          </p>
          {copy ? (
            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{copy.book.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Author</dt>
                    <dd>{copy.book.author}</dd>
                    <dt className="text-muted-foreground">Barcode</dt>
                    <dd className="font-mono">{copy.copy.barcode}</dd>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Badge variant="secondary" className="capitalize">{copy.copy.status}</Badge>
                    </dd>
                  </dl>
                </CardContent>
              </Card>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCopy(null); setStage('book'); setBarcodeInput(''); }}
              >
                Scan Different Book
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="barcode-input">Book Barcode</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode-input"
                  placeholder="Scan or type barcode…"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') lookupBook(barcodeInput); }}
                  autoFocus
                />
                <Button
                  variant="outline"
                  disabled={bookLoading || !barcodeInput.trim()}
                  onClick={() => lookupBook(barcodeInput)}
                >
                  {bookLoading ? '…' : 'Lookup'}
                </Button>
                <Button variant="outline" onClick={() => setCameraOpen((o) => !o)}>
                  {cameraOpen ? 'Close' : 'Camera'}
                </Button>
              </div>
              {cameraOpen && (
                <BarcodeScanner
                  onScan={(b) => { setBarcodeInput(b); lookupBook(b); }}
                  onError={() => setCameraOpen(false)}
                />
              )}
              {bookError && <p className="text-sm text-destructive">{bookError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Confirm */}
      {stage === 'confirm' && student && copy && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Confirm Checkout
          </p>
          {checkoutMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {checkoutMutation.error instanceof ApiError
                  ? checkoutMutation.error.message
                  : 'Checkout failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
            >
              {checkoutMutation.isPending ? 'Processing…' : 'Confirm Checkout'}
            </Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
