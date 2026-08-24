/**
 * ROBÔ 1 — Impressão de Separação (Matricial)
 *
 * Equivalente ao Gerenciador_Impressao do Delphi.
 * Faz polling na dbservimp, gera texto matricial e envia para impressora.
 *
 * Uso: node index.js
 * Ou com config customizada: node index.js --config ./config.json
 */

const { Pool } = require('pg');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Carregar configuração ────────────────────────────────────────────
const configPath = process.argv.includes('--config')
  ? process.argv[process.argv.indexOf('--config') + 1]
  : path.join(__dirname, 'config.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const pool = new Pool({
  connectionString: config.database.connectionString,
  options: `-c search_path=${config.database.schema},public`,
});

const INTERVALO = config.polling.intervaloMs;
const MAX_POR_CICLO = config.polling.maxPorCiclo;
const NROIMP = config.fila.nroimp;
const ARMAZEM = config.fila.armazem;
const IMPRESSORA = config.impressora.nome;

let rodando = false;

// ─── Funções auxiliares de formatação (replicando o Delphi) ───────────
function pad(str, len) {
  return (str || '').substring(0, len).padEnd(len, ' ');
}

function padN(str, len) {
  return (str || '').substring(0, len).padStart(len, ' ');
}

function sep() {
  return '    ' + '- '.repeat(70);
}

function formatMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatData(d) {
  if (!d) return '';
  if (d instanceof Date) {
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }
  const s = String(d).substring(0, 10);
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
}

function agora() {
  const n = new Date();
  return {
    data: `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`,
    hora: n.toTimeString().substring(0, 8),
  };
}

// ─── Gerar relatório texto (layout idêntico ao Delphi Print_Venda) ────
async function gerarTexto(client, registro) {
  const codvenda = registro.CODIGO;
  const tipodoc = registro.TIPODOC;

  // Dados empresa
  const emp = await client.query('SELECT nomecontribuinte, cgc, inscricaoestadual, suframa, telefone, fax, email, logradouro, numero, bairro, cep, municipio, uf FROM dadosempresa LIMIT 1');
  const e = emp.rows[0] || {};

  // Dados da venda
  const venda = await client.query(
    `SELECT v.codvenda, v.data, v.total, v.codcli, v.codusr, v.codvend, v.prazo, v.obs, v.obsfat,
            v.transp, v.vlrfrete, v.pedido, v.status, v.nome as tele_nome
     FROM dbvenda v WHERE v.codvenda = $1`, [codvenda]);
  if (!venda.rows.length) return null;
  const v = venda.rows[0];

  // Cliente
  const cli = await client.query(
    'SELECT codcli, nome, nomefant, cpfcgc, ender, bairro, cidade, uf, cep, iest, obs, complemento FROM dbclien WHERE codcli = $1', [v.codcli]);
  const c = cli.rows[0] || {};

  // Vendedor
  const vend = await client.query(
    `SELECT codvend, nome FROM dbvend WHERE ltrim(codvend::text,'0') = ltrim($1::text,'0')`, [v.codvend]);
  const vendedor = vend.rows[0] || {};

  // Operador
  const oper = await client.query(
    `SELECT codvend, nome FROM dbvend WHERE ltrim(codvend::text,'0') = ltrim($1::text,'0')`, [v.codusr]);
  const operador = oper.rows[0] || {};

  // Armazém
  const arm = await client.query('SELECT arm_descricao FROM cad_armazem WHERE arm_id = $1', [ARMAZEM]);
  const armazem = arm.rows[0]?.arm_descricao || 'GERAL';

  // Itens (locação vem da cad_armazem_produto_locacao pelo armazém do item)
  const itens = await client.query(
    `SELECT i.codprod, i.qtd, i.prunit, i.ref, i.descr, i.arm_id,
            p.unimed, p.codmarca,
            m.descr as marca_nome,
            COALESCE(loc.apl_descricao, p.local, '') as locacao
     FROM dbitvenda i
     LEFT JOIN dbprod p ON i.codprod = p.codprod
     LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
     LEFT JOIN cad_armazem_produto_locacao loc
       ON loc.apl_codprod = i.codprod AND loc.apl_arm_id = i.arm_id::numeric
     WHERE i.codvenda = $1 ORDER BY i.codprod`, [codvenda]);

  // Contagem de itens
  const totalItens = itens.rows.length;
  const totalValor = itens.rows.reduce((acc, it) => acc + Number(it.qtd) * Number(it.prunit), 0);

  const { data: dataImp, hora: horaImp } = agora();
  const dataVenda = formatData(v.data);
  const horaVenda = v.data instanceof Date
    ? v.data.toTimeString().substring(0, 8)
    : (String(v.data || '').substring(11, 19) || '');

  // Determinar tipo de documento
  let tipoLabel = 'PRE-PEDIDO';
  if (tipodoc === 'C') tipoLabel = 'CAUTELA';
  else if (tipodoc === '1') tipoLabel = 'D1 BALCAO';

  // Montar linhas
  const linhas = [];
  const L = (s) => linhas.push(s);

  // Cabeçalho
  L('    ' + pad(e.nomecontribuinte || '', 40) + '            *** SEM VALOR FISCAL ***');
  L('    ' + tipoLabel + ': ' + codvenda + '                       EMISSAO: ' + dataVenda + '          HORA:    ' + horaVenda);
  L('    DATA:       ' + dataVenda + '                      USUARIO: ' + pad(registro.NOMEUSR || operador.nome || '', 20) + ' ARMAZEM: ' + armazem);
  L('    ESTE FORMULARIO FOI IMPRESSO AS ' + horaImp + ' DE ' + dataImp);
  L(sep());

  // Cliente
  L('    CLIENTE:     ' + pad((c.codcli || '') + ' - ' + (c.nome || ''), 61) + 'NOME FANT.: ' + (c.nomefant || ''));
  L('    ENDERECO:    ' + pad(c.ender || '', 60) + ' BAIRRO:     ' + (c.bairro || ''));
  L('    CIDADE:      ' + pad(c.cidade || '', 20) + '                                     UF:         ' + (c.uf || '') + ' - CEP: ' + (c.cep || ''));
  L('    COMPLEMENTO: ' + (c.complemento || ''));
  L('    C.N.P.J.:    ' + pad(c.cpfcgc || '', 61) + 'INSC. EST:  ' + (c.iest || ''));
  L('    OBS. Cliente: ' + (c.obs || ''));
  L('    VEND. RESP.: ' + (vendedor.codvend || v.codvend || '') + ' - ' + pad(vendedor.nome || '', 18) + '                                   O.C.:       ' + (v.pedido || ''));
  L('    VEND. TEL.: ');
  L(sep());

  // Header itens
  L('    ' + pad('LOCACAO', 32) + 'UN QTD ' + pad('REFERENCIA', 15) + pad('DESCRICAO', 43) + ' ' + pad('MARCA', 10) + padN('PC UNIT', 9) + padN('TOTAL', 13));
  L(sep());

  // Itens
  for (const it of itens.rows) {
    L('    ' + pad(it.locacao || '', 31) + ' ' +
      pad(it.unimed || 'PC', 2) +
      padN(String(Number(it.qtd)), 4) + ' ' +
      pad(it.ref || it.codprod || '', 14) + ' ' +
      pad(it.descr || '', 43) + ' ' +
      pad(it.marca_nome || '', 10) +
      padN(formatMoeda(it.prunit), 10) + ' ' +
      padN(formatMoeda(Number(it.qtd) * Number(it.prunit)), 12));
  }
  L(sep());

  // Total
  L('    AUTENTICACAO: ' + pad('', 42) + '                              TOTAL ITENS:' + padN(String(totalItens), 5) + '          TOTAL :' + padN(formatMoeda(totalValor), 13));
  L(sep());

  // Rodapé
  L('    OPERADOR:   ' + (operador.codvend || v.codusr || '') + ' - ' + (operador.nome || ''));
  L('    OBS. FINANCEIRA: ' + (v.obsfat || ''));
  L('    ');
  L('    OBSERVACAO: ' + (v.obs || ''));
  L('    PRAZO:      ' + (v.prazo || ''));
  if (tipodoc === 'C' || tipodoc === 'P' || tipodoc === 'F') {
    L('    TRANSPORTE: ' + (v.transp || 'CLIENTE RETIRA') + '          TAXA ENTREGA: R$ ' + formatMoeda(v.vlrfrete));
  }
  L(' ');
  L(' ');
  L(' ');
  L(' ');
  L(' ');
  L(' ');

  // Assinaturas
  L('    QUANTIDADE DE ITEM(NS): ' + totalItens);
  L(' ');
  L('    SEPARADOR:  ___/___/________      ____:____   ____:____ ____________________________       ________________________________________');
  L(' ');
  L('                                                                                                          ACEITE DO CLIENTE            ');
  L('    CONFERENTE: ___/___/________      ____:____   ____:____ ____________________________');
  L(' ');
  L(' ');
  L('    MOTORISTA:  ___/___/________      ____:____   ____:____ ____________________________');
  L(' ');

  // Motivo da reimpressão (se houver)
  if (registro.motivo) {
    L(' ');
    L('    *** REIMPRESSAO - MOTIVO: ' + registro.motivo + ' ***');
  }

  return linhas.join('\r\n');
}

// ─── Enviar para impressora ──────────────────────────────────────────
function imprimirTexto(texto, codvenda) {
  return new Promise((resolve, reject) => {
    // Salvar em arquivo temporário
    const tmpFile = path.join(os.tmpdir(), `pre_pedido_${codvenda}_${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, texto, 'utf-8');

    if (!IMPRESSORA) {
      console.log(`[PREVIEW] Arquivo salvo: ${tmpFile}`);
      console.log('[PREVIEW] Nenhuma impressora configurada. Configure "impressora.nome" no config.json');
      resolve(tmpFile);
      return;
    }

    // Imprimir via Windows
    const cmd = `print /d:"${IMPRESSORA}" "${tmpFile}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ERRO] Falha ao imprimir: ${error.message}`);
        reject(error);
      } else {
        console.log(`[OK] Impresso na ${IMPRESSORA}: ${codvenda}`);
        // Limpar arquivo temporário após 10s
        setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) {} }, 10000);
        resolve(tmpFile);
      }
    });
  });
}

// ─── Ciclo principal ─────────────────────────────────────────────────
async function ciclo() {
  if (rodando) return;
  rodando = true;

  const client = await pool.connect();
  try {
    // Buscar registros pendentes (IMPRESSO <> 'S')
    const result = await client.query(
      `SELECT "CODIGO", "NRODOC", "TIPODOC", "CODCF", "NOMECF", "NOMEUSR",
              "VALOR", "DATA", "HORA", "NROIMP", "IMPRESSO", "ARMAZEM", motivo
       FROM dbservimp
       WHERE "IMPRESSO" <> 'S' AND "NROIMP" = $1 AND "ARMAZEM" = $2
       ORDER BY "DATA" ASC, "HORA" ASC
       LIMIT $3`,
      [NROIMP, ARMAZEM, MAX_POR_CICLO]
    );

    if (result.rows.length === 0) {
      process.stdout.write('.');
      return;
    }

    console.log(`\n[${agora().hora}] ${result.rows.length} documento(s) na fila`);

    for (const reg of result.rows) {
      try {
        console.log(`  Processando: ${reg.CODIGO} (${reg.TIPODOC}) ...`);

        // 1. Marcar como impresso ANTES de imprimir (estratégia otimista, igual ao Delphi)
        await client.query(
          `UPDATE dbservimp SET "IMPRESSO" = 'S'
           WHERE "CODIGO" = $1 AND "TIPODOC" = $2 AND "NROIMP" = $3 AND "IMPRESSO" <> 'S'
           AND "DATA" = $4 AND "HORA" = $5`,
          [reg.CODIGO, reg.TIPODOC, reg.NROIMP, reg.DATA, reg.HORA]
        );

        // 2. Gerar texto do relatório
        const texto = await gerarTexto(client, reg);
        if (!texto) {
          console.log(`  [AVISO] Venda ${reg.CODIGO} não encontrada, pulando`);
          continue;
        }

        // 3. Enviar para impressora
        await imprimirTexto(texto, reg.CODIGO);

      } catch (err) {
        console.error(`  [ERRO] ${reg.CODIGO}: ${err.message}`);
        // Reverter marcação se der erro
        try {
          await client.query(
            `UPDATE dbservimp SET "IMPRESSO" = 'N'
             WHERE "CODIGO" = $1 AND "TIPODOC" = $2 AND "NROIMP" = $3
             AND "DATA" = $4 AND "HORA" = $5`,
            [reg.CODIGO, reg.TIPODOC, reg.NROIMP, reg.DATA, reg.HORA]
          );
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error(`\n[ERRO] Ciclo: ${err.message}`);
  } finally {
    client.release();
    rodando = false;
  }
}

// ─── Inicialização ──────────────────────────────────────────────────
async function iniciar() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   ROBÔ DE SEPARAÇÃO - Impressão Matricial       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Fila: ${NROIMP}  |  Armazém: ${ARMAZEM}                       ║`);
  console.log(`║  Impressora: ${IMPRESSORA || '(nenhuma - modo preview)'}`.padEnd(51) + '║');
  console.log(`║  Polling: ${INTERVALO / 1000}s  |  Max/ciclo: ${MAX_POR_CICLO}               ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  // Testar conexão
  try {
    const client = await pool.connect();
    const r = await client.query("SELECT COUNT(*) as qtd FROM dbservimp WHERE \"IMPRESSO\" = 'N'");
    console.log(`[OK] Banco conectado. ${r.rows[0].qtd} documento(s) pendente(s) no total.`);
    client.release();
  } catch (err) {
    console.error('[ERRO] Falha ao conectar no banco:', err.message);
    process.exit(1);
  }

  // Iniciar polling
  console.log('[OK] Polling iniciado. Ctrl+C para parar.\n');
  await ciclo();
  setInterval(ciclo, INTERVALO);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[PARANDO] Encerrando robô...');
  await pool.end();
  process.exit(0);
});

iniciar();
