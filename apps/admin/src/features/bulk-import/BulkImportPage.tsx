import { useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, ApiError } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportError {
  row: number;
  message: string;
}

interface StudentImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

interface BookImportResult {
  booksCreated: number;
  booksUpdated: number;
  copiesCreated: number;
  errors: ImportError[];
}

type ImportResult = StudentImportResult | BookImportResult;

// ─── CSV Templates ────────────────────────────────────────────────────────────

const STUDENT_TEMPLATE =
  'fullName,studentId,gradeLevel,email,pin\n' +
  'Juan dela Cruz,2024-001,7,juan@school.edu,1234\n' +
  'Maria Santos,2024-002,8,maria@school.edu,5678\n';

const BOOK_TEMPLATE =
  'isbn,title,author,publisher,genre,description,copies,barcode\n' +
  '9780061120084,To Kill a Mockingbird,Harper Lee,HarperCollins,Fiction,,2,\n' +
  ',Noli Me Tangere,Jose Rizal,Anvil,,Classic Filipino novel,1,\n';

function downloadTemplate(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────

interface UploadPanelProps {
  label: string;
  endpoint: string;
  templateCsv: string;
  templateFilename: string;
  renderResult: (result: ImportResult) => React.ReactNode;
}

function UploadPanel({
  label,
  endpoint,
  templateCsv,
  templateFilename,
  renderResult,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    if (!f.name.endsWith('.csv')) {
      setError('Only CSV files are accepted.');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.upload<ImportResult>(endpoint, formData);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Need the format?</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadTemplate(templateCsv, templateFilename)}
        >
          Download CSV Template
        </Button>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label} CSV`}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-primary/50'
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {file ? (
          <p className="text-sm font-medium">{file.name}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Drag &amp; drop a CSV file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">.csv only</p>
          </>
        )}
      </div>

      {/* Actions */}
      {file && (
        <div className="flex gap-2">
          <Button onClick={handleUpload} disabled={loading}>
            {loading ? 'Uploading…' : `Import ${label}`}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={loading}>
            Clear
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Result */}
      {result && renderResult(result)}
    </div>
  );
}

// ─── Result Renderers ─────────────────────────────────────────────────────────

function ErrorTable({ errors }: { errors: ImportError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-destructive mb-2">Row errors ({errors.length})</p>
      <div className="rounded-md border overflow-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Row</th>
              <th className="px-3 py-2 text-left font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((e) => (
              <tr key={e.row} className="border-t">
                <td className="px-3 py-2 font-mono">{e.row}</td>
                <td className="px-3 py-2 text-destructive">{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentResult(result: StudentImportResult) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Import Complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          <Badge variant="secondary">{result.inserted} inserted</Badge>
          <Badge variant="secondary">{result.updated} updated</Badge>
          {result.skipped > 0 && <Badge variant="outline">{result.skipped} skipped</Badge>}
          {result.errors.length > 0 && (
            <Badge variant="destructive">{result.errors.length} errors</Badge>
          )}
        </div>
        <ErrorTable errors={result.errors} />
      </CardContent>
    </Card>
  );
}

function BookResult(result: BookImportResult) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Import Complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          <Badge variant="secondary">{result.booksCreated} books created</Badge>
          <Badge variant="secondary">{result.booksUpdated} books updated</Badge>
          <Badge variant="secondary">{result.copiesCreated} copies created</Badge>
          {result.errors.length > 0 && (
            <Badge variant="destructive">{result.errors.length} errors</Badge>
          )}
        </div>
        <ErrorTable errors={result.errors} />
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Bulk import admin page — CSV upload for students and books. */
export function BulkImportPage() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload CSV files to import students or books in bulk. Existing records are updated; new
          records are created.
        </p>
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="books">Books</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Students</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadPanel
                label="Students"
                endpoint="/users/import"
                templateCsv={STUDENT_TEMPLATE}
                templateFilename="students-template.csv"
                renderResult={(r) => StudentResult(r as StudentImportResult)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="books" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Books</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadPanel
                label="Books"
                endpoint="/books/import/csv"
                templateCsv={BOOK_TEMPLATE}
                templateFilename="books-template.csv"
                renderResult={(r) => BookResult(r as BookImportResult)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
