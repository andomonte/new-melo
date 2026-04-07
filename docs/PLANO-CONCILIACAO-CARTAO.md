 # Plano de Implementação: Conciliação de Cartão de Crédito

## 📊 Estrutura Oracle Identificada

### Tabelas Principais:
- **DBOPERA** - Operadoras de cartão (Cielo, Rede, etc)
  - `CODOPERA` - Código da operadora (001, 002, etc)
  - `DESCR` - Nome (ex: "CIELO - VISA")
  - `TXOPERA` - Taxa da operadora (%)
  - `PZOPERA` - Prazo de recebimento (dias)
  - `CODCLI` - Código do cliente vinculado

- **DBFRECEB** - Histórico de recebimentos
  - `CODOPERA` - Operadora utilizada
  - `CODAUTORIZACAO` - Nº autorização da transação
  - `PARCELA` - Número da parcela (formato a ajustar)
  - `TX_CARTAO` - Taxa aplicada
  - `DT_CARTAO` - Data da transação
  - `CODDOCUMENTO` - Código do lote/arquivo

- **DBRETORNO_ARQUIVO** - Arquivos de retorno importados
- **DBRETORNO_DETALHE** - Detalhes dos retornos
- **FIN_CARTAO_RECEB** - Recebimentos de cartão

---

## 🎯 Tarefas do Cliente - Implementação

### 1️⃣ **Ajustar Nomenclatura** (1-3, 2-3 em vez de A, B, C)

**Status Atual:**
- Campo `PARCELA` em `DBFRECEB` aceita VARCHAR2(2)
- ❌ Não tem validação de formato

**Implementação:**
```typescript
// src/pages/api/contas-receber/dar-baixa.ts
function formatarParcela(numeroParcela: number, totalParcelas: number): string {
  return `${numeroParcela.toString().padStart(2, '0')}-${totalParcelas.toString().padStart(2, '0')}`;
}

// Exemplo: parcela 1 de 3 → "01-03"
// Exemplo: parcela 12 de 24 → "12-24"
```

**Mudanças necessárias:**
- ✅ Atualizar modal de dar baixa para mostrar "Parcela X de Y"
- ✅ Validar formato antes de salvar
- ✅ Campo no modal: número da parcela + total de parcelas

---

### 2️⃣ **Vincular Cliente/Tarifa**

**Estrutura existente:**
```sql
DBOPERA:
  - CODOPERA: '003' 
  - DESCR: 'CIELO - VISA'
  - TXOPERA: 1.82 (taxa %)
  - PZOPERA: 31 (dias para receber)
  - CODCLI: '003' (código do cliente Cielo)
```

**Implementação:**

**Backend API:**
```typescript
// src/pages/api/operadoras/index.ts
export default async function handler(req, res) {
  const query = `
    SELECT 
      o.codopera,
      o.descr,
      o.txopera,
      o.pzopera,
      o.codcli,
      c.nome as nome_cliente
    FROM db_manaus.dbopera o
    LEFT JOIN db_manaus.dbclien c ON o.codcli = c.codcli
    WHERE o.desativado = 0
    ORDER BY o.descr
  `;
  // Retornar lista de operadoras
}

// src/pages/api/operadoras/calcular-tarifa.ts
export default async function handler(req, res) {
  const { codopera, valorTotal, numParcelas } = req.body;
  
  // 1. Buscar taxa da operadora
  const opera = await buscarOperadora(codopera);
  
  // 2. Calcular valor líquido
  const valorBruto = valorTotal;
  const taxaDecimal = opera.txopera / 100;
  const valorTaxa = valorBruto * taxaDecimal;
  const valorLiquido = valorBruto - valorTaxa;
  
  // 3. Calcular valor por parcela
  const valorParcela = valorLiquido / numParcelas;
  
  return {
    valorBruto,
    valorTaxa,
    valorLiquido,
    valorParcela,
    prazoRecebimento: opera.pzopera
  };
}
```

**Frontend - Modal de Dar Baixa:**
```typescript
// Quando selecionar "Cartão" como forma de pagamento:
<Select value={operadoraSelecionada} onChange={handleOperadoraChange}>
  {operadoras.map(op => (
    <option value={op.codopera}>
      {op.descr} - Taxa: {op.txopera}% - Cliente: {op.nome_cliente}
    </option>
  ))}
</Select>

<div className="bg-blue-50 p-3 rounded">
  <p>Valor Bruto: R$ {valorBruto}</p>
  <p>Taxa ({taxaSelecionada}%): R$ {valorTaxa}</p>
  <p className="font-bold">Valor Líquido: R$ {valorLiquido}</p>
  <p>Valor por Parcela: R$ {valorParcela}</p>
</div>
```

---

### 3️⃣ **Lógica de Geração** (Parcelas automáticas 30, 60, 90 dias)

**Implementação:**
```typescript
// src/pages/api/contas-receber/gerar-parcelas-cartao.ts
interface GerarParcelasParams {
  cod_receb: string;
  codopera: string;
  valorTotal: number;
  numParcelas: number;
  dt_base: string; // Data base para cálculo
}

export default async function handler(req, res) {
  const { cod_receb, codopera, valorTotal, numParcelas, dt_base } = req.body;
  
  // 1. Buscar operadora para pegar taxa e prazo
  const opera = await buscarOperadora(codopera);
  
  // 2. Calcular valor líquido
  const valorLiquido = valorTotal - (valorTotal * opera.txopera / 100);
  const valorParcela = valorLiquido / numParcelas;
  
  // 3. Gerar parcelas com vencimentos fixos
  const parcelas = [];
  const dtBase = new Date(dt_base);
  
  for (let i = 1; i <= numParcelas; i++) {
    const dtVencimento = new Date(dtBase);
    dtVencimento.setDate(dtVencimento.getDate() + (30 * i)); // 30, 60, 90...
    
    parcelas.push({
      parcela: formatarParcela(i, numParcelas), // "01-03"
      dt_venc: dtVencimento.toISOString().split('T')[0],
      valor: i === numParcelas 
        ? valorLiquido - (valorParcela * (numParcelas - 1)) // Ajuste última parcela
        : valorParcela
    });
  }
  
  // 4. Inserir em DBFRECEB (baixa parcial automática)
  for (const parcela of parcelas) {
    await pool.query(`
      INSERT INTO db_manaus.dbfreceb (
        cod_freceb, cod_receb, codopera, parcela, 
        dt_pgto, dt_venc, valor, tipo, sf, 
        tx_cartao, codcli
      ) VALUES (
        (SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)), 0) + 1 FROM db_manaus.dbfreceb WHERE cod_receb = $1),
        $1, $2, $3, $4, $5, $6, 'D', 'S', $7, $8
      )
    `, [cod_receb, codopera, parcela.parcela, parcela.dt_venc, parcela.dt_venc, 
        parcela.valor, opera.txopera, opera.codcli]);
  }
  
  return { success: true, parcelas };
}
```

---

### 4️⃣ **Importação de Arquivo** (CSV/TXT)

**Estrutura típica do arquivo de retorno das operadoras:**
```csv
Loja;NSU;Data;Hora;Bandeira;Parcela;ValorBruto;Taxa;ValorLiquido;Autorizacao;TID
0001;123456;2026-01-02;14:30:00;VISA;01-03;333.33;6.06;327.27;ABC123;TID001
0001;123456;2026-01-02;14:30:00;VISA;02-03;333.33;6.06;327.27;ABC123;TID001
0001;123456;2026-01-02;14:30:00;VISA;03-03;333.34;6.07;327.27;ABC123;TID001
```

**Implementação:**
```typescript
// src/pages/api/conciliacao-cartao/importar.ts
export default async function handler(req, res) {
  const { arquivo, filial } = req.body; // arquivo = base64 ou texto
  
  // 1. Parse do arquivo
  const linhas = arquivo.split('\n');
  const registros = [];
  
  for (let i = 1; i < linhas.length; i++) { // Pula cabeçalho
    const linha = linhas[i].replace(/;;/g, ';null;'); // Trata colunas vazias
    const campos = linha.split(';');
    
    // Identificar filial
    const lojaId = campos[0];
    const filialIdentificada = lojaId === '0001' ? 'Manaus' : 'Porto Velho';
    
    if (filial && filialIdentificada !== filial) continue; // Filtro
    
    registros.push({
      loja: campos[0],
      nsu: campos[1],
      data: campos[2],
      hora: campos[3],
      bandeira: campos[4],
      parcela: campos[5], // Já vem no formato "01-03"
      valorBruto: parseFloat(campos[6].replace(',', '.')),
      taxa: parseFloat(campos[7].replace(',', '.')),
      valorLiquido: parseFloat(campos[8].replace(',', '.')),
      autorizacao: campos[9],
      tid: campos[10]
    });
  }
  
  // 2. Salvar em tabela temporária de importação
  for (const reg of registros) {
    await pool.query(`
      INSERT INTO db_manaus.fin_cartao_receb_import (
        loja, nsu, dt_transacao, bandeira, parcela,
        valor_bruto, taxa, valor_liquido, autorizacao, tid,
        dt_importacao, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'PENDENTE')
    `, [reg.loja, reg.nsu, reg.data, reg.bandeira, reg.parcela,
        reg.valorBruto, reg.taxa, reg.valorLiquido, reg.autorizacao, reg.tid]);
  }
  
  return { 
    success: true, 
    totalRegistros: registros.length,
    filial: filial || 'Todas'
  };
}
```

---

### 5️⃣ **Conciliação/Baixa** (Código C + Nº Autorização + Parcela + Qtd)

**Lógica de Match:**
```typescript
// src/pages/api/conciliacao-cartao/conciliar.ts
export default async function handler(req, res) {
  // 1. Buscar registros importados pendentes
  const importados = await pool.query(`
    SELECT * FROM db_manaus.fin_cartao_receb_import
    WHERE status = 'PENDENTE'
  `);
  
  const resultados = {
    localizados: [],
    naoLocalizados: [],
    cancelados: []
  };
  
  for (const reg of importados.rows) {
    // 2. Extrair dados para match
    const [numParcela, totalParcelas] = reg.parcela.split('-');
    
    // 3. Buscar no DBFRECEB com 4 critérios
    const match = await pool.query(`
      SELECT 
        f.*,
        r.cod_receb,
        r.valor_pgto as valor_titulo,
        c.nome as nome_cliente
      FROM db_manaus.dbfreceb f
      JOIN db_manaus.dbreceb r ON f.cod_receb = r.cod_receb
      JOIN db_manaus.dbclien c ON r.codcli = c.codcli
      WHERE f.codautorizacao = $1  -- Critério 1: Autorização
        AND f.parcela = $2           -- Critério 2: Parcela (formato 01-03)
        AND f.codopera = $3          -- Critério 3: Código da operadora (bandeira)
        AND EXISTS (                 -- Critério 4: Total de parcelas
          SELECT 1 FROM db_manaus.dbfreceb f2
          WHERE f2.cod_receb = f.cod_receb
            AND f2.codautorizacao = f.codautorizacao
          GROUP BY f2.cod_receb, f2.codautorizacao
          HAVING COUNT(*) = $4
        )
    `, [reg.autorizacao, reg.parcela, mapearBandeira(reg.bandeira), parseInt(totalParcelas)]);
    
    if (match.rows.length > 0) {
      // 4. Encontrado! Marcar como conciliado
      await pool.query(`
        UPDATE db_manaus.fin_cartao_receb_import
        SET status = 'CONCILIADO',
            cod_receb = $1,
            cod_freceb = $2,
            dt_conciliacao = NOW()
        WHERE id = $3
      `, [match.rows[0].cod_receb, match.rows[0].cod_freceb, reg.id]);
      
      resultados.localizados.push({
        ...reg,
        match: match.rows[0]
      });
    } else {
      // 5. Não encontrado
      resultados.naoLocalizados.push(reg);
    }
  }
  
  return resultados;
}

// Helper para mapear nome da bandeira para código
function mapearBandeira(nomeBandeira: string): string {
  const mapa = {
    'VISA': '003',
    'MASTERCARD': '006',
    'ELO': '010',
    'AMEX': '005',
    'DINERS': '007'
  };
  return mapa[nomeBandeira.toUpperCase()] || '003';
}
```

---

### 6️⃣ **Relatório de Resumo**

**Tela de Conciliação:**
```typescript
// src/pages/conciliacao-cartao.tsx
export default function ConciliacaoCartao() {
  const [resultado, setResultado] = useState(null);
  
  return (
    <div className="p-6">
      <h1>Conciliação de Cartão de Crédito</h1>
      
      {/* Upload de arquivo */}
      <FileUpload onUpload={handleImportacao} />
      
      {/* Botão conciliar */}
      <Button onClick={handleConciliar}>Conciliar</Button>
      
      {/* Resumo */}
      {resultado && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {/* Localizados */}
          <Card className="bg-green-50">
            <CardHeader>
              <CheckCircle className="text-green-600" />
              <h3>Localizados</h3>
              <p className="text-3xl font-bold">{resultado.localizados.length}</p>
            </CardHeader>
            <CardContent>
              <table>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Cliente</th>
                    <th>Parcela</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.localizados.map(item => (
                    <tr key={item.id}>
                      <td>{item.match.cod_receb}</td>
                      <td>{item.match.nome_cliente}</td>
                      <td>{item.parcela}</td>
                      <td>R$ {item.valorLiquido.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          
          {/* Não Localizados */}
          <Card className="bg-yellow-50">
            <CardHeader>
              <AlertTriangle className="text-yellow-600" />
              <h3>Não Localizados</h3>
              <p className="text-3xl font-bold">{resultado.naoLocalizados.length}</p>
            </CardHeader>
            <CardContent>
              <table>
                <thead>
                  <tr>
                    <th>Autorização</th>
                    <th>Parcela</th>
                    <th>Valor</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.naoLocalizados.map(item => (
                    <tr key={item.id}>
                      <td>{item.autorizacao}</td>
                      <td>{item.parcela}</td>
                      <td>R$ {item.valorLiquido.toFixed(2)}</td>
                      <td>
                        <Button size="sm" onClick={() => criarTituloManual(item)}>
                          Criar Título
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          
          {/* Cancelados/Estornados */}
          <Card className="bg-red-50">
            <CardHeader>
              <XCircle className="text-red-600" />
              <h3>Cancelados/Estornados</h3>
              <p className="text-3xl font-bold">{resultado.cancelados.length}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Registros com flag de cancelamento no arquivo
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Exportar CSV */}
      <Button onClick={exportarCSV} className="mt-4">
        Exportar Resumo
      </Button>
    </div>
  );
}
```

---

## 📋 Checklist de Implementação

### Fase 1: Ajustes Básicos
- [ ] Ajustar formato de parcela para "01-03"
- [ ] Criar API `/api/operadoras` (listar)
- [ ] Criar API `/api/operadoras/calcular-tarifa`
- [ ] Atualizar modal de dar baixa com cálculo de taxa

### Fase 2: Geração de Parcelas
- [ ] Criar API `/api/contas-receber/gerar-parcelas-cartao`
- [ ] Adicionar botão "Parcelar em Cartão" no modal
- [ ] Implementar lógica de vencimentos (30, 60, 90 dias)

### Fase 3: Importação
- [ ] Criar tabela `fin_cartao_receb_import` no PostgreSQL
- [ ] Criar API `/api/conciliacao-cartao/importar`
- [ ] Criar página de upload de arquivo
- [ ] Implementar parser de CSV/TXT

### Fase 4: Conciliação
- [ ] Criar API `/api/conciliacao-cartao/conciliar`
- [ ] Implementar lógica de match (4 critérios)
- [ ] Criar tela de resultados

### Fase 5: Relatórios
- [ ] Criar cards de resumo (Localizados/Não Localizados/Cancelados)
- [ ] Implementar exportação CSV
- [ ] Criar opção de criar título manual para não localizados

---

## 🚀 Priorização Sugerida

1. **Sprint 1 (1-2 semanas):** Fase 1 + Fase 2
2. **Sprint 2 (1-2 semanas):** Fase 3 + Fase 4
3. **Sprint 3 (1 semana):** Fase 5 + Testes

**Total estimado:** 4-5 semanas de desenvolvimento
