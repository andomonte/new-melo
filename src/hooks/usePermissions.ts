// src/hooks/usePermissions.ts
import { useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';

export interface UserPermissions {
  // Ações básicas
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canView: boolean;
  
  // Ações específicas de compras
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canManageItems: boolean;
  canCancel: boolean;
  
  // Ações administrativas
  canManageUsers: boolean;
  canViewReports: boolean;
  canExport: boolean;
}

export interface RequisitionPermissions extends UserPermissions {
  // Permissões específicas para uma requisição
  canEditThisRequisition: boolean;
  canDeleteThisRequisition: boolean;
  canSubmitThisRequisition: boolean;
  canApproveThisRequisition: boolean;
}

/**
 * Hook para gerenciar permissões baseado no sistema existente
 * Usa o perfil do usuário e permissões já existentes no projeto
 * Integra com as telas de compras cadastradas no banco
 */
export function usePermissions(): UserPermissions {
  const { user } = useContext(AuthContext);
  
  // Debug removido
  
  if (!user || !user.usuario) {
    // Usuário não logado - sem permissões
    return {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canView: false,
      canSubmit: false,
      canApprove: false,
      canReject: false,
      canManageItems: false,
      canCancel: false,
      canManageUsers: false,
      canViewReports: false,
      canExport: false,
    };
  }

  // Verificar se o usuário tem acesso às telas de compras
  const hasComprasAccess = user.permissoes?.some(p => 
    p.tb_telas?.PATH_TELA?.includes('compra') || 
    p.tb_telas?.PATH_TELA?.includes('comprador')
  );

  if (!hasComprasAccess) {
    // Usuário sem acesso ao módulo de compras
    return {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canView: false,
      canSubmit: false,
      canApprove: false,
      canReject: false,
      canManageItems: false,
      canCancel: false,
      canManageUsers: false,
      canViewReports: false,
      canExport: false,
    };
  }

  // Verificar permissão específica de edição na tela atual
  const currentScreen = sessionStorage.getItem('telaAtualMelo');
  let canEditOnCurrentScreen = false;
  
  if (currentScreen) {
    try {
      const parsedScreen = typeof currentScreen === 'string' ? JSON.parse(currentScreen) : currentScreen;
      const screenPermission = user.permissoes?.find(
        p => p.tb_telas?.PATH_TELA === parsedScreen
      );
      canEditOnCurrentScreen = screenPermission?.editar === true;
    } catch {
      canEditOnCurrentScreen = false;
    }
  }

  // Usar o perfil existente do sistema
  const userProfile = user.perfil?.toUpperCase()?.trim();
  const isAdmin = userProfile === 'ADMINISTRAÇÃO' || userProfile === 'ADMINISTRACAO';
  const isDiretor = userProfile === 'DIRETOR';
  const isCompras = userProfile === 'COMPRAS';
  
  // DIRETOR tem privilégios de aprovação similares ao admin
  const canApproveAndReject = isAdmin || isDiretor;
  
  // ADMINISTRAÇÃO tem acesso total
  if (isAdmin) {
    return {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canView: true,
      canSubmit: true,
      canApprove: true,
      canReject: true,
      canManageItems: true,
      canCancel: true,
      canManageUsers: true,
      canViewReports: true,
      canExport: true,
    };
  }
  
  // DIRETOR tem privilégios de aprovação
  if (isDiretor) {
    return {
      canCreate: canEditOnCurrentScreen,
      canEdit: canEditOnCurrentScreen,
      canDelete: false,
      canView: true,
      canSubmit: canEditOnCurrentScreen,
      canApprove: true, // DIRETOR pode aprovar
      canReject: true,  // DIRETOR pode reprovar
      canManageItems: canEditOnCurrentScreen,
      canCancel: canEditOnCurrentScreen,
      canManageUsers: false,
      canViewReports: true,
      canExport: true,
    };
  }

  // COMPRAS tem permissões específicas do módulo
  if (isCompras) {
    return {
      canCreate: canEditOnCurrentScreen,
      canEdit: canEditOnCurrentScreen,
      canDelete: canEditOnCurrentScreen,
      canView: true,
      canSubmit: canEditOnCurrentScreen,
      canApprove: false, // Não pode aprovar suas próprias requisições
      canReject: false,
      canManageItems: canEditOnCurrentScreen,
      canCancel: canEditOnCurrentScreen,
      canManageUsers: false,
      canViewReports: true,
      canExport: true,
    };
  }

  // Para outros perfis, usar permissões mais restritivas
  return {
    canCreate: canEditOnCurrentScreen,
    canEdit: canEditOnCurrentScreen,
    canDelete: false, // Só admin e compras podem deletar
    canView: true, // Se tem acesso ao módulo, pode visualizar
    canSubmit: canEditOnCurrentScreen,
    canApprove: canApproveAndReject, // Admin ou Diretor podem aprovar
    canReject: canApproveAndReject, // Admin ou Diretor podem reprovar
    canManageItems: canEditOnCurrentScreen,
    canCancel: canEditOnCurrentScreen,
    canManageUsers: isAdmin,
    canViewReports: true,
    canExport: true,
  };
}

/**
 * Hook para verificar permissões específicas para uma requisição
 * Integra com o sistema de permissões existente
 */
export function useRequisitionPermissions(requisition: RequisitionDTO): RequisitionPermissions {
  const basePermissions = usePermissions();
  const { user } = useContext(AuthContext);

  // Se não tem permissão base, não tem permissão específica
  if (!basePermissions.canView) {
    return {
      ...basePermissions,
      canEditThisRequisition: false,
      canDeleteThisRequisition: false,
      canSubmitThisRequisition: false,
      canApproveThisRequisition: false,
    };
  }

  const userProfile = user?.perfil?.toUpperCase()?.trim();
  const isAdmin = userProfile === 'ADMINISTRAÇÃO';
  const isDiretor = userProfile === 'DIRETOR';
  const isCompras = userProfile === 'COMPRAS';

  // Admin ou Diretor podem fazer tudo relacionado à aprovação
  if (isAdmin || isDiretor) {
    return {
      ...basePermissions,
      canEditThisRequisition: true,
      canDeleteThisRequisition: true,
      canSubmitThisRequisition: true,
      canApproveThisRequisition: true,
    };
  }

  // Para outros perfis, aplicar regras específicas
  // Verificar se é o dono da requisição
  const isOwner = requisition.compradorNome === user?.usuario;
  const isPending = requisition.statusRequisicao === 'P'; // Pendente
  const isSubmitted = requisition.statusRequisicao === 'S'; // Submetida
  
  // Regras baseadas no documento:
  // - Comprador pode editar suas próprias requisições pendentes
  // - Não pode aprovar suas próprias requisições
  // - Admin pode aprovar qualquer requisição submetida
  const canModifyOwn = isOwner && isPending && basePermissions.canEdit;

  return {
    ...basePermissions,
    canEditThisRequisition: canModifyOwn,
    canDeleteThisRequisition: canModifyOwn && basePermissions.canDelete,
    canSubmitThisRequisition: canModifyOwn,
    canApproveThisRequisition: !isOwner && isSubmitted && basePermissions.canApprove,
  };
}