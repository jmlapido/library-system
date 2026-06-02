import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchoolSettings {
  studentCheckoutDays: number;
  teacherCheckoutDays: number;
  studentCheckoutLimit: number;
  teacherCheckoutLimit: number;
  fineEnabled: boolean;
  finePerDay: number;
  overdueReminderDays: number;
  timezone: string;
}

interface SchoolInfo {
  name: string;
  location: string | null;
}

interface SettingsResponse {
  info: SchoolInfo;
  settings: SchoolSettings;
}

type FormValues = SchoolInfo & SchoolSettings;

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS: FormValues = {
  name: '',
  location: '',
  studentCheckoutDays: 14,
  teacherCheckoutDays: 28,
  studentCheckoutLimit: 5,
  teacherCheckoutLimit: 15,
  fineEnabled: false,
  finePerDay: 0,
  overdueReminderDays: 2,
  timezone: 'Asia/Manila',
};

function toForm(data: SettingsResponse): FormValues {
  return {
    name: data.info.name,
    location: data.info.location ?? '',
    ...data.settings,
  };
}

// ─── Field components ─────────────────────────────────────────────────────────

function NumField({
  label,
  id,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40"
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** School configuration settings page — admin only. */
export function SchoolSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormValues>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<SettingsResponse>({
    queryKey: ['school-settings'],
    queryFn: () => api.get<SettingsResponse>('/schools/settings'),
  });

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch<SchoolSettings>('/schools/settings', values),
    onSuccess: () => {
      setSaved(true);
      setErrorMsg(null);
      qc.invalidateQueries({ queryKey: ['school-settings'] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : 'Save failed');
    },
  });

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading settings…</div>;
  }

  if (isError) {
    return <div className="p-6 text-destructive">Failed to load school settings.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">School Settings</h1>

      {/* School Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">School Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="school-name">School Name</Label>
            <Input
              id="school-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="school-location">Location</Label>
            <Input
              id="school-location"
              value={form.location ?? ''}
              onChange={(e) => set('location', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => set('timezone', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Checkout Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkout Rules</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <NumField label="Student loan period (days)" id="s-days" value={form.studentCheckoutDays} onChange={(v) => set('studentCheckoutDays', v)} min={1} max={365} />
          <NumField label="Teacher loan period (days)" id="t-days" value={form.teacherCheckoutDays} onChange={(v) => set('teacherCheckoutDays', v)} min={1} max={365} />
          <NumField label="Student checkout limit" id="s-limit" value={form.studentCheckoutLimit} onChange={(v) => set('studentCheckoutLimit', v)} min={1} max={100} />
          <NumField label="Teacher checkout limit" id="t-limit" value={form.teacherCheckoutLimit} onChange={(v) => set('teacherCheckoutLimit', v)} min={1} max={100} />
          <NumField label="Overdue reminder (days before)" id="reminder" value={form.overdueReminderDays} onChange={(v) => set('overdueReminderDays', v)} min={0} max={30} />
        </CardContent>
      </Card>

      {/* Fines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fine Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="fine-enabled"
              type="checkbox"
              checked={form.fineEnabled}
              onChange={(e) => set('fineEnabled', e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="fine-enabled">Enable overdue fines</Label>
          </div>
          {form.fineEnabled && (
            <NumField label="Fine per day (₱)" id="fine-day" value={form.finePerDay} onChange={(v) => set('finePerDay', v)} min={0} max={1000} />
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-4">
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600">Settings saved.</span>}
        {errorMsg && <span className="text-sm text-destructive">{errorMsg}</span>}
      </div>
    </div>
  );
}
