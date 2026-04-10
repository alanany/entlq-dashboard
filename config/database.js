const { DataSource } = require("typeorm");
require("dotenv").config();

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "education_platform",
    synchronize: true, // Will automatically update schema. Good for dev, dangerous for prod.
    logging: false, // Set to true to view SQL queries in console
    entities: [
        __dirname + "/../models/*.js" // Will load EntitySchemas from models folder
    ],
    migrations: [],
    subscribers: [],
});

module.exports = { AppDataSource };
