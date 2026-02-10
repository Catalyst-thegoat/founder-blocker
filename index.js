const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'blocks.json');

function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return { blocks: [] }; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

app.use(express.json());
app.use(express.static('public'));

app.post('/api/block', (req, res) => {
    const { owner, target, message } = req.body;
    if (!owner || !target || !message) return res.status(400).json({ error: 'owner, target, message required' });
    
    const db = loadDB();
    const userBlocks = db.blocks.filter(b => b.owner === owner && !b.resolved).length;
    if (userBlocks >= 5) return res.status(403).json({ error: 'Free limit reached' });
    
    const block = { id: crypto.randomBytes(4).toString('hex'), owner, target, message, created: new Date().toISOString(), resolved: false };
    db.blocks.push(block);
    saveDB(db);
    
    res.json({ success: true, block, remaining: 5 - userBlocks - 1 });
});

app.get('/api/blocks', (req, res) => {
    const db = loadDB();
    const now = new Date();
    const blocks = db.blocks.filter(b => !b.resolved).map(b => ({
        ...b, age: Math.round((now - new Date(b.created)) / (1000 * 60 * 60)), overdue: (now - new Date(b.created)) > 48 * 60 * 60 * 1000
    }));
    res.json({ blocks, count: blocks.length, overdue: blocks.filter(b => b.overdue).length });
});

app.post('/api/resolve', (req, res) => {
    const { id } = req.body;
    const db = loadDB();
    const block = db.blocks.find(b => b.id === id);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    block.resolved = true;
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    const db = loadDB();
    const active = db.blocks.filter(b => !b.resolved);
    res.json({ total: db.blocks.length, active: active.length, overdue: active.filter(b => new Date(b.created) < new Date(Date.now() - 48*60*60*1000)).length, resolved: db.blocks.length - active.length });
});

app.listen(PORT, () => { console.log('Founder Blocker v4 on port ' + PORT); });
