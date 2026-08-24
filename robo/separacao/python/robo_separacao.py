"""
ROBÔ DE SEPARAÇÃO — Impressão Matricial
Equivalente ao Gerenciador_Impressao do Delphi.

Gera executável standalone com: pyinstaller --onefile --windowed robo_separacao.py
"""

import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time
import os
import tempfile
import psycopg2
from datetime import datetime

# ─── Detectar impressoras Windows ──────────────────────────────────────
def listar_impressoras():
    try:
        import win32print
        impressoras = []
        for flags, desc, name, comment in win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        ):
            impressoras.append(name)
        return impressoras
    except ImportError:
        # Fallback sem win32print
        import subprocess
        result = subprocess.run(
            ['powershell', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
            capture_output=True, text=True
        )
        return [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]


def imprimir_arquivo(impressora, arquivo):
    """Envia arquivo de texto direto para a impressora (RAW, sem abrir Bloco de Notas)"""
    try:
        import win32print
        with open(arquivo, 'r', encoding='utf-8') as f:
            texto = f.read()
        # cp850 para impressoras matriciais (suporta acentos pt-BR)
        dados = texto.encode('cp850', errors='replace')
        hPrinter = win32print.OpenPrinter(impressora)
        try:
            win32print.StartDocPrinter(hPrinter, 1, ("Pre-Pedido", None, "RAW"))
            win32print.StartPagePrinter(hPrinter)
            win32print.WritePrinter(hPrinter, dados)
            win32print.EndPagePrinter(hPrinter)
            win32print.EndDocPrinter(hPrinter)
        finally:
            win32print.ClosePrinter(hPrinter)
        return True
    except ImportError:
        import subprocess
        subprocess.run(['print', f'/d:{impressora}', arquivo], shell=True)
        return True


# ─── Formatação do relatório (idêntico ao Delphi) ─────────────────────
def pad(s, n):
    return (s or '')[:n].ljust(n)

def padn(s, n):
    return (s or '')[:n].rjust(n)

def sep_line():
    return '    ' + '- ' * 70

def fmt_moeda(v):
    try:
        return f"{float(v or 0):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    except:
        return '0,00'

def fmt_data(d):
    if d is None:
        return ''
    if isinstance(d, datetime):
        return d.strftime('%d/%m/%Y')
    s = str(d)[:10]
    p = s.split('-')
    return f"{p[2]}/{p[1]}/{p[0]}" if len(p) == 3 else s

def fmt_hora(d):
    if d is None:
        return ''
    if isinstance(d, datetime):
        return d.strftime('%H:%M:%S')
    s = str(d)
    return s[11:19] if len(s) > 18 else ''


def gerar_relatorio(conn, registro):
    """Gera o texto do pré-pedido idêntico ao layout Delphi"""
    codvenda = registro['CODIGO']
    tipodoc = registro['TIPODOC']
    armazem_id = registro['ARMAZEM']

    cur = conn.cursor()

    # Empresa
    cur.execute("SELECT nomecontribuinte, cgc, inscricaoestadual, suframa, telefone, fax, email, logradouro, numero, bairro, cep, municipio, uf FROM dadosempresa LIMIT 1")
    e = cur.fetchone()
    emp = dict(zip([d[0] for d in cur.description], e)) if e else {}

    # Venda
    cur.execute("""SELECT v.codvenda, v.data, v.total, v.codcli, v.codusr, v.codvend,
                          v.prazo, v.obs, v.obsfat, v.transp, v.vlrfrete, v.pedido
                   FROM dbvenda v WHERE v.codvenda = %s""", (codvenda,))
    row = cur.fetchone()
    if not row:
        return None
    v = dict(zip([d[0] for d in cur.description], row))

    # Cliente
    cur.execute("SELECT codcli, nome, nomefant, cpfcgc, ender, bairro, cidade, uf, cep, iest, obs, complemento FROM dbclien WHERE codcli = %s", (v['codcli'],))
    row = cur.fetchone()
    c = dict(zip([d[0] for d in cur.description], row)) if row else {}

    # Vendedor
    cur.execute("SELECT codvend, nome FROM dbvend WHERE ltrim(codvend::text,'0') = ltrim(%s::text,'0')", (v.get('codvend', ''),))
    row = cur.fetchone()
    vendedor = dict(zip([d[0] for d in cur.description], row)) if row else {}

    # Operador
    cur.execute("SELECT codvend, nome FROM dbvend WHERE ltrim(codvend::text,'0') = ltrim(%s::text,'0')", (v.get('codusr', ''),))
    row = cur.fetchone()
    operador = dict(zip([d[0] for d in cur.description], row)) if row else {}

    # Armazém
    cur.execute("SELECT arm_descricao FROM cad_armazem WHERE arm_id = %s", (armazem_id,))
    row = cur.fetchone()
    armazem = row[0] if row else 'GERAL'

    # Itens (locação vem da cad_armazem_produto_locacao pelo armazém do item)
    cur.execute("""SELECT i.codprod, i.qtd, i.prunit, i.ref, i.descr, i.arm_id,
                          p.unimed, p.codmarca, m.descr as marca_nome,
                          COALESCE(loc.apl_descricao, p.local, '') as locacao
                   FROM dbitvenda i
                   LEFT JOIN dbprod p ON i.codprod = p.codprod
                   LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
                   LEFT JOIN cad_armazem_produto_locacao loc
                     ON loc.apl_codprod = i.codprod AND loc.apl_arm_id = i.arm_id::numeric
                   WHERE i.codvenda = %s ORDER BY i.codprod""", (codvenda,))
    itens = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

    total_itens = len(itens)
    total_valor = sum(float(it.get('qtd', 0) or 0) * float(it.get('prunit', 0) or 0) for it in itens)

    agora = datetime.now()
    data_imp = agora.strftime('%d/%m/%Y')
    hora_imp = agora.strftime('%H:%M:%S')
    data_venda = fmt_data(v.get('data'))
    hora_venda = fmt_hora(v.get('data'))

    tipo_label = 'PRE-PEDIDO'
    if tipodoc == 'C': tipo_label = 'CAUTELA'
    elif tipodoc == '1': tipo_label = 'D1 BALCAO'

    L = []

    # Cabeçalho
    L.append('    ' + pad(emp.get('nomecontribuinte', ''), 40) + '            *** SEM VALOR FISCAL ***')
    L.append(f'    {tipo_label}: {codvenda}                       EMISSAO: {data_venda}          HORA:    {hora_venda}')
    L.append(f'    DATA:       {data_venda}                      USUARIO: {pad(registro["NOMEUSR"] or operador.get("nome", ""), 20)} ARMAZEM: {armazem}')
    L.append(f'    ESTE FORMULARIO FOI IMPRESSO AS {hora_imp} DE {data_imp}')
    L.append(sep_line())

    # Cliente
    L.append(f'    CLIENTE:     {pad(str(c.get("codcli", "")) + " - " + str(c.get("nome", "")), 61)}NOME FANT.: {c.get("nomefant", "")}')
    L.append(f'    ENDERECO:    {pad(c.get("ender", ""), 60)} BAIRRO:     {c.get("bairro", "")}')
    L.append(f'    CIDADE:      {pad(c.get("cidade", ""), 20)}                                     UF:         {c.get("uf", "")} - CEP: {c.get("cep", "")}')
    L.append(f'    COMPLEMENTO: {c.get("complemento", "") or ""}')
    L.append(f'    C.N.P.J.:    {pad(c.get("cpfcgc", ""), 61)}INSC. EST:  {c.get("iest", "")}')
    L.append(f'    OBS. Cliente: {c.get("obs", "") or ""}')
    L.append(f'    VEND. RESP.: {vendedor.get("codvend", v.get("codvend", ""))} - {pad(vendedor.get("nome", ""), 18)}                                   O.C.:       {v.get("pedido", "") or ""}')
    L.append('    VEND. TEL.: ')
    L.append(sep_line())

    # Header itens
    L.append('    ' + pad('LOCACAO', 32) + 'UN QTD ' + pad('REFERENCIA', 15) + pad('DESCRICAO', 43) + ' ' + pad('MARCA', 10) + padn('PC UNIT', 9) + padn('TOTAL', 13))
    L.append(sep_line())

    # Itens
    for it in itens:
        qtd = float(it.get('qtd', 0) or 0)
        prunit = float(it.get('prunit', 0) or 0)
        L.append('    ' + pad(it.get('locacao', ''), 31) + ' ' +
                 pad(it.get('unimed', 'PC'), 2) +
                 padn(str(int(qtd)), 4) + ' ' +
                 pad(it.get('ref', '') or it.get('codprod', ''), 14) + ' ' +
                 pad(it.get('descr', ''), 43) + ' ' +
                 pad(it.get('marca_nome', ''), 10) +
                 padn(fmt_moeda(prunit), 10) + ' ' +
                 padn(fmt_moeda(qtd * prunit), 12))
    L.append(sep_line())

    # Total
    L.append(f'    AUTENTICACAO: {pad("", 42)}                              TOTAL ITENS:{padn(str(total_itens), 5)}          TOTAL :{padn(fmt_moeda(total_valor), 13)}')
    L.append(sep_line())

    # Rodapé
    L.append(f'    OPERADOR:   {operador.get("codvend", v.get("codusr", ""))} - {operador.get("nome", "")}')
    L.append(f'    OBS. FINANCEIRA: {v.get("obsfat", "") or ""}')
    L.append('    ')
    L.append(f'    OBSERVACAO: {v.get("obs", "") or ""}')
    L.append(f'    PRAZO:      {v.get("prazo", "") or ""}')
    if tipodoc in ('C', 'P', 'F'):
        L.append(f'    TRANSPORTE: {v.get("transp", "") or "CLIENTE RETIRA"}          TAXA ENTREGA: R$ {fmt_moeda(v.get("vlrfrete", 0))}')
    L.extend([''] * 6)

    # Assinaturas
    L.append(f'    QUANTIDADE DE ITEM(NS): {total_itens}')
    L.append('')
    L.append('    SEPARADOR:  ___/___/________      ____:____   ____:____ ____________________________       ________________________________________')
    L.append('')
    L.append('                                                                                                          ACEITE DO CLIENTE            ')
    L.append('    CONFERENTE: ___/___/________      ____:____   ____:____ ____________________________')
    L.append('')
    L.append('')
    L.append('    MOTORISTA:  ___/___/________      ____:____   ____:____ ____________________________')

    # Motivo reimpressão
    if registro.get('motivo'):
        L.append('')
        L.append(f'    *** REIMPRESSAO - MOTIVO: {registro["motivo"]} ***')

    cur.close()
    return '\r\n'.join(L)


# ═══════════════════════════════════════════════════════════════════════
# INTERFACE GRÁFICA
# ═══════════════════════════════════════════════════════════════════════
class RoboSeparacaoApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title('Robô de Separação - Impressão Matricial')
        self.root.geometry('700x520')
        self.root.resizable(False, False)

        self.conn = None
        self.rodando = False
        self.thread = None
        self.impressora_selecionada = None
        self.armazem_selecionado = None  # None = TODOS
        self.armazens_map = {}  # {'TODOS': None, '1001 - GERAL': 1001, ...}
        self.fila_nroimp = tk.StringVar(value='01')
        self.intervalo = tk.StringVar(value='20')
        self.db_host = tk.StringVar(value='servicos.melopecas.com.br')
        self.db_port = tk.StringVar(value='5432')
        self.db_name = tk.StringVar(value='postgres')
        self.db_user = tk.StringVar(value='postgres')
        self.db_pass = tk.StringVar(value='Melodb@2025')
        self.db_schema = tk.StringVar(value='db_manaus')

        self.criar_interface()

    def criar_interface(self):
        # ─── Frame conexão ───
        frame_db = ttk.LabelFrame(self.root, text=' Conexão com Banco ', padding=10)
        frame_db.pack(fill='x', padx=10, pady=5)

        row_db1 = ttk.Frame(frame_db)
        row_db1.pack(fill='x', pady=2)
        ttk.Label(row_db1, text='Host:').pack(side='left')
        ttk.Entry(row_db1, textvariable=self.db_host, width=35).pack(side='left', padx=(5, 15))
        ttk.Label(row_db1, text='Porta:').pack(side='left')
        ttk.Entry(row_db1, textvariable=self.db_port, width=6).pack(side='left', padx=(5, 15))
        ttk.Label(row_db1, text='Banco:').pack(side='left')
        ttk.Entry(row_db1, textvariable=self.db_name, width=12).pack(side='left', padx=5)

        row_db2 = ttk.Frame(frame_db)
        row_db2.pack(fill='x', pady=2)
        ttk.Label(row_db2, text='Usuário:').pack(side='left')
        ttk.Entry(row_db2, textvariable=self.db_user, width=15).pack(side='left', padx=(5, 15))
        ttk.Label(row_db2, text='Senha:').pack(side='left')
        ttk.Entry(row_db2, textvariable=self.db_pass, width=20, show='*').pack(side='left', padx=(5, 15))
        ttk.Label(row_db2, text='Schema:').pack(side='left')
        ttk.Entry(row_db2, textvariable=self.db_schema, width=15).pack(side='left', padx=5)

        # ─── Frame configuração ───
        frame_cfg = ttk.LabelFrame(self.root, text=' Configuração ', padding=10)
        frame_cfg.pack(fill='x', padx=10, pady=5)

        row1 = ttk.Frame(frame_cfg)
        row1.pack(fill='x', pady=2)

        ttk.Label(row1, text='Fila (NROIMP):').pack(side='left')
        combo_fila = ttk.Combobox(row1, textvariable=self.fila_nroimp, width=8,
                                   values=['01', '03', '05', '06', '10', '99'])
        combo_fila.pack(side='left', padx=(5, 20))

        ttk.Label(row1, text='Armazém:').pack(side='left')
        self.combo_armazem = ttk.Combobox(row1, width=25, state='readonly', values=['TODOS'])
        self.combo_armazem.current(0)
        self.combo_armazem.pack(side='left', padx=(5, 20))
        self._armazens_carregados = False
        self.combo_armazem.bind('<Button-1>', lambda e: self._carregar_armazens_on_click())

        ttk.Label(row1, text='Intervalo (seg):').pack(side='left')
        ttk.Entry(row1, textvariable=self.intervalo, width=5).pack(side='left', padx=5)

        # ─── Frame impressora ───
        frame_imp = ttk.LabelFrame(self.root, text=' Impressora ', padding=10)
        frame_imp.pack(fill='x', padx=10, pady=5)

        row_imp = ttk.Frame(frame_imp)
        row_imp.pack(fill='x')

        self.combo_impressora = ttk.Combobox(row_imp, width=50, state='readonly')
        self.combo_impressora.pack(side='left', padx=(0, 10))

        ttk.Button(row_imp, text='Atualizar Lista', command=self.atualizar_impressoras).pack(side='left')

        # ─── Botões ───
        frame_btns = ttk.Frame(self.root)
        frame_btns.pack(fill='x', padx=10, pady=10)

        self.btn_iniciar = ttk.Button(frame_btns, text='INICIAR', command=self.iniciar, style='Accent.TButton')
        self.btn_iniciar.pack(side='left', padx=5)

        self.btn_parar = ttk.Button(frame_btns, text='PARAR', command=self.parar, state='disabled')
        self.btn_parar.pack(side='left', padx=5)

        self.lbl_status = ttk.Label(frame_btns, text='Parado', foreground='gray')
        self.lbl_status.pack(side='right', padx=10)

        # ─── Log ───
        frame_log = ttk.LabelFrame(self.root, text=' Log ', padding=5)
        frame_log.pack(fill='both', expand=True, padx=10, pady=5)

        self.txt_log = tk.Text(frame_log, height=10, font=('Consolas', 9), state='disabled',
                               bg='#1e1e1e', fg='#d4d4d4', insertbackground='white')
        scroll = ttk.Scrollbar(frame_log, command=self.txt_log.yview)
        self.txt_log.configure(yscrollcommand=scroll.set)
        scroll.pack(side='right', fill='y')
        self.txt_log.pack(fill='both', expand=True)

        # Carregar impressoras
        self.atualizar_impressoras()

    def log(self, msg):
        agora = datetime.now().strftime('%H:%M:%S')
        self.txt_log.configure(state='normal')
        self.txt_log.insert('end', f'[{agora}] {msg}\n')
        self.txt_log.see('end')
        self.txt_log.configure(state='disabled')

    def _carregar_armazens_on_click(self):
        if not self._armazens_carregados:
            self.carregar_armazens()

    def carregar_armazens(self):
        """Conecta no banco e carrega lista de armazéns"""
        try:
            conn = psycopg2.connect(**self._conn_params())
            cur = conn.cursor()
            cur.execute("SELECT arm_id, arm_descricao FROM cad_armazem ORDER BY arm_id")
            rows = cur.fetchall()
            cur.close()
            conn.close()

            self.armazens_map = {'TODOS': None}
            opcoes = ['TODOS']
            for arm_id, descr in rows:
                label = f'{arm_id} - {descr}'
                self.armazens_map[label] = arm_id
                opcoes.append(label)

            self.combo_armazem['values'] = opcoes
            self.combo_armazem.current(0)
            self._armazens_carregados = True
            self.log(f'{len(rows)} armazém(ns) carregado(s)')
        except Exception as e:
            self.log(f'ERRO ao carregar armazéns: {e}')
            messagebox.showerror('Erro', f'Falha ao carregar armazéns:\n{e}\n\nVerifique a conexão com o banco.')

    def atualizar_impressoras(self):
        impressoras = listar_impressoras()
        self.combo_impressora['values'] = impressoras
        if impressoras:
            self.combo_impressora.current(0)
        self.log(f'{len(impressoras)} impressora(s) detectada(s)')

    def _conn_params(self):
        return dict(
            host=self.db_host.get(),
            port=int(self.db_port.get()),
            dbname=self.db_name.get(),
            user=self.db_user.get(),
            password=self.db_pass.get(),
            options=f'-c search_path={self.db_schema.get()},public',
        )

    def conectar_banco(self):
        try:
            self.conn = psycopg2.connect(**self._conn_params())
            self.conn.autocommit = True
            cur = self.conn.cursor()
            cur.execute("SELECT COUNT(*) FROM dbservimp WHERE \"IMPRESSO\" = 'N'")
            qtd = cur.fetchone()[0]
            cur.close()
            self.log(f'Banco conectado. {qtd} documento(s) pendente(s).')
            return True
        except Exception as e:
            self.log(f'ERRO ao conectar: {e}')
            messagebox.showerror('Erro', f'Falha ao conectar no banco:\n{e}')
            return False

    def iniciar(self):
        if not self.combo_impressora.get():
            messagebox.showwarning('Aviso', 'Selecione uma impressora')
            return

        self.impressora_selecionada = self.combo_impressora.get()
        self.armazem_selecionado = self.armazens_map.get(self.combo_armazem.get())

        if not self.conectar_banco():
            return

        self.rodando = True
        self.btn_iniciar.configure(state='disabled')
        self.btn_parar.configure(state='normal')
        self.lbl_status.configure(text='Rodando...', foreground='green')
        arm_label = self.combo_armazem.get()
        self.log(f'Iniciado | Impressora: {self.impressora_selecionada} | Fila: {self.fila_nroimp.get()} | Armazém: {arm_label}')

        self.thread = threading.Thread(target=self.loop_principal, daemon=True)
        self.thread.start()

    def parar(self):
        self.rodando = False
        self.btn_iniciar.configure(state='normal')
        self.btn_parar.configure(state='disabled')
        self.lbl_status.configure(text='Parado', foreground='gray')
        self.log('Parado pelo usuário')
        if self.conn:
            try:
                self.conn.close()
            except:
                pass

    def loop_principal(self):
        while self.rodando:
            try:
                self.ciclo()
            except Exception as e:
                self.root.after(0, lambda: self.log(f'ERRO no ciclo: {e}'))
                # Reconectar
                try:
                    self.conn = psycopg2.connect(**self._conn_params())
                    self.conn.autocommit = True
                except:
                    pass

            intervalo = int(self.intervalo.get() or 20)
            for _ in range(intervalo):
                if not self.rodando:
                    break
                time.sleep(1)

    def ciclo(self):
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(**self._conn_params())
            self.conn.autocommit = True

        cur = self.conn.cursor()
        if self.armazem_selecionado is not None:
            cur.execute(
                """SELECT "CODIGO", "NRODOC", "TIPODOC", "CODCF", "NOMECF", "NOMEUSR",
                          "VALOR", "DATA", "HORA", "NROIMP", "IMPRESSO", "ARMAZEM", motivo
                   FROM dbservimp
                   WHERE "IMPRESSO" <> 'S' AND "NROIMP" = %s AND "ARMAZEM" = %s
                   ORDER BY "DATA" ASC, "HORA" ASC LIMIT 3""",
                (self.fila_nroimp.get(), int(self.armazem_selecionado))
            )
        else:
            cur.execute(
                """SELECT "CODIGO", "NRODOC", "TIPODOC", "CODCF", "NOMECF", "NOMEUSR",
                          "VALOR", "DATA", "HORA", "NROIMP", "IMPRESSO", "ARMAZEM", motivo
                   FROM dbservimp
                   WHERE "IMPRESSO" <> 'S' AND "NROIMP" = %s
                   ORDER BY "DATA" ASC, "HORA" ASC LIMIT 3""",
                (self.fila_nroimp.get(),)
            )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]

        if not rows:
            return

        registros = [dict(zip(cols, r)) for r in rows]
        self.root.after(0, lambda: self.log(f'{len(registros)} documento(s) na fila'))

        for reg in registros:
            cod = reg['CODIGO']
            try:
                self.root.after(0, lambda c=cod: self.log(f'  Imprimindo: {c}...'))

                # Gerar texto
                texto = gerar_relatorio(self.conn, reg)
                if not texto:
                    self.root.after(0, lambda c=cod: self.log(f'  AVISO: Venda {c} não encontrada'))
                    continue

                # Salvar em temp
                tmp = os.path.join(tempfile.gettempdir(), f'pre_pedido_{cod}_{int(time.time())}.txt')
                with open(tmp, 'w', encoding='utf-8') as f:
                    f.write(texto)

                # Enviar para impressora
                imprimir_arquivo(self.impressora_selecionada, tmp)

                # Impressão OK → agora sim marca como impresso
                cur.execute(
                    """UPDATE dbservimp SET "IMPRESSO" = 'S'
                       WHERE "CODIGO" = %s AND "TIPODOC" = %s AND "NROIMP" = %s
                       AND "IMPRESSO" <> 'S' AND "DATA" = %s AND "HORA" = %s""",
                    (reg['CODIGO'], reg['TIPODOC'], reg['NROIMP'], reg['DATA'], reg['HORA'])
                )

                self.root.after(0, lambda c=cod: self.log(f'  OK: {c} impresso com sucesso'))

                # Limpar temp após 10s
                threading.Timer(10, lambda f=tmp: os.unlink(f) if os.path.exists(f) else None).start()

            except Exception as e:
                # Erro na impressão → NÃO marca como impresso, tenta de novo no próximo ciclo
                self.root.after(0, lambda c=cod, err=str(e): self.log(f'  ERRO {c}: {err} (vai tentar novamente)'))

        cur.close()

    def executar(self):
        self.root.mainloop()


if __name__ == '__main__':
    app = RoboSeparacaoApp()
    app.executar()
