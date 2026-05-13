import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import pool from './db/pool.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Database Migration/Schema Check ──
const runMigrations = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('❌ CRITICAL: DATABASE_URL is not set in environment variables.');
    return;
  }
  
  try {
    console.log('🔄 Checking database schema...');
    // Ensure 'disabled' column exists in users table
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Database schema verified: "disabled" column present.');
  } catch (err) {
    console.error('❌ Database migration error:', err.message);
  }
};

// Run migrations in background (non-blocking for serverless startup)
runMigrations();

// ── Helper ──
function genId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

async function logAction(client, businessId, action, details, meta = {}) {
  const { userName, registerName, registerId } = meta;
  const id = genId();
  try {
    await client.query(
      'INSERT INTO history (id, business_id, action, details, user_name, register_name, register_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, businessId, action, details, userName || null, registerName || null, registerId || null]
    );
  } catch (err) {
    console.error('Logging error:', err);
    // Don't throw, logging shouldn't break the main flow
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'easy-record-super-secret-jwt-key';

// ── AUTH ──
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const { rows: existing } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = genId();
    await pool.query('INSERT INTO users(id, email, name, password) VALUES($1, $2, $3, $4)', [id, email, name, hashedPassword]);
    
    // Create a default business for the new user
    const businessId = genId();
    await pool.query('INSERT INTO businesses(id, name, owner_id) VALUES($1, $2, $3)', [businessId, 'My Business', id]);
    await logAction(pool, businessId, 'Create Business', 'Initial default business created', { userName: name });

    const token = jwt.sign({ id, email, name, isAdmin: false }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id, email, name, isAdmin: false, createdAt: new Date().toISOString() } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.disabled) {
      return res.status(403).json({ error: 'This account has been disabled by an administrator' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin, createdAt: user.created_at } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auth Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    
    try {
      // Robust check: Verify user still exists and is not disabled
      const { rows } = await pool.query('SELECT id, email, is_admin, disabled FROM users WHERE id = $1', [decoded.id]);
      if (rows.length === 0) return res.status(401).json({ error: 'User no longer exists' });
      
      const user = rows[0];
      if (user.disabled) {
        return res.status(403).json({ error: 'This account has been disabled by an administrator' });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Auth middleware DB error:', dbErr);
      // Fallback: if DB is down, still allow if token is valid? 
      // Better to block or use decoded info? Usually better to block if security is priority.
      res.status(500).json({ error: 'Internal server error during authentication' });
    }
  });
};

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    if (user.disabled) {
      return res.status(403).json({ error: 'This account has been disabled' });
    }
    res.json({ id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin, canEdit: user.can_edit, canCreateRegisters: user.can_create_registers, canCreateTemplates: user.can_create_templates, createdAt: user.created_at });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Middleware — checks the database directly so newly promoted admins work without re-login
const adminOnly = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length || !rows[0].is_admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Permission check helper
async function checkRegisterPermission(userId, registerId, type = 'view') {
  const { rows: userRows } = await pool.query('SELECT is_admin, can_edit FROM users WHERE id = $1', [userId]);
  if (userRows.length === 0) return false;
  
  const user = userRows[0];
  // Admins have full access to everything
  if (user.is_admin) return true;

  // Strict permission check: only honor user_permissions table for normal users
  const { rows: perms } = await pool.query(
    'SELECT can_view, can_edit, can_download FROM user_permissions WHERE user_id = $1 AND register_id = $2',
    [userId, registerId]
  );

  if (perms.length === 0) return false;
  
  const p = perms[0];
  if (type === 'view') return p.can_view;
  if (type === 'edit') return p.can_edit;
  if (type === 'download') return p.can_download;
  return false;
}

// Shortcut helpers
const canEdit = (userId, regId) => checkRegisterPermission(userId, regId, 'edit');
const canView = (userId, regId) => checkRegisterPermission(userId, regId, 'view');
const canDownload = (userId, regId) => checkRegisterPermission(userId, regId, 'download');

// ── ADMIN ──
// Temporarily removed authenticateToken and adminOnly to allow direct access for testing
app.get('/api/admin/stats', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as "userCount" FROM users');
    res.json({ userCount: parseInt(rows[0].userCount, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/users', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name, is_admin AS "isAdmin", can_edit AS "canEdit", can_create_registers AS "canCreateRegisters", can_create_templates AS "canCreateTemplates", created_at AS "createdAt" FROM users ORDER BY created_at DESC');
    console.log(`Admin user list fetch: found ${rows.length} users`);
    res.json(rows);
  } catch (err) {
    console.error('Admin user list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/users/:userId/global-permissions', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { canCreateRegisters, canCreateTemplates } = req.body;
    
    // We update can_edit as the primary global create flag, plus the specific columns for future-proofing
    await pool.query(
      'UPDATE users SET can_edit = $1, can_create_registers = $1, can_create_templates = $2 WHERE id = $3',
      [canCreateRegisters, canCreateTemplates, userId]
    );
    
    res.json({ ok: true });
  } catch (err) {
    console.error('Update global perms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/users/:userId/permissions', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    // Get registers that belong to businesses owned by the selected user
    const { rows } = await pool.query(`
      SELECT 
        r.id AS "registerId", 
        r.name AS "registerName",
        b.name AS "businessName",
        COALESCE(p.can_view, FALSE) AS "canView",
        COALESCE(p.can_edit, FALSE) AS "canEdit",
        COALESCE(p.can_download, FALSE) AS "canDownload"
      FROM registers r
      INNER JOIN businesses b ON b.id = r.business_id
      LEFT JOIN user_permissions p ON p.register_id = r.id AND p.user_id = $1
      WHERE r.deleted_at IS NULL
      ORDER BY b.name, r.name
    `, [userId]);
    res.json(rows);
  } catch (err) {
    console.error('Permissions fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/permissions', authenticateToken, adminOnly, async (req, res) => {
  const { userId, permissions } = req.body; // permissions: [{ registerId, canView, canEdit, canDownload }, ...]
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (req.body.globalPermissions) {
      const { canEdit, isAdmin } = req.body.globalPermissions;
      
      if (canEdit !== undefined) {
        const val = !!canEdit;
        await client.query(`
          UPDATE users SET can_edit = $1, can_create_registers = $1, can_create_templates = $1 WHERE id = $2
        `, [val, userId]);
      }
      
      if (isAdmin !== undefined) {
        await client.query(`
          UPDATE users SET is_admin = $1 WHERE id = $2
        `, [!!isAdmin, userId]);
      }
    }
    for (const p of (permissions || [])) {
      await client.query(`
        INSERT INTO user_permissions (user_id, register_id, can_view, can_edit, can_download)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, register_id) DO UPDATE SET
          can_view = EXCLUDED.can_view,
          can_edit = EXCLUDED.can_edit,
          can_download = EXCLUDED.can_download
      `, [userId, p.registerId, !!p.canView, !!p.canEdit, !!p.canDownload]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Permission update error:', err);
    res.status(500).json({ error: 'Failed to update permissions' });
  } finally {
    client.release();
  }
});
// ── BUSINESSES ──
app.get('/api/businesses', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  // Check if admin
  const { rows: userRows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  const isAdmin = userRows.length > 0 && userRows[0].is_admin;

  let rows;
  if (isAdmin) {
    // Admins see all businesses
    const result = await pool.query(`SELECT id, name, owner_id AS "ownerId", created_at AS "createdAt" FROM businesses ORDER BY name`);
    rows = result.rows;
  } else {
    // Users see businesses they own OR have at least one register with view permission
    const result = await pool.query(`
      SELECT DISTINCT b.id, b.name, b.owner_id AS "ownerId", b.created_at AS "createdAt"
      FROM businesses b
      LEFT JOIN registers r ON r.business_id = b.id AND r.deleted_at IS NULL
      LEFT JOIN user_permissions p ON p.register_id = r.id AND p.user_id = $1
      WHERE b.owner_id = $1 OR p.can_view = TRUE
      ORDER BY b.name
    `, [userId]);
    rows = result.rows;
  }
  res.json(rows);
});
app.post('/api/businesses', authenticateToken, async (req, res) => {
  const id = genId();
  const { name } = req.body;
  await pool.query('INSERT INTO businesses(id,name,owner_id) VALUES($1,$2,$3)', [id, name, req.user.id]);
  await logAction(pool, id, 'Create Business', `Created business: ${name}`, { userName: req.user.name });
  res.json({ id, name, ownerId: req.user.id, createdAt: new Date().toISOString() });
});

// ── FOLDERS ──
app.get('/api/folders', authenticateToken, async (req, res) => {
  const { businessId } = req.query;
  const userId = req.user.id;
  
  // If businessId is provided, check if user has access to it
  if (businessId) {
    const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, userId]);
    if (bizCheck.length === 0 && !req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    
    const { rows } = await pool.query('SELECT id, business_id AS "businessId", name, created_at AS "createdAt" FROM folders WHERE business_id=$1', [businessId]);
    return res.json(rows);
  }

  // Otherwise, return folders from ALL businesses the user owns or has permissions in
  const { rows: folderUserRows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  const isFolderAdmin = folderUserRows.length > 0 && folderUserRows[0].is_admin;

  let folderRows;
  if (isFolderAdmin) {
    const result = await pool.query(`SELECT DISTINCT f.id, f.business_id AS "businessId", f.name, f.created_at AS "createdAt" FROM folders f ORDER BY f.name`);
    folderRows = result.rows;
  } else {
    const result = await pool.query(`
      SELECT DISTINCT f.id, f.business_id AS "businessId", f.name, f.created_at AS "createdAt"
      FROM folders f
      INNER JOIN businesses b ON b.id = f.business_id
      LEFT JOIN registers r ON r.folder_id = f.id AND r.deleted_at IS NULL
      LEFT JOIN user_permissions p ON p.register_id = r.id AND p.user_id = $1
      WHERE b.owner_id = $1 OR p.can_view = TRUE
    `, [userId]);
    folderRows = result.rows;
  }
  res.json(folderRows);
});
app.post('/api/folders', authenticateToken, async (req, res) => {
  const { businessId, name } = req.body;
  const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, req.user.id]);
  if (bizCheck.length === 0) return res.status(403).json({ error: 'Forbidden' });

  const id = genId();
  await pool.query('INSERT INTO folders(id,business_id,name) VALUES($1,$2,$3)', [id, businessId, name]);
  await logAction(pool, businessId, 'Create File', `Created file: ${name}`, { userName: req.user.name });
  res.json({ id, businessId, name, createdAt: new Date().toISOString() });
});
app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  await pool.query('UPDATE registers SET folder_id=NULL WHERE folder_id=$1', [id]);
  await pool.query('DELETE FROM folders WHERE id=$1', [id]);
  res.json({ ok: true });
});
app.patch('/api/folders/:id', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query('UPDATE folders SET name=$1 WHERE id=$2 RETURNING id, business_id AS "businessId", name, created_at AS "createdAt"', [name, req.params.id]);
  res.json(rows[0]);
});

// ── REGISTERS ──
app.get('/api/registers', authenticateToken, async (req, res) => {
  const { businessId } = req.query;
  const userId = req.user.id;

  // Check if admin or owner
  const { rows: userRows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  const isAdmin = userRows.length > 0 && userRows[0].is_admin;

  let rows;
  if (isAdmin) {
    // Admins see all registers
    const result = await pool.query(`
      SELECT DISTINCT
        r.id, r.business_id AS "businessId", r.folder_id AS "folderId", r.name, r.icon, r.icon_color AS "iconColor",
        r.category, r.template, r.created_at AS "createdAt", r.updated_at AS "updatedAt", r.entry_count AS "entryCount",
        r.last_activity AS "lastActivity", r.deleted_at AS "deletedAt", TRUE AS "hasAccess"
      FROM registers r
      WHERE ($1::bigint IS NULL OR r.business_id = $1)
        AND r.deleted_at IS NULL
      ORDER BY r.updated_at DESC
    `, [businessId || null]);
    rows = result.rows;
  } else {
    // Regular users: see registers they own (via business) OR have explicit view permission
    const result = await pool.query(`
      SELECT DISTINCT
        r.id, r.business_id AS "businessId", r.folder_id AS "folderId", r.name, r.icon, r.icon_color AS "iconColor",
        r.category, r.template, r.created_at AS "createdAt", r.updated_at AS "updatedAt", r.entry_count AS "entryCount",
        r.last_activity AS "lastActivity", r.deleted_at AS "deletedAt",
        CASE WHEN p.can_view = TRUE THEN TRUE ELSE FALSE END AS "hasAccess"
      FROM registers r
      LEFT JOIN businesses b ON b.id = r.business_id
      LEFT JOIN user_permissions p ON p.register_id = r.id AND p.user_id = $1
      WHERE ($2::bigint IS NULL OR r.business_id = $2)
        AND r.deleted_at IS NULL
        AND (b.owner_id = $1 OR p.can_view = TRUE)
      ORDER BY r.updated_at DESC
    `, [userId, businessId || null]);
    rows = result.rows;
  }

  res.json(rows);
});

app.get('/api/registers/deleted', authenticateToken, async (req, res) => {
  const { businessId } = req.query;
  const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, req.user.id]);
  if (bizCheck.length === 0) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await pool.query(`SELECT id, business_id AS "businessId", folder_id AS "folderId", name, icon, icon_color AS "iconColor",
    category, template, created_at AS "createdAt", updated_at AS "updatedAt", entry_count AS "entryCount",
    last_activity AS "lastActivity", deleted_at AS "deletedAt" FROM registers WHERE business_id=$1 AND deleted_at IS NOT NULL`, [businessId]);
  res.json(rows);
});

app.get('/api/registers/:id', authenticateToken, async (req, res) => {
  const regId = req.params.id;
  const userId = req.user.id;

  const { rows: regRows } = await pool.query(`SELECT id, business_id AS "businessId", folder_id AS "folderId", name, icon, icon_color AS "iconColor",
    category, template, columns, pages, share_link AS "shareLink", shared_with AS "sharedWith", deleted_items AS "deletedItems",
    entry_count AS "entryCount", last_activity AS "lastActivity", deleted_at AS "deletedAt",
    created_at AS "createdAt", updated_at AS "updatedAt" FROM registers WHERE id=$1`, [regId]);
  if (!regRows.length) return res.status(404).json({ error: 'Register not found' });
  const reg = regRows[0];

  // Check if admin or business owner
  const { rows: userRows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  const isAdmin = userRows.length > 0 && userRows[0].is_admin;
  const { rows: bizRows } = await pool.query('SELECT id FROM businesses WHERE id = $1 AND owner_id = $2', [reg.businessId, userId]);
  const isOwner = bizRows.length > 0;

  const { rows: perms } = await pool.query(
    'SELECT can_view, can_edit, can_download FROM user_permissions WHERE user_id = $1 AND register_id = $2',
    [userId, regId]
  );

  if (isAdmin || isOwner) {
    // Admins and owners always get full access; use explicit perms if available
    if (perms.length > 0 && !perms[0].can_view) {
      return res.status(403).json({ error: 'Forbidden: View access denied' });
    }
    reg.permissions = perms.length > 0
      ? { canView: perms[0].can_view, canEdit: perms[0].can_edit, canDownload: perms[0].can_download }
      : { canView: true, canEdit: true, canDownload: true };
  } else if (perms.length > 0) {
    const p = perms[0];
    if (!p.can_view) return res.status(403).json({ error: 'Forbidden: View access denied' });
    reg.permissions = { canView: p.can_view, canEdit: p.can_edit, canDownload: p.can_download };
  } else {
    return res.status(403).json({ error: 'Forbidden: No access record found' });
  }

  const { rows: entryRows } = await pool.query(`SELECT id, register_id AS "registerId", row_number AS "rowNumber", cells, cell_styles AS "cellStyles", page_index AS "pageIndex", created_at AS "createdAt" FROM entries WHERE register_id=$1 ORDER BY row_number`, [regId]);
  reg.entries = entryRows;

  if (!reg.pages || reg.pages.length === 0) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
  if (!reg.columns) reg.columns = [];
  res.json(reg);
});

app.post('/api/registers', authenticateToken, async (req, res) => {
  try {
    const { businessId: reqBusinessId, folderId, name, icon, iconColor, category, template, columns } = req.body;
    
    // 1. Resolve User Permissions
    const { rows: userCheck } = await pool.query('SELECT is_admin, can_edit FROM users WHERE id = $1', [req.user.id]);
    const user = userCheck[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const isAdmin = user.is_admin;
    const canCreateGlobal = user.can_edit;

    // 2. Resolve Business ID
    let businessId = Number(reqBusinessId);
    if (!businessId || isNaN(businessId)) {
      const { rows: bizRows } = await pool.query('SELECT id FROM businesses WHERE owner_id = $1 LIMIT 1', [req.user.id]);
      if (bizRows.length > 0) businessId = Number(bizRows[0].id);
    }

    if (!businessId || isNaN(businessId)) {
      return res.status(400).json({ error: 'A valid business is required to create a register.' });
    }

    // 3. Permission Check
    const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, req.user.id]);
    const isOwner = bizCheck.length > 0;

    if (!isAdmin && !isOwner && !canCreateGlobal) {
      return res.status(403).json({ error: 'Permission denied: Creation privilege required.' });
    }

    const id = genId();
    const cols = (columns || []).map((c, i) => ({ 
      id: id + i + 1, 
      registerId: id, 
      name: c.name, 
      type: c.type, 
      position: i, 
      dropdownOptions: c.dropdownOptions, 
      formula: c.formula, 
      width: c.width, 
      summary: c.summary 
    }));
    const pages = [{ id: 1, name: 'Page 1', index: 0 }];

    await pool.query(
      `INSERT INTO registers(id,business_id,folder_id,name,icon,icon_color,category,template,columns,pages,entry_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id, 
        businessId, 
        folderId ? Number(folderId) : null, 
        name, 
        icon || 'file-text', 
        iconColor || null, 
        category || 'general', 
        template || name, 
        JSON.stringify(cols), 
        JSON.stringify(pages), 
        Number(cols.length > 0 ? 10 : 0)
      ]
    );

    // Grant the creator full access by default
    await pool.query(
      'INSERT INTO user_permissions (user_id, register_id, can_view, can_edit, can_download) VALUES ($1, $2, TRUE, TRUE, TRUE)',
      [req.user.id, id]
    );

    // Create 10 default empty rows if columns exist
    if (cols.length > 0) {
      const values = [];
      const params = [];
      for (let i = 0; i < 10; i++) {
        const eId = id + 5000 + i;
        const offset = i * 6;
        values.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6})`);
        params.push(eId, id, i + 1, '{}', '{}', 0);
      }
      await pool.query(`INSERT INTO entries(id,register_id,row_number,cells,cell_styles,page_index) VALUES ${values.join(',')}`, params);
    }

    await logAction(pool, businessId, 'Create Register', `Created register: ${name}`, { registerId: id, registerName: name, userName: req.user.name });
    res.json({ id, businessId, folderId, name, icon: icon || 'file-text', iconColor, category: category || 'general', template: template || name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entryCount: cols.length > 0 ? 10 : 0 });
  } catch (err) {
    console.error('Register creation error:', err);
    res.status(500).json({ error: 'Internal server error during register creation' });
  }
});

app.delete('/api/registers/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  if (!(await canEdit(req.user.id, id))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
  await pool.query('UPDATE registers SET deleted_at=NOW() WHERE id=$1', [id]);
  res.json({ ok: true });
});

app.delete('/api/registers/:id/permanent', authenticateToken, async (req, res) => {
  const id = req.params.id;
  if (!(await canEdit(req.user.id, id))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
  await pool.query('DELETE FROM entries WHERE register_id=$1', [id]);
  await pool.query('DELETE FROM registers WHERE id=$1', [id]);
  res.json({ ok: true });
});

app.post('/api/registers/:id/restore', authenticateToken, async (req, res) => {
  const id = req.params.id;
  if (!(await canEdit(req.user.id, id))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
  await pool.query('UPDATE registers SET deleted_at=NULL WHERE id=$1', [id]);
  res.json({ ok: true });
});

app.put('/api/registers/:id', authenticateToken, async (req, res) => {
  try {
    // 1. Parse request body — CRITICAL: was referencing undefined `reg`, must use req.body
    const reg = req.body;
    const id = req.params.id === 'NaN' ? null : req.params.id;
    if (!id) return res.status(400).json({ error: 'Invalid register ID provided.' });

    // 2. Resolve or Verify Register existence and Business ID
    const { rows: existing } = await pool.query('SELECT business_id FROM registers WHERE id = $1', [id]);
    let businessId = Number(reg.businessId);
    
    // If it exists, we MUST use its existing business_id to prevent accidental migration/access bypass
    if (existing.length > 0) {
      businessId = existing[0].business_id;
    } else if (!businessId || isNaN(businessId)) {
      // For new registers, if businessId is missing, find one the user owns
      const { rows: bizRows } = await pool.query('SELECT id FROM businesses WHERE owner_id = $1 LIMIT 1', [req.user.id]);
      if (bizRows.length > 0) businessId = Number(bizRows[0].id);
    }

    if (!businessId || isNaN(businessId)) {
      return res.status(400).json({ error: 'A valid business is required to save a register.' });
    }

    // 3. Check Permissions
    const { rows: saveUserRows } = await pool.query('SELECT is_admin, can_edit FROM users WHERE id = $1', [req.user.id]);
    const saveUser = saveUserRows[0];
    const saveIsAdmin = saveUser?.is_admin;

    if (existing.length > 0) {
      // Existing register: admins/owners can always edit; others need explicit canEdit
      const { rows: bizOwner } = await pool.query('SELECT id FROM businesses WHERE id = $1 AND owner_id = $2', [businessId, req.user.id]);
      const isOwner = bizOwner.length > 0;
      if (!saveIsAdmin && !isOwner) {
        if (!(await canEdit(req.user.id, id))) {
          return res.status(403).json({ error: 'Permission denied: Edit access required' });
        }
      }
    } else {
      // New register: Check global creation permission or ownership
      const canCreateGlobal = saveUser?.can_edit;
      const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id = $1 AND owner_id = $2', [businessId, req.user.id]);
      const isOwner = bizCheck.length > 0;
      
      if (!saveIsAdmin && !isOwner && !canCreateGlobal) {
        return res.status(403).json({ error: 'Permission denied: Creation privilege required.' });
      }
      // Grant the creator full access by default for new registers
      await pool.query(
        'INSERT INTO user_permissions (user_id, register_id, can_view, can_edit, can_download) VALUES ($1, $2, TRUE, TRUE, TRUE) ON CONFLICT DO NOTHING',
        [req.user.id, id]
      );
    }

    // 4. Upsert Register
    await pool.query(`
      INSERT INTO registers(id, business_id, folder_id, name, icon, icon_color, category, template, columns, pages, share_link, shared_with, deleted_items, entry_count, updated_at)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        business_id=EXCLUDED.business_id,
        folder_id=EXCLUDED.folder_id,
        name=EXCLUDED.name,
        icon=EXCLUDED.icon,
        icon_color=EXCLUDED.icon_color,
        category=EXCLUDED.category,
        template=EXCLUDED.template,
        columns=EXCLUDED.columns,
        pages=EXCLUDED.pages,
        share_link=EXCLUDED.share_link,
        shared_with=EXCLUDED.shared_with,
        deleted_items=EXCLUDED.deleted_items,
        entry_count=EXCLUDED.entry_count,
        updated_at=NOW()
    `, [
      id,
      businessId,
      reg.folderId ? Number(reg.folderId) : null,
      reg.name || reg.title || 'Untitled Register',
      reg.icon || 'file-text',
      reg.iconColor || null,
      reg.category || 'general',
      reg.template || reg.name || reg.title || 'General',
      JSON.stringify(reg.columns || []),
      JSON.stringify(reg.pages || [{id:1, name:'Page 1', index:0}]),
      reg.shareLink || null,
      JSON.stringify(reg.sharedWith || []),
      JSON.stringify(reg.deletedItems || []),
      Number(reg.entryCount) || (reg.entries ? reg.entries.length : 0)
    ]);

    // 5. Upsert Entries (if provided)
    if (reg.entries) {
      await pool.query('DELETE FROM entries WHERE register_id=$1', [id]);
      const chunkSize = 1000;
      for (let i = 0; i < reg.entries.length; i += chunkSize) {
        const chunk = reg.entries.slice(i, i + chunkSize);
        const cValues = [];
        const cParams = [];
        for (let j = 0; j < chunk.length; j++) {
          const e = chunk[j];
          const entryId = e.id ? Number(e.id) : genId();
          const offset = j * 6;
          cValues.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6})`);
          cParams.push(
            entryId,
            id,
            Number(e.rowNumber || (i + j + 1)),
            JSON.stringify(e.cells || {}),
            JSON.stringify(e.cellStyles || {}),
            Number(e.pageIndex) || 0
          );
        }
        await pool.query(`INSERT INTO entries(id,register_id,row_number,cells,cell_styles,page_index) 
                         VALUES ${cValues.join(',')}
                         ON CONFLICT (id) DO UPDATE SET
                           register_id = EXCLUDED.register_id,
                           row_number = EXCLUDED.row_number,
                           cells = EXCLUDED.cells,
                           cell_styles = EXCLUDED.cell_styles,
                           page_index = EXCLUDED.page_index`, cParams);
      }
    }

    await logAction(pool, businessId, 'Update Register', `Updated register: ${reg.name || id}`, { registerId: id });
    res.json({ ok: true });
  } catch (err) {
    console.error('Register save error:', err);
    res.status(500).json({ error: 'Internal server error during register save' });
  }
});

app.patch('/api/registers/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  if (!(await canEdit(req.user.id, id))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
  const updates = req.body;
  const sets = [];
  const params = [];
  let idx = 1;
  if (updates.name !== undefined) { sets.push(`name=$${idx++}`); params.push(updates.name); }
  if (updates.folderId !== undefined) { sets.push(`folder_id=$${idx++}`); params.push(updates.folderId); }
  if (updates.columns !== undefined) { sets.push(`columns=$${idx++}`); params.push(JSON.stringify(updates.columns)); }
  if (updates.pages !== undefined) { sets.push(`pages=$${idx++}`); params.push(JSON.stringify(updates.pages)); }
  if (updates.sharedWith !== undefined) { sets.push(`shared_with=$${idx++}`); params.push(JSON.stringify(updates.sharedWith)); }
  if (updates.shareLink !== undefined) { sets.push(`share_link=$${idx++}`); params.push(updates.shareLink); }
  if (updates.deletedItems !== undefined) { sets.push(`deleted_items=$${idx++}`); params.push(JSON.stringify(updates.deletedItems)); }
  if (updates.entryCount !== undefined) { sets.push(`entry_count=$${idx++}`); params.push(updates.entryCount); }
  sets.push(`updated_at=NOW()`);
  params.push(req.params.id);
  await pool.query(`UPDATE registers SET ${sets.join(',')} WHERE id=$${idx}`, params);
  // Return full register
  const { rows } = await pool.query(`SELECT id, business_id AS "businessId", folder_id AS "folderId", name, icon, icon_color AS "iconColor", category, template, columns, pages, share_link AS "shareLink", shared_with AS "sharedWith", deleted_items AS "deletedItems", entry_count AS "entryCount", created_at AS "createdAt", updated_at AS "updatedAt" FROM registers WHERE id=$1`, [req.params.id]);
  const reg = rows[0];
  const { rows: entryRows } = await pool.query(`SELECT id, register_id AS "registerId", row_number AS "rowNumber", cells, cell_styles AS "cellStyles", page_index AS "pageIndex", created_at AS "createdAt" FROM entries WHERE register_id=$1 ORDER BY row_number`, [req.params.id]);
  reg.entries = entryRows;
  res.json(reg);
});

app.post('/api/registers/:id/duplicate', authenticateToken, async (req, res) => {
  const origId = req.params.id;
  if (!(await canEdit(req.user.id, origId))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
  const { rows: regRows } = await pool.query('SELECT * FROM registers WHERE id=$1', [origId]);
  if (!regRows.length) return res.status(404).json({ error: 'Not found' });
  const orig = regRows[0];
  const newId = genId();
  const newCols = (orig.columns || []).map((c, i) => ({ ...c, id: newId + i + 1, registerId: newId }));
  await pool.query(`INSERT INTO registers(id,business_id,folder_id,name,icon,icon_color,category,template,columns,pages,entry_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [newId, orig.business_id, orig.folder_id, orig.name + ' (Copy)', orig.icon, orig.icon_color, orig.category, orig.template, JSON.stringify(newCols), JSON.stringify(orig.pages), orig.entry_count]);
  // Copy entries
  const { rows: entries } = await pool.query('SELECT * FROM entries WHERE register_id=$1 ORDER BY row_number', [origId]);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await pool.query('INSERT INTO entries(id,register_id,row_number,cells,cell_styles,page_index) VALUES($1,$2,$3,$4,$5,$6)',
      [newId + 1000 + i, newId, e.row_number, JSON.stringify(e.cells), JSON.stringify(e.cell_styles || {}), e.page_index]);
  }
  res.json({ id: newId, businessId: orig.business_id, name: orig.name + ' (Copy)', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entryCount: orig.entry_count });
});

// ── ENTRIES ──
app.post('/api/registers/:regId/entries', authenticateToken, async (req, res) => {
  const regId = req.params.regId;
  const canEdit = await checkRegisterPermission(req.user.id, regId, 'edit');
  if (!canEdit) return res.status(403).json({ error: 'Permission denied: Edit access required' });

  const { cells, pageIndex, atIndex } = req.body;
  const id = genId();
  const { rows: maxRows } = await pool.query('SELECT COALESCE(MAX(row_number),0) AS max FROM entries WHERE register_id=$1 AND page_index=$2', [regId, pageIndex || 0]);
  const rowNumber = (maxRows[0]?.max || 0) + 1;
  await pool.query('INSERT INTO entries(id,register_id,row_number,cells,page_index) VALUES($1,$2,$3,$4,$5)', [id, regId, rowNumber, JSON.stringify(cells || {}), pageIndex || 0]);
  await pool.query('UPDATE registers SET entry_count=entry_count+1, updated_at=NOW() WHERE id=$1', [regId]);
  res.json({ id, registerId: Number(regId), rowNumber, cells: cells || {}, createdAt: new Date().toISOString(), pageIndex: pageIndex || 0 });
});

app.patch('/api/entries/:id', authenticateToken, async (req, res) => {
  const { rows: entryData } = await pool.query('SELECT register_id FROM entries WHERE id=$1', [req.params.id]);
  if (!entryData.length) return res.status(404).json({ error: 'Entry not found' });
  const regId = entryData[0].register_id;

  const canEdit = await checkRegisterPermission(req.user.id, regId, 'edit');
  if (!canEdit) return res.status(403).json({ error: 'Permission denied: Edit access required' });

  const { cells } = req.body;
  const { rows: existing } = await pool.query('SELECT cells FROM entries WHERE id=$1', [req.params.id]);
  const merged = { ...existing[0].cells, ...cells };
  await pool.query('UPDATE entries SET cells=$1 WHERE id=$2', [JSON.stringify(merged), req.params.id]);
  await pool.query('UPDATE registers SET updated_at=NOW() WHERE id=$1', [regId]);
  res.json({ id: Number(req.params.id), cells: merged });
});

app.patch('/api/entries/:id/styles', authenticateToken, async (req, res) => {
  const { rows: entryData } = await pool.query('SELECT register_id FROM entries WHERE id=$1', [req.params.id]);
  if (!entryData.length) return res.status(404).json({ error: 'Entry not found' });
  const regId = entryData[0].register_id;
  if (!(await canEdit(req.user.id, regId))) return res.status(403).json({ error: 'Permission denied: Edit access required' });

  const { cellStyles } = req.body;
  const { rows: existing } = await pool.query('SELECT cell_styles FROM entries WHERE id=$1', [req.params.id]);
  const merged = { ...(existing[0].cell_styles || {}), ...cellStyles };
  await pool.query('UPDATE entries SET cell_styles=$1 WHERE id=$2', [JSON.stringify(merged), req.params.id]);
  res.json({ id: Number(req.params.id), cellStyles: merged });
});

app.delete('/api/entries/:id', authenticateToken, async (req, res) => {
  const { rows } = await pool.query('SELECT register_id FROM entries WHERE id=$1', [req.params.id]);
  if (rows.length) {
    const regId = rows[0].register_id;
    if (!(await canEdit(req.user.id, regId))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
    await pool.query('DELETE FROM entries WHERE id=$1', [req.params.id]);
    await pool.query('UPDATE registers SET entry_count=GREATEST(entry_count-1,0), updated_at=NOW() WHERE id=$1', [regId]);
  }
  res.json({ ok: true });
});

app.post('/api/registers/:regId/entries/bulk-delete', authenticateToken, async (req, res) => {
  const regId = req.params.regId;
  if (!(await canEdit(req.user.id, regId))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
  const { entryIds } = req.body;
  if (entryIds?.length) {
    const placeholders = entryIds.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(`DELETE FROM entries WHERE id IN (${placeholders})`, entryIds);
    await pool.query('UPDATE registers SET entry_count=(SELECT COUNT(*) FROM entries WHERE register_id=$1), updated_at=NOW() WHERE id=$1', [regId]);
  }
  res.json({ ok: true });
});

app.post('/api/registers/:regId/entries/reorder', authenticateToken, async (req, res) => {
  const regId = req.params.regId;
  if (!(await canEdit(req.user.id, regId))) return res.status(403).json({ error: 'Permission denied: Edit access required' });
  const { entries } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of entries) {
      await client.query('UPDATE entries SET row_number=$1, cells=$2, page_index=$3, cell_styles=$4 WHERE id=$5',
        [e.rowNumber, JSON.stringify(e.cells || {}), e.pageIndex || 0, JSON.stringify(e.cellStyles || {}), e.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.json({ ok: true });
});

// ── HISTORY ──
app.get('/api/history', authenticateToken, async (req, res) => {
  const { businessId } = req.query;
  const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, req.user.id]);
  if (bizCheck.length === 0) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await pool.query(`SELECT id, business_id AS "businessId", action, details, user_name AS "userName", register_name AS "registerName", register_id AS "registerId", timestamp FROM history WHERE business_id=$1 ORDER BY timestamp DESC LIMIT 200`, [businessId]);
  res.json(rows);
});

// ── SEARCH ──
app.get('/api/search', authenticateToken, async (req, res) => {
  const { businessId, q } = req.query;
  const userId = req.user.id;
  if (!q) return res.json([]);

  const term = `%${q}%`;
  // Search register names
  const { rows: regMatches } = await pool.query(`
    SELECT r.id AS "registerId", r.name AS "registerName", r.folder_id AS "folderId" 
    FROM registers r
    INNER JOIN user_permissions p ON p.register_id = r.id AND p.user_id = $1
    WHERE ($3::bigint IS NULL OR r.business_id = $3) 
      AND r.deleted_at IS NULL 
      AND r.name ILIKE $2 
      AND p.can_view = TRUE
    LIMIT 20
  `, [userId, term, businessId || null]);

  // Search entry cells (JSONB text search)
  const { rows: entryMatches } = await pool.query(`
    SELECT e.id AS "entryId", e.register_id AS "registerId", r.name AS "registerName", r.folder_id AS "folderId", e.row_number AS "rowNumber", e.page_index AS "pageIndex", e.cells 
    FROM entries e 
    JOIN registers r ON r.id=e.register_id 
    INNER JOIN user_permissions p ON p.register_id = r.id AND p.user_id = $1
    WHERE ($3::bigint IS NULL OR r.business_id = $3) 
      AND r.deleted_at IS NULL 
      AND e.cells::text ILIKE $2 
      AND p.can_view = TRUE
    LIMIT 50
  `, [userId, term, businessId || null]);
  const results = [
    ...regMatches.map(r => ({ ...r, entryId: -1, rowNumber: -1, matchedText: r.registerName })),
    ...entryMatches.map(e => {
      let matchedText = '';
      for (const v of Object.values(e.cells || {})) {
        if (String(v).toLowerCase().includes(String(q).toLowerCase())) { matchedText = String(v); break; }
      }
      return { registerId: e.registerId, registerName: e.registerName, folderId: e.folderId, entryId: e.entryId, rowNumber: e.rowNumber, matchedText, pageIndex: e.pageIndex };
    })
  ];
  res.json(results);
});

// ── BACKUPS ──
app.get('/api/backups', authenticateToken, async (req, res) => {
  const { businessId } = req.query;
  const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, req.user.id]);
  if (bizCheck.length === 0) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await pool.query(`SELECT id, business_id AS "businessId", created_at AS "createdAt", label, register_count AS "registerCount", folder_count AS "folderCount", total_entries AS "totalEntries", size_kb AS "sizeKb" FROM backups WHERE business_id=$1 ORDER BY created_at DESC`, [businessId]);
  res.json(rows);
});

app.post('/api/backups', authenticateToken, async (req, res) => {
  const { businessId, label } = req.body;
  const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, req.user.id]);
  if (bizCheck.length === 0) return res.status(403).json({ error: 'Forbidden' });

  const id = `backup_${Date.now()}`;
  // Gather all data
  const { rows: regs } = await pool.query('SELECT * FROM registers WHERE business_id=$1', [businessId]);
  const { rows: folders } = await pool.query('SELECT * FROM folders WHERE business_id=$1', [businessId]);
  const allEntries = {};
  for (const r of regs) {
    const { rows: entries } = await pool.query('SELECT * FROM entries WHERE register_id=$1', [r.id]);
    allEntries[r.id] = entries;
  }
  const data = { registers: regs, folders, entries: allEntries };
  const totalEntries = Object.values(allEntries).reduce((s, arr) => s + arr.length, 0);
  const sizeKb = Math.round(JSON.stringify(data).length / 1024);
  const now = new Date();
  const backupLabel = label || `Backup ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  await pool.query('INSERT INTO backups(id,business_id,label,register_count,folder_count,total_entries,size_kb,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, businessId, backupLabel, regs.length, folders.length, totalEntries, sizeKb, JSON.stringify(data)]);
  res.json({ id, businessId, createdAt: now.toISOString(), label: backupLabel, registerCount: regs.length, folderCount: folders.length, totalEntries, sizeKb });
});

app.delete('/api/backups/:id', authenticateToken, async (req, res) => {
  const { rows } = await pool.query('SELECT business_id FROM backups WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Backup not found' });
  
  const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [rows[0].business_id, req.user.id]);
  if (bizCheck.length === 0 && !req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });

  await pool.query('DELETE FROM backups WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/backups/:id/restore', authenticateToken, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM backups WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Backup not found' });
  const backup = rows[0];
  const businessId = backup.business_id;

  const { rows: bizCheck } = await pool.query('SELECT id FROM businesses WHERE id=$1 AND owner_id=$2', [businessId, req.user.id]);
  if (bizCheck.length === 0 && !req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const data = backup.data;
  // Delete existing data
  await pool.query('DELETE FROM entries WHERE register_id IN (SELECT id FROM registers WHERE business_id=$1)', [businessId]);
  await pool.query('DELETE FROM registers WHERE business_id=$1', [businessId]);
  await pool.query('DELETE FROM folders WHERE business_id=$1', [businessId]);
  // Restore
  for (const f of data.folders || []) {
    await pool.query('INSERT INTO folders(id,business_id,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [f.id, businessId, f.name]);
  }
  for (const r of data.registers || []) {
    await pool.query(`INSERT INTO registers(id,business_id,folder_id,name,icon,icon_color,category,template,columns,pages,entry_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [r.id, businessId, r.folder_id, r.name, r.icon, r.icon_color, r.category, r.template, JSON.stringify(r.columns), JSON.stringify(r.pages), r.entry_count]);
    const entries = data.entries?.[r.id] || [];
    for (const e of entries) {
      await pool.query('INSERT INTO entries(id,register_id,row_number,cells,cell_styles,page_index) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [e.id, r.id, e.row_number, JSON.stringify(e.cells), JSON.stringify(e.cell_styles || {}), e.page_index]);
    }
  }
  res.json({ ok: true });
});

// ── ADMIN USER MANAGEMENT ──
// Fully delete a user — removes credentials, permissions, registers, and businesses
app.delete('/api/admin/users/:userId', authenticateToken, adminOnly, async (req, res) => {
  const { userId } = req.params;
  const client = await pool.connect();
  try {
    // Prevent self-deletion
    if (String(req.user.id) === String(userId)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    await client.query('BEGIN');

    // 1. Delete all entries belonging to registers owned by this user
    await client.query(`
      DELETE FROM entries
      WHERE register_id IN (
        SELECT r.id FROM registers r
        INNER JOIN businesses b ON b.id = r.business_id
        WHERE b.owner_id = $1
      )
    `, [userId]);

    // 2. Delete all registers owned by this user's businesses
    await client.query(`
      DELETE FROM registers
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = $1)
    `, [userId]);

    // 3. Delete folders
    await client.query(`
      DELETE FROM folders
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = $1)
    `, [userId]);

    // 4. Delete businesses
    await client.query('DELETE FROM businesses WHERE owner_id = $1', [userId]);

    // 5. Delete user_permissions (where this user had access to other registers)
    await client.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

    // 6. Delete backups
    await client.query(`
      DELETE FROM backups
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = $1)
    `, [userId]);

    // 7. Finally delete the user account
    const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [userId]);
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query('COMMIT');
    console.log(`Admin ${req.user.id} deleted user ${userId}`);
    
    // Log the deletion (using the admin's business context if available)
    // Note: Since the user is deleted, we just log the action globally
    await logAction(pool, 1, 'Admin Action', `Deleted user ID: ${userId}`, { userName: `Admin ${req.user.name}` });
    
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// Reset a user's password (admin sets a temporary password)
app.post('/api/admin/users/:userId/reset-password', authenticateToken, adminOnly, async (req, res) => {
  const { userId } = req.params;
  const tempPassword = Math.random().toString(36).slice(-8);
  try {
    const hashed = await bcrypt.hash(tempPassword, 10);
    const { rowCount } = await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    
    await logAction(pool, 1, 'Admin Action', `Reset password for user ID: ${userId}`, { userName: `Admin ${req.user.name}` });
    
    res.json({ ok: true, tempPassword }); // In production, send via email instead
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Enable or disable a user account
app.put('/api/admin/users/:userId/status', authenticateToken, adminOnly, async (req, res) => {
  const { userId } = req.params;
  const { isDisabled } = req.body;
  try {
    // Requires a `disabled` column — add with: ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;
    await pool.query('UPDATE users SET disabled = $1 WHERE id = $2', [!!isDisabled, userId]);
    
    await logAction(pool, 1, 'Admin Action', `${isDisabled ? 'Disabled' : 'Enabled'} user ID: ${userId}`, { userName: `Admin ${req.user.name}` });
    
    res.json({ ok: true });
  } catch (err) {
    // Column may not exist yet — gracefully handle
    console.error('Status update error (column may be missing):', err.message);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// ── HEALTH ──
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));


// ── GLOBAL ERROR HANDLER ──
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`🚀 Easy Record server running on port ${PORT}`));
}

export default app;
