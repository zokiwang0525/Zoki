const express = require('express');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pic',  express.static(path.join(__dirname, 'pic')));
app.use('/assets',     express.static(path.join(__dirname, '物件')));
app.use('/charvideos', express.static(path.join(__dirname, '選角動畫')));
app.use('/portraits',  express.static(path.join(__dirname, '角色頭貼')));
app.use('/uibtn',      express.static(path.join(__dirname, 'ui按鈕')));
app.use('/charsfx',    express.static(path.join(__dirname, '選角音效')));
app.use('/charsfx2',   express.static(path.join(__dirname, '角色音效')));
app.use('/scenebgm',   express.static(path.join(__dirname, '場景音效')));
app.get('/loadingsfx.mp3', (req, res) => {
    res.sendFile(path.join(__dirname, 'Loading音效.mp3'));
});
app.get('/favicon.png', (req, res) => {
    res.sendFile(path.join(__dirname, '拳擊手套.png'));
});
app.get('/punchcursor.png', (req, res) => {
    res.sendFile(path.join(__dirname, '揮拳.png'));
});

// 檔名有空格的 Action張 精靈圖 → 提供不含空格的別名 URL
app.get('/pic/Action張精靈圖.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'pic', 'Action張 精靈圖.png'));
});

// Debug tool: patch game.js constants in-place
app.post('/debug-apply', (req, res) => {
    const { fw, fh, ranges } = req.body;
    const gamePath = path.join(__dirname, 'public', 'game.js');
    let src = fs.readFileSync(gamePath, 'utf8');

    // Replace FRAME_W / FRAME_H
    src = src.replace(/const FRAME_W\s*=\s*\d+;/, `const FRAME_W   = ${fw};`);
    src = src.replace(/const FRAME_H\s*=\s*\d+;/, `const FRAME_H   = ${fh};`);

    // Replace ANIM_DEFS block
    const order = ['walk', 'punch', 'kick', 'jump', 'hit', 'specialhit', 'death', 'special'];
    const lines = order.map(name => {
        const r = ranges[name];
        const repeat = name === 'walk' ? -1 : 0;
        return `    { name: '${name}',  start: ${r.start}, end: ${r.end}, rate: 10, repeat: ${repeat >= 0 ? ' ' : ''}${repeat} },`;
    });
    const newDefs = `const ANIM_DEFS = [\n${lines.join('\n')}\n];`;
    src = src.replace(/const ANIM_DEFS = \[[\s\S]*?\];/, newDefs);

    fs.writeFileSync(gamePath, src);
    res.json({ ok: true });
});

const queue = [];   // waiting players: { id, socket }
const rooms = {};   // roomId -> { players:[id,id], chars:{} }

io.on('connection', (socket) => {
    console.log('connected:', socket.id);

    socket.on('joinQueue', () => {
        // Remove if already in queue
        const idx = queue.findIndex(p => p.id === socket.id);
        if (idx !== -1) queue.splice(idx, 1);

        if (queue.length > 0) {
            const opponent = queue.shift();
            const roomId = `room_${Date.now()}`;
            rooms[roomId] = { players: [opponent.id, socket.id], chars: {} };

            socket.join(roomId);
            opponent.socket.join(roomId);

            opponent.socket.emit('opponentFound', { roomId, playerNum: 1 });
            socket.emit('opponentFound', { roomId, playerNum: 2 });
        } else {
            queue.push({ id: socket.id, socket });
            socket.emit('waiting');
        }
    });

    socket.on('characterSelected', ({ roomId, character }) => {
        const room = rooms[roomId];
        if (!room) return;
        room.chars[socket.id] = character;
        socket.to(roomId).emit('opponentCharacter', { character });
        if (Object.keys(room.chars).length === 2) {
            io.to(roomId).emit('charsDone');   // 雙方進入場地選擇
        }
    });

    /* 場地預覽選擇（可重複更改，僅轉發給對手顯示） */
    socket.on('stageSelected', ({ roomId, stage }) => {
        const room = rooms[roomId];
        if (!room) return;
        socket.to(roomId).emit('opponentStage', { stage });
    });

    /* 場地確定：雙方都確定後才開戰，最終以 P1 的選擇 + 設定為準 */
    socket.on('stageConfirmed', ({ roomId, stage, settings }) => {
        const room = rooms[roomId];
        if (!room) return;
        room.confirmed = room.confirmed || {};
        room.confirmed[socket.id] = stage;
        room.settings = room.settings || {};
        if (settings) room.settings[socket.id] = settings;
        socket.to(roomId).emit('opponentConfirmed');
        if (Object.keys(room.confirmed).length >= 2) {
            const p1 = room.players[0];
            const finalStage    = room.confirmed[p1] || stage || 'yard';
            const finalSettings = room.settings[p1] || settings || null;
            io.to(roomId).emit('fightStart', { stage: finalStage, settings: finalSettings });
        }
    });

    /* 取消場地確定：從已確定名單移除，並通知對手 */
    socket.on('stageUnconfirmed', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        if (room.confirmed) delete room.confirmed[socket.id];
        if (room.settings)  delete room.settings[socket.id];
        socket.to(roomId).emit('opponentUnconfirmed');
    });

    socket.on('playerState', ({ roomId, state }) => {
        socket.to(roomId).emit('opponentState', state);
    });

    socket.on('playerAction', ({ roomId, action }) => {
        socket.to(roomId).emit('opponentAction', { action });
    });

    socket.on('projectileFired', ({ roomId, x, y, vx, vy, spin, textureKey, dispW, dispH }) => {
        socket.to(roomId).emit('projectileFired', { x, y, vx, vy, spin, textureKey, dispW, dispH });
    });

    socket.on('dealDamage', ({ roomId, amount, type }) => {
        socket.to(roomId).emit('takeDamage', { amount, type });
    });

    socket.on('iDied', ({ roomId }) => {
        /* 回合制：只通知對手，不刪房間（房間於斷線時清除） */
        socket.to(roomId).emit('opponentDied');
    });

    socket.on('disconnect', () => {
        const qi = queue.findIndex(p => p.id === socket.id);
        if (qi !== -1) queue.splice(qi, 1);

        for (const [roomId, room] of Object.entries(rooms)) {
            if (room.players.includes(socket.id)) {
                socket.to(roomId).emit('opponentDisconnected');
                delete rooms[roomId];
                break;
            }
        }
        console.log('disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
