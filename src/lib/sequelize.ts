import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 10, // Número máximo de conexões
    min: 2, // Número mínimo de conexões
    acquire: 30000, // Tempo máximo para tentar obter uma conexão (ms)
    idle: 10000, // Tempo máximo de inatividade antes de liberar a conexão (ms)
  },
});
