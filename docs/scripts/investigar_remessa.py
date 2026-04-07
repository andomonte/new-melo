import cx_Oracle
import sys

def investigar_procedures_remessa():
    try:
        # Configuração da conexão
        dsn = cx_Oracle.makedsn('201.64.221.132', 1524, service_name='desenv.mns.melopecas.com.br')
        connection = cx_Oracle.connect(user='GERAL', password='123', dsn=dsn)
        
        print('✅ Conectado com sucesso ao Oracle!\n')
        
        cursor = connection.cursor()
        
        # 1. Procedures com REMESSA no nome
        print('=' * 60)
        print('1. PROCEDURES COM "REMESSA" NO NOME')
        print('=' * 60)
        
        cursor.execute("""
            SELECT 
              object_name,
              object_type,
              status,
              TO_CHAR(created, 'DD/MM/YYYY HH24:MI:SS') as criado_em,
              TO_CHAR(last_ddl_time, 'DD/MM/YYYY HH24:MI:SS') as ultima_modificacao
            FROM all_objects
            WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
              AND UPPER(object_name) LIKE '%REMESSA%'
              AND owner = 'GERAL'
            ORDER BY object_name
        """)
        
        rows = cursor.fetchall()
        if rows:
            for row in rows:
                print(f"\nNome: {row[0]}")
                print(f"Tipo: {row[1]}")
                print(f"Status: {row[2]}")
                print(f"Criado em: {row[3]}")
                print(f"Última modificação: {row[4]}")
                print('-' * 40)
        else:
            print("Nenhuma procedure encontrada.\n")
        
        # 2. Procedures com REMESSA no código
        print('\n' + '=' * 60)
        print('2. PROCEDURES COM "REMESSA" NO CÓDIGO')
        print('=' * 60)
        
        cursor.execute("""
            SELECT DISTINCT
              name,
              type,
              COUNT(*) as ocorrencias
            FROM all_source
            WHERE UPPER(text) LIKE '%REMESSA%'
              AND owner = 'GERAL'
              AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
            GROUP BY name, type
            ORDER BY name
        """)
        
        rows = cursor.fetchall()
        if rows:
            print(f"\nEncontradas {len(rows)} procedures/funções:\n")
            for row in rows:
                print(f"- {row[0]} ({row[1]}) - {row[2]} ocorrências")
        else:
            print("Nenhuma procedure encontrada.\n")
        
        # 3. Procedures com CNAB no código
        print('\n' + '=' * 60)
        print('3. PROCEDURES COM "CNAB" OU "BOLETO" NO CÓDIGO')
        print('=' * 60)
        
        cursor.execute("""
            SELECT DISTINCT
              name,
              type
            FROM all_source
            WHERE (UPPER(text) LIKE '%CNAB%' OR UPPER(text) LIKE '%BOLETO%')
              AND owner = 'GERAL'
              AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
            ORDER BY name
        """)
        
        rows = cursor.fetchall()
        if rows:
            print(f"\nEncontradas {len(rows)} procedures/funções:\n")
            for row in rows:
                print(f"- {row[0]} ({row[1]})")
        else:
            print("Nenhuma procedure encontrada.\n")
        
        # 4. Tabelas com REMESSA
        print('\n' + '=' * 60)
        print('4. TABELAS COM "REMESSA" NO NOME')
        print('=' * 60)
        
        cursor.execute("""
            SELECT 
              table_name,
              num_rows
            FROM all_tables
            WHERE UPPER(table_name) LIKE '%REMESSA%'
              AND owner = 'GERAL'
            ORDER BY table_name
        """)
        
        rows = cursor.fetchall()
        if rows:
            for row in rows:
                print(f"\nTabela: {row[0]}")
                print(f"Linhas: {row[1] if row[1] else 'N/A'}")
        else:
            print("Nenhuma tabela encontrada.\n")
        
        # 5. Buscar código fonte de procedures específicas
        print('\n' + '=' * 60)
        print('5. BUSCANDO CÓDIGO FONTE DAS PROCEDURES')
        print('=' * 60)
        
        # Primeiro, pegar lista de procedures
        cursor.execute("""
            SELECT DISTINCT name
            FROM all_source
            WHERE UPPER(text) LIKE '%REMESSA%'
              AND owner = 'GERAL'
              AND type IN ('PROCEDURE', 'PACKAGE BODY')
            ORDER BY name
        """)
        
        proc_names = cursor.fetchall()
        
        for proc_name in proc_names[:3]:  # Limitar a 3 primeiras
            print(f"\n{'=' * 60}")
            print(f"CÓDIGO DE: {proc_name[0]}")
            print('=' * 60)
            
            cursor.execute("""
                SELECT text
                FROM all_source
                WHERE name = :proc_name
                  AND owner = 'GERAL'
                ORDER BY line
            """, proc_name=proc_name[0])
            
            code_lines = cursor.fetchall()
            for line in code_lines:
                print(line[0], end='')
        
        cursor.close()
        connection.close()
        
        print('\n\n✅ Investigação concluída!')
        
    except cx_Oracle.Error as error:
        print(f'❌ Erro ao conectar ao Oracle: {error}')
        sys.exit(1)
    except Exception as e:
        print(f'❌ Erro: {e}')
        sys.exit(1)

if __name__ == '__main__':
    investigar_procedures_remessa()
