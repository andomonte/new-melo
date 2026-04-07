import dotenv from "dotenv";
import oracledb from "oracledb";

dotenv.config();

// Tentar primeiro com a versão 23_4 que é usada no projeto
try {
  oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient\\instantclient_23_4" });
  console.log("✅ Usando Instant Client 23_4");
} catch (err) {
  try {
    oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient_23_8" });
    console.log("✅ Usando Instant Client 23_8");
  } catch (err2) {
    console.log("⚠️  Instant Client já inicializado ou não encontrado");
  }
}

console.log("🧠 Oracle client modo:", oracledb.thin ? "Thin ❌" : "Thick ✅");

async function testConnection() {
  let connection;
  
  try {
    console.log("\n🔍 Testando conexão 1: Credenciais diretas DATABASE_URL2...");
    connection = await oracledb.getConnection({
      user: "GERAL",
      password: "123",
      connectString: "201.64.221.132:1524/desenv.mns.melopecas.com.br"
    });
    
    console.log("✅ Conectado com sucesso!");
    
    // Testar uma query simples
    const result = await connection.execute("SELECT USER FROM DUAL");
    console.log("👤 Usuário conectado:", result.rows[0][0]);
    
    await connection.close();
    return true;
    
  } catch (error) {
    console.error("❌ Erro na conexão 1:", error.message);
    console.error("Código:", error.errorNum);
    
    // Tentar com variantes
    const variants = [
      {
        desc: "Sem aspas no service",
        config: {
          user: "GERAL",
          password: "123",
          connectString: "201.64.221.132:1524/desenv.mns.melopecas.com.br"
        }
      },
      {
        desc: "Com SID ao invés de SERVICE_NAME",
        config: {
          user: "GERAL",
          password: "123",
          connectString: "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=201.64.221.132)(PORT=1524))(CONNECT_DATA=(SID=desenv)))"
        }
      },
      {
        desc: "SERVICE_NAME completo",
        config: {
          user: "GERAL",
          password: "123",
          connectString: "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=201.64.221.132)(PORT=1524))(CONNECT_DATA=(SERVICE_NAME=desenv.mns.melopecas.com.br)))"
        }
      }
    ];
    
    for (const variant of variants) {
      try {
        console.log(`\n🔍 Testando: ${variant.desc}...`);
        connection = await oracledb.getConnection(variant.config);
        console.log("✅ Conectado com sucesso!");
        const result = await connection.execute("SELECT USER FROM DUAL");
        console.log("👤 Usuário conectado:", result.rows[0][0]);
        await connection.close();
        return true;
      } catch (err) {
        console.error(`❌ Falhou: ${err.message}`);
      }
    }
    
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log("\n✅ Teste de conexão concluído com sucesso!");
  } else {
    console.log("\n❌ Todas as tentativas de conexão falharam.");
    console.log("\n💡 Verifique:");
    console.log("   - Se o banco Oracle está ativo");
    console.log("   - Se as credenciais estão corretas");
    console.log("   - Se o firewall permite a conexão");
    console.log("   - Se o service name/SID está correto");
  }
  process.exit(success ? 0 : 1);
});
