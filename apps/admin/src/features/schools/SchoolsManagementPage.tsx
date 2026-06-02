import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface School {
  id: string;
  name: string;
  location: string | null;
  createdAt: string;
}

interface CreateForm {
  name: string;
  location: string;
}

interface EditForm {
  name: string;
  location: string;
}

// ─── Create School Form ───────────────────────────────────────────────────────

function CreateSchoolForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CreateForm>({ name: '', location: '' });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: CreateForm) =>
      api.post<School>('/super-admin/schools', values),
    onSuccess: () => {
      setForm({ name: '', location: '' });
      setError(null);
      onCreated();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to create school');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create New School</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="new-name">School Name</Label>
          <Input
            id="new-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. San Juan National High School"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-location">Location</Label>
          <Input
            id="new-location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. San Juan, Metro Manila"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !form.name.trim()}
        >
          {mutation.isPending ? 'Creating…' : 'Create School'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Edit School Row ─────────────────────────────────────────────────────────

function SchoolRow({ school, onUpdated }: { school: School; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    name: school.name,
    location: school.location ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: EditForm) =>
      api.patch<School>(`/super-admin/schools/${school.id}`, values),
    onSuccess: () => {
      setEditing(false);
      setError(null);
      onUpdated();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    },
  });

  if (!editing) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-md">
        <div className="space-y-0.5">
          <p className="font-medium text-sm">{school.name}</p>
          <p className="text-xs text-muted-foreground">
            {school.location ?? 'No location'} &middot; ID: {school.id.slice(0, 8)}…
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {new Date(school.createdAt).toLocaleDateString()}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border rounded-md space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`edit-name-${school.id}`}>School Name</Label>
        <Input
          id={`edit-name-${school.id}`}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`edit-loc-${school.id}`}>Location</Label>
        <Input
          id={`edit-loc-${school.id}`}
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !form.name.trim()}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setEditing(false); setError(null); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Super-admin page for listing and managing all schools in the system. */
export function SchoolsManagementPage() {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery<School[]>({
    queryKey: ['super-admin-schools'],
    queryFn: () => api.get<School[]>('/super-admin/schools'),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['super-admin-schools'] });
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading schools…</div>;
  }

  if (isError) {
    return <div className="p-6 text-destructive">Failed to load schools.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Schools Management</h1>

      <CreateSchoolForm onCreated={refresh} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All Schools{' '}
            <Badge variant="secondary">{data?.length ?? 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No schools registered yet.</p>
          )}
          {data?.map((school) => (
            <SchoolRow key={school.id} school={school} onUpdated={refresh} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
