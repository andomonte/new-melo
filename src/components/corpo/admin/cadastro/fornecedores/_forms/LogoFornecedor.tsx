import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LogoFornecedorProps {
  /** Código do credor (dbcredor.cod_credor) — chave da logo. */
  codCredor: string;
}

function lerComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

const LARGURA_MAX = 400;

/**
 * Calcula o retângulo do CONTEÚDO da imagem, ignorando margens transparentes
 * ou brancas — para o logo sair "justo" (sem sobra em volta) no relatório.
 */
function calcularBBoxConteudo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const data = ctx.getImageData(0, 0, w, h).data;
  const LIM_BRANCO = 245; // r,g,b >= isto é considerado fundo branco
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 16) continue; // transparente
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r >= LIM_BRANCO && g >= LIM_BRANCO && b >= LIM_BRANCO) continue; // branco
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * Carrega a imagem, RECORTA as margens transparentes/brancas, reduz para no
 * máximo LARGURA_MAX de largura (preservando a proporção) e exporta como PNG
 * (data URI). Assim o servidor não precisa de biblioteca nativa e o logo fica
 * justo (mesmo "peso" visual do logo da Melo).
 */
async function normalizarParaPng(file: File): Promise<string> {
  const dataUrl = await lerComoBase64(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Imagem inválida'));
    img.src = dataUrl;
  });
  const ow = img.naturalWidth || img.width || LARGURA_MAX;
  const oh = img.naturalHeight || img.height || LARGURA_MAX;

  // Desenha no tamanho natural para inspecionar os pixels.
  const src = document.createElement('canvas');
  src.width = ow;
  src.height = oh;
  const sctx = src.getContext('2d');
  if (!sctx) throw new Error('Canvas indisponível');
  sctx.drawImage(img, 0, 0, ow, oh);

  // Recorte das margens (com uma pequena folga para não cortar o anti-aliasing).
  let sx = 0, sy = 0, sw = ow, sh = oh;
  try {
    const bbox = calcularBBoxConteudo(sctx, ow, oh);
    if (bbox) {
      const folga = Math.round(Math.max(ow, oh) * 0.02);
      sx = Math.max(0, bbox.minX - folga);
      sy = Math.max(0, bbox.minY - folga);
      sw = Math.min(ow - 1, bbox.maxX + folga) - sx + 1;
      sh = Math.min(oh - 1, bbox.maxY + folga) - sy + 1;
    }
  } catch {
    // getImageData pode falhar (ex.: imagem "tainted"); segue sem recorte.
  }

  // Escala para a largura máxima preservando a proporção do recorte.
  let w = sw;
  let h = sh;
  if (w > LARGURA_MAX) {
    const r = LARGURA_MAX / w;
    w = Math.round(w * r);
    h = Math.round(h * r);
  }

  const out = document.createElement('canvas');
  out.width = Math.max(1, w);
  out.height = Math.max(1, h);
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas indisponível');
  octx.drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/**
 * Seção de logo do fornecedor. Desacoplada do submit do cadastro: salva/remove
 * direto na API (`/api/compras/fornecedores/[cod]/logo`), pois a logo fica em
 * tabela própria (`cad_credor_logo`), sem tocar em dbcredor. A logo é usada,
 * por exemplo, no cabeçalho do PDF da Ordem de Compra.
 */
export default function LogoFornecedor({ codCredor }: LogoFornecedorProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [temLogo, setTemLogo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const urlLogo = `/api/compras/fornecedores/${encodeURIComponent(codCredor)}/logo`;

  const carregarAtual = useCallback(async () => {
    if (!codCredor) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const r = await fetch(`${urlLogo}?t=${Date.now()}`);
      if (r.ok) {
        const blob = await r.blob();
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setTemLogo(true);
      } else {
        setPreview(null);
        setTemLogo(false);
      }
    } catch {
      setPreview(null);
      setTemLogo(false);
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codCredor]);

  useEffect(() => {
    carregarAtual();
    // Revoga a object URL ao desmontar
    return () => {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codCredor]);

  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/i.test(file.type)) {
      toast({ description: 'Selecione uma imagem PNG, JPG, SVG ou WEBP.', variant: 'destructive' });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    try {
      const base64 = await normalizarParaPng(file);
      setSalvando(true);
      const r = await fetch(urlLogo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagemBase64: base64 }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        toast({ description: 'Logo salva com sucesso.' });
        await carregarAtual();
      } else {
        toast({ description: d.message || 'Falha ao salvar a logo.', variant: 'destructive' });
      }
    } catch {
      toast({ description: 'Erro ao enviar a imagem.', variant: 'destructive' });
    } finally {
      setSalvando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remover = async () => {
    setSalvando(true);
    try {
      const r = await fetch(urlLogo, { method: 'DELETE' });
      if (r.ok) {
        toast({ description: 'Logo removida.' });
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setTemLogo(false);
      } else {
        toast({ description: 'Falha ao remover a logo.', variant: 'destructive' });
      }
    } catch {
      toast({ description: 'Erro ao remover a logo.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (!codCredor) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        Salve o fornecedor primeiro para cadastrar a logo.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          Logo do Fornecedor
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Usada no cabeçalho de relatórios do fornecedor (ex.: PDF da Ordem de Compra).
          A imagem é ajustada automaticamente (PNG, até 400px de largura).
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Preview */}
        <div className="w-56 h-28 flex items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-600 bg-white overflow-hidden">
          {carregando ? (
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo do fornecedor" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center text-gray-400">
              <ImageIcon className="w-8 h-8" />
              <span className="text-xs mt-1">Sem logo</span>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={onArquivo}
          />
          <button
            type="button"
            disabled={salvando}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {temLogo ? 'Substituir logo' : 'Enviar logo'}
          </button>
          {temLogo && (
            <button
              type="button"
              disabled={salvando}
              onClick={remover}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </button>
          )}
          <span className="text-xs text-gray-400">PNG, JPG, SVG ou WEBP.</span>
        </div>
      </div>
    </div>
  );
}
