// Exemplo de como usar o componente DadosCobranca em outras telas
// Por exemplo, na consulta de faturas

import React, { useState, useEffect } from 'react';
import DadosCobranca from '@/components/common/DadosCobranca';

interface ConsultaFaturaProps {
  id?: string;
}

export default function ConsultaFatura({ }: ConsultaFaturaProps) {
  // Estados necessários para o componente DadosCobranca
  const [statusVenda, setStatusVenda] = useState({ cobranca: 'S' });
  const [bancos, setBancos] = useState([]);
  const [formCobranca, setFormCobranca] = useState({
    banco: '',
    tipoFatura: '',
    prazoSelecionado: '',
    valorVista: '',
    habilitarValor: false,
    impostoNa1Parcela: false,
    freteNa1Parcela: false,
  });
  const [parcelas, setParcelas] = useState<{ dias: number; vencimento: string }[]>([]);
  const [opcoesTipoFatura, setOpcoesTipoFatura] = useState([
    { value: 'BOLETO', label: 'BOLETO' },
    { value: 'BOLETO BANCARIO', label: 'BOLETO BANCÁRIO' },
    { value: 'DM', label: 'DUPLICATA MERCANTIL' },
  ]);

  // Carregar dados dos bancos ao montar o componente
  useEffect(() => {
    const carregarBancos = async () => {
      try {
        const response = await fetch('/api/faturamento/opcoes-cobranca');
        const data = await response.json();
        setBancos(data.bancos);
      } catch (error) {
        console.error('Erro ao carregar bancos:', error);
      }
    };

    carregarBancos();
  }, []);

  const handleGerarPreviewBoleto = () => {
    // Implementar lógica de geração de preview do boleto
    console.log('Gerar preview do boleto');
  };

  return (
    <div>
      {/* Seus outros componentes da consulta de fatura */}
      
      {/* Componente de cobrança reutilizável */}
      <DadosCobranca
        statusVenda={statusVenda}
        bancos={bancos}
        formCobranca={formCobranca}
        setFormCobranca={setFormCobranca}
        parcelas={parcelas}
        setParcelas={setParcelas}
        opcoesTipoFatura={opcoesTipoFatura}
        onGerarPreviewBoleto={handleGerarPreviewBoleto}
        padraoAberto={false} // pode ser false se não quiser aberto por padrão
      />
      
      {/* Seus outros componentes */}
    </div>
  );
}
