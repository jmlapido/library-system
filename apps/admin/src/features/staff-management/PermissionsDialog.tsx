import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ALL_GRANTABLE_PERMISSIONS, ROLE_FLOORS } from '../../lib/permissions';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';

interface StaffMember {
  id: string;
  fullName: string;
  role: string;
}

interface Props {
  staff: StaffMember | null;
  onClose: () => void;
}

/** Dialog for viewing and editing per-staff permission overrides above their role floor. */
export function PermissionsDialog({ staff, onClose }: Props) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ['staff', 'permissions', staff?.id],
    queryFn: () => api.get<{ permissions: string[] }>(`/admin/staff/${staff!.id}/permissions`),
    enabled: !!staff,
  });

  useEffect(() => {
    if (data) setChecked(new Set(data.permissions));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/staff/${staff!.id}/permissions`, {
        permissions: Array.from(checked),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', 'active'] });
      onClose();
    },
  });

  if (!staff) return null;

  const floor = new Set(ROLE_FLOORS[staff.role as keyof typeof ROLE_FLOORS] ?? []);

  function toggle(perm: string) {
    if (floor.has(perm as never)) return;
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
  }

  return (
    <Dialog open={!!staff} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissions — {staff.fullName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {ALL_GRANTABLE_PERMISSIONS.map((perm) => {
            const isFloor = floor.has(perm as never);
            const isChecked = isFloor || checked.has(perm);
            return (
              <div key={perm} className="flex items-center gap-3">
                <Checkbox
                  id={perm}
                  checked={isChecked}
                  disabled={isFloor}
                  onCheckedChange={() => toggle(perm)}
                />
                <Label
                  htmlFor={perm}
                  className={`text-sm font-mono ${isFloor ? 'text-muted-foreground' : ''}`}
                >
                  {perm}
                  {isFloor && (
                    <span className="ml-2 text-xs">
                      (included in {staff.role.replace('_', ' ')} role)
                    </span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
