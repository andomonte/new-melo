# Notas Fiscais de Serviço (NFS-e)

Tela: **Financeiro > Notas de Serviço** (`/admin/financeiro/notasServico`).

## Origem das notas
- **Até 2025:** NFS-e da Prefeitura de Manaus (nota.manaus.am.gov.br), lançadas à mão com o **código de verificação**.
- **A partir de 2026:** NFS-e do **sistema nacional**, com **chave de acesso** de 50 dígitos.
  - Podem ser lançadas à mão.
  - Ou buscadas no portal pelo botão **Buscar no portal**, que consulta o ADN.
- **Histórico do Delphi:** importado do Oracle por `docs/scripts/importar-nfse-oracle.cjs` (migration 093). O script pode ser rodado de novo, por exemplo contra o Oracle de produção.

## Regras (iguais ao Delphi)
- **Valor líquido** = serviço − desconto − retenções. As retenções são o ISS (só se retido) mais PIS, COFINS, IR, INSS, CSLL e outras.
- **Títulos a receber:**
  - ficam em `dbreceb` com tipo `S`, e o `cod_fat` é o código da fatura da nota;
  - documento = `S` + número da nota + letra;
  - parcelas iguais, e a 1ª absorve o arredondamento.
- **Banco, forma e conta:** seguem a regra do Delphi (`PRETCOBRANCA.INFORMACAO_FINANCEIRA`).
- **Cancelar:** cancela a nota e os títulos. É recusado se algum título tiver recebimento.

Código: `src/lib/nfse/notasServico.ts`, `src/lib/nfse/calculoNota.ts`.

## Busca no portal nacional (ADN)
- **API:** `GET https://adn.nfse.gov.br/contribuintes/DFe/{NSU}?cnpjConsulta=<CNPJ>&lote=true`, com mTLS usando o certificado A1 da empresa.
- **Paginação:** devolve até 50 documentos **depois** do NSU informado. O sistema guarda o último NSU lido em `nfs_adn_controle`.
- **Atenção:** sem o `cnpjConsulta`, o ADN responde `REJEICAO` sem mensagem.
- **Separação dos documentos:**
  - notas em que a empresa é **prestadora** → aba Pendentes, para conferir e importar (cliente pelo CNPJ do tomador, serviço pelo código nacional);
  - notas **tomadas** e **eventos** (cancelamento etc.) → ficam registrados.
- **Na importação:** o líquido calculado é conferido com o `vLiq` do XML, e o XML fica guardado na nota.

Código: `src/lib/nfse/adn/` (`certificado.ts`, `cliente.ts`, `leitorXml.ts`, `distribuicao.ts`). Migration 095.

### Configuração (`.env`)
| Variável | Uso |
|---|---|
| `NFSE_ADN_AMBIENTE` | `PRODUCAO` (padrão) ou `RESTRITA` (testes do governo). |
| `NFSE_ADN_CNPJ` | CNPJ consultado. Sem ele, usa a 1ª empresa com certificado em Dados Empresa. |
| `NFSE_TESTE_PFX`, `NFSE_TESTE_PFX_SENHA` | **Só desenvolvimento:** um `.pfx` local no lugar do certificado do cadastro. Fora disso, o certificado vem de Dados Empresa, que só abre no servidor (`CRYPTO_MASTER_KEY`). **Não usar no servidor.** |

O ADN aceita certificado de outro CNPJ com a mesma raiz (8 dígitos).

### Testado em 25/11/2026
Com um certificado de teste, em produção e só leitura:
- 59 documentos baixados em 2 lotes;
- o líquido do XML bateu em todas as 50 notas;
- a importação com ISS retido conferiu o líquido.

## Emissão pelo sistema (Sefin Nacional)
Na tela, **Nova nota → Emitir pelo sistema**. A outra opção, **Lançar nota já emitida**, é o lançamento manual de antes.

- **Fluxo**, todo numa transação:
  1. grava a nota como pendente;
  2. reserva o próximo nº de DPS (`nfs_dps_controle`, com trava);
  3. monta a DPS (layout 1.01) e assina (RSA-SHA256 em `infDPS`);
  4. envia: `POST /SefinNacional/nfse`.
- **Se a Sefin rejeitar,** nada fica gravado, nem o nº da DPS, e os erros aparecem na tela.
- **Se a resposta se perder** (queda de conexão), o sistema consulta `GET /dps/{id}` e recupera a nota, se ela foi gerada.
- **Nota gerada:** número, chave, XML da NFS-e e XML da DPS ficam em `nfs_nota` (origem `EMITIDA`). O líquido da nota é conferido com o calculado.
- **Pré-requisitos:**
  - **Inscrição municipal** preenchida em Admin > Dados Empresa;
  - tomador com endereço completo: CEP e código do município;
  - serviço com **código de tributação nacional**, de 6 dígitos, em Financeiro > Arquivos > Serviços. A migration 096 preencheu esse código a partir do item da lista; confira.
- **Cancelamento:** se a nota tem chave e foi emitida pela empresa, o cancelamento vai primeiro ao portal (evento 101101).
  - Motivo: 1 erro na emissão, 2 serviço não prestado ou 9 outros.
  - A justificativa tem no mínimo 15 caracteres.
  - Depois do portal, cancela a nota e os títulos no sistema.
- **Impressão:** `GET /api/nfse/notas/{codfat}/danfse` tenta a DANFSe oficial do ADN (PDF). Se ela estiver fora do ar, ou se a nota não tiver chave, gera uma página própria para imprimir.

Código: `src/lib/nfse/sefin/` (`xml.ts`, `assinatura.ts`, `cliente.ts`, `emissao.ts`). Migration 096.

### Configuração (`.env`)
| Variável | Uso |
|---|---|
| `NFSE_SEFIN_AMBIENTE` | `RESTRITA` (**padrão**; testes do governo, sem valor fiscal) ou `PRODUCAO`. Só mudar para `PRODUCAO` quando for emitir de verdade. |
| `NFSE_DPS_SERIE` | Série da DPS (padrão `1`). |
| `NFSE_CMUN_EMISSOR` | Código IBGE do município emissor, se o de Dados Empresa não servir. |

### Testado em 25/11/2026
- **DPS e pedido de cancelamento:** os XMLs validam nos XSDs dos dois ambientes. O de produção restrita tem `finNFSe` e outra ordem no `cServ`, e o sistema monta conforme o ambiente.
- **Envio à produção restrita:** a assinatura e o mTLS foram aceitos. A nota parou na regra **E0116** (inscrição municipal × cadastro CNC do ambiente de testes), que é uma limitação do cadastro de testes do governo. Na rejeição, nada ficou gravado.
