/**
 * Funções utilitárias para formatação de data/hora no padrão SEFAZ
 * Garante que as datas estejam sempre no horário local de Manaus (-04:00)
 */

export function formatarDataHora(data: string | Date, formatoQRCode = false) {
  try {
    let dataLocal: Date;
    
    if (typeof data === 'string') {
      // Converter string UTC para data local
      const dataObj = new Date(data);
      // Ajustar para GMT-4 (Manaus)
      const offsetManaus = -4 * 60; // -4 horas em minutos
      const offsetLocal = dataObj.getTimezoneOffset();
      const diffMinutes = offsetManaus - (-offsetLocal); // Negativo pois getTimezoneOffset retorna o inverso
      
      dataLocal = new Date(dataObj.getTime() + diffMinutes * 60000);
    } else {
      dataLocal = data;
    }

    const pad = (num: number) => num.toString().padStart(2, '0');
    const ano = dataLocal.getFullYear().toString();
    const mes = pad(dataLocal.getMonth() + 1);
    const dia = pad(dataLocal.getDate());
    const hora = pad(dataLocal.getHours());
    const minuto = pad(dataLocal.getMinutes());
    const segundo = pad(dataLocal.getSeconds());

    // Formato QR Code: yyyyMMddTHHmmss-0400
    if (formatoQRCode) {
      return `${ano}${mes}${dia}T${hora}${minuto}${segundo}-0400`;
    }
    
    // Formato XML: yyyy-MM-ddTHH:mm:ss-04:00
    return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}-04:00`;
  } catch (error) {
    console.error('❌ Erro ao formatar data/hora:', error);
    throw new Error(`Data/hora inválida: ${data}`);
  }
}