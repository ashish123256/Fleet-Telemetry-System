/* eslint-disable prettier/prettier */
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',

  // Railway / Production
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),

  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  entities: ['dist/**/*.entity.js'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',

  // REQUIRED on Railway Postgres
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
