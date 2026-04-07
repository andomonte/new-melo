import React, { useState } from 'react';
import ModalFormulario from '@/components/common/modalform';
import FormInput from '@/components/common/FormInput';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cliente: any;
}

const tipoClienteMap: { [key: string]: string } = {
  J: 'Jurídico',
  X: 'Exterior',
  F: 'Física',
};

export default function DetalhesClienteModal({ isOpen, onClose, cliente }: Props) {
  const [activeTab, setActiveTab] = useState<'dados' | 'endereco' | 'cobranca' | 'fiscais' | 'financeiro' | 'comercial'>('dados');

  if (!isOpen || !cliente) return null;

  const renderDadosCadastrais = () => (
    <div className="grid grid-cols-3 gap-4">
      <FormInput label="Código" value={cliente.codcli} readOnly name="codcli" type="text" />
      <FormInput label="CNPJ/CPF" value={cliente.cpfcgc} readOnly name="cpfcgc" type="text" />
      <FormInput label="Tipo" value={`${cliente.tipo} - ${tipoClienteMap[cliente.tipo] || ''}`} readOnly name="tipo" type="text" />
      <FormInput label="Nome Fantasia" value={cliente.nomefant ?? '—'} readOnly name="nomefant" type="text" />
      <FormInput label="Classe Pgto" value={cliente.claspgto ?? '—'} readOnly name="claspgto" type="text" />
      <FormInput label="Situação Tributária" value={cliente.sit_tributaria?.toString() ?? '—'} readOnly name="sit_tributaria" type="text" />
      <FormInput label="Tipo Empresa" value={cliente.tipoemp ?? '—'} readOnly name="tipoemp" type="text" />
    </div>
  );

  const renderEndereco = () => (
    <div className="grid grid-cols-3 gap-4">
      <FormInput label="Endereço" value={cliente.ender ?? '—'} readOnly name="ender" type="text" />
      <FormInput label="Número" value={cliente.numero ?? '—'} readOnly name="numero" type="text" />
      <FormInput label="Complemento" value={cliente.complemento ?? '—'} readOnly name="complemento" type="text" />
      <FormInput label="Bairro" value={cliente.bairro ?? '—'} readOnly name="bairro" type="text" />
      <FormInput label="Cidade" value={cliente.cidade ?? '—'} readOnly name="cidade" type="text" />
      <FormInput label="UF" value={cliente.uf ?? '—'} readOnly name="uf" type="text" />
      <FormInput label="CEP" value={cliente.cep ?? '—'} readOnly name="cep" type="text" />
      <FormInput label="Referência" value={cliente.referencia ?? '—'} readOnly name="referencia" type="text" />
    </div>
  );

  const renderCobranca = () => (
    <div className="grid grid-cols-3 gap-4">
      <FormInput label="Endereço Cobrança" value={cliente.endercobr ?? '—'} readOnly name="endercobr" type="text" />
      <FormInput label="Número" value={cliente.numerocobr ?? '—'} readOnly name="numerocobr" type="text" />
      <FormInput label="Complemento" value={cliente.complementocobr ?? '—'} readOnly name="complementocobr" type="text" />
      <FormInput label="Bairro Cobrança" value={cliente.bairrocobr ?? '—'} readOnly name="bairrocobr" type="text" />
      <FormInput label="Cidade Cobrança" value={cliente.cidadecobr ?? '—'} readOnly name="cidadecobr" type="text" />
      <FormInput label="UF Cobrança" value={cliente.ufcobr ?? '—'} readOnly name="ufcobr" type="text" />
      <FormInput label="CEP Cobrança" value={cliente.cepcobr ?? '—'} readOnly name="cepcobr" type="text" />
      <FormInput label="Referência Cobrança" value={cliente.referenciacobr ?? '—'} readOnly name="referenciacobr" type="text" />
    </div>
  );

  const renderFiscais = () => (
    <div className="grid grid-cols-3 gap-4">
      <FormInput label="IE" value={cliente.iest ?? '—'} readOnly name="iest" type="text" />
      <FormInput label="IM" value={cliente.imun ?? '—'} readOnly name="imun" type="text" />
      <FormInput label="Suframa" value={cliente.isuframa ?? '—'} readOnly name="isuframa" type="text" />
      <FormInput label="Habilita Suframa" value={cliente.habilitasuframa ?? '—'} readOnly name="habilitasuframa" type="text" />
      <FormInput label="ICMS" value={cliente.icms ?? '—'} readOnly name="icms" type="text" />
      <FormInput label="IPI" value={cliente.ipi ?? '—'} readOnly name="ipi" type="text" />
    </div>
  );

  const renderFinanceiro = () => (
    <div className="grid grid-cols-3 gap-4">
      <FormInput label="Email" value={cliente.email ?? '—'} readOnly name="email" type="text" />
      <FormInput label="Email NFe" value={cliente.emailnfe ?? '—'} readOnly name="emailnfe" type="text" />
      <FormInput label="Débito em Conta" value={`R$ ${(parseFloat(cliente.debito) || 0).toFixed(2)}`} readOnly name="debito" type="text" />
      <FormInput label="Limite de Crédito" value={`R$ ${(parseFloat(cliente.limite) || 0).toFixed(2)}`} readOnly name="limite" type="text" />
      <FormInput label="Observações" value={cliente.obs ?? '—'} readOnly name="obs" type="text" />
      <FormInput label="Banco" value={`${cliente.banco_codigo ?? ''} - ${cliente.banco_nome ?? '—'}`} readOnly name="banco" type="text" />
      <FormInput label="Tipo de Conta" value={cliente.dados_banco?.tipo ?? '—'} readOnly name="tipo_conta" type="text" />
      <FormInput label="Número da Conta" value={cliente.dados_banco?.nroconta ?? '—'} readOnly name="nroconta" type="text" />
      <FormInput label="Convênio" value={cliente.dados_banco?.convenio ?? '—'} readOnly name="convenio" type="text" />
      <FormInput label="Variação" value={cliente.dados_banco?.variacao ?? '—'} readOnly name="variacao" type="text" />
      <FormInput label="Carteira" value={cliente.dados_banco?.carteira ?? '—'} readOnly name="carteira" type="text" />
      <FormInput label="Agência" value={cliente.dados_banco?.agencia ?? '—'} readOnly name="agencia" type="text" />
    </div>
  );

  const renderComercial = () => (
    <div className="grid grid-cols-3 gap-4">
      <FormInput label="Desconto" value={cliente.desconto?.toFixed(2) ?? '0.00'} readOnly name="desconto" type="text" />
      <FormInput label="Acréscimo" value={cliente.acrescimo?.toFixed(2) ?? '0.00'} readOnly name="acrescimo" type="text" />
      <FormInput label="Vendedor Externo" value={cliente.codvend ?? '—'} readOnly name="codvend" type="text" />
      <FormInput label="Vendedor Tmk" value={cliente.codtmk ?? '—'} readOnly name="codtmk" type="text" />
      <FormInput label="Bloquear Preço Venda" value={cliente.bloquear_preco ?? '—'} readOnly name="bloquear_preco" type="text" />
      <FormInput label="KickBack" value={cliente.kickback?.toString() ?? '—'} readOnly name="kickback" type="text" />
    </div>
  );

  return (
    <ModalFormulario
      titulo={`Detalhes do Cliente — ${cliente.nome}`}
      footer={null}
      tabs={[
    { key: 'dados', name: 'Dados Cadastrais' },
    { key: 'endereco', name: 'Endereço' },
    { key: 'cobranca', name: 'Cobrança' },
    { key: 'fiscais', name: 'Dados Fiscais' },
    { key: 'financeiro', name: 'Contato & Financeiro' },
    { key: 'comercial', name: 'Dados Comerciais' },
  ]}
      activeTab={activeTab}
      setActiveTab={(tab: string) => setActiveTab(tab as 'dados' | 'endereco' | 'cobranca' | 'fiscais' | 'financeiro' | 'comercial')}
      handleSubmit={onClose}
      handleClear={onClose}
      onClose={onClose}
      renderTabContent = {()=>{
        switch (activeTab) {
          case 'dados':
            return renderDadosCadastrais();
          case 'endereco':
            return renderEndereco();
          case 'cobranca':
            return renderCobranca();
          case 'fiscais':
            return renderFiscais();
          case 'financeiro':
            return renderFinanceiro();
          case 'comercial':
            return renderComercial();
          default:
            return null;
        }
      }}
    />
  );
}
