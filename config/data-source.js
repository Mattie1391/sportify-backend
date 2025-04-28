require('dotenv').config();
const { DataSource } = require('typeorm');
const User = require('../models/User');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: true,
  logging: false,
  entities: [User], // ← 注意這裡要匯入正確 Entity
});

module.exports = { AppDataSource };
