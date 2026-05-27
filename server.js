const express = require('express');
const path = require('path');
const { pool, init } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  try {
    const [entRes, holRes, comRes] = await Promise.all([
      pool.query('SELECT person, total_days FROM entitlements WHERE year = $1', [year]),
      pool.query('SELECT id, person, date, name, is_public FROM holidays WHERE year = $1 ORDER BY date ASC', [year]),
      pool.query('SELECT person, content FROM comments WHERE year = $1', [year]),
    ]);
    res.json({ entitlements: entRes.rows, holidays: holRes.rows, comments: comRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entitlements', async (req, res) => {
  const { person, year, total_days } = req.body;
  try {
    await pool.query(`
      INSERT INTO entitlements (person, year, total_days)
      VALUES ($1, $2, $3)
      ON CONFLICT (person, year) DO UPDATE SET total_days = EXCLUDED.total_days
    `, [person, year, total_days]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/holidays', async (req, res) => {
  const { person, year, date, name, is_public } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO holidays (person, year, date, name, is_public)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [person, year, date, name, is_public]);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'A holiday already exists for this person on this date' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/holidays/range', async (req, res) => {
  const { person, year, start_date, end_date, name, is_public } = req.body;
  const startYear = parseInt(start_date.split('-')[0]);
  const endYear   = parseInt(end_date.split('-')[0]);
  if (startYear !== endYear || startYear !== year) {
    return res.status(400).json({ error: 'Date range must be within a single year' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'End date must be on or after start date' });
  }
  try {
    const dates = [];
    const cur = new Date(start_date + 'T00:00:00');
    const end = new Date(end_date + 'T00:00:00');
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    let inserted = 0;
    for (const date of dates) {
      const r = await pool.query(
        `INSERT INTO holidays (person, year, date, name, is_public)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (person, date) DO NOTHING`,
        [person, year, date, name, is_public]
      );
      if (r.rowCount > 0) inserted++;
    }
    const skipped = dates.length - inserted;
    res.json({ success: true, inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments', async (req, res) => {
  const { person, year, content } = req.body;
  try {
    await pool.query(
      `INSERT INTO comments (person, year, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (person, year) DO UPDATE SET content = EXCLUDED.content`,
      [person, year, content]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/holidays/:id', async (req, res) => {
  const { name, is_public } = req.body;
  try {
    await pool.query('UPDATE holidays SET name = $1, is_public = $2 WHERE id = $3', [name, is_public, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/holidays/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM holidays WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => app.listen(PORT, () => console.log(`Holiday Calendar running at http://localhost:${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
