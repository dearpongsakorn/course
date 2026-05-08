import pg from 'pg'

const { Pool } = pg
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://mycourse:mycourse_password@localhost:5432/mycourse'

export const pool = new Pool({
  connectionString: databaseUrl,
})

export const query = (text, params = []) => pool.query(text, params)
