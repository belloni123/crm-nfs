import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main 
      className="flex-1 flex flex-col items-center justify-center p-6 bg-cover bg-center bg-no-repeat relative min-h-screen"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* Dark overlay for contrast and premium look */}
      <div className="absolute inset-0 bg-[#050505]/75 pointer-events-none z-0" />

      <div className="w-full max-w-[420px] px-6 py-12 flex flex-col items-center justify-center relative z-10">
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
