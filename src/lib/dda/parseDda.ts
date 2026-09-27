/**
 * Parser do arquivo DDA (Débito Direto Autorizado) — layout CNAB240 FEBRABAN, banco 341 (Itaú),
 * fiel ao btnAbrirDDAClick do Delphi (UnitFormContasP.pas, MELOSYS).
 *
 * Linhas de EXATAMENTE 240 caracteres. Registro de detalhe do título = posição 8 = '3'
 * (tipo de registro) e posição 14 = 'G' (segmento). Posições são 1-based inclusivas
 * (Delphi copy(linha, inicio, tamanho)); em JS: linha.substring(inicio-1, inicio-1+tam).
 */

export interface DdaTitulo {
  banco: string;
  registro: string;
  codbar: string;          // código de barras (44 pos)
  tipoInscricao: 'F' | 'J'; // '1' → PF, senão PJ
  cnpj: string;            // inscrição do cedente, só dígitos
  cnpjFmt: string;         // formatado (CPF/CNPJ)
  nome: string;            // nome do cedente
  dtVenc: string | null;   // ISO yyyy-mm-dd
  valor: number;           // reais
  documento: string;
  agencia: string;
  especie: string;         // descrição
  dtEmissao: string | null;
}

export interface DdaParsed {
  banco: string;
  titulos: DdaTitulo[];
  linhasLidas: number;
  linhasInvalidas: number; // linhas com tamanho != 240
}

const ESPECIE: Record<string, string> = {
  '1': 'DUPL. MERCANTIL', '2': 'NOTA PROMISSÓRIA', '3': 'NOTA DE SEGURO', '4': 'MENSALIDADE ESCOLAR',
  '5': 'RECIBO', '6': 'CONTRATO', '7': 'CO-SEGUROS', '8': 'DUPL. DE SERVIÇO', '9': 'LETRA DE CÂMBIO',
  '10': 'ESCRITURAL/OUTROS', '13': 'NOTA DE DÉBITO',
};

/** copy(linha, inicio, tam) do Delphi (1-based inclusivo), com trim. */
const campo = (linha: string, inicio: number, tam: number) => linha.substring(inicio - 1, inicio - 1 + tam).trim();

/** Texto numérico → número com `dec` casas decimais implícitas. Ex.: '0000000012345', 2 → 123.45 */
const txtToFloat = (txt: string, dec: number): number => {
  const d = String(txt || '').replace(/\D/g, '');
  if (!d) return 0;
  return parseInt(d, 10) / Math.pow(10, dec);
};

/** DDMMAAAA → ISO yyyy-mm-dd (null se inválida/zerada). */
const dmaParaIso = (dma: string): string | null => {
  const d = String(dma || '').replace(/\D/g, '').padStart(8, '0');
  if (d.length !== 8 || d === '00000000') return null;
  const dia = d.slice(0, 2), mes = d.slice(2, 4), ano = d.slice(4, 8);
  if (dia === '00' || mes === '00' || ano === '0000') return null;
  return `${ano}-${mes}-${dia}`;
};

/** Formata CPF (11 díg) / CNPJ (14 díg) por dígitos; senão devolve como veio. */
export const formatarCpfCnpj = (digitos: string): string => {
  const d = String(digitos || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return digitos;
};

export function parseDda(texto: string): DdaParsed {
  const linhas = String(texto || '').split(/\r?\n/).filter((l) => l.length > 0);
  const titulos: DdaTitulo[] = [];
  let invalidas = 0;

  for (const linha of linhas) {
    if (linha.length !== 240) { invalidas++; continue; }
    const tipoReg = linha.substring(7, 8); // pos 8
    const segmento = linha.substring(13, 14); // pos 14
    if (tipoReg !== '3' || segmento.toUpperCase() !== 'G') continue;

    const inscricaoRaw = campo(linha, 63, 15).replace(/\D/g, '');
    const tipoInscr = campo(linha, 62, 1) === '1' ? 'F' : 'J';
    // CPF tem 11 dígitos; muitos arquivos trazem a inscrição com zeros à esquerda em 14/15 pos.
    const cnpj = tipoInscr === 'F' ? inscricaoRaw.replace(/^0+/, '').padStart(11, '0') : inscricaoRaw.replace(/^0+/, '').padStart(14, '0');

    titulos.push({
      banco: campo(linha, 1, 3),
      registro: campo(linha, 9, 5),
      codbar: campo(linha, 18, 44),
      tipoInscricao: tipoInscr,
      cnpj,
      cnpjFmt: formatarCpfCnpj(cnpj),
      nome: campo(linha, 78, 30),
      dtVenc: dmaParaIso(campo(linha, 108, 8)),
      valor: txtToFloat(campo(linha, 116, 13), 2),
      documento: campo(linha, 148, 15),
      agencia: campo(linha, 163, 5),
      especie: ESPECIE[campo(linha, 180, 2).replace(/^0+/, '') || '0'] || campo(linha, 180, 2),
      dtEmissao: dmaParaIso(campo(linha, 182, 8)),
    });
  }

  return {
    banco: titulos[0]?.banco || (linhas[0]?.substring(0, 3) ?? ''),
    titulos,
    linhasLidas: linhas.length,
    linhasInvalidas: invalidas,
  };
}
