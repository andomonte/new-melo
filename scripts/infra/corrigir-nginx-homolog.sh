#!/usr/bin/env bash
# =============================================================================
# Correção do nginx da HOMOLOGAÇÃO (sistemahomolog.melopecas.com.br)
#
# SINTOMA (testado em 09/11/2026):
#   - Requisições com corpo acima de ~15 KB voltam "500 Internal Server Error" em HTML
#     do próprio nginx — a requisição nem chega ao sistema (container site-melo).
#       8 KB  -> sistema responde normal
#       16 KB -> 500 do nginx
#   - Respostas grandes chegam CORTADAS (~64-98 KB): arquivos JS da aplicação e PDFs.
#     Resultado: telas em branco, "Erro ao gerar o PDF da nota", Associar/Salvar da
#     Importação com erro 500, Imprimir/Salvar PDF na Consulta de Faturas.
#   - O container está OK: o Chromium gera PDF normalmente (testado com HTML pequeno).
#
# CAUSA PROVÁVEL:
#   O nginx grava em disco os corpos grandes (client_body_temp) e as respostas grandes
#   do proxy (proxy_temp), em /var/lib/nginx/body e /var/lib/nginx/proxy. Se essas pastas
#   estão sem permissão para o usuário do nginx, ou o disco/inodes estão cheios, dá
#   exatamente esse comportamento.
#
# O QUE ESTE SCRIPT FAZ (rodar como root no servidor da homologação):
#   1. Diagnóstico (disco, inodes, permissões, log de erro).
#   2. Recria/corrige as pastas temporárias do nginx e a permissão delas.
#   3. Cria /etc/nginx/conf.d/melo-limites.conf com limites adequados e buffers em
#      memória maiores (menos dependência de disco).
#   4. Testa a configuração (nginx -t) e só então recarrega (reload, sem derrubar).
#   Não altera os arquivos de site existentes; faz backup antes de criar o .conf.
#
# Uso:  sudo bash corrigir-nginx-homolog.sh            (diagnóstico + correção)
#       sudo bash corrigir-nginx-homolog.sh --so-diagnostico
# =============================================================================
set -u

SO_DIAG=0
[ "${1:-}" = "--so-diagnostico" ] && SO_DIAG=1

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (sudo)."; exit 1
fi

titulo() { echo; echo "=== $* ==="; }

titulo "1. Versão e usuário do nginx"
nginx -v 2>&1
NGINX_USER=$(grep -E '^\s*user\s+' /etc/nginx/nginx.conf | head -1 | awk '{print $2}' | tr -d ';')
NGINX_USER=${NGINX_USER:-www-data}
echo "Usuário dos workers: $NGINX_USER"
ps -o user=,cmd= -C nginx | sort | uniq -c

titulo "2. Disco e inodes (pastas do nginx e /var)"
df -h /var/lib/nginx /var/log/nginx /tmp 2>/dev/null
df -i /var/lib/nginx /tmp 2>/dev/null

titulo "3. Pastas temporárias do nginx"
for d in /var/lib/nginx /var/lib/nginx/body /var/lib/nginx/proxy /var/lib/nginx/fastcgi; do
  if [ -e "$d" ]; then ls -ld "$d"; else echo "NÃO EXISTE: $d"; fi
done
echo "Teste de escrita como $NGINX_USER:"
for d in /var/lib/nginx/body /var/lib/nginx/proxy; do
  if sudo -u "$NGINX_USER" sh -c "touch '$d/.teste_escrita' && rm -f '$d/.teste_escrita'" 2>/dev/null; then
    echo "  OK   $d"
  else
    echo "  FALHA $d  <-- provável causa"
  fi
done

titulo "4. Limites já configurados (podem sobrepor os novos)"
grep -RnE 'client_max_body_size|client_body_buffer_size|client_body_temp_path|proxy_buffer|proxy_temp|proxy_max_temp_file_size' /etc/nginx/ 2>/dev/null || echo "(nenhum)"

titulo "5. Últimos erros do nginx relacionados"
grep -hiE 'client_body_temp|proxy_temp|Permission denied|No space left|open\(\)|upstream prematurely' \
  /var/log/nginx/error.log* 2>/dev/null | tail -20 || true

if [ "$SO_DIAG" -eq 1 ]; then
  echo; echo "Somente diagnóstico. Nada foi alterado."; exit 0
fi

titulo "6. Corrigindo pastas temporárias"
mkdir -p /var/lib/nginx/body /var/lib/nginx/proxy /var/lib/nginx/fastcgi
chown -R "$NGINX_USER":"$NGINX_USER" /var/lib/nginx/body /var/lib/nginx/proxy /var/lib/nginx/fastcgi
chmod 700 /var/lib/nginx/body /var/lib/nginx/proxy /var/lib/nginx/fastcgi
ls -ld /var/lib/nginx/body /var/lib/nginx/proxy

titulo "7. Limites e buffers (/etc/nginx/conf.d/melo-limites.conf)"
CONF=/etc/nginx/conf.d/melo-limites.conf
if ! grep -qE 'include\s+/etc/nginx/conf\.d/\*\.conf' /etc/nginx/nginx.conf; then
  echo "ATENÇÃO: nginx.conf não inclui conf.d/*.conf. Copie as diretivas abaixo para o bloco http {}."
fi
[ -f "$CONF" ] && cp -a "$CONF" "$CONF.bak.$(date +%Y%m%d%H%M%S)"
cat > "$CONF" <<'EOF'
# Sistema Melo — limites para envios/respostas grandes (DI de importação, DANFE, PDFs).
# Corpo de requisição: a aplicação aceita até 6 MB (HTML do DANFE, itens da DI).
client_max_body_size     20m;
# Mantém em memória corpos até 2 MB (evita gravar em /var/lib/nginx/body).
client_body_buffer_size  2m;

# Respostas do proxy (JS da aplicação, PDFs de nota com ~2 MB).
proxy_buffer_size        128k;
proxy_buffers            32 256k;
proxy_busy_buffers_size  512k;

# Notas grandes demoram a gerar (puppeteer).
proxy_read_timeout       300s;
proxy_send_timeout       300s;
EOF
cat "$CONF"

titulo "8. Validando e recarregando"
if nginx -t; then
  systemctl reload nginx && echo "nginx recarregado."
else
  echo "nginx -t FALHOU: nada recarregado. Verifique se alguma diretiva acima já está"
  echo "definida no mesmo contexto (item 4) e remova a duplicada de $CONF."
  exit 1
fi

titulo "9. Teste (deve dar 400 JSON, não 500 HTML)"
URL=${URL_TESTE:-https://sistemahomolog.melopecas.com.br/api/importacao/associar-e-vincular}
PAD=$(head -c 40000 /dev/zero | tr '\0' 'x')
printf '{"id_importacao":0,"faturas":[],"pad":"%s"}' "$PAD" > /tmp/melo_teste_40k.json
curl -sk -o /tmp/melo_teste_resp.txt -w "POST 40 KB -> HTTP %{http_code} %{content_type}\n" \
  -X POST -H 'Content-Type: application/json' --data-binary @/tmp/melo_teste_40k.json "$URL"
head -c 200 /tmp/melo_teste_resp.txt; echo
rm -f /tmp/melo_teste_40k.json /tmp/melo_teste_resp.txt
echo
echo "Esperado: HTTP 400 application/json {\"message\":\"Nenhuma fatura enviada\"}"
echo "Se ainda vier 500 text/html, envie a saída completa deste script ao desenvolvimento."
