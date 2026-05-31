import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../../lib/api';
import { useAuthStore, type AdminUser } from '../../stores/auth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});
type LoginForm = z.infer<typeof LoginSchema>;

const ERROR_MESSAGES: Record<string, string> = {
  APPROVAL_PENDING: 'Your account is awaiting admin approval',
  ACCOUNT_INACTIVE: 'Your account has been deactivated',
  EMAIL_NOT_VERIFIED: 'Check your email to verify your account',
  INVALID_CREDENTIALS: 'Invalid email or password',
};

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(LoginSchema) });

  async function onSubmit(data: LoginForm) {
    setServerError(null);
    try {
      const result = await api.post<LoginResponse>('/auth/login', {
        identifier: data.email,
        credential: data.password,
      });
      setSession(result);
      navigate(result.user.role === 'admin' ? '/staff-management' : '/circulation', {
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(ERROR_MESSAGES[err.code] ?? 'Login failed. Please try again.');
      } else {
        setServerError('An unexpected error occurred.');
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">LibraMS Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {serverError && (
              <p className="text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
