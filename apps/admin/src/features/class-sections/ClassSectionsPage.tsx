import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface SchoolYear { id: string; name: string; isActive: boolean; }

interface ClassSection {
  id: string;
  schoolYearId: string;
  name: string;
  gradeLevel: number | null;
  createdAt: string;
}

interface SectionDetail extends ClassSection {
  teachers: Array<{ id: string; fullName: string; email: string | null }>;
  students: Array<{ id: string; fullName: string; studentId: string | null; gradeLevel: number | null }>;
}

const SectionSchema = z.object({
  schoolYearId: z.string().uuid('Required'),
  name: z.string().min(1, 'Name required'),
  gradeLevel: z.coerce.number().int().min(1).max(12).optional(),
});
type SectionForm = z.infer<typeof SectionSchema>;

const MemberSchema = z.object({ userId: z.string().uuid('Must be a valid UUID') });

function SectionFormDialog({
  open,
  initial,
  years,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: ClassSection | null;
  years: SchoolYear[];
  onClose: () => void;
  onSave: (data: SectionForm) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SectionForm>({
    resolver: zodResolver(SectionSchema),
    defaultValues: initial
      ? { schoolYearId: initial.schoolYearId, name: initial.name, gradeLevel: initial.gradeLevel ?? undefined }
      : { schoolYearId: years.find((y) => y.isActive)?.id ?? '' },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Section' : 'Add Class Section'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cs-year">School Year</Label>
            <select id="cs-year" {...register('schoolYearId')} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
              <option value="">Select school year…</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>
              ))}
            </select>
            {errors.schoolYearId && <p className="text-xs text-destructive">{errors.schoolYearId.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cs-name">Section Name</Label>
            <Input id="cs-name" placeholder="e.g. Grade 5 – Mabini" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cs-grade">Grade Level (optional)</Label>
            <Input id="cs-grade" type="number" min={1} max={12} placeholder="5" {...register('gradeLevel')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">{initial ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionDetailDrawer({
  sectionId,
  onClose,
}: {
  sectionId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [memberUserId, setMemberUserId] = useState('');
  const [memberError, setMemberError] = useState('');

  const { data, isLoading } = useQuery<SectionDetail>({
    queryKey: ['section-detail', sectionId],
    queryFn: () => api.get<SectionDetail>(`/class-sections/${sectionId}`),
    enabled: !!sectionId,
  });

  const addStudent = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/class-sections/${sectionId}/students`, { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section-detail', sectionId] });
      setMemberUserId('');
      setMemberError('');
    },
    onError: () => setMemberError('Failed to add student.'),
  });

  const removeStudent = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/class-sections/${sectionId}/students/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['section-detail', sectionId] }),
  });

  const addTeacher = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/class-sections/${sectionId}/teachers`, { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section-detail', sectionId] });
      setMemberUserId('');
      setMemberError('');
    },
    onError: () => setMemberError('Failed to add teacher.'),
  });

  const removeTeacher = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/class-sections/${sectionId}/teachers/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['section-detail', sectionId] }),
  });

  function handleAddMember(type: 'student' | 'teacher') {
    const parsed = MemberSchema.safeParse({ userId: memberUserId.trim() });
    if (!parsed.success) { setMemberError('Enter a valid user UUID.'); return; }
    if (type === 'student') addStudent.mutate(parsed.data.userId);
    else addTeacher.mutate(parsed.data.userId);
  }

  if (!sectionId) return null;

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 440, background: 'white', borderLeft: '1px solid #e2e8f0', zIndex: 50, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Section Details</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data ? (
        <p className="text-sm text-destructive">Failed to load.</p>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Info</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="font-medium">Name:</span> {data.name}</p>
              {data.gradeLevel && <p><span className="font-medium">Grade:</span> {data.gradeLevel}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Teachers ({data.teachers.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.teachers.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span>{t.fullName}</span>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeTeacher.mutate(t.id)}>Remove</Button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Input placeholder="Teacher UUID" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} className="text-xs" />
                <Button size="sm" onClick={() => handleAddMember('teacher')}>Add</Button>
              </div>
              {memberError && <p className="text-xs text-destructive">{memberError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Students ({data.students.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.students.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.fullName} {s.studentId && <span className="text-muted-foreground">({s.studentId})</span>}</span>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeStudent.mutate(s.id)}>Remove</Button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Input placeholder="Student UUID" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} className="text-xs" />
                <Button size="sm" onClick={() => handleAddMember('student')}>Add</Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Class sections management page — list sections, add/edit/delete, manage rosters. */
export function ClassSectionsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassSection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: years = [] } = useQuery<SchoolYear[]>({
    queryKey: ['school-years'],
    queryFn: () => api.get<SchoolYear[]>('/school-years'),
  });

  const { data: sections = [], isLoading, error } = useQuery<ClassSection[]>({
    queryKey: ['class-sections'],
    queryFn: () => api.get<ClassSection[]>('/class-sections'),
  });

  const create = useMutation({
    mutationFn: (body: SectionForm) => api.post<ClassSection>('/class-sections', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['class-sections'] }); setDialogOpen(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: SectionForm & { id: string }) =>
      api.patch<ClassSection>(`/class-sections/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['class-sections'] }); setEditing(null); setDialogOpen(false); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/class-sections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class-sections'] }),
  });

  function handleSave(form: SectionForm) {
    if (editing) update.mutate({ id: editing.id, ...form });
    else create.mutate(form);
  }

  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? id;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Class Sections</h1>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>+ Add Section</Button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">Failed to load sections.</p>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections yet.</p>
          ) : (
            sections.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {yearName(s.schoolYearId)}{s.gradeLevel ? ` · Grade ${s.gradeLevel}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedId(s.id)}>Roster</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(s.id)}>Delete</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <SectionFormDialog
        open={dialogOpen}
        initial={editing}
        years={years}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
      />

      <SectionDetailDrawer
        sectionId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
