/**
 * Login da Alocação — mesmo modelo do Recebimento e das estações: filial pelo link
 * (/alocacao/1 = MANAUS), matrícula + código pessoal, primeiro acesso cria o código.
 * Reaproveita a tela do Recebimento com as chamadas da alocação.
 */
import React from 'react';
import LoginRecebimento from '../recebimento-entrada/LoginRecebimento';
import { loginAlocador, criarCodigoAlocador, Alocador } from '@/data/alocacao/alocacaoService';

interface Props {
  filial: string;
  onLoginSuccess: (alocador: Alocador) => void;
  onTrocarFilial?: () => void;
}

const LoginAlocacao: React.FC<Props> = ({ filial, onLoginSuccess, onTrocarFilial }) => (
  <LoginRecebimento
    filial={filial}
    onLoginSuccess={onLoginSuccess}
    onTrocarFilial={onTrocarFilial}
    titulo="Alocação"
    subtitulo="Informe sua matrícula e seu código para alocar as entradas recebidas"
    fazerLogin={loginAlocador}
    criarCodigo={criarCodigoAlocador}
  />
);

export default LoginAlocacao;
