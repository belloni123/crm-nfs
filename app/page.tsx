import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-bg-base">
      <div className="w-full max-w-[420px] px-6 py-12 flex flex-col items-center justify-center">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center text-text-secondary text-xs">
            Carregando...
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
