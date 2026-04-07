/* import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token_melo')?.value;
 
  const signInURL = new URL('/login', request.url);
  if (!token) {
    return NextResponse.redirect(signInURL);
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/filial/:path*', '/', '/administracao/:path*', '/vendas/:path*'], //'/filial/:path*',
};
 */

import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next(); // deixa a requisição passar normalmente
}

export const config = {
  matcher: [], // nenhuma rota será interceptada
};
