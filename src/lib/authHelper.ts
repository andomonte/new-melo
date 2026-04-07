import { NextApiRequest } from 'next';
import { getCookie } from 'cookies-next';

interface UserSession {
  login_user_login: string;
  login_user_name: string;
  perfil: string;
  filial: string;
}

/**
 * Extrai informações do usuário autenticado da sessão
 * Utiliza tanto cookies quanto cabeçalhos para obter dados do usuário
 */
export function getUserFromRequest(req: NextApiRequest): UserSession | null {
  try {
    // Primeiro, tenta obter do cookie
    const tokenCookie = getCookie('token_melo', { req });
    if (tokenCookie && typeof tokenCookie === 'string') {
      const userLogin = tokenCookie.replace('-cookiesmelo', '');
      
      // Se tem cookie, tenta obter dados adicionais do sessionStorage via headers
      const userDataHeader = req.headers['x-user-data'];
      if (userDataHeader && typeof userDataHeader === 'string') {
        try {
          const userData = JSON.parse(decodeURIComponent(userDataHeader));
          return {
            login_user_login: userData.usuario || userLogin,
            login_user_name: userData.login_user_name || userData.usuario || userLogin,
            perfil: userData.perfil || 'SISTEMA',
            filial: userData.filial || 'PADRÃO'
          };
        } catch (parseError) {
          console.warn('Erro ao parsear dados do usuário do header:', parseError);
        }
      }
      
      // Se não conseguiu obter dados completos, retorna dados básicos do cookie
      return {
        login_user_login: userLogin,
        login_user_name: userLogin,
        perfil: 'SISTEMA', 
        filial: 'PADRÃO'
      };
    }
    
    // Fallback: tenta obter do header de autorização
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const userData = JSON.parse(authHeader);
      return {
        login_user_login: userData.usuario || userData.login_user_login || 'SYSTEM',
        login_user_name: userData.login_user_name || userData.usuario || 'Usuário do Sistema',
        perfil: userData.perfil || 'SISTEMA',
        filial: userData.filial || 'PADRÃO'
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Erro ao extrair usuário da requisição:', error);
    return null;
  }
}

/**
 * Obtém dados do usuário ou retorna valores padrão para SYSTEM
 */
export function getUserOrDefault(req: NextApiRequest): UserSession {
  const user = getUserFromRequest(req);
  return user || {
    login_user_login: 'SYSTEM',
    login_user_name: 'Usuário do Sistema',
    perfil: 'SISTEMA',
    filial: 'SISTEMA'
  };
}