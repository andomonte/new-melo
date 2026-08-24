"""
ROBÔ 2 — Impressão DANFE / NF-e / Boleto / NFC-e
Equivalente ao Gerenciador_Impressao_NFE do Delphi.

Faz polling na fin_impressao, busca o PDF da DANFE via API e envia para impressora.

Gera executável standalone com: pyinstaller --onefile --windowed robo_danfe.py
"""

import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time
import os
import tempfile
import urllib.request
import json
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
        import subprocess
        result = subprocess.run(
            ['powershell', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
            capture_output=True, text=True
        )
        return [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]


def imprimir_pdf(impressora, arquivo_pdf):
    """Envia PDF para a impressora"""
    try:
        import win32api
        win32api.ShellExecute(0, "printto", arquivo_pdf, f'"{impressora}"', ".", 0)
        return True
    except ImportError:
        import subprocess
        subprocess.run(
            ['powershell', '-Command',
             f'Start-Process -FilePath "{arquivo_pdf}" -Verb PrintTo -ArgumentList "{impressora}"'],
            shell=True
        )
        return True


def baixar_pdf_danfe(url_base, codfat):
    """Baixa o PDF da DANFE via API do sistema"""
    url = f"{url_base}/api/faturamento/pdf-nota?codfat={codfat}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 200:
                content_type = resp.headers.get('Content-Type', '')
                data = resp.read()
                if 'pdf' in content_type or len(data) > 1000:
                    return data
                # Pode ser JSON de erro
                try:
                    err = json.loads(data)
                    return None
                except:
                    return data
            return None
    except Exception as e:
        print(f"Erro ao baixar DANFE {codfat}: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# INTERFACE GRÁFICA
# ═══════════════════════════════════════════════════════════════════════
class RoboDanfeApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title('Robô DANFE / NF-e — Impressão Laser')
        self.root.geometry('750x580')
        self.root.resizable(False, False)

        self.conn = None
        self.rodando = False
        self.thread = None

        # Variáveis de configuração
        self.db_url = tk.StringVar(value='postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres?options=-c%20search_path%3Ddb_manaus,public')
        self.api_url = tk.StringVar(value='http://localhost:3000')
        self.fila_id = tk.StringVar(value='1')
        self.intervalo = tk.StringVar(value='40')

        self.criar_interface()

    def criar_interface(self):
        # ─── Frame conexão ───
        frame_db = ttk.LabelFrame(self.root, text=' Conexão com Banco ', padding=10)
        frame_db.pack(fill='x', padx=10, pady=5)

        ttk.Label(frame_db, text='URL PostgreSQL:').pack(anchor='w')
        ttk.Entry(frame_db, textvariable=self.db_url, width=95).pack(fill='x')

        row_api = ttk.Frame(frame_db)
        row_api.pack(fill='x', pady=(5, 0))
        ttk.Label(row_api, text='URL do Sistema (para buscar DANFE PDF):').pack(side='left')
        ttk.Entry(row_api, textvariable=self.api_url, width=40).pack(side='left', padx=5)

        # ─── Frame configuração ───
        frame_cfg = ttk.LabelFrame(self.root, text=' Configuração ', padding=10)
        frame_cfg.pack(fill='x', padx=10, pady=5)

        row1 = ttk.Frame(frame_cfg)
        row1.pack(fill='x', pady=2)

        ttk.Label(row1, text='Fila (imp_fila):').pack(side='left')
        ttk.Entry(row1, textvariable=self.fila_id, width=5).pack(side='left', padx=(5, 20))

        ttk.Label(row1, text='Intervalo (seg):').pack(side='left')
        ttk.Entry(row1, textvariable=self.intervalo, width=5).pack(side='left', padx=5)

        # ─── Frame impressoras ───
        frame_imp = ttk.LabelFrame(self.root, text=' Impressoras ', padding=10)
        frame_imp.pack(fill='x', padx=10, pady=5)

        # DANFE (NF-e)
        row_danfe = ttk.Frame(frame_imp)
        row_danfe.pack(fill='x', pady=2)
        ttk.Label(row_danfe, text='DANFE (NF-e):', width=18, anchor='w').pack(side='left')
        self.combo_danfe = ttk.Combobox(row_danfe, width=45, state='readonly')
        self.combo_danfe.pack(side='left', padx=5)

        # Boleto / Cobrança
        row_boleto = ttk.Frame(frame_imp)
        row_boleto.pack(fill='x', pady=2)
        ttk.Label(row_boleto, text='Boleto/Cobrança:', width=18, anchor='w').pack(side='left')
        self.combo_boleto = ttk.Combobox(row_boleto, width=45, state='readonly')
        self.combo_boleto.pack(side='left', padx=5)

        # NFC-e
        row_nfce = ttk.Frame(frame_imp)
        row_nfce.pack(fill='x', pady=2)
        ttk.Label(row_nfce, text='NFC-e:', width=18, anchor='w').pack(side='left')
        self.combo_nfce = ttk.Combobox(row_nfce, width=45, state='readonly')
        self.combo_nfce.pack(side='left', padx=5)

        ttk.Button(frame_imp, text='Atualizar Lista de Impressoras', command=self.atualizar_impressoras).pack(pady=(5, 0))

        # ─── Botões ───
        frame_btns = ttk.Frame(self.root)
        frame_btns.pack(fill='x', padx=10, pady=10)

        self.btn_iniciar = ttk.Button(frame_btns, text='INICIAR', command=self.iniciar)
        self.btn_iniciar.pack(side='left', padx=5)

        self.btn_parar = ttk.Button(frame_btns, text='PARAR', command=self.parar, state='disabled')
        self.btn_parar.pack(side='left', padx=5)

        self.lbl_status = ttk.Label(frame_btns, text='Parado', foreground='gray')
        self.lbl_status.pack(side='right', padx=10)

        # ─── Log ───
        frame_log = ttk.LabelFrame(self.root, text=' Log ', padding=5)
        frame_log.pack(fill='both', expand=True, padx=10, pady=5)

        self.txt_log = tk.Text(frame_log, height=8, font=('Consolas', 9), state='disabled',
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

    def atualizar_impressoras(self):
        impressoras = listar_impressoras()
        for combo in [self.combo_danfe, self.combo_boleto, self.combo_nfce]:
            combo['values'] = ['(nenhuma)'] + impressoras
            if impressoras:
                combo.current(1)  # Seleciona a primeira impressora real
            else:
                combo.current(0)
        self.log(f'{len(impressoras)} impressora(s) detectada(s)')

    def conectar_banco(self):
        try:
            self.conn = psycopg2.connect(self.db_url.get())
            self.conn.autocommit = True
            cur = self.conn.cursor()
            cur.execute("SELECT COUNT(*) FROM fin_impressao WHERE imp_impresso = 'N'")
            qtd = cur.fetchone()[0]
            cur.close()
            self.log(f'Banco conectado. {qtd} documento(s) pendente(s) na fila.')
            return True
        except Exception as e:
            self.log(f'ERRO ao conectar: {e}')
            messagebox.showerror('Erro', f'Falha ao conectar no banco:\n{e}')
            return False

    def iniciar(self):
        danfe = self.combo_danfe.get()
        if not danfe or danfe == '(nenhuma)':
            messagebox.showwarning('Aviso', 'Selecione pelo menos a impressora DANFE')
            return

        if not self.conectar_banco():
            return

        self.rodando = True
        self.btn_iniciar.configure(state='disabled')
        self.btn_parar.configure(state='normal')
        self.lbl_status.configure(text='Rodando...', foreground='green')

        imp_danfe = danfe if danfe != '(nenhuma)' else None
        imp_boleto = self.combo_boleto.get()
        imp_boleto = imp_boleto if imp_boleto != '(nenhuma)' else None
        imp_nfce = self.combo_nfce.get()
        imp_nfce = imp_nfce if imp_nfce != '(nenhuma)' else None

        self.impressoras = {
            'DANFE': imp_danfe,
            'BOLETO': imp_boleto or imp_danfe,  # fallback para DANFE
            'NFCE': imp_nfce or imp_danfe,
        }

        self.log(f'Iniciado | DANFE: {imp_danfe} | Fila: {self.fila_id.get()}')
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
                try:
                    self.conn = psycopg2.connect(self.db_url.get())
                    self.conn.autocommit = True
                except:
                    pass

            intervalo = int(self.intervalo.get() or 40)
            for _ in range(intervalo):
                if not self.rodando:
                    break
                time.sleep(1)

    def ciclo(self):
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(self.db_url.get())
            self.conn.autocommit = True

        cur = self.conn.cursor()

        # Buscar documentos pendentes na fila
        cur.execute(
            """SELECT imp_aut_id, imp_data, imp_fila
               FROM fin_impressao
               WHERE imp_impresso = 'N' AND imp_fila = %s
               ORDER BY imp_data ASC LIMIT 5""",
            (int(self.fila_id.get()),)
        )
        rows = cur.fetchall()

        if not rows:
            return

        self.root.after(0, lambda: self.log(f'{len(rows)} documento(s) na fila'))

        for row in rows:
            imp_aut_id = str(row[0])
            try:
                self.root.after(0, lambda c=imp_aut_id: self.log(f'  Processando fatura: {c}...'))

                # Identificar tipo de documento pela fatura
                cur.execute(
                    "SELECT codfat, tipodoc, tipofat, numero, serie FROM dbfatura WHERE codfat = %s",
                    (imp_aut_id,)
                )
                fat_row = cur.fetchone()

                if not fat_row:
                    self.root.after(0, lambda c=imp_aut_id: self.log(f'  AVISO: Fatura {c} não encontrada'))
                    # Marcar como impresso para não ficar em loop
                    cur.execute(
                        "UPDATE fin_impressao SET imp_impresso = 'S' WHERE imp_aut_id = %s AND imp_fila = %s",
                        (imp_aut_id, int(self.fila_id.get()))
                    )
                    continue

                codfat = fat_row[0]
                tipodoc = (fat_row[1] or '').strip()
                tipofat = (fat_row[2] or '').strip()

                # Determinar impressora pelo tipo
                impressora = self.impressoras.get('DANFE')

                # Baixar PDF via API
                pdf_data = baixar_pdf_danfe(self.api_url.get(), codfat)

                if not pdf_data:
                    self.root.after(0, lambda c=codfat: self.log(f'  AVISO: PDF não disponível para {c} (NF-e pode não estar autorizada)'))
                    # Não marca como impresso — tenta novamente no próximo ciclo
                    continue

                # Salvar PDF temporariamente
                tmp_pdf = os.path.join(tempfile.gettempdir(), f'danfe_{codfat}_{int(time.time())}.pdf')
                with open(tmp_pdf, 'wb') as f:
                    f.write(pdf_data)

                # Marcar como impresso ANTES (estratégia otimista)
                cur.execute(
                    "UPDATE fin_impressao SET imp_impresso = 'S' WHERE imp_aut_id = %s AND imp_fila = %s",
                    (imp_aut_id, int(self.fila_id.get()))
                )

                # Enviar para impressora
                if impressora:
                    imprimir_pdf(impressora, tmp_pdf)
                    self.root.after(0, lambda c=codfat, p=impressora: self.log(f'  OK: DANFE {c} enviada para {p}'))
                else:
                    self.root.after(0, lambda c=codfat, f=tmp_pdf: self.log(f'  PREVIEW: PDF salvo em {f}'))

                # Limpar temp após 30s
                threading.Timer(30, lambda f=tmp_pdf: os.unlink(f) if os.path.exists(f) else None).start()

            except Exception as e:
                self.root.after(0, lambda c=imp_aut_id, err=str(e): self.log(f'  ERRO {c}: {err}'))

        cur.close()

    def executar(self):
        self.root.mainloop()


if __name__ == '__main__':
    app = RoboDanfeApp()
    app.executar()
