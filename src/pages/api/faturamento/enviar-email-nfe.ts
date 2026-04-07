import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { enviarDocumentoFiscal } from '@/lib/nfeEmailService';
import { gerarNotaFiscalValida } from '@/utils/gerarPreviewNF';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat, emailCliente, nomeCliente, xmlAssinado, forcarReenvio } = req.body;

  if (!codfat || !emailCliente) {
    return res.status(400).json({
      error: 'Código da fatura e email do cliente são obrigatórios',
    });
  }

  try {
    const client = await getPgPool().connect();

    // Buscar dados da fatura, documento fiscal (NF-e ou NFC-e) e cliente
    const queryFatura = `
      SELECT
        f.*,
        nfe.chave,
        nfe.numprotocolo,
        nfe.dthrprotocolo,
        CAST(nfe.nrodoc_fiscal AS TEXT) as numero_documento,
        nfe.modelo,
        nfe.emailenviado,
        nfe.imagem as pdf_imagem,
        CASE WHEN nfe.modelo = '65' THEN 'nfce' ELSE 'nfe' END as tipo_documento,
        -- Dados do cliente
        c.nome as cliente_nome,
        c.nomefant as cliente_nomefant,
        c.cpfcgc as cliente_cpfcgc,
        c.ender as cliente_ender,
        c.numero as cliente_numero,
        c.bairro as cliente_bairro,
        c.cidade as cliente_cidade,
        c.uf as cliente_uf,
        c.cep as cliente_cep,
        c.email as cliente_fone,
        c.iest as cliente_iest,
        -- Dados da empresa na venda
        v.cnpj_empresa,
        v.ie_empresa
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      LEFT JOIN db_manaus.fatura_venda fv ON f.codfat = fv.codfat
      LEFT JOIN db_manaus.dbvenda v ON fv.codvenda = v.codvenda
      WHERE f.codfat = $1
    `;

    const faturaResult = await client.query(queryFatura, [codfat]);

    if (faturaResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    const fatura = faturaResult.rows[0];
    const tipoDocumento = fatura.tipo_documento || 'nfe';
    const numeroDocumento = fatura.numero_documento;

    // Verificar se documento fiscal foi emitido
    if (!fatura.chave || !fatura.numprotocolo) {
      client.release();
      return res.status(400).json({
        error: `${tipoDocumento.toUpperCase()} ainda não foi emitida para esta fatura`,
      });
    }

    // Verificar se já foi enviado (a menos que seja forçado reenvio)
    if (fatura.emailenviado === 'S' && !forcarReenvio) {
      client.release();
      return res.status(400).json({
        error: `Email da ${tipoDocumento.toUpperCase()} já foi enviado anteriormente. Use 'forcarReenvio: true' para reenviar.`,
      });
    }

    // Buscar produtos da fatura com impostos
    const queryProdutos = `
      SELECT
        i.codprod,
        p.descr,
        p.unimed,
        i.ncm,
        i.cfop,
        i.qtd::numeric,
        i.prunit::numeric,
        (i.qtd * i.prunit)::numeric as total_item,
        -- Impostos IBS/CBS (Nova Lei)
        COALESCE(i.aliquota_ibs, 0)::numeric as aliquota_ibs,
        COALESCE(i.aliquota_cbs, 0)::numeric as aliquota_cbs,
        COALESCE(i.valor_ibs, 0)::numeric as valor_ibs,
        COALESCE(i.valor_cbs, 0)::numeric as valor_cbs,
        -- Impostos ICMS
        COALESCE(i.baseicms, 0)::numeric as baseicms,
        COALESCE(i.totalicms, 0)::numeric as totalicms,
        COALESCE(i.icms, 0)::numeric as icms,
        i.csticms,
        i.origemcom,
        -- Impostos IPI
        COALESCE(i.baseipi, 0)::numeric as baseipi,
        COALESCE(i.totalipi, 0)::numeric as totalipi,
        COALESCE(i.ipi, 0)::numeric as ipi
      FROM db_manaus.dbfatura f
      JOIN db_manaus.fatura_venda fv ON fv.codfat = f.codfat
      JOIN db_manaus.dbvenda v ON v.codvenda = fv.codvenda
      JOIN db_manaus.dbitvenda i ON i.codvenda = v.codvenda
      LEFT JOIN db_manaus.dbprod p ON p.codprod = i.codprod
      WHERE f.codfat = $1
      ORDER BY i.ref, p.descr
    `;

    const produtosResult = await client.query(queryProdutos, [codfat]);

    // Buscar dados da empresa (query robusta filtrando por CNPJ/IE da venda se houver)
    let queryEmpresa = `
      SELECT * FROM dadosempresa
      WHERE "certificadoKey" IS NOT NULL
        AND "certificadoCrt" IS NOT NULL
        AND "certificadoKey" != ''
        AND "certificadoCrt" != ''
    `;

    const paramsEmpresa: any[] = [];
    if (fatura.cnpj_empresa) {
      paramsEmpresa.push(fatura.cnpj_empresa);
      queryEmpresa += ` AND cgc = $${paramsEmpresa.length}`;
    }
    if (fatura.ie_empresa) {
      paramsEmpresa.push(fatura.ie_empresa);
      queryEmpresa += ` AND inscricaoestadual = $${paramsEmpresa.length}`;
    }

    queryEmpresa += ` ORDER BY cgc LIMIT 1`;

    const empresaResult = await client.query(queryEmpresa, paramsEmpresa);

    console.log('🏢 DEBUG - Dados da empresa encontrados:', {
      encontrados: empresaResult.rows.length,
      filtro_cnpj: fatura.cnpj_empresa || 'N/A',
      empresa_nome: empresaResult.rows[0]?.nomecontribuinte,
      empresa_cnpj: empresaResult.rows[0]?.cgc,
    });

    if (empresaResult.rows.length === 0) {
      client.release();
      return res
        .status(500)
        .json({ error: 'Dados da empresa não encontrados' });
    }

    const dadosEmpresa = empresaResult.rows[0];
    client.release();

    // Preparar dados para geração do PDF
    const produtos = produtosResult.rows.map((row) => ({
      codprod: row.codprod,
      descr: row.descr,
      unimed: row.unimed,
      ncm: row.ncm,
      cfop: row.cfop,
      qtd: Number(row.qtd),
      prunit: Number(row.prunit),
      total_item: Number(row.total_item),
      // Impostos IBS/CBS (Nova Lei)
      aliquota_ibs: Number(row.aliquota_ibs || 0),
      aliquota_cbs: Number(row.aliquota_cbs || 0),
      valor_ibs: Number(row.valor_ibs || 0),
      valor_cbs: Number(row.valor_cbs || 0),
      // Impostos ICMS
      baseicms: Number(row.baseicms || 0),
      totalicms: Number(row.totalicms || 0),
      icms: Number(row.icms || 0),
      // Impostos IPI
      baseipi: Number(row.baseipi || 0),
      totalipi: Number(row.totalipi || 0),
      ipi: Number(row.ipi || 0),
      // Dados CST
      cst: row.csticms,
      origem: row.origemcom,
    }));

    // Calcular totais de impostos para a fatura
    const totaisImpostos = produtos.reduce((acc, p) => ({
      aliquota_ibs: p.aliquota_ibs || acc.aliquota_ibs, // Usar última alíquota encontrada
      aliquota_cbs: p.aliquota_cbs || acc.aliquota_cbs,
      valor_ibs: acc.valor_ibs + p.valor_ibs,
      valor_cbs: acc.valor_cbs + p.valor_cbs,
      baseicms: acc.baseicms + p.baseicms,
      totalicms: acc.totalicms + p.totalicms,
      baseipi: acc.baseipi + p.baseipi,
      totalipi: acc.totalipi + p.totalipi,
    }), { aliquota_ibs: 0, aliquota_cbs: 0, valor_ibs: 0, valor_cbs: 0, baseicms: 0, totalicms: 0, baseipi: 0, totalipi: 0 });

    // Mesclar dados do cliente na fatura para o PDF
    const faturaComCliente = {
      ...fatura,
      // Dados do cliente (sobrescrever se existirem)
      nomefant: fatura.cliente_nomefant || fatura.cliente_nome || fatura.nomefant,
      nome: fatura.cliente_nome || fatura.nome,
      cpfcgc: fatura.cliente_cpfcgc || fatura.cpfcgc,
      ender: fatura.cliente_ender || fatura.ender,
      numero: fatura.cliente_numero || fatura.numero,
      bairro: fatura.cliente_bairro || fatura.bairro,
      cidade: fatura.cliente_cidade || fatura.cidade,
      uf: fatura.cliente_uf || fatura.uf,
      cep: fatura.cliente_cep || fatura.cep,
      fone: fatura.cliente_fone || fatura.fone,
      iest: fatura.cliente_iest || fatura.iest,
      // Totais de impostos calculados
      aliquota_ibs: totaisImpostos.aliquota_ibs,
      aliquota_cbs: totaisImpostos.aliquota_cbs,
      valor_ibs: totaisImpostos.valor_ibs,
      valor_cbs: totaisImpostos.valor_cbs,
      baseicms: totaisImpostos.baseicms,
      valor_icms: totaisImpostos.totalicms,
      baseipi: totaisImpostos.baseipi,
      valor_ipi: totaisImpostos.totalipi,
    };

    const venda = {
      nrovenda: fatura.nrovenda,
      obs: fatura.obs,
      transp: fatura.transp,
    };

    const dadosNFe = {
      chaveAcesso: fatura.chave,
      protocolo: fatura.numprotocolo,
      numeroNFe: fatura.numero_nfe,
      dataEmissao: fatura.data,
      // Fallback robusto para evitar valor zero: totalnf -> totalfat -> 0
      valorTotal: Number(fatura.totalnf || fatura.totalfat || 0),
    };

    console.log('📄 Gerando PDF da NFe para envio por email...');

    // Se já tivermos um PDF salvo na tabela dbfat_nfe, preferir reutilizá-lo
    let pdfBuffer: Buffer | undefined = undefined;

    if (fatura.pdf_imagem) {
      try {
        console.log('📁 Usando PDF salvo em dbfat_nfe (campo imagem) para envio do email');
        // fatura.pdf_imagem pode ser Buffer ou string base64 dependendo do driver
        if (Buffer.isBuffer(fatura.pdf_imagem)) {
          pdfBuffer = Buffer.from(fatura.pdf_imagem);
        } else if (typeof fatura.pdf_imagem === 'string') {
          pdfBuffer = Buffer.from(fatura.pdf_imagem, 'base64');
        } else {
          // Fallback: tentar converter
          pdfBuffer = Buffer.from(String(fatura.pdf_imagem));
        }

        // Validação rápida do PDF salvo: tamanho e presença de palavras-chave do DANFE
        try {
          const texto = pdfBuffer.toString('latin1'); // tentar ler texto bruto
          const hasKeywords = /DADOS DO PRODUTO|DANFE|CHAVE DE ACESSO|DESTINATÁRIO/i.test(texto);
          console.log('🔍 Validação PDF salvo - tamanho:', pdfBuffer.length, 'hasKeywords:', hasKeywords);

          // Se o PDF for muito pequeno ou não conter palavras-chave, considerar incompleto
          if (pdfBuffer.length < 15000 || !hasKeywords) {
            console.warn('⚠️ PDF salvo aparenta incompleto (vai regenerar).');
            pdfBuffer = undefined as any; // forçar regeneração abaixo
          }
        } catch (e) {
          console.warn('⚠️ Falha ao validar conteúdo do PDF salvo:', e);
        }

        // Salvar cópia temporária para inspeção
        try {
          const os = require('os');
          const fs = require('fs');
          const path = require('path');
          const tmpdir = os.tmpdir();
          const outPath = path.join(tmpdir, `NFe-salvo-${codfat}.pdf`);
          fs.writeFileSync(outPath, pdfBuffer || Buffer.from(''));
          console.log('📁 DEBUG - PDF salvo temporariamente (do banco) em:', outPath);
        } catch (e) {
          console.warn('⚠️ Não foi possível gravar PDF temporário do banco:', e);
        }
      } catch (e) {
        console.error('❌ Erro ao usar PDF salvo na tabela:', e);
        // Se falhar, continuar para gerar novo
        pdfBuffer = undefined as any;
      }
    }

    if (!pdfBuffer) {
      // Gerar PDF da NFe (usando faturaComCliente que tem dados do cliente e impostos)
      const pdfDoc = await gerarNotaFiscalValida(
        faturaComCliente,
        produtos,
        venda,
        dadosEmpresa,
        dadosNFe,
      );

      // Debug: log inputs que influenciam o PDF e salvar uma cópia temporária para inspeção
      try {
        console.log('📄 DEBUG - Gerando PDF NFe - fatura resumo:', {
          codfat: fatura.codfat,
          cliente: fatura.nomefant || fatura.nome || null,
          chave: fatura.chave,
          numero_nfe: fatura.numero_nfe,
          totalnf: fatura.totalnf,
        });
        console.log('📄 DEBUG - dadosEmpresa resumo:', {
          nome: dadosEmpresa.nomecontribuinte || dadosEmpresa.xNome,
          cgc: dadosEmpresa.cgc || dadosEmpresa.cnpj,
          endereco: dadosEmpresa.logradouro || dadosEmpresa.endereco,
        });
        console.log('📄 DEBUG - produtos: count=', produtos.length, 'exemplo=', produtos[0]);

        const pdfBufferPreview = Buffer.from((pdfDoc as any).output('arraybuffer'));
        const os = require('os');
        const fs = require('fs');
        const path = require('path');
        const tmpdir = os.tmpdir();
        const outPath = path.join(tmpdir, `NFe-${codfat}.pdf`);
        fs.writeFileSync(outPath, pdfBufferPreview);
        console.log('📁 DEBUG - PDF salvo temporariamente em:', outPath);
      } catch (e) {
        console.error('❌ Erro ao gravar PDF de debug:', e);
      }

      pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    }

    // Gerar boletos válidos se a fatura tiver cobrança configurada
    let pdfBoleto: Buffer | undefined;

    if (fatura.cobranca === 'S') {
      try {
        console.log('💰 Gerando boletos válidos para a fatura...');
        
        // Buscar parcelas da fatura
        const clientParcelas = await pool.connect();
        const queryParcelas = `
          SELECT 
            r.cod_receb as codreceb,
            r.dt_venc as vencimento,
            r.valor_pgto::numeric as valor,
            r.nro_doc as nrodoc,
            r.nro_docbanco as nossonumero,
            r.banco,
            r.nro_banco as linha_digitavel,
            r.bradesco as codigobarras
          FROM db_manaus.dbreceb r
          WHERE r.cod_fat = $1
          AND r.forma_fat = 'B'
          ORDER BY r.dt_venc
        `;
        
        const parcelasResult = await clientParcelas.query(queryParcelas, [codfat]);
        clientParcelas.release();
        
        if (parcelasResult.rows.length > 0) {
          console.log(`📋 Encontradas ${parcelasResult.rows.length} parcelas para gerar boletos`);
          
          const { jsPDF } = require('jspdf');
          const JsBarcode = require('jsbarcode');
          const axios = require('axios');
          
          // Buscar dados do banco e cliente
          const clientDados = await pool.connect();

          // Buscar dados do banco de dbdados_banco e nome de dbbanco_cobranca
          const queryBanco = `
            SELECT
              db.*,
              bc.nome as nome_banco
            FROM db_manaus.dbdados_banco db
            LEFT JOIN db_manaus.dbbanco_cobranca bc ON db.banco = bc.banco::text
            WHERE db.banco = $1
            LIMIT 1
          `;
          const bancoResult = await clientDados.query(queryBanco, [parcelasResult.rows[0].banco]);
          let dadosBanco = bancoResult.rows[0] || {};

          // Se não encontrou, tentar buscar só de dbbanco_cobranca pelo código
          if (!dadosBanco.nome_banco && parcelasResult.rows[0].banco) {
            const queryBancoFallback = `
              SELECT nome, banco as codigo
              FROM db_manaus.dbbanco_cobranca
              WHERE banco = $1 OR banco::text = $1
              LIMIT 1
            `;
            const bancoFallback = await clientDados.query(queryBancoFallback, [parcelasResult.rows[0].banco]);
            if (bancoFallback.rows[0]) {
              dadosBanco = { ...dadosBanco, nome_banco: bancoFallback.rows[0].nome, codigo: bancoFallback.rows[0].codigo };
            }
          }

          // Mapa de códigos de banco para nomes (fallback final)
          const mapaBancos: Record<string, string> = {
            '0': 'BRADESCO',
            '237': 'BRADESCO',
            '1': 'BANCO DO BRASIL',
            '001': 'BANCO DO BRASIL',
            '0001': 'BANCO DO BRASIL',
            '2': 'ITAÚ',
            '341': 'ITAÚ',
          };

          const nomeBancoFinal = dadosBanco.nome_banco || mapaBancos[parcelasResult.rows[0].banco] || 'BANCO';
          
          const queryCliente = `
            SELECT * FROM db_manaus.dbclien 
            WHERE codcli = $1 
            LIMIT 1
          `;
          const clienteResult = await clientDados.query(queryCliente, [fatura.codcli]);
          const dadosCliente = clienteResult.rows[0] || {};
          
          clientDados.release();
          
          // Se os boletos ainda não foram gerados, gerar agora
          const boletosParaGerar = parcelasResult.rows.filter(p => !p.linha_digitavel || !p.codigobarras);
          
          if (boletosParaGerar.length > 0) {
            console.log(`🔄 Gerando ${boletosParaGerar.length} boletos válidos via API legada...`);
            
            for (let i = 0; i < boletosParaGerar.length; i++) {
              const parcela = boletosParaGerar[i];
              
              try {
                // Axios runs on Node here; build an absolute URL to avoid "Invalid URL" for relative paths
                const host = (req.headers.host as string) || process.env.NEXT_PUBLIC_HOST || 'localhost:3000';
                const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
                const gerarUrl = `${protocol}://${host}/api/boleto/gerar-legado`;

                const boletoResponse = await axios.post(gerarUrl, {
                  codfat: codfat,
                  valor: Number(parcela.valor),
                  vencimento: new Date(parcela.vencimento).toISOString().split('T')[0],
                  banco: parcela.banco,
                  numeroParcela: i + 1,
                  totalParcelas: boletosParaGerar.length,
                  codreceb: parcela.codreceb, // Usar COD_RECEB existente
                });

                if (boletoResponse.data.sucesso) {
                  // Atualizar dados da parcela com os valores gerados
                  parcela.linha_digitavel = boletoResponse.data.boleto.linhaDigitavel;
                  parcela.codigobarras = boletoResponse.data.boleto.codigoBarras;
                  parcela.nossonumero = boletoResponse.data.boleto.nossoNumero;
                  console.log(`✅ Boleto ${i + 1} gerado com sucesso`);
                }
              } catch (boletoError) {
                console.error(`❌ Erro ao gerar boleto ${i + 1}:`, boletoError);
              }
            }
            
            // Atualizar lista de parcelas com dados gerados
            const clientUpdate = await pool.connect();
            const queryUpdate = `
              SELECT 
                r.cod_receb as codreceb,
                r.dt_venc as vencimento,
                r.valor_pgto::numeric as valor,
                r.nro_doc as nrodoc,
                r.nro_docbanco as nossonumero,
                r.banco,
                r.nro_banco as linha_digitavel,
                r.bradesco as codigobarras
              FROM db_manaus.dbreceb r
              WHERE cod_fat = $1 AND forma_fat = 'B'
              ORDER BY dt_venc
            `;
            const parcelasAtualizadas = await clientUpdate.query(queryUpdate, [codfat]);
            clientUpdate.release();
            
            parcelasResult.rows = parcelasAtualizadas.rows;
          }
          
          // ===== REUTILIZANDO A LÓGICA DO drawTicketBlock DO PREVIEW =====
          // Função auxiliar para desenhar campos (mesma do FaturamentoNota.tsx)
          const drawField = (
            doc: any,
            title: string,
            value: string,
            x: number,
            yPos: number,
            width: number,
            height: number,
            options: any = {},
          ) => {
            const {
              valueAlign = 'left',
              valueSize = 9,
              titleSize = 6,
              titleYOffset = 8,
              valueYOffset = 20,
            } = options;

            doc.setLineWidth(0.5);
            doc.rect(x, yPos, width, height);

            doc.setFontSize(titleSize).setFont('helvetica', 'normal');
            doc.text(title.toUpperCase(), x + 3, yPos + titleYOffset);

            let textX = valueAlign === 'right' ? x + width - 3 : x + 3;
            if (valueAlign === 'center') textX = x + width / 2;

            doc.setFontSize(valueSize).setFont('helvetica', 'bold');
            const textOptions: any = { align: valueAlign };
            doc.text(value, textX, yPos + valueYOffset, textOptions);
          };
          
          const getValue = (value: any, defaultValue: string = '') => {
            return value != null && value !== '' ? String(value) : defaultValue;
          };
          
          // Função para desenhar um boleto completo (baseada no drawTicketBlock)
          const drawBoletoCompleto = (
            doc: any,
            startY: number,
            parcela: any,
            empresa: any,
            sacado: any,
            banco: any,
          ) => {
            const margin = 20;
            const pageWidth = doc.internal.pageSize.width;
            const contentWidth = pageWidth - margin * 2;
            let y = startY;
            
            // Cabeçalho
            doc.setFont('helvetica', 'bold').setFontSize(12);
            doc.text(getValue(empresa.nomecontribuinte), margin, y);

            doc.text(
              `${banco.nome || 'Banco'} | ${banco.codigo || parcela.banco}`,
              pageWidth - margin,
              y,
              { align: 'right' },
            );
            y += 12;
            doc.setFontSize(8);
            doc.text('SEU DISTRIBUIDOR 100% ATACADO', margin, y);
            y += 15;

            doc.setFont('helvetica', 'bold').setFontSize(8);
            doc.text('RECIBO DO CLIENTE', margin, y);
            y += 12;

            // Dados do sacado
            doc.setFont('helvetica', 'normal').setFontSize(8);
            doc.text('Nome do Cliente', margin, y);
            y += 10;
            const sacadoNome = `(${getValue(sacado.codcli)}) ${getValue(
              sacado.nomefant,
            )} CNPJ ${getValue(sacado.cpfcgc)}`;
            const sacadoEndereco = `${getValue(sacado.ender)} - ${getValue(
              sacado.bairro,
            )} - ${getValue(sacado.cidade)}/${getValue(sacado.uf)} CEP:${getValue(
              sacado.cep,
            )}`;
            doc.text(sacadoNome, margin, y);
            y += 10;
            doc.text(sacadoEndereco, margin, y);
            y += 15;

            doc.text(`Número Docto.: ${parcela.nrodoc}`, margin, y);
            doc.text(`Data do Vencto: ${new Date(parcela.vencimento).toLocaleDateString('pt-BR')}`, margin + 250, y);
            doc.text(
              `Valor Documento: ${Number(parcela.valor).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}`,
              margin + 400,
              y,
            );
            y += 15;

            doc.text(`Nosso Número: ${parcela.nossonumero || 'N/A'}`, margin, y);
            doc.text('Autenticação Mecânica (no verso)', pageWidth - margin, y, {
              align: 'right',
            });

            y += 15;
            doc.line(margin, y, pageWidth - margin, y);
            y += 15;

            // Ficha de compensação
            doc.setFont('helvetica', 'bold').setFontSize(14);
            doc.text(
              `${banco.nome || 'Banco'} | ${banco.codigo || parcela.banco}`,
              margin,
              y + 18,
            );
            
            // Linha digitável (agora com dados reais)
            const linhaDigitavel = parcela.linha_digitavel || '';
            doc.setFont('helvetica', 'bold').setFontSize(11);
            if (linhaDigitavel) {
              doc.text(linhaDigitavel, pageWidth - margin, y + 18, { align: 'right' });
            }
            y += 28;

            const fieldY1 = y;
            const mainWidth = contentWidth - 160;
            drawField(
              doc,
              'Local de Pagamento',
              'Pagável em qualquer agência bancária. Após o vencimento somente nas agências do Banco.',
              margin,
              fieldY1,
              mainWidth,
              35,
            );
            drawField(
              doc,
              'Vencimento',
              new Date(parcela.vencimento).toLocaleDateString('pt-BR'),
              margin + mainWidth,
              fieldY1,
              160,
              25,
              { valueAlign: 'right' },
            );

            const fieldY2 = fieldY1 + 35;
            drawField(
              doc,
              'Cedente',
              `${getValue(empresa.nomecontribuinte)} - CNPJ: ${getValue(
                empresa.cgc,
              )}`,
              margin,
              fieldY2,
              mainWidth,
              25,
            );
            drawField(
              doc,
              'Agência / Cód.Cedente',
              `${banco.agencia || '0000'}/${banco.conta || '0000000'}`,
              margin + mainWidth,
              fieldY1 + 25,
              160,
              25,
              { valueAlign: 'right' },
            );

            const fieldY3 = fieldY2 + 25;
            drawField(
              doc,
              'Data de Emissão',
              new Date().toLocaleDateString('pt-BR'),
              margin,
              fieldY3,
              90,
              25,
            );
            drawField(
              doc,
              'Número Docto',
              parcela.nrodoc,
              margin + 90,
              fieldY3,
              110,
              25,
            );
            drawField(
              doc,
              'Espécie Docto',
              'DM',
              margin + 200,
              fieldY3,
              80,
              25,
            );
            drawField(doc, 'Aceite', 'N', margin + 280, fieldY3, 40, 25);
            drawField(
              doc,
              'Data Processamento',
              new Date().toLocaleDateString('pt-BR'),
              margin + 320,
              fieldY3,
              mainWidth - 320,
              25,
            );
            drawField(
              doc,
              'Nosso Número',
              parcela.nossonumero || 'N/A',
              margin + mainWidth,
              fieldY3,
              160,
              25,
              { valueAlign: 'right' },
            );

            const fieldY4 = fieldY3 + 25;
            drawField(doc, 'Uso do Banco', '', margin, fieldY4, 90, 25);
            drawField(doc, 'CIP', '', margin + 90, fieldY4, 60, 25);
            drawField(
              doc,
              'Carteira',
              'COBRANCA SIMPLES - RCR',
              margin + 150,
              fieldY4,
              170,
              25,
            );
            drawField(doc, 'Moeda', 'R$', margin + 320, fieldY4, 45, 25);
            drawField(doc, 'Quantidade', '', margin + 365, fieldY4, mainWidth - 365, 25);
            drawField(
              doc,
              '(=) Valor do Docto',
              Number(parcela.valor).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }),
              margin + mainWidth,
              fieldY4,
              160,
              25,
              { valueAlign: 'right' },
            );

            const fieldY5 = fieldY4 + 25;
            const instrucoes = `:: Senhor(a) caixa, não receber em CHEQUES.
:: Após o vencimento cobrar mora de R$ 3.74 por dia de atraso.
:: Título sujeito a protesto à partir de 11 dias após vencimento.`;
            drawField(
              doc,
              'Instruções (Todas informações deste bloqueto são de exclusiva responsabilidade do cedente)',
              instrucoes,
              margin,
              fieldY5,
              mainWidth,
              60,
              { valueSize: 7, valueYOffset: 15 },
            );
            drawField(
              doc,
              '(-) Desconto/Abatimento',
              '',
              margin + mainWidth,
              fieldY5,
              160,
              20,
              { valueAlign: 'right' },
            );
            drawField(doc, '(+) Mora/Multa', '', margin + mainWidth, fieldY5 + 20, 160, 20, {
              valueAlign: 'right',
            });
            drawField(
              doc,
              '(=) Valor Cobrado',
              '',
              margin + mainWidth,
              fieldY5 + 40,
              160,
              20,
              { valueAlign: 'right' },
            );

            y = fieldY5 + 65;
            doc.setFont('helvetica', 'normal').setFontSize(6);
            doc.text('SACADO', margin, y);
            y += 8;
            doc.setFont('helvetica', 'bold').setFontSize(9);
            doc.text(sacadoNome, margin, y);
            y += 10;
            doc.text(sacadoEndereco, margin, y);
            y += 5;
            doc.setFont('helvetica', 'normal').setFontSize(6);
            doc.text('SACADOR/AVALISTA', margin + mainWidth, y);

            y += 10;

            // Código de barras (agora com dados reais)
            const barcodeValue = parcela.codigobarras || '';
            if (barcodeValue) {
              try {
                // Usar @napi-rs/canvas (mesmo módulo usado em gerarPreviewNF.ts)
                let createCanvasFn: any;
                try {
                  createCanvasFn = require('@napi-rs/canvas').createCanvas;
                } catch {
                  // Fallback para canvas padrão
                  createCanvasFn = require('canvas').createCanvas;
                }

                const canvas = createCanvasFn(400, 100);
                JsBarcode(canvas, barcodeValue, {
                  format: 'ITF',
                  displayValue: false,
                  margin: 0,
                  height: 40,
                  width: 1.2,
                });
                doc.addImage(
                  canvas.toDataURL('image/png'),
                  'PNG',
                  margin,
                  y,
                  contentWidth - 200,
                  40,
                );
                console.log('✅ Código de barras do boleto gerado com sucesso');
              } catch (e) {
                console.error('❌ Erro ao gerar código de barras do boleto:', e);
                // Fallback: desenhar linhas simulando código de barras
                for (let i = 0; i < 60; i++) {
                  const x = margin + i * 5;
                  doc.setLineWidth(i % 3 === 0 ? 1.5 : 0.8);
                  doc.line(x, y, x, y + 40);
                }
              }
            }

            y += 45;
            doc.setFont('helvetica', 'bold').setFontSize(8);
            doc.text(
              'Autenticação Mecânica / Ficha de Compensação',
              pageWidth - margin,
              y,
              { align: 'right' },
            );

            return y + 10;
          };
          
          // Gerar PDF com todos os boletos usando a mesma estrutura do preview
          const doc = new jsPDF('p', 'pt', 'a4');
          const pageHeight = doc.internal.pageSize.height;
          const margin = 20;
          
          // Preparar dados do banco no formato esperado
          const bancoInfo = {
            nome: nomeBancoFinal,
            codigo: dadosBanco.codigo || parcelasResult.rows[0].banco,
            agencia: dadosBanco.agencia || '0000',
            conta: dadosBanco.nroconta || dadosBanco.conta || '0000000',
          };

          console.log('🏦 Dados do banco para boleto:', bancoInfo);
          
          // Processar boletos em pares (2 por página)
          for (let i = 0; i < parcelasResult.rows.length; i += 2) {
            if (i > 0) {
              doc.addPage();
            }
            
            let y = margin;
            
            // Desenhar primeiro boleto do par
            if (i < parcelasResult.rows.length) {
              y = drawBoletoCompleto(
                doc,
                y,
                parcelasResult.rows[i],
                dadosEmpresa,
                dadosCliente,
                bancoInfo,
              );
              
              // Se houver um segundo boleto, desenhar
              if (i + 1 < parcelasResult.rows.length) {
                y += 5;
                doc.setLineWidth(1);
                doc.line(margin, y, doc.internal.pageSize.width - margin, y);
                y += 10;
                
                y = drawBoletoCompleto(
                  doc,
                  y,
                  parcelasResult.rows[i + 1],
                  dadosEmpresa,
                  dadosCliente,
                  bancoInfo,
                );
              }
            }
          }
          
          pdfBoleto = Buffer.from(doc.output('arraybuffer'));
          console.log('✅ PDF com todos os boletos gerado com sucesso');
          
        } else {
          console.log('ℹ️ Nenhuma parcela encontrada para gerar boletos');
        }
        
      } catch (boletoError) {
        console.error('⚠️ Erro ao gerar boletos (continuando sem boleto):', boletoError instanceof Error ? boletoError.message : boletoError);
        // Continua o envio sem o boleto em caso de erro
      }
    } else {
      console.log(
        'ℹ️ Fatura sem cobrança configurada - boleto não será gerado',
      );
    }

    console.log(`📧 Enviando email com ${tipoDocumento.toUpperCase()}, XML e Boleto...`);

    // Diagnóstico: salvar buffer que será anexado e verificar se contém as seções esperadas
    try {
      const os = require('os');
      const fs = require('fs');
      const path = require('path');
      const tmpdir = os.tmpdir();
      const anexoPath = path.join(tmpdir, `NFe-anexo-${codfat}.pdf`);
      fs.writeFileSync(anexoPath, pdfBuffer);

      const bin = pdfBuffer.toString('latin1');
      const hasDest = /DESTINATÁRIO|DESTINATARIO|DESTINATÓRIO/i.test(bin);
      const hasImposto = /CÁLCULO DO IMPOSTO|CALCULO DO IMPOSTO|CÁLCULO DO IMPOSTO/i.test(bin);
      console.log('📁 DEBUG - PDF anexado salvo em:', anexoPath, 'size:', pdfBuffer.length, 'hasDest:', hasDest, 'hasImposto:', hasImposto);
    } catch (e) {
      console.warn('⚠️ Erro ao salvar/inspecionar PDF anexo antes do envio:', e);
    }

    // Enviar email usando função unificada
    const resultadoEmail = await enviarDocumentoFiscal({
      destinatario: emailCliente,
      nomeCliente: nomeCliente || fatura.nomefant || fatura.nome || 'Cliente',
      numeroNota: numeroDocumento || fatura.nroform,
      valorTotal: Number(fatura.totalnf),
      dataVencimento: fatura.vencimento
        ? new Date(fatura.vencimento).toLocaleDateString('pt-BR')
        : undefined,
      dataEmissao: tipoDocumento === 'nfce' ? fatura.data : undefined,
      pdfDocumento: pdfBuffer,
      xmlDocumento: xmlAssinado, // Incluir XML assinado como anexo
      pdfBoleto: pdfBoleto, // Boleto gerado (se disponível)
      chaveAcesso: fatura.chave,
      tipoDocumento: tipoDocumento as 'nfe' | 'nfce',
      cnpjEmpresa: fatura.cnpj_empresa,
      ieEmpresa: fatura.ie_empresa
    });

    // Atualizar flag de email enviado na NFe
    const clientUpdate = await getPgPool().connect();
    await clientUpdate.query(
      'UPDATE db_manaus.dbfat_nfe SET emailenviado = $1 WHERE codfat = $2',
      ['S', codfat],
    );
    clientUpdate.release();

    console.log('✅ Email enviado e flag atualizada com sucesso');

    return res.status(200).json({
      success: true,
      message: forcarReenvio ? 'Email reenviado com sucesso' : 'Email enviado com sucesso',
      messageId: resultadoEmail.messageId,
      destinatario: emailCliente,
      tipoDocumento: tipoDocumento.toUpperCase(),
      reenvio: forcarReenvio || false
    });
  } catch (error) {
    console.error('❌ Erro ao enviar email da NFe:', error);
    return res.status(500).json({
      error: 'Erro ao enviar email da NFe',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
