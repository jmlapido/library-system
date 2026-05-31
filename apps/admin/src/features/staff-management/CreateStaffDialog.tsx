import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const CreateSchema = z.object({
  fullName: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['librarian', 'library_assistant', 'admin']),
});
type CreateForm = z.infer<typeof CreateSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Dialog for creating a new staff account and sending an invite email. */
export function CreateStaffDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const schoolId = useAuthStore((s) => s.user?.schoolId ?? '');

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(CreateSchema) });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) =>
      api.post('/admin/staff', { ...data, schoolId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', 'active'] });
      reset();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Staff Account</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => createMutation.mutate(d))}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="csFullName">Full Name</Label>
            <Input id="csFullName" {...register('fullName')} />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="csEmail">Email</Label>
            <Input id="csEmail" type="email" {...register('email')} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select onValueChange={(v) => setValue('role', v as CreateForm['role'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="librarian">Librarian</SelectItem>
                <SelectItem value="library_assistant">Library Assistant</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>
          {createMutation.isError && (
            <p className="text-sm text-destructive">Failed to send invite. Try again.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
