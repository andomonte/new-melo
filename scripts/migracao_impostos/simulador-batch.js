/**
 * SIMULADOR COMPARATIVO DE IMPOSTOS - MODO BATCH
 *
 * Executa múltiplos casos de teste a partir de um arquivo JSON
 */

const SimuladorComparativo = require('./simulador-comparativo');
const fs = require('fs');
const path = require('path');

class SimuladorBatch extends SimuladorComparativo {
  constructor(arquivoCasos) {
    super();
    this.arquivoCasos = arquivoCasos;
    this.casos = [];
    this.resultadosCasos = [];
  }

  /**
   * Carrega casos de teste do arquivo JSON
   */
  carregarCasos() {
    try {
      const conteudo = fs.readFileSync(this.arquivoCasos, 'utf-8');
      this.casos = JSON.parse(conteudo);
      console.log(`\n✓ ${this.casos.length} casos de teste carregados\n`);
    } catch (error) {
      console.error(`✗ Erro ao carregar casos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Executa um caso de teste
   */
  async executarCaso(caso, indice) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`CASO ${indice + 1}/${this.casos.length}: ${caso.nome}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`Descrição: ${caso.descricao}\n`);

    try {
      // Buscar produto
      const produto = await this.buscarProduto(caso.produto.termo_busca);
      if (!produto) {
        console.log(`⚠ Produto não encontrado: ${caso.produto.termo_busca}`);
        return {
          caso: caso.nome,
          status: 'ERRO',
          erro: 'Produto não encontrado'
        };
      }

      // Buscar cliente
      const cliente = await this.buscarCliente(caso.cliente.termo_busca);
      if (!cliente) {
        console.log(`⚠ Cliente não encontrado: ${caso.cliente.termo_busca}`);
        return {
          caso: caso.nome,
          status: 'ERRO',
          erro: 'Cliente não encontrado'
        };
      }

      // Armazenar entrada
      this.resultados.entrada = {
        produto: produto.oracle,
        cliente: cliente.oracle,
        valor: caso.valores.valor_unitario,
        quantidade: caso.valores.quantidade
      };

      // Calcular Oracle
      const resultadoOracle = await this.calcularOracle(
        produto.oracle.id_produto,
        cliente.oracle.id_cliente,
        caso.valores.valor_unitario,
        caso.valores.quantidade
      );

      // Calcular PostgreSQL
      const resultadoPg = await this.calcularPostgreSQL(
        produto.pg?.id_produto || produto.oracle.id_produto,
        cliente.pg?.id_cliente || cliente.oracle.id_cliente,
        caso.valores.valor_unitario,
        caso.valores.quantidade
      );

      this.resultados.oracle = resultadoOracle;
      this.resultados.postgresql = resultadoPg;

      // Comparar
      if (resultadoOracle && resultadoPg) {
        this.compararResultados(resultadoOracle, resultadoPg);

        // Salvar relatório individual
        await this.salvarRelatorio();

        return {
          caso: caso.nome,
          status: 'SUCESSO',
          comparacao: this.resultados.comparacao
        };
      } else {
        return {
          caso: caso.nome,
          status: 'INCOMPLETO',
          erro: 'Dados insuficientes para comparação'
        };
      }
    } catch (error) {
      console.error(`✗ Erro ao executar caso: ${error.message}`);
      return {
        caso: caso.nome,
        status: 'ERRO',
        erro: error.message
      };
    }
  }

  /**
   * Executa todos os casos de teste
   */
  async executarTodos() {
    try {
      console.log('\n╔═══════════════════════════════════════════════════╗');
      console.log('║  SIMULADOR COMPARATIVO - MODO BATCH              ║');
      console.log('╚═══════════════════════════════════════════════════╝');

      // Conectar aos bancos
      await this.conectar();

      // Carregar casos
      this.carregarCasos();

      // Executar cada caso
      for (let i = 0; i < this.casos.length; i++) {
        const resultado = await this.executarCaso(this.casos[i], i);
        this.resultadosCasos.push(resultado);

        // Pequena pausa entre casos
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Gerar relatório consolidado
      await this.gerarRelatorioConsolidado();

      // Mostrar resumo final
      this.mostrarResumoFinal();

    } catch (error) {
      console.error('✗ Erro fatal:', error);
      throw error;
    } finally {
      await this.desconectar();
    }
  }

  /**
   * Gera relatório consolidado de todos os casos
   */
  async gerarRelatorioConsolidado() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(__dirname, 'testes_comparativos');
    const filename = `consolidado_${timestamp.split('T')[0]}.md`;
    const filepath = path.join(dir, filename);

    let md = `# Relatório Consolidado - Testes Comparativos de Impostos

**Data:** ${new Date().toLocaleString('pt-BR')}
**Total de Casos:** ${this.casos.length}

## Resumo Executivo

`;

    // Estatísticas gerais
    const sucesso = this.resultadosCasos.filter(r => r.status === 'SUCESSO').length;
    const erro = this.resultadosCasos.filter(r => r.status === 'ERRO').length;
    const incompleto = this.resultadosCasos.filter(r => r.status === 'INCOMPLETO').length;

    md += `| Métrica | Quantidade | Percentual |\n`;
    md += `|---------|------------|------------|\n`;
    md += `| Sucessos | ${sucesso} | ${((sucesso / this.casos.length) * 100).toFixed(1)}% |\n`;
    md += `| Erros | ${erro} | ${((erro / this.casos.length) * 100).toFixed(1)}% |\n`;
    md += `| Incompletos | ${incompleto} | ${((incompleto / this.casos.length) * 100).toFixed(1)}% |\n\n`;

    // Detalhes por caso
    md += `## Resultados por Caso\n\n`;

    this.resultadosCasos.forEach((resultado, i) => {
      md += `### ${i + 1}. ${resultado.caso}\n\n`;
      md += `**Status:** ${resultado.status}\n\n`;

      if (resultado.status === 'SUCESSO') {
        const comp = resultado.comparacao;
        md += `- ✓ Campos compatíveis: ${comp.compativeis}/${comp.total} (${comp.percentual}%)\n`;
        md += `- ✗ Campos divergentes: ${comp.divergentes}\n`;
        md += `- ✨ Campos novos: ${comp.novos}\n\n`;

        if (comp.divergentes > 0) {
          md += `**Divergências encontradas:**\n\n`;
          comp.detalhes
            .filter(d => !d.compativel && d.status !== 'NOVO')
            .forEach(d => {
              md += `- ${d.campo}: Oracle=${d.oracle}, PG=${d.postgresql}\n`;
            });
          md += `\n`;
        }
      } else if (resultado.status === 'ERRO') {
        md += `**Erro:** ${resultado.erro}\n\n`;
      }

      md += `---\n\n`;
    });

    // Conclusões
    md += `## Conclusões\n\n`;

    if (sucesso === this.casos.length) {
      md += `✅ **TODOS OS TESTES PASSARAM COM SUCESSO!**\n\n`;
      md += `Os sistemas Oracle e PostgreSQL estão calculando os impostos de forma compatível.\n\n`;
    } else if (sucesso > 0) {
      md += `⚠️ **TESTES PARCIALMENTE COMPATÍVEIS**\n\n`;
      md += `${sucesso} de ${this.casos.length} casos passaram com sucesso.\n`;
      md += `Revisar casos com erro ou divergência.\n\n`;
    } else {
      md += `❌ **ATENÇÃO: NENHUM TESTE PASSOU**\n\n`;
      md += `É necessário revisar urgentemente a implementação dos cálculos.\n\n`;
    }

    md += `## Próximos Passos\n\n`;
    md += `1. Analisar casos com divergência\n`;
    md += `2. Verificar regras de negócio específicas\n`;
    md += `3. Ajustar cálculos conforme necessário\n`;
    md += `4. Re-executar testes\n\n`;

    md += `---\n\n`;
    md += `*Relatório gerado automaticamente pelo Simulador Comparativo (Modo Batch)*\n`;

    fs.writeFileSync(filepath, md);
    console.log(`\n💾 Relatório consolidado salvo: ${filepath}`);
  }

  /**
   * Mostra resumo final no console
   */
  mostrarResumoFinal() {
    console.log('\n' + '═'.repeat(80));
    console.log('RESUMO FINAL');
    console.log('═'.repeat(80));

    const sucesso = this.resultadosCasos.filter(r => r.status === 'SUCESSO').length;
    const erro = this.resultadosCasos.filter(r => r.status === 'ERRO').length;
    const incompleto = this.resultadosCasos.filter(r => r.status === 'INCOMPLETO').length;

    console.log(`\nTotal de casos: ${this.casos.length}`);
    console.log(`✓ Sucessos: ${sucesso}`);
    console.log(`✗ Erros: ${erro}`);
    console.log(`⚠ Incompletos: ${incompleto}`);

    if (sucesso === this.casos.length) {
      console.log('\n✅ TODOS OS TESTES PASSARAM!');
    } else if (sucesso > 0) {
      console.log(`\n⚠️ ${sucesso}/${this.casos.length} testes passaram`);
    } else {
      console.log('\n❌ NENHUM TESTE PASSOU - REVISAR IMPLEMENTAÇÃO');
    }

    console.log('\n' + '═'.repeat(80) + '\n');
  }
}

// Executar
async function main() {
  const args = process.argv.slice(2);
  const arquivoCasos = args[0] || path.join(__dirname, 'testes_comparativos', 'casos-teste.json');

  console.log(`\nArquivo de casos: ${arquivoCasos}\n`);

  const simulador = new SimuladorBatch(arquivoCasos);

  try {
    await simulador.executarTodos();
  } catch (error) {
    console.error('Erro fatal:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SimuladorBatch;
