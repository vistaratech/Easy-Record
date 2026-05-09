// server/routes/admin.js
// Mount this at /api/admin in your Express app:
//   app.use('/api/admin', require('./routes/admin'));
//
// Middleware assumption: `requireAuth` and `requireRole` are applied before
// these handlers. Both are included below for reference.

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); // your existing Neon/pg pool

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * requireAuth
 * Validates the session / JWT and attaches `req.user`.
 * Adjust to match your existing auth strategy.
 */
function requireAuth(req, res, next) {
  // Example for JWT in cookie — swap for your real implementation:
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthenticated' });

  try {
    const jwt = require('jsonwebtoken');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * requireRole
 * Returns a middleware that enforces a specific role.
 * Usage: requireRole('admin')
 */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// Apply auth + role check to every route in this file.
// This is the server-side RBAC complement to the frontend AdminRoute.
router.use(requireAuth, requireRole('admin'));

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
// Returns aggregate metrics: total user count.
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS "totalUsers" FROM users'
    );
    // COUNT returns a string in pg — coerce to integer.
    res.json({ totalUsers: parseInt(rows[0].totalUsers, 10) });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
// Returns the full user list for the management table.
// Never expose password hashes; select columns explicitly.
router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        username,
        email,
        role,
        created_at AS "registrationDate"
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
