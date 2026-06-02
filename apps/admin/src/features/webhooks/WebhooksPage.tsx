import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  secret: string;
}

interface FormState {
  url: string;
  events: string[];
  description: string;
}

const ALL_EVENTS = [
  'checkout.created',
  'checkout.returned',
  'hold.placed',
  'hold.ready',
  'overdue.alert',
] as const;

const EMPTY_FORM: FormState = { url: '', events: [], description: '' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function WebhookRow({
  webhook,
  onToggle,
  onDelete,
}: {
  webhook: Webhook;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  function handleDelete() {
    if (window.confirm(`Delete webhook for ${webhook.url}?`)) {
      onDelete(webhook.id);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{webhook.url}</p>
        {webhook.description && (
          <p className="text-xs text-muted-foreground">{webhook.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {webhook.events.map((e) => (
            <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={webhook.isActive ? 'default' : 'outline'}>
          {webhook.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggle(webhook.id, !webhook.isActive)}
        >
          {webhook.isActive ? 'Disable' : 'Enable'}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function AddWebhookForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.url) { setError('URL is required'); return; }
    if (form.events.length === 0) { setError('Select at least one event'); return; }
    setSubmitting(true);
    try {
      await api.post('/webhooks', {
        url: form.url,
        events: form.events,
        description: form.description || undefined,
      });
      setForm(EMPTY_FORM);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="webhook-url">URL</Label>
        <Input
          id="webhook-url"
          type="url"
          placeholder="https://example.com/webhook"
          value={form.url}
          onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="webhook-description">Description (optional)</Label>
        <Input
          id="webhook-description"
          placeholder="My webhook"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label>Events</Label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_EVENTS.map((ev) => (
            <div key={ev} className="flex items-center gap-2">
              <Checkbox
                id={`event-${ev}`}
                checked={form.events.includes(ev)}
                onCheckedChange={() => toggleEvent(ev)}
              />
              <label htmlFor={`event-${ev}`} className="text-sm cursor-pointer">{ev}</label>
            </div>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add Webhook'}
      </Button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Admin-only page for managing webhook subscriptions. */
export function WebhooksPage() {
  const queryClient = useQueryClient();

  const { data: webhooks, isLoading, isError } = useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: () => api.get<Webhook[]>('/webhooks'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/webhooks/${id}/toggle`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading webhooks…</div>;
  if (isError) return <div className="p-6 text-destructive">Failed to load webhooks.</div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-muted-foreground text-sm">
          Receive real-time event notifications via HMAC-signed HTTP POST requests.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          {!webhooks?.length ? (
            <p className="text-sm text-muted-foreground">No webhooks configured.</p>
          ) : (
            webhooks.map((w) => (
              <WebhookRow
                key={w.id}
                webhook={w}
                onToggle={(id, isActive) => toggleMutation.mutate({ id, isActive })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Webhook</CardTitle>
        </CardHeader>
        <CardContent>
          <AddWebhookForm
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['webhooks'] })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
