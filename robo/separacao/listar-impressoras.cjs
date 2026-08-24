/**
 * Lista todas as impressoras instaladas no Windows
 * Uso: node listar-impressoras.cjs
 */
const { exec } = require('child_process');

exec('wmic printer get Name,PortName,PrinterStatus,WorkOffline /format:csv', (err, stdout) => {
  if (err) {
    // Alternativa se wmic não funcionar
    exec('powershell -Command "Get-Printer | Select-Object Name,PortName,PrinterStatus | Format-Table -AutoSize"', (err2, stdout2) => {
      if (err2) {
        console.error('Erro ao listar impressoras:', err2.message);
        return;
      }
      console.log('\n=== IMPRESSORAS DISPONIVEIS ===\n');
      console.log(stdout2);
      console.log('\nCopie o nome da impressora e coloque no config.json em "impressora.nome"');
    });
    return;
  }

  console.log('\n=== IMPRESSORAS DISPONIVEIS ===\n');
  const linhas = stdout.trim().split('\n').filter(l => l.trim());
  if (linhas.length > 1) {
    console.log('  NOME                                    PORTA              STATUS');
    console.log('  ' + '-'.repeat(75));
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(',');
      if (cols.length >= 4) {
        const nome = (cols[1] || '').trim();
        const porta = (cols[2] || '').trim();
        const status = (cols[3] || '').trim();
        if (nome) {
          console.log('  ' + nome.padEnd(42) + porta.padEnd(19) + (status === '3' ? 'IDLE' : status === '0' ? 'OK' : status));
        }
      }
    }
  }
  console.log('\n  Copie o nome exato da impressora e coloque no config.json em "impressora.nome"');
  console.log('  Exemplo: { "impressora": { "nome": "EPSON LX-300+II", "tipo": "matricial" } }\n');
});
