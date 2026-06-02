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
  gracePeriodDays: number;
  maxFineAmount: number;
  overdueReminderDays: number;
  timezone: string;
  ssoGoogleEnabled: boolean;
  ssoGoogleClientId: string;
  ssoGoogleClientSecret: string;
  ssoMicrosoftEnabled: boolean;
  ssoMicrosoftClientId: string;
  ssoMicrosoftClientSecret: string;
  ldapEnabled: boolean;
  ldapUrl: string;
  ldapBaseDn: string;
  ldapBindDn: string;
  ldapBindPassword: string;
  ldapSearchFilter: string;
  ldapEmailAttribute: string;
  ldapNameAttribute: string;
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
  gracePeriodDays: 0,
  maxFineAmount: 0,
  overdueReminderDays: 2,
  timezone: 'Asia/Manila',
  ssoGoogleEnabled: false,
  ssoGoogleClientId: '',
  ssoGoogleClientSecret: '',
  ssoMicrosoftEnabled: false,
  ssoMicrosoftClientId: '',
  ssoMicrosoftClientSecret: '',
  ldapEnabled: false,
  ldapUrl: '',
  ldapBaseDn: '',
  ldapBindDn: '',
  ldapBindPassword: '',
  ldapSearchFilter: '(mail={{email}})',
  ldapEmailAttribute: 'mail',
  ldapNameAttribute: 'displayName',
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
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Fine per day (₱)"
                id="fine-day"
                value={form.finePerDay}
                onChange={(v) => set('finePerDay', v)}
                min={0}
                max={1000}
              />
              <NumField
                label="Grace period (days)"
                id="fine-grace"
                value={form.gracePeriodDays}
                onChange={(v) => set('gracePeriodDays', v)}
                min={0}
                max={30}
              />
              <NumField
                label="Max fine per item (₱, 0 = no cap)"
                id="fine-max"
                value={form.maxFineAmount}
                onChange={(v) => set('maxFineAmount', v)}
                min={0}
                max={100000}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* SSO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Single Sign-On (SSO)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="sso-google"
                type="checkbox"
                checked={form.ssoGoogleEnabled}
                onChange={(e) => set('ssoGoogleEnabled', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="sso-google">Enable Google SSO</Label>
            </div>
            {form.ssoGoogleEnabled && (
              <div className="pl-7 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="google-client-id">Google Client ID</Label>
                  <Input
                    id="google-client-id"
                    value={form.ssoGoogleClientId}
                    onChange={(e) => set('ssoGoogleClientId', e.target.value)}
                    placeholder="xxxxxxxx.apps.googleusercontent.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="google-client-secret">Google Client Secret</Label>
                  <Input
                    id="google-client-secret"
                    type="password"
                    value={form.ssoGoogleClientSecret}
                    onChange={(e) => set('ssoGoogleClientSecret', e.target.value)}
                    placeholder="GOCSPX-…"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Microsoft */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="sso-microsoft"
                type="checkbox"
                checked={form.ssoMicrosoftEnabled}
                onChange={(e) => set('ssoMicrosoftEnabled', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="sso-microsoft">Enable Microsoft SSO</Label>
            </div>
            {form.ssoMicrosoftEnabled && (
              <div className="pl-7 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ms-client-id">Microsoft Client (Application) ID</Label>
                  <Input
                    id="ms-client-id"
                    value={form.ssoMicrosoftClientId}
                    onChange={(e) => set('ssoMicrosoftClientId', e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ms-client-secret">Microsoft Client Secret</Label>
                  <Input
                    id="ms-client-secret"
                    type="password"
                    value={form.ssoMicrosoftClientSecret}
                    onChange={(e) => set('ssoMicrosoftClientSecret', e.target.value)}
                    placeholder="Secret value…"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LDAP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LDAP / Active Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input id="ldap-enabled" type="checkbox" checked={form.ldapEnabled} onChange={(e) => set('ldapEnabled', e.target.checked)} className="h-4 w-4" />
            <Label htmlFor="ldap-enabled">Enable LDAP authentication for staff</Label>
          </div>
          {form.ldapEnabled && (
            <div className="space-y-3">
              {([
                ['ldapUrl', 'Server URL', 'ldap://192.168.1.10:389'],
                ['ldapBaseDn', 'Base DN', 'DC=school,DC=edu,DC=ph'],
                ['ldapBindDn', 'Bind DN (service account)', 'CN=ldap-reader,OU=Service,DC=school,DC=edu,DC=ph'],
                ['ldapSearchFilter', 'Search filter', '(mail={{email}})'],
                ['ldapEmailAttribute', 'Email attribute', 'mail'],
                ['ldapNameAttribute', 'Name attribute', 'displayName'],
              ] as [keyof FormValues, string, string][]).map(([key, label, placeholder]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={key}>{label}</Label>
                  <Input id={key} value={String(form[key])} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="ldapBindPassword">Bind password</Label>
                <Input id="ldapBindPassword" type="password" value={form.ldapBindPassword} onChange={(e) => set('ldapBindPassword', e.target.value)} />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => api.post('/auth/ldap/test-connection', {}).then(() => alert('LDAP connection successful!')).catch((e: unknown) => alert(`LDAP error: ${e instanceof Error ? e.message : 'Unknown'}`))}>
                Test Connection
              </Button>
            </div>
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
