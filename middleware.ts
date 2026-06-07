import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Se acessar rotas de administração global e não for SUPERADMIN, redireciona
    if (path.startsWith('/admin') && token?.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/?error=AccessDenied', req.url));
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Matcher para interceptar painel do admin e áreas de projetos do CRM
export const config = {
  matcher: ['/admin/:path*', '/project/:path*'],
};
