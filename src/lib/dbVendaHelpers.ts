import { NextApiRequest, NextApiResponse } from 'next';
import { updateDtUpdate, updateMultipleDtUpdate } from './updateDtupdate';

/**
 * Middleware para atualizar dtupdate automaticamente após operações de UPDATE
 * Este middleware deve ser usado após operações que modificam registros em dbvenda
 */

// Exemplo de função helper para operações comuns
export class DbVendaOperations {
  /**
   * Atualiza o status de um pedido e o dtupdate automaticamente
   */
  static async updateStatus(
    client: any,
    codvenda: string | number,
    newStatus: string,
    additionalFields: Record<string, any> = {},
  ): Promise<any> {
    const setFields = Object.keys(additionalFields)
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');

    const query = `
      UPDATE dbvenda 
      SET statuspedido = $1, 
          dtupdate = NOW()
          ${setFields ? ', ' + setFields : ''}
      WHERE codvenda = $2
      RETURNING *
    `;

    const params = [newStatus, codvenda, ...Object.values(additionalFields)];
    return await client.query(query, params);
  }

  /**
   * Inicia separação de um pedido
   */
  static async iniciarSeparacao(
    client: any,
    codvenda: string | number,
    matriculaSeparador: string,
  ): Promise<any> {
    return await this.updateStatus(client, codvenda, '2', {
      separador: matriculaSeparador,
      inicioseparacao: 'NOW()',
    });
  }

  /**
   * Finaliza separação de um pedido
   */
  static async finalizarSeparacao(
    client: any,
    codvenda: string | number,
  ): Promise<any> {
    return await this.updateStatus(client, codvenda, '3');
  }

  /**
   * Inicia conferência de um pedido
   */
  static async iniciarConferencia(
    client: any,
    codvenda: string | number,
    matriculaConferente: string,
  ): Promise<any> {
    return await this.updateStatus(client, codvenda, '3', {
      conferente: matriculaConferente,
      inicioconferencia: 'NOW()',
    });
  }

  /**
   * Finaliza conferência de um pedido
   */
  static async finalizarConferencia(
    client: any,
    codvenda: string | number,
  ): Promise<any> {
    return await this.updateStatus(client, codvenda, '4', {
      finalizadopedido: 'NOW()',
    });
  }

  /**
   * Confirma um pedido (move para faturamento)
   */
  static async confirmarPedido(
    client: any,
    codvenda: string | number,
  ): Promise<any> {
    return await this.updateStatus(client, codvenda, '5');
  }
}

/**
 * Decorator para automatizar a atualização do dtupdate
 * Uso: @AutoUpdateDtUpdate(['codvenda'])
 */
export function AutoUpdateDtUpdate(codvendaFields: string[]) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      // Extrair códigos de venda do resultado
      const codvendas: (string | number)[] = [];

      if (result && result.rows) {
        result.rows.forEach((row: any) => {
          codvendaFields.forEach((field) => {
            if (row[field]) {
              codvendas.push(row[field]);
            }
          });
        });
      }

      // Atualizar dtupdate se houver códigos de venda
      if (codvendas.length > 0) {
        try {
          await updateMultipleDtUpdate(codvendas);
        } catch (error) {
          console.warn('Erro ao atualizar dtupdate automaticamente:', error);
        }
      }

      return result;
    };
  };
}

/**
 * Hook personalizado para APIs Next.js que automatiza dtupdate
 */
export function withAutoUpdateDtUpdate(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  extractCodvenda?: (req: NextApiRequest) => string | number | null,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Executar o handler original
    await handler(req, res);

    // Tentar extrair codvenda e atualizar dtupdate
    if (extractCodvenda) {
      try {
        const codvenda = extractCodvenda(req);
        if (codvenda) {
          await updateDtUpdate(codvenda);
        }
      } catch (error) {
        console.warn('Erro ao atualizar dtupdate automaticamente:', error);
      }
    }
  };
}

// Exemplo de uso:
/*
// Em uma API:
export default withAutoUpdateDtUpdate(
  async (req: NextApiRequest, res: NextApiResponse) => {
    // Sua lógica da API aqui
  },
  (req) => req.body.codvenda // Função para extrair codvenda
);

// Ou usando a classe helper:
await DbVendaOperations.iniciarSeparacao(client, codvenda, matricula);
*/
