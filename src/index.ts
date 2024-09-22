import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import {Key, keyboard, mouse} from '@nut-tree-fork/nut-js';
import { readFileSync, writeFileSync } from 'fs';

keyboard.config.autoDelayMs = 0;
mouse.config.autoDelayMs = 0;

const app = express();
const http = createServer(app);
const io = new Server(http);

const PORT = 3000;
const rootDir = path.resolve(__dirname, '..');

app.use(express.static(path.join(rootDir, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'index.html'));
});
app.get('/editor', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'editor.html'));
});
app.post('/api/update', (req, res) => {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString();
    });
    req.on('end', () => {
        writeFileSync(path.join(rootDir, 'public', 'save.json'), body);
        res.end();
    });
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

http.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});