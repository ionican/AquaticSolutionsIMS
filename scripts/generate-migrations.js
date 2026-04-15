#!/usr/bin/env node

/**
 * Migration generator script
 * Fetches schema from Azure SQL and generates Supabase migrations
 */

const mssql = require('mssql')

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
}

const MIGRATION_TABLES = [
  'Jobs',
  'Events',
  'Ebsford_Clients',
  'Ebsford_Contacts',
  'Ebsford_job_types',
  'Ebsford_job_classes',
  'business_units',
  'Notes',
  'parameters'
]

async function generateMigrations() {
  try {
    const pool = new mssql.ConnectionPool(config)
    await pool.connect()

    const migrations = []

    for (const tableName of MIGRATION_TABLES) {
      const schemaResult = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `)

      const columns = schemaResult.recordset.map(col => {
        const pgType = mapSqlServerToPostgres(col.DATA_TYPE, col.CHARACTER_MAXIMUM_LENGTH, col.NUMERIC_PRECISION, col.NUMERIC_SCALE)
        const nullable = col.IS_NULLABLE === 'YES' ? '' : ' NOT NULL'
        return `  "${col.COLUMN_NAME}" ${pgType}${nullable}`
      }).join(',\n')

      const migration = `-- Migration: Create ${tableName} table
CREATE TABLE IF NOT EXISTS "${tableName}" (
  id BIGSERIAL PRIMARY KEY,
${columns},
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`

      migrations.push(migration)
    }

    const combined = migrations.join('\n\n')
    console.log(combined)

    await pool.close()
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

function mapSqlServerToPostgres(sqlType, maxLength, precision, scale) {
  const typeMap = {
    'int': 'INTEGER',
    'bigint': 'BIGINT',
    'smallint': 'SMALLINT',
    'tinyint': 'SMALLINT',
    'bit': 'BOOLEAN',
    'decimal': precision && scale ? `DECIMAL(${precision},${scale})` : 'DECIMAL',
    'numeric': precision && scale ? `NUMERIC(${precision},${scale})` : 'NUMERIC',
    'money': 'DECIMAL(19,4)',
    'smallmoney': 'DECIMAL(10,4)',
    'float': 'DOUBLE PRECISION',
    'real': 'REAL',
    'datetime': 'TIMESTAMP',
    'datetime2': 'TIMESTAMP',
    'smalldatetime': 'TIMESTAMP',
    'date': 'DATE',
    'time': 'TIME',
    'datetimeoffset': 'TIMESTAMPTZ',
    'char': maxLength ? `CHAR(${maxLength})` : 'CHAR(1)',
    'varchar': maxLength && maxLength > 0 ? `VARCHAR(${maxLength})` : 'TEXT',
    'text': 'TEXT',
    'nchar': maxLength ? `CHAR(${maxLength})` : 'CHAR(1)',
    'nvarchar': maxLength && maxLength > 0 ? `VARCHAR(${maxLength})` : 'TEXT',
    'ntext': 'TEXT',
    'binary': 'BYTEA',
    'varbinary': 'BYTEA',
    'image': 'BYTEA',
    'uniqueidentifier': 'UUID',
    'xml': 'XML',
  }

  return typeMap[sqlType.toLowerCase()] || 'TEXT'
}

generateMigrations()
