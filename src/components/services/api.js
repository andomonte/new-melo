import axios from 'axios';

const api = axios.create({
  baseURL: process.env.UPLOAD_FOTOS,
});

// Interceptor para adicionar dados de autenticação automaticamente
api.interceptors.request.use(
  (config) => {
    try {
      // Obter dados do usuário do sessionStorage
      const userSession = sessionStorage.getItem('perfilUserMelo');
      if (userSession) {
        const userData = JSON.parse(userSession);
        
        // Adicionar header com dados do usuário para captura em APIs
        config.headers['x-user-data'] = encodeURIComponent(JSON.stringify({
          usuario: userData.usuario,
          login_user_name: userData.usuario, // Pode ser melhorado se houver campo específico
          perfil: userData.perfil,
          filial: userData.filial
        }));
      }
    } catch (error) {
      console.warn('Erro ao adicionar dados de autenticação à requisição:', error);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
