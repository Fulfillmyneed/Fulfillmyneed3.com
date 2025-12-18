const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
);

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to PostgreSQL:', error);
    process.exit(1);
  }
};

// Create database if it doesn't exist (for initial setup)
const createDatabaseIfNotExists = async () => {
  const tempSequelize = new Sequelize(
    'postgres', // Connect to default database
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
      logging: false
    }
  );

  try {
    await tempSequelize.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    console.log(`✅ Database ${process.env.DB_NAME} created successfully.`);
  } catch (error) {
    if (error.original && error.original.code === '42P04') {
      console.log(`📁 Database ${process.env.DB_NAME} already exists.`);
    } else {
      console.error('❌ Error creating database:', error);
    }
  } finally {
    await tempSequelize.close();
  }
};

module.exports = {
  sequelize,
  testConnection,
  createDatabaseIfNotExists
};