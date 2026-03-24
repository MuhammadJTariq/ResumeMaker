class JsonQueryEngine {
  constructor(query) {
    this.query = query || {};
    this.params = [];
  }

  build() {
    if (!this.query.table) {
      throw new Error("Query table is required.");
    }

    const action = String(this.query.action || "").toUpperCase();
    switch (action) {
      case "SELECT":
        return this.buildSelect();
      case "INSERT":
        return this.buildInsert();
      case "UPDATE":
        return this.buildUpdate();
      case "DELETE":
        return this.buildDelete();
      default:
        throw new Error("Unsupported SQL action.");
    }
  }

  buildSelect() {
    const table = this.escapeIdentifier(this.query.table);
    const fields = this.buildFieldList(this.query.fields);
    let sql = `SELECT ${fields} FROM ${table}`;

    if (this.query.where) {
      sql += ` WHERE ${this.parseWhere(this.query.where)}`;
    }

    if (this.query.orderBy) {
      sql += ` ORDER BY ${this.buildOrderBy(this.query.orderBy)}`;
    }

    if (this.query.limit !== undefined) {
      sql += ` LIMIT ${this.buildLimit(this.query.limit)}`;
    }

    return { sql, params: this.params };
  }

  buildInsert() {
    const data = this.query.data || {};
    const keys = Object.keys(data);

    if (!keys.length) {
      throw new Error("INSERT data is required.");
    }

    const table = this.escapeIdentifier(this.query.table);
    const columns = keys.map((key) => this.escapeIdentifier(key)).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    this.params.push(...keys.map((key) => data[key]));

    return {
      sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
      params: this.params,
    };
  }

  buildUpdate() {
    const data = this.query.data || {};
    const keys = Object.keys(data);

    if (!keys.length) {
      throw new Error("UPDATE data is required.");
    }

    const table = this.escapeIdentifier(this.query.table);
    const updates = keys
      .map((key) => {
        this.params.push(data[key]);
        return `${this.escapeIdentifier(key)} = ?`;
      })
      .join(", ");

    let sql = `UPDATE ${table} SET ${updates}`;

    if (this.query.where) {
      sql += ` WHERE ${this.parseWhere(this.query.where)}`;
    }

    return { sql, params: this.params };
  }

  buildDelete() {
    const table = this.escapeIdentifier(this.query.table);
    let sql = `DELETE FROM ${table}`;

    if (this.query.where) {
      sql += ` WHERE ${this.parseWhere(this.query.where)}`;
    }

    return { sql, params: this.params };
  }

  buildFieldList(fields) {
    if (!Array.isArray(fields) || !fields.length) {
      return "*";
    }

    return fields
      .map((field) => {
        if (typeof field !== "string") {
          throw new Error("Field names must be strings.");
        }

        const aliasMatch = field.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_]*))?$/i);
        if (!aliasMatch) {
          throw new Error(`Invalid field identifier: ${field}`);
        }

        const base = this.escapeIdentifier(aliasMatch[1]);
        if (aliasMatch[2]) {
          return `${base} AS ${this.escapeIdentifier(aliasMatch[2])}`;
        }

        return base;
      })
      .join(", ");
  }

  buildOrderBy(orderBy) {
    if (Array.isArray(orderBy)) {
      return orderBy.map((entry) => this.parseOrderEntry(entry)).join(", ");
    }

    return this.parseOrderEntry(orderBy);
  }

  parseOrderEntry(entry) {
    if (typeof entry === "string") {
      const parts = entry.trim().split(/\s+/);
      const field = this.escapeIdentifier(parts[0]);
      const direction = parts[1] ? parts[1].toUpperCase() : "ASC";
      if (!["ASC", "DESC"].includes(direction)) {
        throw new Error("Invalid ORDER BY direction.");
      }
      return `${field} ${direction}`;
    }

    throw new Error("ORDER BY must be a string or string array.");
  }

  buildLimit(limit) {
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("LIMIT must be a non-negative integer.");
    }
    return value;
  }

  parseWhere(whereObj) {
    if (!whereObj || typeof whereObj !== "object" || Array.isArray(whereObj)) {
      throw new Error("WHERE clause must be an object.");
    }

    const clauses = Object.entries(whereObj).map(([key, value]) => {
      if (key === "OR" || key === "AND") {
        if (!Array.isArray(value) || !value.length) {
          throw new Error(`${key} clause must be a non-empty array.`);
        }

        const operator = ` ${key} `;
        return `(${value.map((group) => this.parseWhere(group)).join(operator)})`;
      }

      const column = this.escapeIdentifier(key);
      return this.parseCondition(column, value);
    });

    return clauses.join(" AND ");
  }

  parseCondition(column, value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value);
      if (!entries.length) {
        throw new Error("Condition operator object cannot be empty.");
      }

      return entries
        .map(([operator, operatorValue]) => this.parseOperatorCondition(column, operator, operatorValue))
        .join(" AND ");
    }

    if (value === null) {
      return `${column} IS NULL`;
    }

    this.params.push(value);
    return `${column} = ?`;
  }

  parseOperatorCondition(column, operator, value) {
    const normalized = operator.toUpperCase();

    if (normalized === "IN") {
      if (!Array.isArray(value) || !value.length) {
        throw new Error("IN operator requires a non-empty array.");
      }

      const placeholders = value.map(() => "?").join(", ");
      this.params.push(...value);
      return `${column} IN (${placeholders})`;
    }

    if (normalized === "LIKE") {
      this.params.push(value);
      return `${column} LIKE ?`;
    }

    if (["=", "!=", ">", "<", ">=", "<="].includes(normalized)) {
      this.params.push(value);
      return `${column} ${normalized} ?`;
    }

    throw new Error(`Unsupported WHERE operator: ${operator}`);
  }

  escapeIdentifier(identifier) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid SQL identifier: ${identifier}`);
    }

    return `\`${identifier}\``;
  }
}

module.exports = JsonQueryEngine;
