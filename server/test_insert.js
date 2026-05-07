import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({connectionString: process.env.DATABASE_URL});
(async () => {
  try {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const cols = [{name: 'Col 1', type: 'text'}].map((c, i) => ({ id: id + i + 1, registerId: id, name: c.name, type: c.type, position: i, dropdownOptions: c.dropdownOptions, formula: c.formula, width: c.width, summary: c.summary }));
    const pages = [{ id: 1, name: 'Page 1', index: 0 }];
    
    await pool.query('INSERT INTO registers(id,business_id,folder_id,name,icon,icon_color,category,template,columns,pages,entry_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id, '1778121542415', null, 'Test Reg', 'file-text', null, 'general', 'Test Reg', JSON.stringify(cols), JSON.stringify(pages), cols.length > 0 ? 10 : 0]);
      
    const values = [];
    const params = [];
    for (let i = 0; i < 10; i++) {
      const eId = id + 5000 + i;
      const offset = i * 5;
      values.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5})`);
      params.push(eId, id, i + 1, '{}', 0);
    }
    await pool.query(`INSERT INTO entries(id,register_id,row_number,cells,page_index) VALUES ${values.join(',')}`, params);
    
    console.log('Success!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
