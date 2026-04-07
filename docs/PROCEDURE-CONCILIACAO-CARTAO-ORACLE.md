# Procedure de Conciliação de Cartão - Oracle

## Identificação
- **Pacote**: GERAL.CONTASR
- **Procedure**: CON_CARTAO_RECEB
- **Linhas**: 1179-1207

## Código Oracle Original

```sql
PROCEDURE CON_CARTAO_RECEB(vNroParc in Varchar2,
                           vTotParc in Varchar2,
                           vNsuDoc in Varchar2,
                           vCodAuto in Varchar2,
                           vTipo  in Varchar2,
                           vCursor out cursorgenerico.TIPOCURSORGENERICO) IS
BEGIN
  if vTotParc is null then
    open vCursor for
    select r.*, c.codcli, c.nome
    from dbreceb r
    inner join dbclien c on r.codcli=c.codcli
    inner join fin_cartao_receb crr on r.cod_receb=crr.car_cod_receb
    inner join fin_cartao car on crr.car_car_id=car.car_id
    where car.car_nrodocumento=vNsuDoc and car.car_nroautorizacao=vCodAuto and
          car_codcli in (select codcli from dbclien where nome like decode(vTipo,'CIELO','CIELO%','SANTANDER%'));
  else
    open vCursor for
    select r.*, c.codcli, c.nome
    from dbreceb r
    inner join dbclien c on r.codcli=c.codcli
    inner join fin_cartao_receb crr on r.cod_receb=crr.car_cod_receb
    inner join fin_cartao car on crr.car_car_id=car.car_id
    where car.car_nrodocumento=vNsuDoc and car.car_nroautorizacao=vCodAuto and
          r.nro_doc = 'C'||vNsuDoc||'-'||strzero_s(vNroParc,2) and
          car.car_nroparcela=strzero_s(vTotParc,2) and
          car_codcli in (select codcli from dbclien where nome like decode(vTipo,'CIELO','CIELO%','SANTANDER%'));
  end if;
END CON_CARTAO_RECEB;
```

## Parâmetros

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| vNroParc | varchar2 | Número da parcela atual | '01', '02', '03' |
| vTotParc | varchar2 | Total de parcelas (pode ser null) | '03', '06', '12' |
| vNsuDoc | varchar2 | NSU (Número Sequencial Único) | '123456789' |
| vCodAuto | varchar2 | Código de Autorização | 'ABC123' |
| vTipo | varchar2 | Tipo de operadora | 'CIELO' ou 'SANTANDER' |
| vCursor | OUT cursor | Cursor com resultados encontrados | - |

## Lógica de Matching

### Caso 1: vTotParc é NULL (Match Simples)
**Critérios de busca:**
1. ✅ NSU (car_nrodocumento) = vNsuDoc
2. ✅ Autorização (car_nroautorizacao) = vCodAuto
3. ✅ Cliente operadora (nome LIKE 'CIELO%' ou 'SANTANDER%')

**Exemplo**: Busca por NSU '123456789' e Autorização 'ABC123' da CIELO, sem especificar parcela

### Caso 2: vTotParc NÃO é NULL (Match Estrito)
**Critérios de busca:**
1. ✅ NSU (car_nrodocumento) = vNsuDoc
2. ✅ Autorização (car_nroautorizacao) = vCodAuto
3. ✅ Documento (r.nro_doc) = 'C' + vNsuDoc + '-' + vNroParc (padded com 2 dígitos)
4. ✅ Total Parcelas (car.car_nroparcela) = vTotParc (padded com 2 dígitos)
5. ✅ Cliente operadora (nome LIKE 'CIELO%' ou 'SANTANDER%')

**Exemplo**: 
- Entrada: NSU='123456789', Auth='ABC123', Parcela='2', Total='3', Tipo='CIELO'
- Busca: nro_doc = 'C123456789-02' AND car_nroparcela = '03'

## Tabelas Envolvidas

### Join Chain
```
dbreceb (r)
  ↓ codcli
dbclien (c)

dbreceb (r)
  ↓ cod_receb
fin_cartao_receb (crr)
  ↓ car_car_id
fin_cartao (car)
  ↓ car_codcli
dbclien (filtro nome LIKE)
```

### Campos Retornados
- **r.*** - Todos os campos de DBRECEB (título a receber)
- **c.codcli** - Código do cliente
- **c.nome** - Nome do cliente

## Função strzero_s

A função `strzero_s(valor, tamanho)` faz padding com zeros à esquerda:
- `strzero_s(2, 2)` → '02'
- `strzero_s(12, 2)` → '12'
- `strzero_s(3, 2)` → '03'

Equivalente JavaScript: `valor.toString().padStart(2, '0')`

## Formato do Documento

O campo `nro_doc` segue o padrão:
```
'C' + NSU + '-' + PARCELA_PADDED
```

**Exemplos:**
- Parcela 1 de 3: `C123456789-01`
- Parcela 2 de 3: `C123456789-02`
- Parcela 3 de 3: `C123456789-03`

## Filtro de Operadora

O `decode(vTipo,'CIELO','CIELO%','SANTANDER%')` funciona assim:
- Se vTipo = 'CIELO' → busca clientes com nome LIKE 'CIELO%'
- Caso contrário → busca clientes com nome LIKE 'SANTANDER%'

**Clientes Operadoras no Sistema:**
- CIELO (e variações como CIELO CREDITO, CIELO DEBITO, etc.)
- SANTANDER (e variações)

## Implementação PostgreSQL/TypeScript

### Tradução da Lógica

```typescript
interface MatchCriteria {
  nsu: string;              // vNsuDoc
  autorizacao: string;      // vCodAuto
  parcela?: string;         // vNroParc (opcional)
  totalParcelas?: string;   // vTotParc (opcional)
  tipo: 'CIELO' | 'SANTANDER';  // vTipo
}

async function conciliarCartao(criteria: MatchCriteria) {
  const { nsu, autorizacao, parcela, totalParcelas, tipo } = criteria;
  
  let query = `
    SELECT r.*, c.codcli, c.nome
    FROM dbreceb r
    INNER JOIN dbclien c ON r.codcli = c.codcli
    INNER JOIN fin_cartao_receb crr ON r.cod_receb = crr.car_cod_receb
    INNER JOIN fin_cartao car ON crr.car_car_id = car.car_id
    WHERE car.car_nrodocumento = $1
      AND car.car_nroautorizacao = $2
  `;
  
  const params: any[] = [nsu, autorizacao];
  
  // Match estrito se totalParcelas informado
  if (totalParcelas) {
    const nroDoc = `C${nsu}-${parcela!.padStart(2, '0')}`;
    const totParc = totalParcelas.padStart(2, '0');
    
    query += `
      AND r.nro_doc = $3
      AND car.car_nroparcela = $4
    `;
    params.push(nroDoc, totParc);
  }
  
  // Filtro de operadora
  query += `
    AND car.car_codcli IN (
      SELECT codcli 
      FROM dbclien 
      WHERE nome LIKE $${params.length + 1}
    )
  `;
  
  const operadoraPattern = tipo === 'CIELO' ? 'CIELO%' : 'SANTANDER%';
  params.push(operadoraPattern);
  
  return await pool.query(query, params);
}
```

## Observações Importantes

1. **Dois Modos de Busca**: A procedure tem comportamento diferente se totalParcelas for null ou não
2. **Padding Obrigatório**: Parcelas sempre com 2 dígitos ('01', '02', não '1', '2')
3. **Prefixo 'C'**: Todos os documentos de cartão começam com 'C'
4. **Cliente = Operadora**: O car_codcli deve ser o código do cliente CIELO ou SANTANDER
5. **LIKE Pattern**: Permite variações do nome (CIELO CREDITO, CIELO DEBITO, etc.)

## Aplicação no Sistema Novo

Para o módulo de conciliação em PostgreSQL, devemos:

1. **Importar arquivo CSV** → tabela `fin_cartao_receb_import`
2. **Para cada registro pendente**, executar busca similar a CON_CARTAO_RECEB
3. **Se encontrado**: 
   - Atualizar status = 'CONCILIADO'
   - Registrar cod_receb e cod_freceb encontrados
4. **Se não encontrado**:
   - Atualizar status = 'NAO_LOCALIZADO'
5. **Gerar relatório** com 3 colunas (Conciliados / Não Localizados / Cancelados)
