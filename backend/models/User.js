import bcrypt from 'bcryptjs';
import { database } from '../config/database.js';

export class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.role = data.role || 'user';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async findById(id) {
    try {
      const userData = await database.get(
        'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      
      return userData ? new User(userData) : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async findByUsername(username) {
    try {
      const userData = await database.get(
        'SELECT id, username, email, role, created_at, updated_at FROM users WHERE username = ?',
        [username]
      );
      
      return userData ? new User(userData) : null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  static async findByUsernameWithPassword(username) {
    try {
      const userData = await database.get(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      
      return userData || null;
    } catch (error) {
      console.error('Error finding user with password:', error);
      throw error;
    }
  }

  static async create(userData) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
      
      const result = await database.run(
        'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
        [userData.username, hashedPassword, userData.email || null, userData.role || 'user']
      );

      if (result.id) {
        return await User.findById(result.id);
      }
      
      throw new Error('Failed to create user');
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async validatePassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  }

  static async updatePassword(userId, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
      
      const result = await database.run(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, userId]
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  static async update(userId, updateData) {
    try {
      const allowedFields = ['username', 'email', 'role'];
      const updates = [];
      const values = [];

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(userId);
      
      const result = await database.run(
        `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      if (result.changes > 0) {
        return await User.findById(userId);
      }
      
      return null;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  static async delete(userId) {
    try {
      const result = await database.run('DELETE FROM users WHERE id = ?', [userId]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  static async list(options = {}) {
    try {
      const { page = 1, limit = 10, sort = 'created_at', order = 'desc' } = options;
      const offset = (page - 1) * limit;

      const users = await database.all(
        `SELECT id, username, email, role, created_at, updated_at 
         FROM users 
         ORDER BY ${sort} ${order.toUpperCase()} 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const total = await database.get('SELECT COUNT(*) as count FROM users');

      return {
        users: users.map(user => new User(user)),
        pagination: {
          page,
          limit,
          total: total.count,
          pages: Math.ceil(total.count / limit)
        }
      };
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  }

  static async exists(username, email = null) {
    try {
      let query = 'SELECT id FROM users WHERE username = ?';
      let params = [username];

      if (email) {
        query += ' OR email = ?';
        params.push(email);
      }

      const user = await database.get(query, params);
      return !!user;
    } catch (error) {
      console.error('Error checking user existence:', error);
      throw error;
    }
  }

  static async getStats() {
    try {
      const stats = await database.get(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
          COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as new_users_30d
        FROM users
      `);

      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Instance methods
  async updateLastLogin() {
    try {
      await database.run(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [this.id]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  async getContainers() {
    try {
      const containers = await database.all(
        'SELECT * FROM containers WHERE created_by = ? ORDER BY created_at DESC',
        [this.id]
      );

      return containers;
    } catch (error) {
      console.error('Error getting user containers:', error);
      throw error;
    }
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

export default User;
