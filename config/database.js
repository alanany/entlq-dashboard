const { DataSource } = require("typeorm");
require("dotenv").config();

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "education_platform",
    synchronize: process.env.NODE_ENV !== "production", // Auto-syncs only in development
    logging: process.env.NODE_ENV !== "production",
    entities: [
        __dirname + "/../models/*.js" 
    ],
    migrations: [
        __dirname + "/../migrations/*.js"
    ],
    subscribers: [],
});

module.exports = AppDataSource;
module.exports.AppDataSource = AppDataSource; // Keep backward compatibility for existing require imports
