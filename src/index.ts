import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import {Button, Key, keyboard, mouse, Point} from '@nut-tree-fork/nut-js';
import { readFileSync, writeFileSync } from 'fs';
import { keymap } from './keymap';
import robot from 'robotjs';

keyboard.config.autoDelayMs = 0;
mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 1000;
robot.setMouseDelay(0);

const app = express();
const http = createServer(app);
const io = new Server(http);

const PORT = 3000;
const rootDir = path.resolve(__dirname, '..');

app.use(express.static(path.join(rootDir, 'public')));

app.get('/', (req, res) => {res.sendFile(path.join(rootDir, 'public', 'index.html'));});
const setRoute = (route:string) => app.get(`/${route}`,(req, res) => {res.sendFile(path.join(rootDir, 'public', `${route}.html`))})

setRoute('mouse');
setRoute('editor');
setRoute('game');
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

const sensivility = 30;
const main = async () => {
    let mousePos = await mouse.getPosition();
    
    io.on('connection', (socket) => {
        console.log('a user connected');
        socket.on('log', (...args:any[]) => {
            console.log('[Client]', ...args);
        })
        socket.on('buttonPress', (data) => {
            keyboard.pressKey(keymap[data.key]);
        });
        socket.on('buttonRelease', (data) => {
            keyboard.releaseKey(keymap[data.key]);
        });
        socket.on('joystickMove', async (data) => {
            const x = Math.cos(data.angle) * data.distance * 10;
            const y = Math.sin(data.angle) * data.distance * 10;
            const mousePos = await mouse.getPosition();
            mouse.setPosition(new Point(mousePos.x + x, mousePos.y + y));
        });
        socket.on('mouseZoneMove', async (data) => {
            const mousePos = await mouse.getPosition();
            mouse.setPosition(new Point(mousePos.x + data.deltaX, mousePos.y + data.deltaY));
        });
        socket.on('mouseZoneClick', async (data) => {
            if (data.button === 'left') {
                mouse.click(Button.LEFT);
            } else if (data.button === 'right') {
                mouse.click(Button.RIGHT);
            }
        });
        socket.on('mouseMove', async (data) => {
            const mouseCurPos = robot.getMousePos();
            const x = Math.round(data.x * sensivility);
            const y = Math.round(data.y * sensivility);
            robot.moveMouse(mouseCurPos.x + x, mouseCurPos.y + y);
            // mouse.setPosition(new Point(mouseCurPos.x + x, mouseCurPos.y + y));
            // mouse.move([
            //     mousePos,
            //     new Point(mousePos.x + x, mousePos.y + y)
            // ])
            // mousePos = new Point(mousePos.x + x, mousePos.y + y);
        })
        socket.on('mousePress', (data) => {
            if (data.button === 'left') {
                mouse.pressButton(Button.LEFT);
            } else if (data.button === 'right') {
                mouse.pressButton(Button.RIGHT);
            }
        });
        socket.on('mouseRelease', (data) => {
            if (data.button === 'left') {
                mouse.releaseButton(Button.LEFT);
            } else if (data.button === 'right') {
                mouse.releaseButton(Button.RIGHT);
            }
        });
        socket.on('mouseScroll', (data) => {
            mouse.scrollDown(data.deltaY);
            mouse.scrollRight(data.deltaX);
        });
        socket.on('disconnect', () => {
            console.log('user disconnected');
        });
    });
}
main()


http.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
    console.log(`you can access editor at http://localhost:${PORT}/editor`);
});