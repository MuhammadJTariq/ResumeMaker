const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const JsonQueryEngine = require("./json-query-engine");

class Database {
  static instance = null;

  constructor() {
    if (Database.instance) {
      return Database.instance;
    }

    this.pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "resumemaker",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    Database.instance = this;
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }

    return Database.instance;
  }

  getPool() {
    return this.pool;
  }

  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  async run(queryObject) {
    const engine = new JsonQueryEngine(queryObject);
    const { sql, params } = engine.build();
    return this.query(sql, params);
  }

  async testConnection() {
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  }

  async initializeSchema() {
    const schemaPath = path.join(__dirname, "..", "..", "dbfiles", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    const statements = schemaSql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await this.query(statement);
    }
  }
}

module.exports = Database;
