#!/usr/bin/env python3
import cx_Oracle

try:
    # Configuração da conexão
    dsn = cx_Oracle.makedsn("201.64.221.132", 1524, service_name="desenv.mns.melopecas.com.br")
    connection = cx_Oracle.connect("GERAL", "123", dsn)
    
    cursor = connection.cursor()
    
    # Verificar se a tabela existe
    cursor.execute("""
        SELECT COUNT(*) 
        FROM user_tables 
        WHERE table_name = 'CMP_ORDEM_COMPRA'
    """)
    
    table_exists = cursor.fetchone()[0]
    print(f"Tabela CMP_ORDEM_COMPRA existe: {table_exists > 0}")
    
    if table_exists > 0:
        # Buscar estrutura da tabela
        cursor.execute("""
            SELECT column_name, data_type, nullable, data_length
            FROM user_tab_columns 
            WHERE table_name = 'CMP_ORDEM_COMPRA' 
            ORDER BY column_id
        """)
        
        print("\nEstrutura da tabela CMP_ORDEM_COMPRA:")
        print("COLUMN_NAME".ljust(30) + "DATA_TYPE".ljust(20) + "NULLABLE".ljust(10) + "LENGTH")
        print("-" * 70)
        
        for row in cursor.fetchall():
            column_name, data_type, nullable, length = row
            print(f"{column_name:<30} {data_type:<20} {nullable:<10} {length}")
        
        # Buscar algumas ordens de exemplo
        cursor.execute("""
            SELECT * FROM (
                SELECT * FROM CMP_ORDEM_COMPRA 
                ORDER BY ORC_ID DESC
            ) WHERE ROWNUM <= 3
        """)
        
        print("\nExemplos de dados (3 últimos registros):")
        columns = [desc[0] for desc in cursor.description]
        print(" | ".join(columns))
        print("-" * 80)
        
        for row in cursor.fetchall():
            print(" | ".join(str(val) if val is not None else "NULL" for val in row))
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"Erro ao conectar no Oracle: {e}")
