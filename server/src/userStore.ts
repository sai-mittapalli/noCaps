import bcrypt from 'bcryptjs';
import pool from './db';

export type UserRole = 'host' | 'viewer';

export interface UserDTO {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  display_name: string;
}

function toDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    displayName: row.display_name,
  };
}

export async function registerUser(data: {
  email: string;
  password: string;
  role: UserRole;
  displayName: string;
}): Promise<UserDTO> {
  const passwordHash = await bcrypt.hash(data.password, 10);
  try {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.email.toLowerCase(), passwordHash, data.role, data.displayName.trim()]
    );
    return toDTO(rows[0]);
  } catch (err: unknown) {
    // Postgres unique_violation code
    if ((err as { code?: string }).code === '23505') {
      throw new Error('email already registered');
    }
    throw err;
  }
}

export async function loginUser(email: string, password: string): Promise<UserDTO> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  // Use the same error message whether email is missing or password is wrong
  if (rows.length === 0) throw new Error('invalid credentials');
  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) throw new Error('invalid credentials');
  return toDTO(rows[0]);
}

export async function getUserById(id: string): Promise<UserDTO | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return rows.length > 0 ? toDTO(rows[0]) : null;
}
