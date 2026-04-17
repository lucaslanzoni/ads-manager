require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadRoute   = require('./routes/upload');
const analyzeRoute  = require('./routes/analyze');
const generateRoute = require('./routes/generate');
const publishRoute  = require('./routes/publish');

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));
app.use('/output', express.static(outputDir));

app.use('/api/upload',   uploadRoute);
app.use('/api/analyze',  analyzeRoute);
app.use('/api/generate', generateRoute);
app.use('/api/publish',  publishRoute);

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ads-manager backend rodando na porta ${PORT}`));
