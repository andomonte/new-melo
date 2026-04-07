// lib/impostos/calculadoraImpostos.ts

/**
 * Biblioteca de cálculo de impostos
 * Utiliza functions SQL do PostgreSQL para cálculos precisos
 */

import { PoolClient } from 'pg';
import {
  DadosCalculoImposto,
  ResultadoCalculoImposto,
  DadosProduto,
  DadosCliente,
  AliquotasICMS,
  DadosIBSCBS,
  ValidacaoResultado,
  CSTICMS,
  CSTIPI,
  CSTPISCOFINS,
} from './types';

/**
 * Classe principal para cálculo de impostos
 */
export class CalculadoraImpostos {
  constructor(private client: PoolClient) {}

  /**
   * Calcula todos os impostos para um item
   */
  async calcular(dados: DadosCalculoImposto): Promise<ResultadoCalculoImposto> {
    const inicio = Date.now();
    const observacoes: string[] = [];
    const warnings: string[] = [];

    // 1. Validar dados de entrada
    const validacao = this.validarDados(dados);
    if (!validacao.valido) {
      throw new Error(`Dados inválidos: ${validacao.erros.join(', ')}`);
    }
    warnings.push(...validacao.warnings);

    // 2. Buscar dados do produto
    const produto = await this.buscarDadosProduto(
      dados.produto_id,
      dados.ncm
    );
    observacoes.push(`Produto: ${produto.descricao} (NCM: ${produto.ncm})`);

    // 3. Buscar dados do cliente
    const cliente = await this.buscarDadosCliente(dados.cliente_id);
    observacoes.push(`Cliente: ${cliente.nome} (${cliente.uf})`);

    // 4. Buscar UF da empresa
    const ufEmpresa = dados.uf_empresa || (await this.buscarUFEmpresa());
    observacoes.push(`UF Empresa: ${ufEmpresa}`);

    // 5. Determinar UF cliente
    const ufCliente = dados.uf_cliente || cliente.uf;

    // 6. Verificar se é operação interna ou interestadual
    const operacaoInterna = ufEmpresa === ufCliente;
    const operacaoInterestadual = !operacaoInterna;

    // 7. Calcular CFOP
    const { cfop, tipocfop } = await this.calcularCFOP(
      dados.tipo_operacao,
      ufEmpresa,
      ufCliente
    );
    observacoes.push(`CFOP: ${cfop} - ${tipocfop}`);

    // 8. Buscar alíquotas ICMS
    const aliquotasOrigem = await this.buscarAliquotasICMS(ufEmpresa);
    const aliquotasDestino = await this.buscarAliquotasICMS(ufCliente);

    // 9. Calcular valores básicos
    const valorTotalItem =
      dados.quantidade * dados.valor_produto - (dados.desconto || 0);

    // 10. Determinar alíquotas do produto
    // SIMPLIFICADO: Usar sempre os valores do produto
    // (o Delphi parece fazer isso ao invés de seguir as regras complexas do procedimento Oracle)
    const isVenda = dados.tipo_operacao === 'VENDA';
    const isCompra = dados.tipo_operacao === 'COMPRA' || dados.tipo_operacao === 'ENTRADA';

    const ipiAliquota = dados.ipi_aliquota ?? produto.ipi;
    const pisAliquota = dados.pis_aliquota ?? produto.pis;
    const cofinsAliquota = dados.cofins_aliquota ?? produto.cofins;

    // CST padrão para venda
    const cstpisCalculado = isVenda ? '01' : '50';
    const cstcofinsCalculado = isVenda ? '01' : '50';

    // 11. Calcular IPI (com TODAS as regras do procedimento Oracle)
    const ipi = await this.calcularIPI(
      valorTotalItem,
      produto,
      ufEmpresa,
      ufCliente,
      cliente,
      dados.tipo_operacao
    );

    // 12. Calcular ICMS
    const icms = await this.calcularICMS(
      valorTotalItem,
      aliquotasOrigem,
      aliquotasDestino,
      operacaoInterna,
      dados
    );

    // 13. Verificar e calcular ST
    const st = await this.calcularST(
      valorTotalItem,
      ipi.totalipi,
      produto.ncm,
      ufEmpresa,
      ufCliente,
      operacaoInterna,
      aliquotasOrigem,
      aliquotasDestino
    );

    if (st.tem_st) {
      observacoes.push(
        `ST aplicada: MVA ${st.mva_ajustado.toFixed(2)}% (${st.origem_mva})`
      );
    }

    // 14. Calcular PIS/COFINS
    // Base de cálculo: APENAS o valor do produto (SEM IPI)
    const pis = this.calcularPIS(
      valorTotalItem,
      pisAliquota,
      produto,
      dados,
      ufEmpresa,
      ufCliente,
      cliente
    );
    const cofins = this.calcularCOFINS(
      valorTotalItem,
      cofinsAliquota,
      produto,
      dados,
      ufEmpresa,
      ufCliente,
      cliente
    );

    // 15. Calcular FCP (se aplicável)
    const fcp = this.calcularFCP(
      icms.baseicms,
      st.basesubst_trib,
      aliquotasDestino
    );

    // 16. Calcular IBS/CBS (Reforma 2026)
    const ibsCbs = await this.calcularIBSCBS(
      produto.ncm,
      valorTotalItem,
      dados.data_operacao
    );

    if (ibsCbs.informativo) {
      observacoes.push(
        `IBS/CBS: Valores informativos (Reforma 2026) - Total: ${(ibsCbs.ibs_valor + ibsCbs.cbs_valor).toFixed(2)}`
      );
    }

    // 17. Determinar CSTs
    const csticms = await this.determinarCSTICMS(
      st.tem_st,
      dados.base_icms_reduzida || false,
      dados.isento_icms || false
    );
    const cstipi = this.determinarCSTIPI(produto, dados.tipo_operacao);
    const cstpis = isVenda ? cstpisCalculado : this.determinarCSTPISCOFINS(produto, dados.tipo_operacao);
    const cstcofins = isVenda ? cstcofinsCalculado : cstpis;

    // 18. Montar resultado completo
    const resultado: ResultadoCalculoImposto = {
      // Valores básicos
      valor_produto: dados.valor_produto,
      quantidade: dados.quantidade,
      valor_total_item: valorTotalItem,
      desconto: dados.desconto || 0,

      // ICMS
      cfop,
      tipocfop,
      icms: icms.aliquota,
      baseicms: icms.baseicms,
      totalicms: icms.totalicms,
      icmsinterno_dest: aliquotasDestino.icms_interno,
      icmsexterno_orig: operacaoInterestadual ? aliquotasOrigem.icms_externo : 0,
      csticms,

      // ST
      tem_st: st.tem_st,
      mva: st.mva_ajustado,
      basesubst_trib: st.basesubst_trib,
      totalsubst_trib: st.totalsubst_trib,
      protocolo_icms: st.protocolo,
      origem_mva: st.origem_mva,

      // IPI
      ipi: ipi.aliquota,
      baseipi: ipi.baseipi,
      totalipi: ipi.totalipi,
      cstipi,

      // PIS
      pis: pis.aliquota,
      basepis: pis.basepis,
      valorpis: pis.valorpis,
      cstpis,

      // COFINS
      cofins: cofins.aliquota,
      basecofins: cofins.basecofins,
      valorcofins: cofins.valorcofins,
      cstcofins,

      // FCP
      fcp: fcp.aliquota,
      base_fcp: fcp.base_fcp,
      valor_fcp: fcp.valor_fcp,
      fcp_subst: fcp.aliquota_st,
      basefcp_subst: fcp.base_fcp_st,
      valorfcp_subst: fcp.valor_fcp_st,

      // IBS/CBS
      ibs_aliquota: ibsCbs.aliquota_ibs,
      ibs_e: ibsCbs.ibs_e, // IBS Estadual (substitui ICMS)
      ibs_m: ibsCbs.ibs_m, // IBS Municipal (substitui ISS)
      ibs_valor: ibsCbs.ibs_valor,
      cbs_aliquota: ibsCbs.aliquota_cbs,
      cbs_valor: ibsCbs.cbs_valor,
      ibs_cbs_informativo: ibsCbs.informativo,

      // Metadados
      ncm: produto.ncm,
      cest: produto.cest,
      origem_mercadoria: produto.strib || '0',

      // Operação
      operacao_interna: operacaoInterna,
      operacao_interestadual: operacaoInterestadual,

      // Debug
      observacoes,
      warnings,
      timestamp: new Date(),
    };

    const duracao = Date.now() - inicio;
    observacoes.push(`Cálculo executado em ${duracao}ms`);

    return resultado;
  }

  /**
   * Valida dados de entrada
   */
  private validarDados(dados: DadosCalculoImposto): ValidacaoResultado {
    const erros: string[] = [];
    const warnings: string[] = [];

    if (!dados.ncm || dados.ncm.length < 8) {
      erros.push('NCM deve ter no mínimo 8 dígitos');
    }

    if (!dados.cliente_id || dados.cliente_id <= 0) {
      erros.push('Cliente ID inválido');
    }

    if (!dados.valor_produto || dados.valor_produto <= 0) {
      erros.push('Valor do produto deve ser maior que zero');
    }

    if (!dados.quantidade || dados.quantidade <= 0) {
      erros.push('Quantidade deve ser maior que zero');
    }

    if (!dados.tipo_operacao) {
      erros.push('Tipo de operação obrigatório');
    }

    if (dados.desconto && dados.desconto > dados.valor_produto * dados.quantidade) {
      warnings.push('Desconto maior que valor total do item');
    }

    return {
      valido: erros.length === 0,
      erros,
      warnings,
    };
  }

  /**
   * Busca dados do produto no banco
   */
  private async buscarDadosProduto(
    produtoId?: number,
    ncmFallback?: string
  ): Promise<DadosProduto> {
    const query = produtoId
      ? `SELECT codprod, clasfiscal as ncm, descr as descricao, ref as referencia,
                COALESCE(ipi, 0)::numeric as ipi,
                COALESCE(pis, 0)::numeric as pis,
                COALESCE(cofins, 0)::numeric as cofins,
                strib, cest, isentoipi
         FROM dbprod
         WHERE codprod = $1
         LIMIT 1`
      : null;

    if (query && produtoId) {
      const result = await this.client.query(query, [produtoId.toString().padStart(6, '0')]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const ncm = (row.ncm || '').replace(/\D/g, '').substring(0, 8);
        const strib = (row.strib || '0').substring(0, 1);

        // Verificar se NCM é monofásico
        const isMonofasico = await this.verificarNCMMonofasico(ncm);

        return {
          codprod: row.codprod,
          ncm: ncm || ncmFallback || '',
          descricao: row.descricao || '',
          referencia: row.referencia,
          ipi: Number(row.ipi) || 0,
          pis: Number(row.pis) || 0,
          cofins: Number(row.cofins) || 0,
          strib: strib,
          produto_importado: ['1', '2', '3', '8'].includes(strib),
          monofasico: isMonofasico,
          cest: row.cest,
          isentoipi: row.isentoipi || 'N',
        };
      }
    }

    // Fallback se não encontrar produto
    return {
      codprod: '',
      ncm: ncmFallback || '',
      descricao: 'Produto não encontrado',
      ipi: 0,
      pis: 1.65,
      cofins: 7.6,
      strib: '0',
      produto_importado: false,
      monofasico: false,
      isentoipi: 'N',
    };
  }

  /**
   * Busca dados do cliente
   */
  private async buscarDadosCliente(clienteId: number): Promise<DadosCliente> {
    const result = await this.client.query(
      `SELECT codcli, nome, nomefant, tipo, uf, cidade, cpfcgc, iest, icms
       FROM dbclien
       WHERE codcli = $1
       LIMIT 1`,
      [clienteId.toString().padStart(5, '0')]
    );

    if (result.rows.length === 0) {
      throw new Error(`Cliente ${clienteId} não encontrado`);
    }

    const row = result.rows[0];
    return {
      codcli: row.codcli,
      nome: row.nome || '',
      nome_fantasia: row.nomefant,
      tipo: row.tipo || 'F',
      uf: (row.uf || '').toUpperCase(),
      cidade: (row.cidade || '').toUpperCase(),
      cnpj_cpf: row.cpfcgc,
      inscricao_estadual: row.iest,
      contribuinte_icms: row.icms === 'S',
    };
  }

  /**
   * Busca UF da empresa
   */
  private async buscarUFEmpresa(): Promise<string> {
    const result = await this.client.query(
      `SELECT uf FROM dadosempresa LIMIT 1`
    );

    if (result.rows.length === 0) {
      throw new Error('UF da empresa não encontrada');
    }

    return (result.rows[0].uf || 'AM').toUpperCase();
  }

  /**
   * Calcula CFOP usando function SQL
   */
  private async calcularCFOP(
    tipoOperacao: string,
    ufOrigem: string,
    ufDestino: string
  ): Promise<{ cfop: string; tipocfop: string }> {
    try {
      const result = await this.client.query(
        `SELECT * FROM calcular_cfop($1, $2, $3)`,
        [tipoOperacao, ufOrigem, ufDestino]
      );

      if (result.rows.length > 0) {
        return {
          cfop: result.rows[0].cfop || '5102',
          tipocfop: result.rows[0].descricao || 'Venda de mercadoria',
        };
      }
    } catch (error) {
      console.error('Erro ao calcular CFOP:', error);
    }

    // Fallback
    const interno = ufOrigem === ufDestino;
    return {
      cfop: interno ? '5102' : '6102',
      tipocfop: interno
        ? 'Venda de mercadoria adquirida ou recebida de terceiros'
        : 'Venda de mercadoria adquirida ou recebida de terceiros',
    };
  }

  /**
   * Busca alíquotas ICMS por UF usando function SQL
   */
  private async buscarAliquotasICMS(uf: string): Promise<AliquotasICMS> {
    try {
      const result = await this.client.query(
        `SELECT * FROM buscar_aliquota_icms($1)`,
        [uf]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        let icms_interno = Number(row.aliquota_interna) || 0;
        let icms_externo = Number(row.aliquota_interestadual) || 0;

        // Fallback se a view retornar 0
        if (icms_interno === 0 && uf === 'AM') {
          icms_interno = 18; // Alíquota padrão do Amazonas
        }
        if (icms_externo === 0) {
          icms_externo = 12; // Alíquota interestadual padrão
        }

        return {
          uf: uf,
          icms_interno,
          icms_externo,
          icms_corredor: Number(row.aliquota_corredor) || 0,
          tem_st: row.tem_st === true,
          icms_antecipado: row.icms_antecipado === true,
          fcp: Number(row.aliquota_fcp) || 0,
        };
      }
    } catch (error) {
      console.error(`Erro ao buscar alíquotas ICMS para ${uf}:`, error);
    }

    // Fallback com valores padrão do Amazonas
    return {
      uf: uf,
      icms_interno: uf === 'AM' ? 18 : 17,
      icms_externo: 12,
      icms_corredor: 0,
      tem_st: false,
      icms_antecipado: false,
      fcp: 0,
    };
  }

  /**
   * Busca se a UF é zona incentivada (para regra de IPI)
   */
  /**
   * Verifica se NCM é monofásico consultando a tabela DBCLASSIFICACAO_PISCOFINS
   * Tenta match com 8, 7, 6, 5, 4 e 3 dígitos (igual ao Oracle)
   */
  private async verificarNCMMonofasico(ncm: string): Promise<boolean> {
    if (!ncm || ncm.length < 3) return false;

    try {
      // Tentar match com NCM completo (8 dígitos) até 3 dígitos
      for (let len = Math.min(ncm.length, 8); len >= 3; len--) {
        const ncmPrefix = ncm.substring(0, len);
        const result = await this.client.query(
          `SELECT 1 FROM dbclassificacao_piscofins
           WHERE "NCM" = $1 AND LENGTH("NCM") = $2
           LIMIT 1`,
          [ncmPrefix, len]
        );
        if (result.rows.length > 0) {
          return true;
        }
      }
    } catch (error) {
      console.error(`Erro ao verificar NCM monofásico para ${ncm}:`, error);
    }

    return false;
  }

  private async buscarZonaIncentivada(uf: string): Promise<boolean> {
    try {
      const result = await this.client.query(
        `SELECT "ZONA_ISENTIVADA" FROM dbuf_n WHERE "UF" = $1`,
        [uf]
      );

      if (result.rows.length > 0) {
        return result.rows[0].ZONA_ISENTIVADA === 'S';
      }
    } catch (error) {
      console.error(`Erro ao buscar zona incentivada para ${uf}:`, error);
    }
    return false; // Default: não é zona incentivada
  }

  /**
   * Busca alíquota de IPI do NCM (não do produto!)
   * Segundo Oracle linha 1661: xResult := nvl(RowNCM.Ipi,0.00)
   */
  private async buscarAliquotaIPIDoNCM(ncm: string): Promise<number> {
    if (!ncm) return 0;

    try {
      const result = await this.client.query(
        `SELECT COALESCE(ipi, 0)::numeric as ipi
         FROM dbclassificacao_fiscal
         WHERE ncm = $1
         LIMIT 1`,
        [ncm]
      );

      if (result.rows.length > 0) {
        return Number(result.rows[0].ipi) || 0;
      }
    } catch (error) {
      console.error(`Erro ao buscar IPI do NCM ${ncm}:`, error);
    }

    return 0;
  }

  /**
   * Calcula IPI com TODAS as regras do procedimento Oracle
   * Implementa a função Validar_IPI (linhas 1612-1673 do Oracle)
   * Para SAÍDA (vendas/faturamento)
   */
  private async calcularIPI(
    valorBase: number,
    produto: DadosProduto,
    ufOrigem: string,
    ufDestino: string,
    cliente: DadosCliente,
    tipoOperacao: string
  ): Promise<{ aliquota: number; baseipi: number; totalipi: number }> {
    let aliquotaFinal = 0; // Por padrão, isento

    // REGRA UNIVERSAL (linha 1667-1669): Pessoa Física NUNCA paga IPI
    if (cliente.tipo === 'F') {
      return {
        aliquota: 0,
        baseipi: 0,
        totalipi: 0,
      };
    }

    // Lógica para SAÍDA (linhas 1648-1665)
    const isentoipi = produto.isentoipi || 'N';
    const isZonaIncentivada = await this.buscarZonaIncentivada(ufDestino);
    const ufDiferente = ufOrigem !== ufDestino;

    // Operações que são devolução/remessa
    const isDevRemessa = ['DEVOLUCAO_COMPRA', 'DEVOLUCAO_TRANSFERENCIA', 'REMESSA_GARANTIA_FABRICA', 'REMESSA_CONSERTO'].includes(tipoOperacao);

    // Verificar se COBRA IPI (lógica invertida do Oracle)
    let cobraIPI = false;

    // Condição 1: IsentoIPI='C' (Cobrado) e UF diferente e NÃO devolução/remessa
    if (isentoipi === 'C' && ufDiferente && !isDevRemessa) {
      cobraIPI = true;
    }

    // Condição 2: IsentoIPI='I' (Isento) ou 'T' (Tributado) - SEMPRE cobra
    if (isentoipi === 'I' || isentoipi === 'T') {
      cobraIPI = true;
    }

    // Condição 3: IsentoIPI='C' e devolução/remessa e UF diferente
    if (isentoipi === 'C' && isDevRemessa && ufDiferente) {
      cobraIPI = true;
    }

    // Condição 4: IsentoIPI='P' (Pago) e devolução/remessa e UF diferente
    if (isentoipi === 'P' && isDevRemessa && ufDiferente) {
      cobraIPI = true;
    }

    // Condição 5: IsentoIPI='S' (Suspenso) e Zona_Isentivada='N'
    if (isentoipi === 'S' && !isZonaIncentivada) {
      cobraIPI = true;
    }

    // Se cobra IPI, buscar alíquota do NCM (NÃO do produto!)
    if (cobraIPI) {
      aliquotaFinal = await this.buscarAliquotaIPIDoNCM(produto.ncm);
    }

    // IPI normalmente é sobre o valor do produto
    const baseipi = aliquotaFinal > 0 ? valorBase : 0;
    const totalipi = (baseipi * aliquotaFinal) / 100;

    return {
      aliquota: aliquotaFinal,
      baseipi,
      totalipi: Number(totalipi.toFixed(2)),
    };
  }

  /**
   * Calcula ICMS
   */
  private async calcularICMS(
    valorBase: number,
    aliquotasOrigem: AliquotasICMS,
    aliquotasDestino: AliquotasICMS,
    operacaoInterna: boolean,
    dados: DadosCalculoImposto
  ): Promise<{ aliquota: number; baseicms: number; totalicms: number }> {
    let baseicms = valorBase;
    let aliquota = operacaoInterna
      ? aliquotasOrigem.icms_interno
      : aliquotasOrigem.icms_externo;

    // Aplicar redução de base se houver
    if (dados.base_icms_reduzida && dados.percentual_reducao) {
      baseicms = baseicms * (1 - dados.percentual_reducao / 100);
    }

    // Se isento, zera
    if (dados.isento_icms) {
      aliquota = 0;
    }

    const totalicms = (baseicms * aliquota) / 100;

    return {
      aliquota,
      baseicms,
      totalicms: Number(totalicms.toFixed(2)),
    };
  }

  /**
   * Calcula Substituição Tributária usando view e function SQL
   */
  private async calcularST(
    valorBase: number,
    valorIPI: number,
    ncm: string,
    ufOrigem: string,
    ufDestino: string,
    operacaoInterna: boolean,
    aliquotasOrigem: AliquotasICMS,
    aliquotasDestino: AliquotasICMS
  ): Promise<{
    tem_st: boolean;
    mva_original: number;
    mva_ajustado: number;
    basesubst_trib: number;
    totalsubst_trib: number;
    protocolo?: string;
    origem_mva: string;
  }> {
    const ncm8 = ncm.replace(/\D/g, '').substring(0, 8);

    try {
      // 1. Buscar MVA na view
      const result = await this.client.query(
        `SELECT mva_original, protocolo
         FROM v_mva_ncm_uf_completa
         WHERE ncm = $1 AND uf_destino = $2
         LIMIT 1`,
        [ncm8, ufDestino]
      );

      if (result.rows.length === 0) {
        // Não tem ST
        return {
          tem_st: false,
          mva_original: 0,
          mva_ajustado: 0,
          basesubst_trib: 0,
          totalsubst_trib: 0,
          origem_mva: 'NAO_APLICAVEL',
        };
      }

      const mvaOriginal = Number(result.rows[0].mva_original) || 0;
      const protocolo = result.rows[0].protocolo;

      // 2. Se operação interestadual, ajustar MVA
      let mvaAjustado = mvaOriginal;

      if (!operacaoInterna) {
        try {
          const ajusteResult = await this.client.query(
            `SELECT * FROM calcular_mva_ajustado($1, $2, $3)`,
            [
              mvaOriginal,
              aliquotasOrigem.icms_interno,
              aliquotasOrigem.icms_externo,
            ]
          );

          if (ajusteResult.rows.length > 0) {
            mvaAjustado = Number(ajusteResult.rows[0].mva_ajustado) || mvaOriginal;
          }
        } catch (error) {
          console.error('Erro ao calcular MVA ajustado:', error);
        }
      }

      // 3. Calcular base ST
      const baseSubstTrib = (valorBase + valorIPI) * (1 + mvaAjustado / 100);

      // 4. Calcular ICMS ST
      const icmsInterno = (baseSubstTrib * aliquotasDestino.icms_interno) / 100;
      const icmsOrigem = (valorBase * aliquotasOrigem.icms_externo) / 100;
      const totalSubstTrib = icmsInterno - icmsOrigem;

      return {
        tem_st: true,
        mva_original: mvaOriginal,
        mva_ajustado: mvaAjustado,
        basesubst_trib: Number(baseSubstTrib.toFixed(2)),
        totalsubst_trib: Number(Math.max(0, totalSubstTrib).toFixed(2)),
        protocolo,
        origem_mva: 'VIEW',
      };
    } catch (error) {
      console.error('Erro ao calcular ST:', error);
      return {
        tem_st: false,
        mva_original: 0,
        mva_ajustado: 0,
        basesubst_trib: 0,
        totalsubst_trib: 0,
        origem_mva: 'ERRO',
      };
    }
  }

  /**
   * Determina alíquotas PIS/COFINS para VENDA conforme Oracle
   * Baseado no procedure Calcular_PIS_COFINS_Saida do Oracle
   */
  private determinarAliquotasPISCOFINSVenda(
    ufCliente: string,
    cidade_cliente: string,
    ufEmpresa: string,
    produto: DadosProduto
  ): { pis: number; cofins: number; cstpis: string; cstcofins: string } {
    // 1. Exportação
    if (ufCliente === 'EX') {
      return { pis: 0, cofins: 0, cstpis: '08', cstcofins: '08' };
    }

    // 2. NCM Monofásico
    if (produto.monofasico) {
      return { pis: 0, cofins: 0, cstpis: '04', cstcofins: '04' };
    }

    // 3. PIS+COFINS = 13.10 ou 11.50 (produtos com alíquota especial)
    const somaPisCofins = produto.pis + produto.cofins;
    if (somaPisCofins === 13.10 || somaPisCofins === 11.50) {
      return { pis: 0, cofins: 0, cstpis: '04', cstcofins: '04' };
    }

    // 4. Zona Franca (Manaus e outras cidades)
    const cidadesZonaFranca = [
      'MANAUS',
      'BRASILEIA',
      'MACAPA',
      'SANTANA',
      'TABATINGA',
      'BOA VISTA',
      'BONFIM',
      'GUAJARA-MIRIM'
    ];
    if (
      ufEmpresa === 'AM' &&
      cidadesZonaFranca.includes(cidade_cliente.toUpperCase().replace(/[^A-Z]/g, ''))
    ) {
      return { pis: 0, cofins: 0, cstpis: '06', cstcofins: '06' };
    }

    // 5. Venda normal - Alíquotas padrão Oracle
    return { pis: 1.65, cofins: 7.60, cstpis: '01', cstcofins: '01' };
  }

  /**
   * Calcula PIS
   */
  private calcularPIS(
    valorBase: number,
    aliquota: number,
    produto: DadosProduto,
    dados: DadosCalculoImposto,
    ufEmpresa: string,
    ufCliente: string,
    cliente: DadosCliente
  ): { aliquota: number; basepis: number; valorpis: number } {
    let aliquotaFinal = aliquota;

    // Se flag ativo, usar regras do procedimento Oracle
    if (dados.usar_regras_oracle_procedimento && dados.tipo_operacao === 'VENDA') {
      const regrasOracle = this.determinarAliquotasPISCOFINSVenda(
        ufCliente,
        cliente.cidade || '',
        ufEmpresa,
        produto
      );
      aliquotaFinal = regrasOracle.pis;
    }

    const basepis = aliquotaFinal > 0 ? valorBase : 0;
    const valorpis = (basepis * aliquotaFinal) / 100;

    return {
      aliquota: aliquotaFinal,
      basepis,
      valorpis: Number(valorpis.toFixed(2)),
    };
  }

  /**
   * Calcula COFINS
   */
  private calcularCOFINS(
    valorBase: number,
    aliquota: number,
    produto: DadosProduto,
    dados: DadosCalculoImposto,
    ufEmpresa: string,
    ufCliente: string,
    cliente: DadosCliente
  ): { aliquota: number; basecofins: number; valorcofins: number } {
    let aliquotaFinal = aliquota;

    // Se flag ativo, usar regras do procedimento Oracle
    if (dados.usar_regras_oracle_procedimento && dados.tipo_operacao === 'VENDA') {
      const regrasOracle = this.determinarAliquotasPISCOFINSVenda(
        ufCliente,
        cliente.cidade || '',
        ufEmpresa,
        produto
      );
      aliquotaFinal = regrasOracle.cofins;
    }

    const basecofins = aliquotaFinal > 0 ? valorBase : 0;
    const valorcofins = (basecofins * aliquotaFinal) / 100;

    return {
      aliquota: aliquotaFinal,
      basecofins,
      valorcofins: Number(valorcofins.toFixed(2)),
    };
  }

  /**
   * Calcula FCP (Fundo de Combate à Pobreza)
   */
  private calcularFCP(
    baseICMS: number,
    baseST: number,
    aliquotas: AliquotasICMS
  ): {
    aliquota: number;
    base_fcp: number;
    valor_fcp: number;
    aliquota_st: number;
    base_fcp_st: number;
    valor_fcp_st: number;
  } {
    const aliquotaFCP = aliquotas.fcp || 0;

    if (aliquotaFCP === 0) {
      return {
        aliquota: 0,
        base_fcp: 0,
        valor_fcp: 0,
        aliquota_st: 0,
        base_fcp_st: 0,
        valor_fcp_st: 0,
      };
    }

    const valorFCP = (baseICMS * aliquotaFCP) / 100;
    const valorFCPST = (baseST * aliquotaFCP) / 100;

    return {
      aliquota: aliquotaFCP,
      base_fcp: baseICMS,
      valor_fcp: Number(valorFCP.toFixed(2)),
      aliquota_st: aliquotaFCP,
      base_fcp_st: baseST,
      valor_fcp_st: Number(valorFCPST.toFixed(2)),
    };
  }

  /**
   * Calcula IBS/CBS usando function SQL
   * Em 2026 (fase de teste): IBS = 0.10% (0.05% estadual + 0.05% municipal), CBS = 0.90%
   * Ref: Lei Complementar nº 214/25, Art. 348
   */
  private async calcularIBSCBS(
    ncm: string,
    valorBase: number,
    dataOperacao?: Date | string
  ): Promise<DadosIBSCBS> {
    const ncm8 = ncm.replace(/\D/g, '').substring(0, 8);
    const ano = dataOperacao
      ? new Date(dataOperacao).getFullYear()
      : new Date().getFullYear();

    try {
      const result = await this.client.query(
        `SELECT * FROM buscar_aliquota_ncm($1, $2)`,
        [ncm8, ano]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const aliquotaIBS = Number(row.aliquota_ibs) || 0;
        const aliquotaCBS = Number(row.aliquota_cbs) || 0;
        const categoria = row.categoria || 'PADRAO';

        // Dividir IBS em estadual e municipal (50% cada conforme LC 214/25)
        // Em 2026: IBS total = 0.10%, então IBS-E = 0.05% e IBS-M = 0.05%
        const ibsEstadual = Number((aliquotaIBS / 2).toFixed(2));
        const ibsMunicipal = Number((aliquotaIBS / 2).toFixed(2));

        return {
          ano,
          ncm: ncm8,
          categoria,
          aliquota_ibs: aliquotaIBS,
          aliquota_cbs: aliquotaCBS,
          ibs_e: ibsEstadual, // IBS Estadual (substitui ICMS)
          ibs_m: ibsMunicipal, // IBS Municipal (substitui ISS)
          ibs_valor: Number(((valorBase * aliquotaIBS) / 100).toFixed(2)),
          cbs_valor: Number(((valorBase * aliquotaCBS) / 100).toFixed(2)),
          informativo: ano === 2026,
          observacao:
            ano === 2026
              ? 'Valores informativos - Reforma Tributária em transição (LC 214/25)'
              : undefined,
        };
      }
    } catch (error) {
      console.error('Erro ao buscar IBS/CBS:', error);
    }

    // Fallback com alíquota padrão
    // Em 2026: IBS = 0.10% (teste), CBS = 0.90% (teste)
    const aliquotaIBSPadrao = ano === 2026 ? 0.10 : 27.0;
    const aliquotaCBSPadrao = ano === 2026 ? 0.90 : 10.0;
    const ibsEstadualPadrao = Number((aliquotaIBSPadrao / 2).toFixed(2));
    const ibsMunicipalPadrao = Number((aliquotaIBSPadrao / 2).toFixed(2));

    return {
      ano,
      ncm: ncm8,
      categoria: 'PADRAO',
      aliquota_ibs: aliquotaIBSPadrao,
      aliquota_cbs: aliquotaCBSPadrao,
      ibs_e: ibsEstadualPadrao, // IBS Estadual
      ibs_m: ibsMunicipalPadrao, // IBS Municipal
      ibs_valor: Number(((valorBase * aliquotaIBSPadrao) / 100).toFixed(2)),
      cbs_valor: Number(((valorBase * aliquotaCBSPadrao) / 100).toFixed(2)),
      informativo: ano === 2026,
      observacao: ano === 2026 ? 'Valores informativos (LC 214/25 - dados não encontrados)' : undefined,
    };
  }

  /**
   * Determina CST ICMS usando function SQL
   */
  private async determinarCSTICMS(
    temST: boolean,
    baseReduzida: boolean,
    isento: boolean
  ): Promise<CSTICMS> {
    try {
      const result = await this.client.query(
        `SELECT * FROM determinar_cst_icms($1, $2, $3)`,
        [temST, baseReduzida, isento]
      );

      if (result.rows.length > 0) {
        return result.rows[0].cst as CSTICMS;
      }
    } catch (error) {
      console.error('Erro ao determinar CST ICMS:', error);
    }

    // Fallback
    if (isento) return '40';
    if (temST && baseReduzida) return '70';
    if (temST) return '10';
    if (baseReduzida) return '20';
    return '00';
  }

  /**
   * Determina CST IPI
   */
  private determinarCSTIPI(
    produto: DadosProduto,
    tipoOperacao: string
  ): CSTIPI {
    if (tipoOperacao === 'EXPORTACAO') return '53'; // Saída não-tributada

    if (produto.ipi === 0) return '53'; // Saída não-tributada
    return '50'; // Saída tributada
  }

  /**
   * Determina CST PIS/COFINS
   */
  private determinarCSTPISCOFINS(
    produto: DadosProduto,
    tipoOperacao: string
  ): CSTPISCOFINS {
    if (tipoOperacao === 'EXPORTACAO') return '08'; // Operação sem incidência

    if (produto.monofasico) return '04'; // Operação Tributável Monofásica

    if (produto.pis === 0 || produto.cofins === 0) return '08'; // Sem incidência

    return '01'; // Operação Tributável com Alíquota Básica
  }
}

/**
 * Helper para formatar valores monetários
 */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Helper para formatar percentual
 */
export function formatarPercentual(valor: number): string {
  return `${valor.toFixed(2)}%`;
}
