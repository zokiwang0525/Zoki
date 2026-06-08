/* ── Constants ── */
const GAME_W    = 960;
const GAME_H    = 540;
const FLOOR_Y   = 470;
const SCALE     = 0.50;
const FRAME_W   = 456;
const FRAME_H   = 456;
const MOVE_SPD  = 280;
const JUMP_VEL  = -720;
const GRAVITY   = 1500;

/* ── 可在「設定」畫面調整的對戰數值 ── */
const GAME_SETTINGS = {
    maxHP:      200,   /* 最大生命值 */
    punchDmg:   8,     /* 出拳傷害 */
    kickDmg:    15,    /* 踢腳傷害 */
    specialDmg: 30,    /* 大招傷害 */
    spRegen:    1.5,   /* 能量每秒回充 */
};
const GAME_SETTINGS_DEFAULT = { ...GAME_SETTINGS };   /* 供重置用 */

/* 從 localStorage 載入上次的設定（若有） */
try {
    const saved = JSON.parse(localStorage.getItem('ickomb_settings') || '{}');
    for (const k of Object.keys(GAME_SETTINGS)) {
        if (typeof saved[k] === 'number') GAME_SETTINGS[k] = saved[k];
    }
} catch (e) { /* 忽略損壞的存檔 */ }

function saveSettings() {
    try { localStorage.setItem('ickomb_settings', JSON.stringify(GAME_SETTINGS)); } catch (e) {}
}

const CHAR_LIST = ['皇', '瓜張', '聾', 'Action張'];

/* 角色頭貼 */
const CHAR_PORTRAITS = {
    '皇':       'portraits/皇大頭.PNG',
    '瓜張':     'portraits/瓜張大頭.PNG',
    '聾':       'portraits/聾大頭.PNG',
    'Action張': 'portraits/Action張大頭.PNG',
};

/* 選角動畫影片（有定義的角色用影片卡，其餘用精靈動畫） */
const CHAR_VIDEOS = {
    '皇':       'charvideos/皇絜如_key.webm',
    '瓜張':     'charvideos/誇彰.webm',
    '聾':       'charvideos/張家聾_key.webm',
    'Action張': 'charvideos/Action張_key.webm',
};

/* 選角音效（滑鼠移到角色上播放） */
const CHAR_SOUNDS = {
    '皇':       'charsfx/皇音效.MP3',
    '瓜張':     'charsfx/彰音效.MP3',
    '聾':       'charsfx/聾音效.MP3',
    'Action張': 'charsfx/明音效.MP3',
};

/* 角色大招音效（發動大招時播放） */
const CHAR_SPECIAL_SFX = {
    '皇':       'charsfx2/皇/黃捷如大招.mp3',
    '聾':       'charsfx2/聾/Box2D.mp3',
    'Action張': 'charsfx2/actoin張/張世明笑聲.mp3',
    '瓜張':     'charsfx2/誇張/瓜章 我也不差啊.mp3',
};

/* 角色死亡音效（陣亡時播放） */
const CHAR_DEATH_SFX = {
    '聾': 'charsfx2/聾/聾受傷.mp3',
    '皇': 'charsfx2/皇/皇死掉音效.m4a',
};

/* 各角色選角影片顯示縮放微調（>1 放大、<1 縮小，用來統一視覺大小） */
const CHAR_VIDEO_SCALE = {
    '皇':       1.30,
    '瓜張':     1.30,
    '聾':       1.00,
    'Action張': 0.90,
};

/* 關卡列表 */
const STAGE_LIST = [
    { key: 'yard',    file: 'pic/yard.jpg',                   label: '球　場' },
    { key: 'stage02', file: 'pic/七館.PNG',                   label: '七　館',   floor: 515 },
    { key: 'stage01', file: 'pic/background_01_pixelate.png', label: '像素城市' },
    { key: 'stage03', file: 'pic/七館黑夜版.png',             label: '七館夜版', floor: 515 },
    { key: 'stage04', file: 'pic/電競房.png',                 label: '電競房' },
    { key: 'stage05', file: 'pic/鬥舞室.png',                 label: '鬥舞室' },
    { key: 'stage06', file: 'pic/泳池.jpg',                   label: '泳　池' },
    { key: 'stage07', file: 'pic/操場夜景.jpg',               label: '操場夜景' },
];

/* sprite file paths (Action張 has a space in filename) */
const CHAR_FILE = {
    '皇':      'pic/皇精靈圖.png',
    '瓜張':    'pic/瓜張精靈圖.png',
    '聾':      'pic/聾精靈圖.png',
    'Action張': 'pic/Action張精靈圖.png',
};

/* Animation frame ranges (0-based, matching user layout) */
const ANIM_DEFS = [
    { name: 'walk',  start: 0, end: 14, rate: 10, repeat: -1 },
    { name: 'punch',  start: 15, end: 19, rate: 10, repeat:  0 },
    { name: 'kick',  start: 20, end: 24, rate: 10, repeat:  0 },
    { name: 'jump',  start: 25, end: 29, rate: 10, repeat:  0 },
    { name: 'hit',  start: 30, end: 33, rate: 10, repeat:  0 },
    { name: 'specialhit',  start: 34, end: 38, rate: 10, repeat:  0 },
    { name: 'death',  start: 39, end: 39, rate: 10, repeat:  0 },
    { name: 'special',  start: 40, end: 47, rate: 10, repeat:  0 },
];

/* ── Socket (global, persistent) ── */
const socket = io();

/* ── 共用：圖片按鈕（像素級點擊判定，hover 放大）
   breakFx=true 時點擊會換成碎掉的按鈕圖再執行（目前只有開始遊戲用） ── */
function makeImageButton(scene, x, y, texKey, width, onClick, breakFx = false) {
    /* pixelPerfect：只有按鈕實體（非透明）被點到才算，避免透明邊框誤判 */
    const img = scene.add.image(x, y, texKey).setInteractive({ useHandCursor: true, pixelPerfect: true });
    const base = width / img.width;          /* 依目標寬度等比例縮放 */
    img.setScale(base);
    img.on('pointerover', () => {
        if (img._clicked) return;
        scene.tweens.add({ targets: img, scaleX: base * 1.08, scaleY: base * 1.08, duration: 110, ease: 'Back.Out' });
    });
    img.on('pointerout', () => {
        if (img._clicked) return;
        scene.tweens.add({ targets: img, scaleX: base, scaleY: base, duration: 100, ease: 'Power2' });
    });
    img.on('pointerdown', () => {
        if (img._clicked) return;
        img._clicked = true;

        if (breakFx && scene.textures.exists('btnBroken')) {
            /* 換成碎掉的按鈕圖，抖動 + 放大淡出後執行 */
            if (scene.cache.audio.exists('btnBreakSfx')) scene.sound.play('btnBreakSfx', { volume: 0.7 });
            img.setTexture('btnBroken');
            img.setScale(width / img.width);
            scene.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 50, yoyo: true, repeat: 3 });
            scene.tweens.add({
                targets: img, alpha: 0, scaleX: img.scaleX * 1.15, scaleY: img.scaleY * 1.15,
                delay: 130, duration: 220, onComplete: onClick,
            });
        } else {
            /* 一般按鈕：簡單按壓回彈 */
            scene.tweens.add({
                targets: img, scaleX: base * 0.95, scaleY: base * 0.95,
                duration: 70, yoyo: true,
                onComplete: () => { img._clicked = false; onClick(); },
            });
        }
    });
    return img;
}

/* 回上一頁按鈕：預設放在左上角，常駐最上層；可用 opts 覆寫位置與大小 */
function addBackButton(scene, onClick, opts = {}) {
    const { x = 95, y = 56, width = 300 } = opts;
    return makeImageButton(scene, x, y, 'btnBack', width, onClick).setDepth(60);
}

/* ══════════════════════════════════════════
   CursorScene – 自訂拳頭游標（常駐最上層）
   ══════════════════════════════════════════ */
class CursorScene extends Phaser.Scene {
    constructor() { super('Cursor'); }

    create() {
        this.cursor = this.add.sprite(GAME_W / 2, GAME_H / 2, 'punchCursor', 0)
            .setScale(0.10).setOrigin(0.45, 0.4).setDepth(99999);
        this.cursor.on('animationcomplete', () => this.cursor.setFrame(0));
        /* 點擊就揮拳 */
        this.input.on('pointerdown', () => this.cursor.play('cursorPunch'));
    }

    update() {
        /* 戰鬥中（用鍵盤操作）隱藏游標 */
        const inFight = this.scene.isActive('Fight');
        this.cursor.setVisible(!inFight);
        if (inFight) return;
        const p = this.input.activePointer;
        this.cursor.setPosition(p.x, p.y);
    }
}

/* ══════════════════════════════════════════
   BootScene – 只載入封面圖，其餘交給 LoadingScene
   ══════════════════════════════════════════ */
class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        this.load.image('loadscreen', 'pic/load.png');
        /* 自訂拳頭游標精靈圖（2360×700，三格） */
        this.load.spritesheet('punchCursor', 'punchcursor.png', {
            frameWidth: 786, frameHeight: 700,
        });
    }

    create() {
        /* 拳頭游標動畫 + 啟動常駐游標場景（最上層） */
        if (!this.anims.exists('cursorPunch')) {
            this.anims.create({
                key: 'cursorPunch',
                frames: this.anims.generateFrameNumbers('punchCursor', { start: 0, end: 2 }),
                frameRate: 22, repeat: 0,
            });
        }
        this.scene.launch('Cursor');

        /* 封面圖 */
        this.add.image(GAME_W / 2, GAME_H / 2, 'loadscreen')
            .setDisplaySize(GAME_W, GAME_H);

        /* 半透明遮罩讓文字更清楚 */
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.35);

        /* 「點擊開始」提示（閃爍） */
        const hint = this.add.text(GAME_W / 2, GAME_H - 70, '點擊開始', {
            fontSize: '46px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 8,
            padding: { top: 6, bottom: 4 },
        }).setOrigin(0.5);
        this.tweens.add({
            targets: hint, alpha: { from: 1, to: 0.3 },
            duration: 700, yoyo: true, repeat: -1,
        });

        /* 點擊任意處 → 解鎖音訊並進入 Loading */
        this.input.once('pointerdown', () => {
            if (this.sound.locked) this.sound.unlock();
            this.scene.start('Loading');
        });
    }
}

/* ══════════════════════════════════════════
   LoadingScene – 封面圖 + 精靈載入 + 5 秒進度條
   ══════════════════════════════════════════ */
class LoadingScene extends Phaser.Scene {
    constructor() { super('Loading'); }

    /* preload 只做純資源載入，不呼叫 this.add */
    preload() {
        for (const s of STAGE_LIST) {
            this.load.image(s.key, s.file);
        }
        this.load.image('selectbg', 'pic/選角背景.PNG');
        this.load.image('logo',     'pic/Logo.png');
        this.load.audio('loadingSfx', 'loadingsfx.mp3');
        this.load.audio('battleBgm', 'scenebgm/場景音效.MP3');
        this.load.audio('winSfx',  'scenebgm/You win音效.mp3');
        this.load.audio('loseSfx', 'scenebgm/You lose 音效.mp3');
        this.load.audio('btnBreakSfx', 'scenebgm/按鈕破碎聲音.mp3');
        this.load.image('youwin',   'pic/You win.PNG');
        this.load.image('youlose',  'pic/You lose.PNG');
        this.load.image('btnStart',    'uibtn/開始遊戲按鈕.PNG');
        this.load.image('btnTutorial', 'uibtn/操作引導按鈕.png');
        this.load.image('btnReplay',   'uibtn/再玩一次按鈕.PNG');
        this.load.image('btnSettings',  'uibtn/數值設定按鈕.png');
        this.load.image('btnRandom',     'uibtn/隨機地圖按鈕.png');
        this.load.image('btnRandomChar', 'uibtn/隨機角色按鈕.png');
        this.load.image('btnBroken',     'uibtn/按鈕碎掉.png');
        this.load.image('btnBack',       'uibtn/回上一頁按鈕.png');
        this.load.image('dude',   'assets/dude.png');
        this.load.image('vodka',  'assets/明的伏特加.png');
        this.load.image('kaobei', 'assets/靠杯.png');
        this.load.image('trophy', 'assets/獎盃.png');
        this.load.image('combo',  'assets/combo.png');
        for (let i = 1; i <= 8; i++) {
            this.load.image(`trash${i}`, `assets/皇大招/垃圾${i}.png`);
        }
        for (const [ch, url] of Object.entries(CHAR_PORTRAITS)) {
            this.load.image(`portrait_${ch}`, url);
        }
        for (const [ch, url] of Object.entries(CHAR_SOUNDS)) {
            this.load.audio(`sfx_${ch}`, url);
        }
        for (const [ch, url] of Object.entries(CHAR_SPECIAL_SFX)) {
            this.load.audio(`special_${ch}`, url);
        }
        for (const [ch, url] of Object.entries(CHAR_DEATH_SFX)) {
            this.load.audio(`death_${ch}`, url);
        }
        for (const ch of CHAR_LIST) {
            this.load.spritesheet(ch, CHAR_FILE[ch], {
                frameWidth: FRAME_W, frameHeight: FRAME_H,
            });
        }
    }

    create() {
        /* 封面圖全螢幕（資源已載完才到 create，所以可安全使用） */
        this.add.image(GAME_W / 2, GAME_H / 2, 'loadscreen')
            .setDisplaySize(GAME_W, GAME_H);

        /* 建立所有動畫 */
        for (const ch of CHAR_LIST) {
            for (const def of ANIM_DEFS) {
                this.anims.create({
                    key: `${ch}_${def.name}`,
                    frames: this.anims.generateFrameNumbers(ch, { start: def.start, end: def.end }),
                    frameRate: def.rate,
                    repeat: def.repeat,
                });
            }
        }

        /* ── 5 秒進度條 UI ── */
        const BAR_W = 620, BAR_Y = GAME_H - 48;

        this.add.rectangle(GAME_W / 2, BAR_Y, BAR_W + 4, 28, 0x000000, 0.6).setDepth(5);
        this.add.rectangle(GAME_W / 2, BAR_Y, BAR_W,     22, 0x222222).setDepth(5);

        const fill = this.add.rectangle(
            GAME_W / 2 - BAR_W / 2, BAR_Y, 0, 18, 0xffee00
        ).setOrigin(0, 0.5).setDepth(6);

        const glow = this.add.rectangle(
            GAME_W / 2 - BAR_W / 2, BAR_Y, 6, 18, 0xffffff, 0.4
        ).setOrigin(0, 0.5).setDepth(7);

        const txt = this.add.text(GAME_W / 2, BAR_Y + 18, 'Loading…', {
            fontSize: '13px', color: '#aaaaaa',
        }).setOrigin(0.5, 0).setDepth(7);

        /* ── 隨機角色在進度條上跟著跑 ── */
        const barLeft = GAME_W / 2 - BAR_W / 2;
        const runnerCh = Phaser.Utils.Array.GetRandom(CHAR_LIST);
        const runner = this.add.sprite(barLeft, BAR_Y - 10, runnerCh)
            .setOrigin(0.5, 1)        /* 腳底踩在進度條上緣 */
            .setScale(0.20)           /* 小小一隻 */
            .setDepth(8);
        runner.play(`${runnerCh}_walk`);

        /* ── Loading 音效（瀏覽器自動播放被鎖時，等解鎖後再播） ── */
        const loadSnd = this.sound.add('loadingSfx');
        if (this.sound.locked) {
            this.sound.once('unlocked', () => { if (loadSnd && !loadSnd.isPlaying) loadSnd.play(); });
        } else {
            loadSnd.play();
        }

        /* tween：fill 和 glow 的 width 一起從 0 長到 BAR_W（5 秒） */
        this.tweens.add({
            targets:  fill,
            width:    BAR_W,
            duration: 5000,
            ease:     'Linear',
            onUpdate: () => {
                glow.width = Math.min(fill.width, 30);
                glow.x     = fill.x + fill.width - glow.width / 2;
                runner.x   = barLeft + fill.width;   /* 跟著進度右緣跑 */
            },
            onComplete: () => {
                txt.setText('Ready!');
                runner.x = barLeft + BAR_W;
                runner.play(`${runnerCh}_punch`);   /* 抵達終點來個收尾動作 */
                loadSnd.stop();   /* 進入主選單前停掉 loading 音效 */
                this.time.delayedCall(300, () => this.scene.start('Menu'));
            },
        });
    }
}

/* ══════════════════════
   MenuScene – title
   ══════════════════════ */
class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
        this.add.image(GAME_W / 2, GAME_H / 2, 'selectbg').setDisplaySize(GAME_W, GAME_H);

        const logo = this.add.image(GAME_W / 2, 200, 'logo');
        logo.setScale(700 / logo.width);   /* 依目標寬度等比例縮放 */

        makeImageButton(this, GAME_W / 2, 370, 'btnStart',    360, () => this.scene.start('Select', { offline: false }), true);
        makeImageButton(this, GAME_W / 2, 460, 'btnTutorial', 220, () => this.scene.start('Tutorial'));

        /* 數值設定（圖片按鈕，放在練習模式上方） */
        makeImageButton(this, GAME_W - 75, GAME_H - 70, 'btnSettings', 150, () => this.scene.start('Settings'));

        /* 練習模式（工程測試用） */
        const pBtn = this.add.text(GAME_W - 14, GAME_H - 12, '🛠 練習模式', {
            fontSize: '16px', color: '#88ccff',
            stroke: '#000', strokeThickness: 3,
            backgroundColor: '#11223399', padding: { x: 10, y: 6 },
        }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
        pBtn.on('pointerover', () => pBtn.setStyle({ color: '#ffee00' }));
        pBtn.on('pointerout',  () => pBtn.setStyle({ color: '#88ccff' }));
        pBtn.on('pointerdown', () => this.scene.start('Select', { offline: true }));
    }
}

/* ══════════════════════════════
   TutorialScene – 新手教學
   ══════════════════════════════ */
class TutorialScene extends Phaser.Scene {
    constructor() { super('Tutorial'); }

    create() {
        /* CJK 字頂部修正 patch：只在此場景有效，離開時自動還原 */
        const _ut = Phaser.GameObjects.Text.prototype.updateText;
        Phaser.GameObjects.Text.prototype.updateText = function () {
            if ((this.padding.top || 0) < 3) this.padding.top = 3;
            return _ut.call(this);
        };
        this.events.once('shutdown', () => {
            Phaser.GameObjects.Text.prototype.updateText = _ut;
        });

        /* 背景 */
        this.add.image(GAME_W / 2, GAME_H / 2, 'yard')
            .setDisplaySize(GAME_W, GAME_H).setAlpha(0.22);
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.78);

        /* 標題 */
        this.add.text(GAME_W / 2, 22, '操作指引', {
            fontSize: '32px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 7, padding: { top: 5, bottom: 3 },
        }).setOrigin(0.5, 0);
        this.add.rectangle(GAME_W / 2, 60, GAME_W - 60, 2, 0xffee00, 0.35);

        /* ════ 左側：互動示範角色（按鍵試玩） ════ */
        this.panel(20, 70, 330, 410);
        this.sectionTitle(34, 86, '動作示範');
        this.add.text(185, 104, '按下方按鍵，角色立刻示範！', { fontSize: '12px', color: '#cccccc' }).setOrigin(0.5);
        this.demoLabel = this.add.text(185, 130, '', {
            fontSize: '20px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 5, padding: { top: 4 },
        }).setOrigin(0.5);
        this.add.ellipse(185, 458, 150, 26, 0x000000, 0.4);   /* 腳底陰影 */

        const dch = Phaser.Utils.Array.GetRandom(CHAR_LIST);
        const dsp = this.add.sprite(185, 458, dch).setOrigin(0.5, 1).setScale(0.5);
        dsp.setFrame(0);
        this.demo = { sprite: dsp, ch: dch, x: 185, y: 458, velY: 0,
                      facing: 1, jumping: false, attacking: false, anim: 'idle' };
        this.demoFloorY = 458;

        /* 防禦護盾罩（按 I 時顯示）— 黃色能量罩，與戰鬥中一致 */
        if (!this.textures.exists('shield_dome')) {
            const R = 60, gg = this.make.graphics({ add: false });
            gg.fillStyle(0xffee00, 0.14).fillCircle(R, R, R);
            gg.lineStyle(3, 0xffdd33, 0.6).strokeCircle(R, R, R - 2);
            gg.fillStyle(0xffffff, 0.30).fillCircle(R * 0.62, R * 0.55, R * 0.18);
            gg.generateTexture('shield_dome', R * 2, R * 2);
            gg.destroy();
        }
        const dShieldBase = (FRAME_H * 0.5) / 120;   /* 依示範角色 scale 0.5 縮放，罩住整個角色 */
        this.demoShield = this.add.image(185, 350, 'shield_dome').setScale(dShieldBase).setDepth(6).setVisible(false);
        this.tweens.add({ targets: this.demoShield, scale: { from: dShieldBase * 0.96, to: dShieldBase * 1.06 },
            duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

        this.keys = this.input.keyboard.addKeys({
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            jump:  Phaser.Input.Keyboard.KeyCodes.W,
            punch: Phaser.Input.Keyboard.KeyCodes.J,
            kick:  Phaser.Input.Keyboard.KeyCodes.K,
            special: Phaser.Input.Keyboard.KeyCodes.L,
            block: Phaser.Input.Keyboard.KeyCodes.I,
        });

        /* ════ 右側：說明 ════ */
        const RX = 366;
        /* 操作按鍵 */
        this.panel(360, 70, 574, 140);
        this.sectionTitle(RX + 6, 86, '操作按鍵');
        this.keyRow(RX, 116, 'A', '向左移動');
        this.keyRow(RX, 142, 'D', '向右移動');
        this.keyRow(RX, 168, 'W', '跳躍');
        this.keyRow(RX, 194, 'I', '防禦（按住）', '', '#88ddff');
        this.keyRow(RX + 280, 116, 'J', '出拳', '8',  '#ffaa44');
        this.keyRow(RX + 280, 142, 'K', '踢腳', '15', '#ff7733');
        this.keyRow(RX + 280, 168, 'L', '大招', '需 SP 滿', '#ff4444');

        /* 三條狀態 */
        this.panel(360, 220, 574, 96);
        this.sectionTitle(RX + 6, 234, '介面 / 三條狀態');
        const barRow = (x, y, label, col, desc) => {
            this.add.text(x, y, label, { fontSize: '11px', color: '#888' }).setOrigin(0, 0.5);
            this.add.rectangle(x + 44, y, 90, 11, 0x333333).setOrigin(0, 0.5);
            this.add.rectangle(x + 44, y, 90, 7,  col).setOrigin(0, 0.5);
            this.add.text(x + 142, y, desc, { fontSize: '11px', color: '#cccccc' }).setOrigin(0, 0.5);
        };
        barRow(RX, 262, 'HP',    0x44ff44, '生命，歸零落敗');
        barRow(RX, 286, 'SP',    0x44aaff, '能量，滿格放大招');
        barRow(RX + 300, 262, 'GD', 0xbb66ff, '防禦耐力，耗盡破防');
        this.add.text(RX, 305, '⚡ SP 滿＝角色發金光、可放大招', { fontSize: '10px', color: '#ffee88' }).setOrigin(0, 0.5);

        /* 角色大招 */
        this.panel(360, 326, 280, 154);
        this.sectionTitle(RX + 6, 342, '角色大招');
        [['聾', 'dude 投射物'], ['Action張', '伏特加瓶'], ['瓜張', '靠杯'], ['皇', '垃圾彈幕']]
            .forEach(([c, d], i) => {
                const y = 368 + i * 26;
                this.add.text(RX, y, c, { fontSize: '12px', color: '#ffee00', fontStyle: 'bold' }).setOrigin(0, 0.5);
                this.add.text(RX + 84, y, `→ ${d}`, { fontSize: '11px', color: '#cccccc' }).setOrigin(0, 0.5);
            });

        /* 連擊 / 回合 */
        this.panel(648, 326, 286, 154);
        this.sectionTitle(660, 342, '連擊 / 勝負');
        [
            '連續命中累計連擊',
            '連擊越高傷害越高(最高+40%)',
            '三戰兩勝',
            '被擊中會硬直、連擊中斷',
        ].forEach((t, i) => this.add.text(660, 366 + i * 24, `• ${t}`, { fontSize: '11px', color: '#cccccc' }).setOrigin(0, 0.5));

        /* ── 返回按鈕（此頁版面較滿，上移讓按鈕本體落在面板上方避免重疊） ── */
        addBackButton(this, () => this.scene.start('Menu'), { y: 16 });
    }

    /* 示範角色：吃鍵盤輸入做出對應動作 */
    update(_, delta) {
        const p = this.demo;
        if (!p) return;
        const k = this.keys, dt = delta / 1000;
        let dx = 0;

        if (!p.attacking) {
            if (k.block.isDown && !p.jumping) {
                if (p.anim !== 'block') {
                    p.anim = 'block'; p.sprite.stop(); p.sprite.setFrame(0);
                    this.demoLabel.setText('防禦  I');
                }
            } else {
                if (p.anim === 'block') p.anim = '';
                if (k.left.isDown)  { dx = -150; p.facing = -1; }
                if (k.right.isDown) { dx = +150; p.facing =  1; }
                if (Phaser.Input.Keyboard.JustDown(k.jump) && !p.jumping) {
                    p.velY = -470; p.jumping = true; this.demoPlay('jump'); this.demoLabel.setText('跳躍  W');
                }
                if (Phaser.Input.Keyboard.JustDown(k.punch)   && !p.jumping) this.demoAttack('punch',   '出拳  J');
                if (Phaser.Input.Keyboard.JustDown(k.kick)    && !p.jumping) this.demoAttack('kick',    '踢腳  K');
                if (Phaser.Input.Keyboard.JustDown(k.special) && !p.jumping) this.demoAttack('special', '大招  L');
            }
        }

        p.x += dx * dt;
        p.velY += 1300 * dt;
        p.y += p.velY * dt;
        if (p.y >= this.demoFloorY) {
            p.y = this.demoFloorY; p.velY = 0;
            if (p.jumping) { p.jumping = false; if (!p.attacking) { p.anim = ''; this.demoPlay('walk'); } }
        }
        p.x = Phaser.Math.Clamp(p.x, 80, 290);

        if (!p.attacking && !p.jumping && p.anim !== 'block') {
            if (dx !== 0) {
                this.demoPlay('walk');
                this.demoLabel.setText('移動  A / D');
            } else if (p.anim !== 'idle') {
                p.anim = 'idle'; p.sprite.stop(); p.sprite.setFrame(0);
                this.demoLabel.setText('');
            }
        }
        p.sprite.setPosition(p.x, p.y).setFlipX(p.facing < 0);

        /* 防禦護盾罩跟著角色顯示/隱藏 */
        this.demoShield.setVisible(p.anim === 'block');
        if (p.anim === 'block') this.demoShield.setPosition(p.x, p.y - FRAME_H * SCALE * 0.5);
    }

    demoPlay(name) {
        const p = this.demo;
        if (p.anim === name) return;
        p.anim = name;
        p.sprite.play(`${p.ch}_${name}`);
    }

    demoAttack(type, label) {
        const p = this.demo;
        p.attacking = true; p.anim = '';
        this.demoPlay(type);
        this.demoLabel.setText(label);
        p.sprite.off('animationcomplete');
        p.sprite.once('animationcomplete', () => {
            p.attacking = false; p.anim = ''; this.demoPlay('walk');
        });
    }

    /* ── 半透明面板背景 ── */
    panel(x, y, w, h) {
        this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x111122, 0.7);
        this.add.rectangle(x + w / 2, y + h / 2, w, h).setStrokeStyle(1, 0x334466, 0.8).setFillStyle(0, 0);
    }

    /* ── 段落標題 ── */
    sectionTitle(x, y, text) {
        this.add.rectangle(x, y, 3, 18, 0xffee00).setOrigin(0, 0.5);
        this.add.text(x + 8, y, text, {
            fontSize: '14px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
    }

    /* ── 按鍵 + 說明列 ── */
    keyRow(x, y, keyLabel, desc, extra = '', extraColor = '#aaaaaa') {
        /* 按鍵圖示 */
        this.add.rectangle(x + 18, y, 36, 28, 0x444455).setOrigin(0.5);
        this.add.rectangle(x + 18, y - 1, 32, 24, 0x6677aa).setOrigin(0.5);
        this.add.text(x + 18, y, keyLabel, {
            fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        /* 說明 */
        this.add.text(x + 44, y, desc, {
            fontSize: '13px', color: '#dddddd',
        }).setOrigin(0, 0.5);
        /* 額外資訊（傷害等） */
        if (extra) {
            this.add.text(x + 44 + 130, y, extra, {
                fontSize: '12px', color: extraColor, fontStyle: 'bold',
            }).setOrigin(0, 0.5);
        }
    }
}

/* ══════════════════════════════
   SettingsScene – 數值設定
   ══════════════════════════════ */
class SettingsScene extends Phaser.Scene {
    constructor() { super('Settings'); }

    create() {
        this.add.image(GAME_W / 2, GAME_H / 2, 'selectbg').setDisplaySize(GAME_W, GAME_H);
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7);

        this.add.text(GAME_W / 2, 40, '數值設定', {
            fontSize: '40px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 8, padding: { top: 6, bottom: 4 },
        }).setOrigin(0.5);
        this.add.text(GAME_W / 2, 80, '調整對戰平衡（連線對戰以 P1／房主的設定為準，自動同步給雙方）', {
            fontSize: '14px', color: '#cccccc',
        }).setOrigin(0.5);

        /* 每項設定：key、標籤、最小、最大、步進、小數位 */
        const rows = [
            { key: 'maxHP',      label: '最大生命值', min: 50, max: 500, step: 25, dp: 0 },
            { key: 'punchDmg',   label: '出拳傷害',   min: 1,  max: 50,  step: 1,  dp: 0 },
            { key: 'kickDmg',    label: '踢腳傷害',   min: 1,  max: 60,  step: 1,  dp: 0 },
            { key: 'specialDmg', label: '大招傷害',   min: 5,  max: 120, step: 5,  dp: 0 },
            { key: 'spRegen',    label: '能量回充/秒', min: 0,  max: 10,  step: 0.5, dp: 1 },
        ];

        const startY = 135, gap = 55;
        rows.forEach((r, i) => this.makeRow(r, startY + i * gap));

        /* 重置 */
        const reset = this.add.text(GAME_W / 2 - 110, GAME_H - 38, '↺ 重置預設', {
            fontSize: '20px', color: '#ffaa66', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 4,
            backgroundColor: '#332211cc', padding: { x: 16, y: 8 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        reset.on('pointerover', () => reset.setStyle({ color: '#ffee00' }));
        reset.on('pointerout',  () => reset.setStyle({ color: '#ffaa66' }));
        reset.on('pointerdown', () => {
            Object.assign(GAME_SETTINGS, GAME_SETTINGS_DEFAULT);
            saveSettings();
            this.refreshValues();
        });

        /* 返回 */
        addBackButton(this, () => this.scene.start('Menu'));
    }

    makeRow(cfg, y) {
        const { key, label, min, max, step, dp } = cfg;
        const labelX = 250, valX = 600, minusX = 540, plusX = 660;

        this.add.text(labelX, y, label, {
            fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0, 0.5);

        /* 數值顯示 */
        this.valTexts = this.valTexts || {};
        this.valTexts[key] = this.add.text(valX, y, '', {
            fontSize: '24px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);

        const mkBtn = (x, sign) => {
            const b = this.add.text(x, y, sign > 0 ? '＋' : '－', {
                fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
                backgroundColor: '#445588', padding: { x: 12, y: 2 },
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            b.on('pointerover', () => b.setBackgroundColor('#6688bb'));
            b.on('pointerout',  () => b.setBackgroundColor('#445588'));
            b.on('pointerdown', () => {
                let v = GAME_SETTINGS[key] + sign * step;
                v = Math.min(max, Math.max(min, Math.round(v / step) * step));
                GAME_SETTINGS[key] = v;
                saveSettings();
                this.refreshValues();
            });
        };
        mkBtn(minusX, -1);
        mkBtn(plusX,  +1);

        this._fmt = this._fmt || {};
        this._fmt[key] = dp;
        this.refreshValues();
    }

    refreshValues() {
        for (const key of Object.keys(this.valTexts || {})) {
            const dp = this._fmt[key] || 0;
            this.valTexts[key].setText(GAME_SETTINGS[key].toFixed(dp));
        }
    }
}

/* ══════════════════════════════
   SelectScene – pick character
   ══════════════════════════════ */
class SelectScene extends Phaser.Scene {
    constructor() { super('Select'); }

    init(data) {
        this.offline = data?.offline || false;   /* 練習模式：離線選角 */
    }

    create() {
        this.roomId     = null;
        this.playerNum  = null;
        this.selectedCh = null;
        this.opponentCh = null;

        this.add.image(GAME_W / 2, GAME_H / 2, 'selectbg').setDisplaySize(GAME_W, GAME_H);

        this.add.text(GAME_W / 2, 45, this.offline ? '練習模式 · 選擇角色' : '選擇角色', {
            fontSize: '38px', color: '#ffffff',
            stroke: '#000', strokeThickness: 6,
            padding: { top: 5, bottom: 3 },
        }).setOrigin(0.5);

        this.statusTxt = this.add.text(GAME_W / 2, GAME_H - 28,
            this.offline ? '◀ ▶ 切換，點角色開始練習' : '正在連線中…', {
            fontSize: '20px', color: '#ffee00',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);

        this.buildCarousel();

        /* 回上一頁（回主選單） */
        addBackButton(this, () => this.scene.start('Menu'));

        if (this.offline) {
            this.roomId = 'practice';   /* 讓 pick() 不被擋 */
        } else {
            this.setupSocket();
            socket.emit('joinQueue');
        }
    }

    buildCarousel() {
        const cx = GAME_W / 2, cy = 285;

        /* 灰色半透明背景 */
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x555555, 0.45);

        this.oppChar  = null;
        this.displays = [];

        CHAR_LIST.forEach((ch, i) => {
            let disp, base;
            if (CHAR_VIDEOS[ch]) {
                /* 選角影片：原生 <video> 畫進 CanvasTexture */
                const texKey = `charVid_${i}`, TW = 120, TH = 160;
                if (this.textures.exists(texKey)) this.textures.remove(texKey);
                const canvasTex = this.textures.createCanvas(texKey, TW, TH);
                base = 1.9 * (CHAR_VIDEO_SCALE[ch] ?? 1);
                disp = this.add.image(cx, cy, texKey).setOrigin(0.5).setScale(base);

                const vid = document.createElement('video');
                vid.src = CHAR_VIDEOS[ch];
                vid.loop = true; vid.muted = true; vid.playsInline = true;
                vid.play().catch(() => {});
                const drawFrame = () => {
                    if (vid.readyState < 2) return;
                    const vw = vid.videoWidth, vh = vid.videoHeight;
                    if (!vw || !vh) return;
                    const s = Math.min(TW / vw, TH / vh);
                    const dw = vw * s, dh = vh * s;
                    const c = canvasTex.getContext();
                    c.clearRect(0, 0, TW, TH);
                    c.drawImage(vid, (TW - dw) / 2, (TH - dh) / 2, dw, dh);
                    canvasTex.refresh();
                };
                this.events.on('prerender', drawFrame);
                this.events.once('shutdown', () => {
                    this.events.off('prerender', drawFrame);
                    vid.pause(); vid.src = '';
                    if (this.textures.exists(texKey)) this.textures.remove(texKey);
                });
            } else {
                /* 一般精靈動畫 */
                base = 0.45;
                disp = this.add.sprite(cx, cy, ch).setOrigin(0.5).setScale(base);
                disp.play(`${ch}_walk`);
            }
            disp.baseScale = base;
            disp.slot = i;
            disp.setInteractive({ useHandCursor: true });
            disp.on('pointerdown', () => {
                if (disp.slot === this.index) this.pick(CHAR_LIST[disp.slot]);
                else this.moveToSlot(disp.slot);   /* 點側邊卡片→轉到前方 */
            });
            this.displays.push(disp);
        });

        /* 角色名稱 */
        this.nameTxt = this.add.text(cx, 458, '', {
            fontSize: '30px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 6, padding: { top: 5, bottom: 3 },
        }).setOrigin(0.5).setDepth(40);

        /* 對手選擇提示 */
        this.oppTxt = this.add.text(cx, 92, '', {
            fontSize: '16px', color: '#ff8844', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(40).setVisible(false);

        /* 左右箭頭（螢光紫、細描邊、立體陰影） */
        const mkArrow = (x, dir, label) => {
            const a = this.add.text(x, cy, label, {
                fontSize: '35px', color: '#cc44ff', fontStyle: 'bold',
                stroke: '#000', strokeThickness: 3,
            }).setOrigin(0.5).setDepth(40).setInteractive({ useHandCursor: true });
            /* 立體感：深紫投影 + 微光暈 */
            a.setShadow(5, 6, '#3a0a55', 4, true, true);
            a.on('pointerover', () => a.setScale(1.2).setColor('#e07bff'));
            a.on('pointerout',  () => a.setScale(1).setColor('#cc44ff'));
            a.on('pointerdown', () => this.moveChar(dir));
        };
        mkArrow(cx - 360, -1, '◀');
        mkArrow(cx + 360, +1, '▶');

        /* 隨機角色按鈕（轉盤抽角色） */
        makeImageButton(this, 165, GAME_H - 95, 'btnRandomChar', 300, () => this.randomCharSpin());

        /* 鍵盤左右切換 */
        this.input.keyboard.on('keydown-LEFT',  () => this.moveChar(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.moveChar(1));

        this.rot       = 0;   /* 目前圓柱旋轉量（以「格」為單位） */
        this.rotTarget = 0;   /* 目標旋轉量 */
        this.index     = 0;
        this.spinning  = false;
        this.layoutCarousel();
        this.refreshCarousel();
    }

    /* ── 隨機角色：用初速 + 摩擦旋轉，自然減速停在隨機角色 ── */
    randomCharSpin() {
        if (this.spinning) return;
        this.spinning = true;
        this.spinVel = Phaser.Math.Between(22, 30);   /* 初始角速度（格/秒），隨機 */
    }

    /* 每幀更新圓柱旋轉 */
    update(_, delta) {
        if (this.rotTarget === undefined) return;
        const N = this.displays.length;
        const dt = delta / 1000;
        const tick = () => {
            const idx = ((Math.round(this.rot) % N) + N) % N;
            if (idx !== this.index) {
                this.index = idx;
                if (!this.spinning || this.spinVel < 8) this.hoverSound(CHAR_LIST[idx]);
                this.refreshCarousel();
            }
        };

        if (this.spinning) {
            /* 摩擦減速（每 0.55 秒速度減半） */
            this.spinVel *= Math.pow(0.5, dt / 0.70);
            this.rot += this.spinVel * dt;
            this.layoutCarousel();
            tick();
            if (this.spinVel < 1.2) {            /* 夠慢了 → 對齊最近的角色停下 */
                this.spinning = false;
                this.rotTarget = Math.round(this.rot);
            }
            return;
        }

        if (Math.abs(this.rot - this.rotTarget) > 0.0005) {
            this.rot += (this.rotTarget - this.rot) * Math.min(1, dt * 9);
            this.layoutCarousel();
            tick();
        }
    }

    /* ── 圓柱排列：依 this.rot 把每張卡放到圓柱上的位置 ── */
    layoutCarousel() {
        const N = this.displays.length;
        const cx = GAME_W / 2, cy = 285, R = 210;
        this.displays.forEach((d, k) => {
            const theta = ((k - this.rot) / N) * Math.PI * 2;   /* 此卡在圓柱上的角度 */
            const front = (Math.cos(theta) + 1) / 2;            /* 0=最後面, 1=最前面 */
            d.x = cx + Math.sin(theta) * R;
            d.y = cy;
            const sc = d.baseScale * (0.5 + 0.5 * front);       /* 前大後小 */
            d.scaleX = sc; d.scaleY = sc;
            d.setAlpha(0.35 + 0.65 * front);                    /* 後面較暗 */
            d.setDepth(10 + Math.round(front * 20));            /* 前面蓋住後面 */
        });
    }

    moveChar(dir) {
        if (this.spinning) return;
        const N = this.displays.length;
        this.rotTarget += dir;
        this.index = ((Math.round(this.rotTarget) % N) + N) % N;
        this.hoverSound(CHAR_LIST[this.index]);
        this.refreshCarousel();
    }

    /* 點側邊卡片：以最短路徑轉到前方 */
    moveToSlot(k) {
        const N = this.displays.length;
        let diff = k - this.index;
        if (diff >  N / 2) diff -= N;
        if (diff < -N / 2) diff += N;
        if (diff !== 0) this.moveChar(diff);
    }

    refreshCarousel() {
        const ch = CHAR_LIST[this.index];
        this.nameTxt.setText(this.selectedCh === ch ? `✓ ${ch}` : ch)
            .setColor(this.selectedCh === ch ? '#00ff88' : '#ffffff');
    }

    /* ── 滑鼠移入角色：播放對應選角音效 ── */
    hoverSound(ch) {
        const key = `sfx_${ch}`;
        if (!this.cache.audio.exists(key)) return;
        /* 先停掉上一個 hover 音效，避免重疊 */
        if (this.curHoverSfx && this.curHoverSfx.isPlaying) this.curHoverSfx.stop();
        this.curHoverSfx = this.sound.add(key);
        this.curHoverSfx.play();
    }

    pick(ch) {
        if (this.spinning) return;
        if (!this.roomId) {
            this.statusTxt.setText('請等待對手加入！');
            return;
        }
        if (this.selectedCh === ch) return;

        this.selectedCh = ch;

        /* 練習模式：直接進入戰鬥場景（對手為假人） */
        if (this.offline) {
            const dummy = CHAR_LIST.find(c => c !== ch) || ch;
            this.scene.start('Fight', {
                practice:   true,
                playerNum:  1,
                localChar:  ch,
                remoteChar: dummy,
                stage:      'yard',
            });
            return;
        }

        this.refreshCarousel();   /* 名稱變綠標示已選 */
        this.statusTxt.setText(
            this.opponentCh
                ? `你選 ${ch}｜對手選 ${this.opponentCh}`
                : `已選 ${ch}，等待對手…`
        );

        socket.emit('characterSelected', { roomId: this.roomId, character: ch });
    }

    setupSocket() {
        socket.off('waiting').off('opponentFound').off('opponentCharacter')
              .off('charsDone').off('opponentDisconnected');

        socket.on('waiting', () => {
            this.statusTxt.setText('等待對手加入…');
        });

        socket.on('opponentFound', ({ roomId, playerNum }) => {
            this.roomId    = roomId;
            this.playerNum = playerNum;
            this.statusTxt.setText('對手已找到！請選擇角色');
        });

        socket.on('opponentCharacter', ({ character }) => {
            this.opponentCh = character;
            this.oppChar = character;
            this.oppTxt.setText(`對手選擇：${character}`).setVisible(true);
            this.refreshCarousel();   /* 對手選的角色圓點變橘 */
            /* 更新狀態文字 */
            if (this.selectedCh) {
                this.statusTxt.setText(`你選 ${this.selectedCh}｜對手選 ${character}`);
            } else {
                this.statusTxt.setText(`對手已選 ${character}，換你選！`);
            }
        });

        socket.on('charsDone', () => {
            this.scene.start('StageSelect', {
                roomId:     this.roomId,
                playerNum:  this.playerNum,
                localChar:  this.selectedCh,
                remoteChar: this.opponentCh,
            });
        });

        socket.on('opponentDisconnected', () => {
            this.roomId = null;
            this.statusTxt.setText('對手離線，重新配對…');
            socket.emit('joinQueue');
        });
    }
}

/* ══════════════════════════════
   StageSelectScene – pick stage
   ══════════════════════════════ */
class StageSelectScene extends Phaser.Scene {
    constructor() { super('StageSelect'); }

    init(data) {
        this.roomId      = data.roomId;
        this.playerNum   = data.playerNum;
        this.localChar   = data.localChar;
        this.remoteChar  = data.remoteChar;
        this.selectedKey = null;     /* 目前選的場地（可更改） */
        this.confirmed   = false;    /* 是否已按確定 */
    }

    create() {
        /* 背景：跟著選擇的場地同步切換 */
        this.bgKey = STAGE_LIST[0].key;
        this.bg = this.add.image(GAME_W / 2, GAME_H / 2, this.bgKey)
            .setDisplaySize(GAME_W, GAME_H).setDepth(0);
        /* 暗化遮罩讓卡片與文字更清楚 */
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.45).setDepth(0);

        /* 標題 */
        this.add.text(GAME_W / 2, 40, '選擇場地', {
            fontSize: '40px', color: '#ffee00',
            stroke: '#000', strokeThickness: 9, fontStyle: 'bold',
            padding: { top: 5, bottom: 3 },
        }).setOrigin(0.5).setDepth(6);

        /* 玩家身分提示 */
        const pColor = this.playerNum === 1 ? '#00ff88' : '#ff8844';
        this.add.text(GAME_W - 18, 14, `P${this.playerNum}`, {
            fontSize: '20px', color: pColor, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(1, 0);

        const hint = this.playerNum === 1
            ? 'P1 的選擇決定最終場地'
            : 'P2 也請選擇，以 P1 選擇為準';
        this.add.text(GAME_W / 2, 82, hint, {
            fontSize: '15px', color: '#ffee88',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(6);

        /* 狀態文字 */
        this.statusTxt = this.add.text(GAME_W - 16, GAME_H - 40, '◀ ▶ 切換場地', {
            fontSize: '18px', color: '#ffffff',
            stroke: '#000', strokeThickness: 5,
        }).setOrigin(1, 0.5);

        /* 確定按鈕 */
        this.confirmBtn = this.add.text(GAME_W / 2, GAME_H - 28, '✓ 確定場地', {
            fontSize: '24px', color: '#00ff88', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 5,
            backgroundColor: '#113322cc', padding: { x: 22, y: 8 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.confirmBtn.on('pointerover', () => this.confirmBtn.setStyle({ color: '#ffee00' }));
        this.confirmBtn.on('pointerout',  () => this.confirmBtn.setStyle({ color: this.confirmed ? '#ff6666' : '#00ff88' }));
        this.confirmBtn.on('pointerdown', () => this.confirmed ? this.cancelConfirm() : this.confirm());

        /* 隨機地圖按鈕（左下角） */
        makeImageButton(this, 130, GAME_H - 34, 'btnRandom', 300, () => this.randomStage());

        /* 回上一頁（回角色選擇） */
        addBackButton(this, () => this.scene.start('Select', { offline: false }));

        this.buildCarousel();
        this.setupSocket();
    }

    /* ── 隨機選一個場地 ── */
    randomStage() {
        if (this.confirmed) return;
        const n = STAGE_LIST.length;
        let i = this.index;
        if (n > 1) { while (i === this.index) i = Phaser.Math.Between(0, n - 1); }  /* 避免抽到同一個 */
        this.showIndex(i);
    }

    buildCarousel() {
        const cx = GAME_W / 2, cy = 250;
        const PW = 520, PH = 292;   /* 預覽圖大小（16:9） */

        /* 預覽外框 */
        this.add.rectangle(cx, cy, PW + 10, PH + 10, 0x000000, 0.5)
            .setStrokeStyle(4, 0xffee00).setDepth(3);
        /* 預覽圖 */
        this.preview = this.add.image(cx, cy, STAGE_LIST[0].key)
            .setDisplaySize(PW, PH).setDepth(3)
            .setInteractive({ useHandCursor: true });
        this.preview.on('pointerdown', () => { if (!this.confirmed) this.confirm(); });  /* 點圖＝確定 */

        /* 對手選擇提示（圖右上角） */
        this.oppTag = this.add.text(cx + PW / 2 - 6, cy - PH / 2 + 6, '', {
            fontSize: '15px', color: '#ff8844', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 4, padding: { top: 3 },
            backgroundColor: '#00000088',
        }).setOrigin(1, 0).setDepth(6).setVisible(false);

        /* 場地名稱（圖下方） */
        this.nameTxt = this.add.text(cx, cy + PH / 2 + 26, '', {
            fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 6, padding: { top: 5, bottom: 3 },
        }).setOrigin(0.5).setDepth(6);

        /* 左右箭頭 */
        const mkArrow = (x, sign, label) => {
            const a = this.add.text(x, cy, label, {
                fontSize: '64px', color: '#ffee00', fontStyle: 'bold',
                stroke: '#000', strokeThickness: 8,
            }).setOrigin(0.5).setDepth(6).setInteractive({ useHandCursor: true });
            a.on('pointerover', () => a.setScale(1.2));
            a.on('pointerout',  () => a.setScale(1));
            a.on('pointerdown', () => this.move(sign));
            return a;
        };
        mkArrow(cx - PW / 2 - 50, -1, '◀');
        mkArrow(cx + PW / 2 + 50, +1, '▶');

        /* 底部圓點指示器 */
        this.dots = STAGE_LIST.map((_, i) => {
            const dx = GAME_W / 2 + (i - (STAGE_LIST.length - 1) / 2) * 22;
            return this.add.circle(dx, cy + PH / 2 + 58, 5, 0x555555).setDepth(6);
        });

        /* 鍵盤左右切換 */
        this.input.keyboard.on('keydown-LEFT',  () => this.move(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.move(+1));

        this.index = 0;
        this.showIndex(0, true);
    }

    move(sign) {
        if (this.confirmed) return;
        const n = STAGE_LIST.length;
        this.showIndex((this.index + sign + n) % n);
    }

    showIndex(i) {
        this.index = i;
        const stage = STAGE_LIST[i];
        this.preview.setTexture(stage.key).setDisplaySize(520, 292);
        this.nameTxt.setText(stage.label);
        this.refreshDots();
        this.pick(stage.key);   /* 切到哪就選哪（會同步背景＋廣播） */
    }

    refreshDots() {
        this.dots.forEach((d, k) => {
            const key = STAGE_LIST[k].key;
            let c = 0x555555;
            if (this.opponentStageKey === key) c = 0xff8844;   /* 對手選的 */
            if (k === this.index)              c = 0xffee00;   /* 目前這個（優先） */
            d.setFillStyle(c);
        });
    }

    updateOppTag() {
        if (this.opponentStageKey) {
            const label = STAGE_LIST.find(s => s.key === this.opponentStageKey)?.label ?? '';
            this.oppTag.setText(`對手：${label}`).setVisible(true);
        }
        this.refreshDots();
    }

    /* ── 切換背景預覽 ── */
    setBg(key) {
        if (this.bg && this.bg.texture.key !== key) {
            this.bg.setTexture(key);
            this.bg.setDisplaySize(GAME_W, GAME_H);
        }
    }

    pick(key) {
        if (this.confirmed) return;
        this.selectedKey = key;
        this.bgKey = key;
        this.setBg(key);
        socket.emit('stageSelected', { roomId: this.roomId, stage: key });
    }

    confirm() {
        if (this.confirmed || !this.selectedKey) return;
        this.confirmed = true;
        this.confirmBtn.setText('✗ 取消確定').setStyle({ color: '#ff6666' });

        const label = STAGE_LIST.find(s => s.key === this.selectedKey)?.label ?? this.selectedKey;
        this.statusTxt.setText(`已確定「${label}」，等待對手…`);

        /* 把自己的數值設定一併送出（最終以 P1 的為準，雙方統一） */
        socket.emit('stageConfirmed', { roomId: this.roomId, stage: this.selectedKey, settings: { ...GAME_SETTINGS } });
    }

    cancelConfirm() {
        if (!this.confirmed) return;
        this.confirmed = false;
        this.confirmBtn.setText('✓ 確定場地').setStyle({ color: '#00ff88' });
        this.statusTxt.setText('◀ ▶ 切換場地');
        socket.emit('stageUnconfirmed', { roomId: this.roomId });
    }

    setupSocket() {
        socket.off('fightStart').off('opponentDisconnected')
              .off('opponentStage').off('opponentConfirmed').off('opponentUnconfirmed');

        /* 對手選了場地（預覽）→ 顯示對手選擇 + 切到該場地時標示 */
        socket.on('opponentStage', ({ stage }) => {
            this.opponentStageKey = stage;
            this.updateOppTag();
        });

        /* 對手已按確定 */
        socket.on('opponentConfirmed', () => {
            this.oppConfirmed = true;
            if (!this.confirmed) this.statusTxt.setText('對手已確定，換你按確定！');
        });

        /* 對手取消確定 */
        socket.on('opponentUnconfirmed', () => {
            this.oppConfirmed = false;
            if (!this.confirmed) this.statusTxt.setText('對手取消了確定…');
        });

        socket.on('fightStart', ({ stage, settings }) => {
            /* 套用 P1 的數值設定，雙方統一 */
            if (settings) {
                for (const k of Object.keys(GAME_SETTINGS)) {
                    if (typeof settings[k] === 'number') GAME_SETTINGS[k] = settings[k];
                }
            }
            this.scene.start('Fight', {
                roomId:     this.roomId,
                playerNum:  this.playerNum,
                localChar:  this.localChar,
                remoteChar: this.remoteChar,
                stage:      stage || 'yard',
            });
        });

        socket.on('opponentDisconnected', () => {
            this.scene.start('Select', { offline: false });
        });
    }
}

/* ══════════════════════════════
   FightScene – main battle
   ══════════════════════════════ */
class FightScene extends Phaser.Scene {
    constructor() { super('Fight'); }

    init(data) {
        this.roomId     = data.roomId;
        this.playerNum  = data.playerNum;
        this.localChar  = data.localChar;
        this.remoteChar = data.remoteChar;
        this.stage      = data.stage || 'yard';
        this.practice   = data.practice || false;   /* 單人練習模式 */
        this.debugOn    = false;
    }

    create() {
        /* Background */
        this.add.image(GAME_W / 2, GAME_H / 2, this.stage).setDisplaySize(GAME_W, GAME_H);

        /* 此場景的地板高度（每個場景可在 STAGE_LIST 設 floor 覆寫，預設 FLOOR_Y） */
        const stageDef = STAGE_LIST.find(s => s.key === this.stage);
        this.floorY = (stageDef && stageDef.floor) || FLOOR_Y;

        /* Start positions */
        const lx = 220, rx = 740;
        if (this.playerNum === 1) {
            this.local  = this.makePlayer(lx, this.localChar,   1);
            this.remote = this.makePlayer(rx, this.remoteChar, -1);
            this.localStart  = { x: lx, facing:  1 };
            this.remoteStart = { x: rx, facing: -1 };
        } else {
            this.local  = this.makePlayer(rx, this.localChar,  -1);
            this.remote = this.makePlayer(lx, this.remoteChar,  1);
            this.localStart  = { x: rx, facing: -1 };
            this.remoteStart = { x: lx, facing:  1 };
        }

        this.setupHUD();
        this.setupKeys();
        this.setupSocket();
        this.setupPlayerLabels();

        this.localAuraOn  = false;
        this.remoteAuraOn = false;
        this.setupAura();

        this.localShieldOn  = false;
        this.remoteShieldOn = false;
        this.setupShield();

        this.active       = false;
        this.syncTimer    = 0;
        this.hitDone      = false;
        this.remoteHP     = GAME_SETTINGS.maxHP;
        this.remoteEnergy = 0;
        this.remoteGuard  = 100;
        this.remoteHurtUntil = 0;   /* 對手受擊動畫鎖定到此時間（防閃爍） */
        this.projectiles  = [];

        /* ── 回合制：三戰兩勝 ── */
        this.roundWins = { local: 0, remote: 0 };
        this.roundNum  = 1;
        this.roundOver = false;
        this.matchEnded = false;
        this.WINS_NEEDED = 2;
        this.setupRoundUI();

        /* ── 戰鬥統計（給結算總結用） ── */
        this.stats = {
            punch:   { n: 0, dmg: 0 },
            kick:    { n: 0, dmg: 0 },
            special: { n: 0, dmg: 0 },
            maxCombo: 0,
            oppDmg: 0,   /* 對手對我造成的總傷害 */
        };

        /* ── 連擊系統（雙方各一組顯示） ── */
        this.comboCount   = 0;   /* 本地連擊 */
        this.remoteCombo  = 0;   /* 對手連擊（由 state 同步） */
        this.lastHitTime  = 0;
        this.COMBO_WINDOW = 1300;   /* 連擊時限（毫秒） */
        /* 本地顯示在自己那側、對手顯示在對手那側 */
        const localX  = this.playerNum === 1 ? 250 : GAME_W - 250;
        const remoteX = this.playerNum === 1 ? GAME_W - 250 : 250;
        this.comboLocal  = this.makeComboBadge(localX);
        this.comboRemote = this.makeComboBadge(remoteX);

        this.setupDebug();

        /* ── 戰鬥背景音樂（循環） ── */
        this.bgmBaseVol = 0.25;
        this.bgm = this.sound.add('battleBgm', { loop: true, volume: this.bgmBaseVol });
        this.bgm.play();
        this.events.once('shutdown', () => { if (this.bgm) this.bgm.stop(); });

        this.showRoundBanner(() => this.countdown());
    }

    /* ── Debug 疊層 ── */
    setupDebug() {
        this.debugGfx = this.add.graphics().setDepth(50);
        this.debugText = this.add.text(8, 58, '', {
            fontSize: '12px', color: '#00ff66', fontFamily: 'monospace',
            backgroundColor: '#000000bb', padding: { x: 6, y: 6 },
        }).setDepth(51).setVisible(false);

        /* ` 鍵切換 debug 疊層 */
        this.input.keyboard.on('keydown-BACKTICK', () => {
            this.debugOn = !this.debugOn;
            this.debugText.setVisible(this.debugOn);
            if (!this.debugOn) this.debugGfx.clear();
        });

        /* 作弊鍵（僅 debug 開啟時生效） */
        this.input.keyboard.on('keydown-E', () => { if (this.debugOn) this.local.energy = 100; });
        this.input.keyboard.on('keydown-H', () => { if (this.debugOn) this.local.hp = GAME_SETTINGS.maxHP; });
        this.input.keyboard.on('keydown-R', () => {
            if (!this.debugOn) return;
            this.local.hp = GAME_SETTINGS.maxHP; this.local.energy = 0;
            this.remoteHP = GAME_SETTINGS.maxHP; this.remoteEnergy = 0;
        });
        this.input.keyboard.on('keydown-G', () => {
            if (!this.debugOn) return;
            /* 對對手造成 30 傷害 */
            if (this.practice) {
                this.remoteHP = Math.max(0, this.remoteHP - 30);
                this.hitFX(this.remote.x, this.remote.y - 80, true);
                this.dummyHit('special');
            } else {
                socket.emit('dealDamage', { roomId: this.roomId, amount: 30, type: 'special' });
            }
        });

        /* 練習模式：ESC 返回主選單 + 畫面提示 */
        if (this.practice) {
            this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
            this.add.text(GAME_W / 2, GAME_H - 14, '練習模式　按 ` 開啟 Debug　ESC 離開', {
                fontSize: '14px', color: '#aaddff',
                stroke: '#000', strokeThickness: 3,
                backgroundColor: '#11223388', padding: { x: 10, y: 4 },
            }).setOrigin(0.5, 1).setDepth(40);
        }
    }

    /* ── 更新 debug 疊層內容 ── */
    updateDebug() {
        const g = this.debugGfx;
        g.clear();
        if (!this.debugOn) return;

        const bodyW = FRAME_W * SCALE * 0.32;
        const bodyH = FRAME_H * SCALE * 0.55;

        /* 兩人受擊框（綠） */
        for (const p of [this.local, this.remote]) {
            const cx = p.x, cy = p.y - bodyH * 0.5;
            const hw = bodyW + 20, hh = bodyH;
            g.lineStyle(1, 0x00ff66, 0.9).strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
        }

        /* 本地攻擊範圍（紅，攻擊中且非投射物時） */
        const p = this.local;
        if (p.attacking && p.attackType) {
            const reach = p.attackType === 'special' ? 180
                        : p.attackType === 'kick'    ? 130 : 105;
            const tipX = p.x + p.facing * reach;
            const tipY = p.y - bodyH * 0.5;
            g.lineStyle(2, 0xff3333, 0.9).lineBetween(p.x, tipY, tipX, tipY);
            g.fillStyle(0xff3333, 0.5).fillCircle(tipX, tipY, 8);
        }

        /* 投射物位置（黃點） */
        g.fillStyle(0xffee00, 0.8);
        for (const proj of this.projectiles) g.fillCircle(proj.img.x, proj.img.y, 5);

        /* 文字資訊 */
        const fps = Math.round(this.game.loop.actualFps);
        const fmt = (pl, hp) =>
            `x:${pl.x.toFixed(0)} y:${pl.y.toFixed(0)} hp:${hp.toFixed(0)} ` +
            `sp:${pl.energy.toFixed(0)} anim:${pl.anim} face:${pl.facing} atk:${pl.attackType ?? '-'}`;
        this.debugText.setText([
            `FPS:${fps}   mode:${this.practice ? 'PRACTICE' : 'ONLINE'}   room:${this.roomId ?? '-'}  P${this.playerNum}`,
            `LOCAL  ${fmt(this.local, this.local.hp)}`,
            `REMOTE ${fmt(this.remote, this.remoteHP)} sp:${this.remoteEnergy.toFixed(0)}`,
            `proj:${this.projectiles.length}`,
            `[\`]切換  [E]充能  [H]補血  [G]打對手  [R]重置${this.practice ? '  [ESC]離開' : ''}`,
        ].join('\n'));
    }

    /* ── 練習模式：假人受擊反應 ── */
    dummyHit(type) {
        const r = this.remote;
        if (this.remoteHP <= 0) {
            r.anim = '';
            this.playAnim(r, 'death');
            this.playCharSfx(`death_${r.ch}`);
            this.time.delayedCall(1500, () => {
                if (!this.active) return;
                this.remoteHP = GAME_SETTINGS.maxHP;   /* 假人復活，方便持續練習 */
                r.anim = '';
                this.playAnim(r, 'walk');
            });
        } else {
            r.anim = '';
            this.playAnim(r, 'hit');   /* 統一用 hit 受擊動畫 */
            this.time.delayedCall(400, () => {
                if (!this.active || this.remoteHP <= 0) return;
                r.anim = '';
                this.playAnim(r, 'walk');
            });
        }
    }

    /* ── P1/P2 labels + self-indicator ── */
    setupPlayerLabels() {
        const myNum     = this.playerNum;
        const theirNum  = myNum === 1 ? 2 : 1;
        const labelStyle = (color) => ({
            fontSize: '18px', color, fontStyle: 'bold',
            stroke: '#000', strokeThickness: 5,
            backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
        });

        /* floating 名牌：你（綠）/ 對手（橘） */
        this.localTag  = this.add.text(0, 0, `P${myNum}·你`,    labelStyle('#00ff88')).setOrigin(0.5, 1).setDepth(15);
        this.remoteTag = this.add.text(0, 0, `P${theirNum}·對手`, labelStyle('#ff8844')).setOrigin(0.5, 1).setDepth(15);

        /* 綠色箭頭標示自己（加大） */
        this.selfArrow = this.add.text(0, 0, '▼', {
            fontSize: '26px', color: '#00ff88',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5, 1).setDepth(16);

        /* 同角色：把「對手」染成藍色（自己永遠是原色，最好分辨） */
        if (this.localChar === this.remoteChar) {
            this.remote.sprite.setTint(0x55aaff);
        }
    }

    /* ── Player factory ── */
    makePlayer(x, ch, facing) {
        const sp = this.add.sprite(x, this.floorY, ch)
            .setScale(SCALE).setOrigin(0.5, 1).setDepth(2);
        sp.setFlipX(facing < 0);
        sp.play(`${ch}_walk`);

        return {
            sprite: sp, ch,
            x, y: this.floorY,
            velY: 0, facing,
            hp: GAME_SETTINGS.maxHP,
            energy:    0,
            jumping:   false,
            attacking: false,
            attackType: null,
            hurt:      false,
            blocking:  false,
            guard:       100,    /* 防禦耐力 */
            guardBroken: false,  /* 防禦破壞中（需回復才能再防禦） */
            anim:      'walk',
            targetX:   x,
            targetY:   this.floorY,
        };
    }

    /* ── HUD ── */
    setupHUD() {
        const leftCh  = this.playerNum === 1 ? this.localChar  : this.remoteChar;
        const rightCh = this.playerNum === 1 ? this.remoteChar : this.localChar;
        const leftIsLocal = this.playerNum === 1;   /* 左側血條是不是「自己」 */

        const HPW = 300, SPW = 240, SEG = 8;

        /* ── HP bars (row 1, y=22)：黑底 + 黃色掉血殘影 + 綠色血量 + 頂部光澤 ── */
        this.add.rectangle(205, 22, 306, 22, 0x000000).setDepth(7);
        this.lDmg = this.add.rectangle(57, 22, HPW, 16, 0xffcc00).setOrigin(0, 0.5).setDepth(8);
        this.lBar = this.add.rectangle(57, 22, HPW, 16, 0x44ff44).setOrigin(0, 0.5).setDepth(9);
        this.add.rectangle(57, 17, HPW, 4, 0xffffff, 0.25).setOrigin(0, 0.5).setDepth(10);
        this.add.text(207, 6, (leftIsLocal ? '▶ 你 · ' : 'P1 · ') + leftCh, {
            fontSize: '15px', color: leftIsLocal ? '#ffee33' : '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5, 0).setDepth(12);

        this.add.rectangle(755, 22, 306, 22, 0x000000).setDepth(7);
        this.rDmg = this.add.rectangle(903, 22, HPW, 16, 0xffcc00).setOrigin(1, 0.5).setDepth(8);
        this.rBar = this.add.rectangle(903, 22, HPW, 16, 0x44ff44).setOrigin(1, 0.5).setDepth(9);
        this.add.rectangle(903, 17, HPW, 4, 0xffffff, 0.25).setOrigin(1, 0.5).setDepth(10);
        this.add.text(753, 6, rightCh + (leftIsLocal ? ' · P2' : ' · 你 ◀'), {
            fontSize: '15px', color: leftIsLocal ? '#ffffff' : '#ffee33', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5, 0).setDepth(12);

        this.add.text(GAME_W / 2, 22, 'VS', {
            fontSize: '15px', color: '#ffee00', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        /* ── SP 能量條 (row 2, y=45) 寬 240、分段格 ── */
        this.add.rectangle(177, 45, 246, 14, 0x000000).setDepth(8);
        this.lEBar = this.add.rectangle(57, 45, SPW, 10, 0x33ccff).setOrigin(0, 0.5).setDepth(9);
        this.add.rectangle(783, 45, 246, 14, 0x000000).setDepth(8);
        this.rEBar = this.add.rectangle(903, 45, SPW, 10, 0x33ccff).setOrigin(1, 0.5).setDepth(9);
        const spLabel = { fontSize: '11px', color: '#88ddff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 };
        this.add.text(57 + SPW + 8, 45, 'SP', spLabel).setOrigin(0, 0.5).setDepth(11);
        this.add.text(903 - SPW - 8, 45, 'SP', spLabel).setOrigin(1, 0.5).setDepth(11);

        /* ── 防禦耐力條 (row 3, y=62) 寬 180、加高加亮 ── */
        const gLabel = { fontSize: '11px', color: '#dd99ff', fontStyle: 'bold',
                         stroke: '#000', strokeThickness: 3 };
        this.add.rectangle(147, 65, 186, 17, 0x000000).setDepth(8);
        this.lGBar = this.add.rectangle(57, 65, 180, 12, 0xbb66ff).setOrigin(0, 0.5).setDepth(9);
        this.add.text(57 + 180 + 8, 65, 'GUARD', gLabel).setOrigin(0, 0.5).setDepth(10);

        this.add.rectangle(813, 65, 186, 17, 0x000000).setDepth(8);
        this.rGBar = this.add.rectangle(903, 65, 180, 12, 0xbb66ff).setOrigin(1, 0.5).setDepth(9);
        this.add.text(903 - 180 - 8, 65, 'GUARD', gLabel).setOrigin(1, 0.5).setDepth(10);

        /* 大招 READY 提示文字 */
        this.lReadyTxt = this.add.text(207, 42, '⚡ 大招 READY!', {
            fontSize: '11px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(11).setVisible(false);

        this.rReadyTxt = this.add.text(753, 42, '⚡ 大招 READY!', {
            fontSize: '11px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(11).setVisible(false);

        /* 按 playerNum 分配 local/remote 各自對應的 bar */
        this.localBar  = this.playerNum === 1 ? this.lBar  : this.rBar;
        this.remoteBar = this.playerNum === 1 ? this.rBar  : this.lBar;
        this.localDmg  = this.playerNum === 1 ? this.lDmg  : this.rDmg;
        this.remoteDmg = this.playerNum === 1 ? this.rDmg  : this.lDmg;
        this.localHPshown  = GAME_SETTINGS.maxHP;
        this.remoteHPshown = GAME_SETTINGS.maxHP;
        this.localEBar  = this.playerNum === 1 ? this.lEBar : this.rEBar;
        this.remoteEBar = this.playerNum === 1 ? this.rEBar : this.lEBar;
        this.localGBar  = this.playerNum === 1 ? this.lGBar : this.rGBar;
        this.remoteGBar = this.playerNum === 1 ? this.rGBar : this.lGBar;
        this.localReadyTxt  = this.playerNum === 1 ? this.lReadyTxt : this.rReadyTxt;
        this.remoteReadyTxt = this.playerNum === 1 ? this.rReadyTxt : this.lReadyTxt;

        /* ── 角色頭貼（圓形） ── */
        const addPortrait = (ch, cx, cy, R) => {
            const key = `portrait_${ch}`;
            if (!this.textures.exists(key)) return;
            /* 深色背景圓 */
            this.add.graphics()
                .fillStyle(0x111111, 0.85).fillCircle(cx, cy, R).setDepth(8);
            /* 頭貼圖片 */
            const img = this.add.image(cx, cy, key)
                .setDisplaySize(R * 2, R * 2).setDepth(9);
            /* 圓形遮罩 */
            const msk = this.make.graphics({ add: false });
            msk.fillStyle(0xffffff).fillCircle(cx, cy, R);
            img.setMask(msk.createGeometryMask());
            /* 金色邊框 */
            this.add.graphics()
                .lineStyle(2, 0xffee00, 0.9).strokeCircle(cx, cy, R + 1).setDepth(10);
        };

        addPortrait(leftCh,  28,  27, 22);   /* 左側血條旁 */
        addPortrait(rightCh, 928, 27, 22);   /* 右側血條旁 */
    }

    /* ── 回合勝利點 UI ── */
    setupRoundUI() {
        const TW = 22, TH = 33;   /* 獎盃顯示大小 */
        const makeTrophies = (x0, dir) => {
            const arr = [];
            for (let i = 0; i < this.WINS_NEEDED; i++) {
                arr.push(this.add.image(x0 + dir * i * 28, 87, 'trophy')
                    .setDisplaySize(TW, TH).setDepth(11));
            }
            return arr;
        };
        const leftT  = makeTrophies(58, 1);
        const rightT = makeTrophies(902, -1);
        this.localDots  = this.playerNum === 1 ? leftT  : rightT;
        this.remoteDots = this.playerNum === 1 ? rightT : leftT;

        /* 回合提示文字（置中上方） */
        this.roundTxt = this.add.text(GAME_W / 2, 72, '', {
            fontSize: '26px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(11);

        this.updateRoundUI();
    }

    updateRoundUI() {
        /* 已贏的回合：獎盃全亮彩色；未贏：暗灰半透明 */
        const apply = (arr, wins) => arr.forEach((t, i) => {
            if (i < wins) { t.setAlpha(1).clearTint(); }
            else          { t.setAlpha(0.35).setTint(0x666666); }
        });
        apply(this.localDots,  this.roundWins.local);
        apply(this.remoteDots, this.roundWins.remote);
        this.roundTxt.setText(`第 ${this.roundNum} 回合`);
    }

    /* ── 獎盃點亮特效：放大彈跳 + 閃光 + 火花 ── */
    popTrophy(t) {
        const sx = t.scaleX, sy = t.scaleY;
        t.setScale(sx * 1.9, sy * 1.9).setTint(0xffffff);
        this.tweens.add({ targets: t, scaleX: sx, scaleY: sy, duration: 450, ease: 'Back.Out' });
        this.time.delayedCall(180, () => { if (t.active) t.clearTint(); });

        const e = this.add.particles(t.x, t.y, 'aura_particle', {
            speed: { min: 60, max: 190 }, lifespan: 520,
            scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 },
            tint: [0xffee00, 0xffffff, 0xffcc00], blendMode: 'ADD', emitting: false,
        }).setDepth(12);
        e.explode(16, t.x, t.y);
        this.time.delayedCall(560, () => e.destroy());
    }

    setupKeys() {
        this.keys = this.input.keyboard.addKeys({
            left:    Phaser.Input.Keyboard.KeyCodes.A,
            right:   Phaser.Input.Keyboard.KeyCodes.D,
            jump:    Phaser.Input.Keyboard.KeyCodes.W,
            punch:   Phaser.Input.Keyboard.KeyCodes.J,
            kick:    Phaser.Input.Keyboard.KeyCodes.K,
            special: Phaser.Input.Keyboard.KeyCodes.L,
            block:   Phaser.Input.Keyboard.KeyCodes.I,
        });
    }

    setupSocket() {
        if (this.practice) return;   /* 練習模式不連線 */

        socket.off('opponentState').off('takeDamage')
              .off('opponentDied').off('opponentDisconnected').off('projectileFired').off('opponentAction');

        socket.on('opponentState', s => this.onRemoteState(s));
        socket.on('opponentAction', ({ action }) => this.onOpponentAction(action));
        socket.on('takeDamage',    ({ amount, type }) => this.onHit(amount, type));
        socket.on('opponentDied',  () => {
            /* play death on remote side */
            this.remoteHP = 0;            /* 對手死亡 → 血條歸零（避免看起來還有殘量） */
            this.refreshBars();
            this.remote.anim = '';
            this.playAnim(this.remote, 'death');
            this.playCharSfx(`death_${this.remote.ch}`);   /* 對手死亡音效 */
            this.onRoundEnd(true);   /* 本回合贏 */
        });
        socket.on('opponentDisconnected', () => this.endFight('win'));

        /* 對手射出投射物，本地端僅顯示視覺（不做傷害判定） */
        socket.on('projectileFired', ({ x, y, vx, vy, spin, grow, textureKey, dispW, dispH }) => {
            if (!this.active) return;
            const w = dispW ?? 84, h = dispH ?? 42;
            const img = this.add.image(x, y, textureKey ?? 'dude')
                .setDisplaySize(w, h).setDepth(3).setFlipX(vx < 0);
            this.projectiles.push({ img, vx, vy: vy ?? 0, spin: spin ?? 300, isLocal: false, dispW: w, dispH: h, grow: grow ?? 0 });
        });
    }

    /* ── 回合開始橫幅：停留一下再開始倒數 ── */
    showRoundBanner(done) {
        const isFinal = (this.roundWins.local === this.WINS_NEEDED - 1
                      && this.roundWins.remote === this.WINS_NEEDED - 1);
        const label = isFinal ? '最終回合' : `第 ${this.roundNum} 回合`;
        const t = this.add.text(GAME_W / 2, GAME_H / 2 - 30, label, {
            fontSize: '72px', color: isFinal ? '#ff4422' : '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 11, padding: { top: 8, bottom: 5 },
        }).setOrigin(0.5).setDepth(30).setScale(0.7).setAlpha(0);

        this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 350, ease: 'Back.Out' });
        this.time.delayedCall(1200, () => {
            this.tweens.add({
                targets: t, alpha: 0, scale: 1.25, duration: 250,
                onComplete: () => t.destroy(),
            });
            done();
        });
    }

    /* ── Countdown ── */
    countdown() {
        const t = this.add.text(GAME_W / 2, GAME_H / 2 - 40, '', {
            fontSize: '110px', color: '#fff',
            stroke: '#000', strokeThickness: 12, fontStyle: 'bold',
            padding: { top: 8, bottom: 5 },
        }).setOrigin(0.5).setDepth(20);

        let n = 3;
        const tick = () => {
            if (n > 0) {
                t.setText(String(n)).setScale(1.4);
                this.tweens.add({ targets: t, scaleX: 1, scaleY: 1, duration: 900, ease: 'Power2' });
                n--;
                this.time.delayedCall(1000, tick);
            } else {
                t.setText('FIGHT!').setScale(1);
                this.active = true;
                this.time.delayedCall(800, () => t.destroy());
            }
        };
        tick();
    }

    /* ══ update ══ */
    update(_, delta) {
        if (!this.active) return;
        const dt = delta / 1000;

        this.updateLocal(dt);
        if (this.practice) {
            /* 假人原地站立、面向玩家 */
            const r = this.remote;
            r.facing = Math.sign(this.local.x - r.x) || r.facing;
            r.sprite.setFlipX(r.facing < 0);
        } else {
            this.interpRemote(dt);
        }
        this.detectHit();
        this.refreshBars();
        this.updateLabels();
        this.updateAura();
        this.updateShield();
        this.updateProjectiles(dt);
        this.updateDebug();

        /* 連擊超時則中斷 */
        if (this.comboCount > 0 && this.time.now - this.lastHitTime > this.COMBO_WINDOW) {
            this.resetCombo();
        }

        /* sync ~30 fps（練習模式不送） */
        if (!this.practice) {
            this.syncTimer += delta;
            if (this.syncTimer >= 20) {
                this.syncTimer = 0;
                const p = this.local;
                socket.emit('playerState', {
                    roomId: this.roomId,
                    state: { x: p.x, y: p.y, facing: p.facing, anim: p.anim, hp: p.hp, energy: p.energy, blocking: p.blocking, guard: p.guard, combo: this.comboCount },
                });
            }
        }
    }

    /* ── Local player input & physics ── */
    updateLocal(dt) {
        const p = this.local;
        const k = this.keys;
        let dx = 0;

        /* 防禦：按住 I、在地面、非攻擊/受傷、且耐力未破壞且 >0 */
        const wantBlock = k.block.isDown && !p.hurt && !p.attacking && !p.jumping
                          && !p.guardBroken && p.guard > 0;
        if (wantBlock) {
            p.blocking = true;
            p.guard = Math.max(0, p.guard - 45 * dt);   /* 防禦時消耗耐力（約 2.2 秒） */
            if (p.guard <= 0) {
                /* 防禦破壞：強制中斷，需回復才能再防禦 */
                p.guardBroken = true;
                p.blocking = false;
                p.anim = '';
                this.guardBreakFX(p);
            } else {
                /* 防禦時面向對手、停止移動、定格 */
                const fd = Math.sign(this.remote.x - p.x);
                if (fd !== 0) p.facing = fd;
                if (p.anim !== 'block') {
                    p.anim = 'block';
                    p.sprite.stop();
                    p.sprite.setFrame(0);
                }
                p.sprite.setPosition(p.x, p.y);
                p.sprite.setFlipX(p.facing < 0);
                if (p.hp > 0) p.energy = Math.min(100, p.energy + GAME_SETTINGS.spRegen * dt);
                return;   /* 防禦時不處理其他輸入 */
            }
        }
        if (p.blocking) { p.blocking = false; p.anim = ''; }   /* 放開防禦 */

        /* 非防禦時耐力回復；破壞狀態回復到 40 才解除 */
        if (!p.blocking) {
            p.guard = Math.min(100, p.guard + 10 * dt);
            if (p.guardBroken && p.guard >= 40) p.guardBroken = false;
        }

        /* input only when not hurt */
        if (!p.hurt) {
            if (!p.attacking) {
                if (k.left.isDown)  { dx = -MOVE_SPD; p.facing = -1; }
                if (k.right.isDown) { dx = +MOVE_SPD; p.facing =  1; }

                /* when idle, auto-face opponent */
                if (dx === 0) {
                    const fd = Math.sign(this.remote.x - p.x);
                    if (fd !== 0) p.facing = fd;
                }

                /* jump */
                if (Phaser.Input.Keyboard.JustDown(k.jump) && !p.jumping) {
                    p.velY    = JUMP_VEL;
                    p.jumping = true;
                    this.playAnim(p, 'jump');
                    this.emitAction('jump');
                }

                /* punch */
                if (Phaser.Input.Keyboard.JustDown(k.punch) && !p.jumping) {
                    p.attacking  = true;
                    p.attackType = 'punch';
                    this.hitDone = false;
                    this.stats.punch.n++;
                    this.playAnim(p, 'punch');
                    this.emitAction('punch');
                    p.sprite.off('animationcomplete');
                    p.sprite.once('animationcomplete', () => {
                        p.attacking  = false;
                        p.attackType = null;
                        p.anim = '';
                        this.playAnim(p, 'walk');
                    });
                }

                /* kick */
                if (Phaser.Input.Keyboard.JustDown(k.kick) && !p.jumping) {
                    p.attacking  = true;
                    p.attackType = 'kick';
                    this.hitDone = false;
                    this.stats.kick.n++;
                    this.playAnim(p, 'kick');
                    this.emitAction('kick');
                    p.sprite.off('animationcomplete');
                    p.sprite.once('animationcomplete', () => {
                        p.attacking  = false;
                        p.attackType = null;
                        p.anim = '';
                        this.playAnim(p, 'walk');
                    });
                }

                /* special：需要能量滿格 */
                if (Phaser.Input.Keyboard.JustDown(k.special) && !p.jumping) {
                    if (p.energy < 100) {
                        /* 能量不足提示 */
                        const t = this.add.text(p.x, p.y - FRAME_H * SCALE - 10, 'SP 不足', {
                            fontSize: '16px', color: '#ff7777', fontStyle: 'bold',
                            stroke: '#000', strokeThickness: 4,
                        }).setOrigin(0.5).setDepth(28);
                        this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
                    }
                    if (p.energy >= 100) {
                        p.energy     = 0;
                        p.attacking  = true;
                        p.attackType = 'special';
                        this.stats.special.n++;
                        /* 投射物角色跳過近戰 detectHit */
                        this.hitDone = p.ch === '聾' || p.ch === 'Action張' || p.ch === '瓜張' || p.ch === '皇';
                        this.playCharSfx(`special_${p.ch}`);   /* 大招音效 */
                        this.playAnim(p, 'special');
                        this.emitAction('special');
                        p.sprite.off('animationcomplete');
                        p.sprite.once('animationcomplete', () => {
                            p.attacking  = false;
                            p.attackType = null;
                            p.anim = '';
                            this.playAnim(p, 'walk');
                        });
                        /* 投射物角色：蓄力後射出 */
                        if (p.ch === '聾') {
                            this.time.delayedCall(180, () => {
                                if (this.active) this.fireProjectile(p, 'dude', 50, 50, { grow: 150 });
                            });
                        } else if (p.ch === 'Action張') {
                            this.time.delayedCall(180, () => {
                                if (this.active) this.fireProjectile(p, 'vodka', 36, 100);
                            });
                        } else if (p.ch === '瓜張') {
                            /* 大招：物品從對手頭頂正上方砸下來 */
                            this.time.delayedCall(220, () => {
                                if (!this.active) return;
                                const tgt = this.remote;
                                this.fireProjectile(p, 'kaobei', 140, 140, {
                                    vx: 0, vy: 620, spin: 160, homeX: true,
                                    startX: tgt.x,
                                    startY: -120,
                                });
                            });
                        } else if (p.ch === '皇') {
                            this.time.delayedCall(150, () => {
                                if (this.active) this.fireGarbageBarrage(p);
                            });
                        }
                    }
                }
            }
        }

        p.x += dx * dt;

        /* gravity always runs (prevents floating when hurt mid-air) */
        p.velY += GRAVITY * dt;
        p.y    += p.velY   * dt;

        if (p.y >= this.floorY) {
            p.y    = this.floorY;
            p.velY = 0;
            if (p.jumping) {
                p.jumping = false;
                if (!p.attacking && !p.hurt) {
                    p.anim = '';
                    this.playAnim(p, 'walk');
                }
            }
        }

        p.x = Phaser.Math.Clamp(p.x, 55, GAME_W - 55);

        /* idle vs walk (only when free) */
        if (!p.attacking && !p.jumping && !p.hurt) {
            if (dx !== 0) {
                this.playAnim(p, 'walk');
            } else if (p.anim !== 'idle') {
                p.anim = 'idle';
                p.sprite.stop();
                p.sprite.setFrame(0);
            }
        }

        /* 被動能量累積（約 25 秒填滿；死亡後停止） */
        if (p.hp > 0) {
            p.energy = Math.min(100, p.energy + GAME_SETTINGS.spRegen * dt);
        }

        p.sprite.setPosition(p.x, p.y);
        p.sprite.setFlipX(p.facing < 0);
    }

    /* ── Remote player interpolation ── */
    interpRemote(dt) {
        const p = this.remote;
        const f = 1 - Math.pow(0.05, dt * 10);
        p.x = Phaser.Math.Linear(p.x, p.targetX, f);
        p.y = Math.min(Phaser.Math.Linear(p.y, p.targetY, f), this.floorY);
        p.sprite.setPosition(p.x, p.y);
    }

    /* ── Hit detection (local client-side) ── */
    detectHit() {
        const p = this.local;
        if (!p.attacking || this.hitDone) return;

        const reach = p.attackType === 'special' ? 180
                    : p.attackType === 'kick'    ? 130 : 105;
        const bodyW  = FRAME_W * SCALE * 0.32;
        const bodyH  = FRAME_H * SCALE * 0.55;
        /* dx > 0 = 對手在正前方；允許小負值（-bodyW）處理極近距離 */
        const dx     = p.facing * (this.remote.x - p.x);
        const tipY   = p.y - bodyH * 0.5;
        const remY   = this.remote.y - bodyH * 0.5;

        if (dx > -bodyW && dx <= reach &&
            Math.abs(tipY - remY) < bodyH) {

            this.hitDone = true;
            const baseDmg = p.attackType === 'special' ? GAME_SETTINGS.specialDmg
                          : p.attackType === 'kick'    ? GAME_SETTINGS.kickDmg : GAME_SETTINGS.punchDmg;
            const dmg = Math.round(baseDmg * this.comboMult());   /* 連擊加成 */
            const blocked = this.remote.blocking;
            const applied = blocked ? Math.max(1, Math.round(dmg * 0.15)) : dmg;
            this.remoteHP = Math.max(0, this.remoteHP - applied);
            if (this.stats[p.attackType]) this.stats[p.attackType].dmg += applied;   /* 統計傷害 */

            /* 命中增加能量：出拳 +8，踢腳 +12（大招本身不額外加） */
            const eGain = p.attackType === 'punch' ? 8
                        : p.attackType === 'kick'  ? 12 : 0;
            p.energy = Math.min(100, p.energy + eGain);

            if (this.practice) {
                this.dummyHit(p.attackType);   /* 練習：直接結算 + 假人反應 */
            } else {
                socket.emit('dealDamage', { roomId: this.roomId, amount: dmg, type: p.attackType });
            }
            /* 對手格擋 → 顯示格擋火花；否則正常命中特效 + 連擊計數 + 對手受擊動畫 */
            if (blocked) {
                this.blockSparkFX(this.remote.x + this.remote.facing * 25, this.remote.y - bodyH);
            } else {
                this.hitFX(this.remote.x, this.remote.y - bodyH, p.attackType === 'special');
                this.addCombo();
                if (!this.practice) this.playRemoteHurt(p.attackType);
            }
        }
    }

    /* ── 命中瞬間：立即在對手身上播放被擊中動畫（每次都重播） ── */
    playRemoteHurt(type) {
        if (this.remoteHP <= 0) return;   /* 已死亡交給死亡動畫 */
        const r = this.remote;
        r.anim = '';
        this.playAnim(r, 'hit');   /* 統一用 hit 受擊動畫 */
        this.remoteHurtUntil = this.time.now + 300;   /* 鎖定，避免同步把它蓋回 walk 而閃爍 */
    }

    /* ── Hit flash text ── */
    hitFX(x, y, isSpecial = false) {
        const label = isSpecial ? '💥 SPECIAL!' : 'HIT!';
        const size  = isSpecial ? '44px' : '32px';
        const color = isSpecial ? '#ff4400' : '#ffee00';
        const t = this.add.text(x, y, label, {
            fontSize: size, color,
            stroke: '#000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(25);
        this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: isSpecial ? 800 : 550, onComplete: () => t.destroy() });
        if (isSpecial) this.cameras.main.shake(300, 0.018);
    }

    /* ── Receive remote state ── */
    onRemoteState(s) {
        const p = this.remote;
        p.targetX = s.x;
        p.targetY = Math.min(s.y, this.floorY);   /* 防止對手座標超過地板 */
        p.facing  = s.facing;
        p.sprite.setFlipX(s.facing < 0);

        p.blocking = !!s.blocking;   /* 對手防禦狀態（給護盾特效用） */
        if (s.guard !== undefined) this.remoteGuard = s.guard;
        /* 對手連擊同步顯示 */
        if (s.combo !== undefined && s.combo !== this.remoteCombo) {
            this.remoteCombo = s.combo;
            if (s.combo >= 2) this.showComboBadge(this.comboRemote, s.combo);
            else              this.hideComboBadge(this.comboRemote);
        }

        /* 受擊鎖定期間：忽略 walk/idle/空 的覆蓋，讓被擊中動畫播完不閃爍 */
        const hurtLocked = this.time.now < this.remoteHurtUntil
            && (s.anim === 'walk' || s.anim === 'idle' || s.anim === 'block' || !s.anim);
        if (hurtLocked) {
            if (s.hp     !== undefined) this.remoteHP     = s.hp;
            if (s.energy !== undefined) this.remoteEnergy = s.energy;
            return;
        }

        const key = (s.anim === 'idle' || s.anim === 'block') ? null : `${p.ch}_${s.anim}`;
        if (!key) {
            p.sprite.stop(); p.sprite.setFrame(0);
        } else {
            const a = p.sprite.anims;
            /* walk 是循環動畫：若被停住（之前 idle）要重播，避免「平移沒動畫」；
               其餘（拳/腳/大招等非循環）只在 key 改變時播，避免重複抖動 */
            const needPlay = a.currentAnim?.key !== key
                          || (s.anim === 'walk' && !a.isPlaying);
            if (needPlay) p.sprite.play(key, true);
        }

        if (s.hp     !== undefined) this.remoteHP     = s.hp;
        if (s.energy !== undefined) this.remoteEnergy = s.energy;
        /* 回合勝負統一由 opponentDied / iDied 事件處理 */
    }

    /* ── Take damage (server says we got hit) ── */
    onHit(amount, type) {
        if (!this.active) return;
        const p = this.local;

        /* ── 防禦中：大幅減傷、不進入硬直、爆出格擋火花 ── */
        if (p.blocking) {
            const chip = Math.max(1, Math.round(amount * 0.15));   /* 僅 15% 削減傷害 */
            p.hp = Math.max(0, p.hp - chip);
            this.stats.oppDmg += chip;   /* 對手傷害統計 */
            /* 擋下攻擊額外消耗耐力（依傷害大小）→ 重招更易破防 */
            p.guard = Math.max(0, p.guard - amount * 0.8);
            if (p.guard <= 0) { p.blocking = false; p.guardBroken = true; p.anim = ''; this.guardBreakFX(p); }
            this.blockSparkFX(p.x + p.facing * 25, p.y - FRAME_H * SCALE * 0.5);
            this.cameras.main.shake(80, 0.004);
            if (p.hp <= 0) {
                p.blocking = false;
                p.anim = '';
                this.playAnim(p, 'death');
                this.playCharSfx(`death_${p.ch}`);
                socket.emit('iDied', { roomId: this.roomId });
                this.onRoundEnd(false);   /* 本回合輸 */
            }
            return;
        }

        p.hp = Math.max(0, p.hp - amount);
        this.stats.oppDmg += amount;   /* 對手傷害統計 */
        this.resetCombo();   /* 被打到 → 自己的連擊中斷 */

        /* clear any in-progress attack */
        p.attacking  = false;
        p.attackType = null;
        p.hurt       = true;
        p.sprite.off('animationcomplete');
        p.anim = '';

        if (p.hp <= 0) {
            /* death */
            this.playAnim(p, 'death');
            this.playCharSfx(`death_${p.ch}`);   /* 死亡音效 */
            this.cameras.main.shake(300, 0.02);
            socket.emit('iDied', { roomId: this.roomId });
            this.onRoundEnd(false);   /* 本回合輸 */
        } else {
            /* 受擊反應：統一用 hit（specialhit 幀無明顯動作），大招震動較大 */
            p.anim = '';
            this.playAnim(p, 'hit');
            this.cameras.main.shake(type === 'special' ? 250 : 120,
                                    type === 'special' ? 0.015 : 0.008);
            p.sprite.once('animationcomplete', () => {
                p.hurt = false;
                p.anim = '';
                this.playAnim(p, 'walk');
            });
        }
    }

    /* ── HP + SP bar refresh ── */
    refreshBars() {
        /* HP */
        const max = GAME_SETTINGS.maxHP;
        const lr = this.local.hp / max;
        const rr = this.remoteHP / max;
        this.localBar.setDisplaySize(300 * lr, 16);
        this.remoteBar.setDisplaySize(300 * rr, 16);
        const hpCol = r => r > 0.5 ? 0x44ff44 : r > 0.25 ? 0xffaa00 : 0xff3333;
        this.localBar.setFillStyle(hpCol(lr));
        this.remoteBar.setFillStyle(hpCol(rr));

        /* 黃色掉血殘影：受傷後緩慢追上實際血量 */
        if (this.localHPshown  == null) this.localHPshown  = this.local.hp;
        if (this.remoteHPshown == null) this.remoteHPshown = this.remoteHP;
        this.localHPshown  = this.local.hp  > this.localHPshown  ? this.local.hp  : this.localHPshown  + (this.local.hp  - this.localHPshown)  * 0.08;
        this.remoteHPshown = this.remoteHP > this.remoteHPshown ? this.remoteHP : this.remoteHPshown + (this.remoteHP - this.remoteHPshown) * 0.08;
        this.localDmg.setDisplaySize(300 * Math.max(0, this.localHPshown)  / max, 16);
        this.remoteDmg.setDisplaySize(300 * Math.max(0, this.remoteHPshown) / max, 16);

        /* SP 能量（用 scaleX 避免初始 width=0 的除零問題） */
        const le = this.local.energy / 100;
        const re = this.remoteEnergy / 100;
        this.localEBar.scaleX  = le;
        this.remoteEBar.scaleX = re;
        this.localEBar.setFillStyle(le  >= 1 ? 0xffee00 : 0x44aaff);
        this.remoteEBar.setFillStyle(re >= 1 ? 0xffee00 : 0x44aaff);

        /* 大招 READY 提示：滿格時出現並閃爍 */
        const wasLocalReady = this.localReadyTxt.visible;
        this.localReadyTxt.setVisible(le >= 1);
        if (le >= 1 && !wasLocalReady) {
            this.tweens.killTweensOf(this.localReadyTxt);
            this.tweens.add({
                targets: this.localReadyTxt, alpha: { from: 0.3, to: 1 },
                duration: 350, yoyo: true, repeat: -1,
            });
        } else if (le < 1) {
            this.tweens.killTweensOf(this.localReadyTxt);
            this.localReadyTxt.setAlpha(1);
        }

        this.remoteReadyTxt.setVisible(re >= 1);

        /* 防禦耐力條（破壞或過低時變紅） */
        const lg = Math.max(0.001, this.local.guard / 100);
        const rg = Math.max(0.001, this.remoteGuard / 100);
        this.localGBar.scaleX  = lg;
        this.remoteGBar.scaleX = rg;
        const gCol = (val, broken) => broken ? 0xff3333 : val > 0.3 ? 0xbb66ff : 0xffaa00;
        this.localGBar.setFillStyle(gCol(lg, this.local.guardBroken));
        this.remoteGBar.setFillStyle(gCol(rg, this.remoteGuard <= 0));
    }

    /* ── Move P1/P2 tags each frame ── */
    updateLabels() {
        const headH = FRAME_H * SCALE;
        const lx = this.local.x,  ly = this.local.y  - headH - 4;
        const rx = this.remote.x, ry = this.remote.y - headH - 4;
        this.localTag.setPosition(lx, ly);
        this.remoteTag.setPosition(rx, ry);
        this.selfArrow.setPosition(lx, ly - 18);
    }

    /* ── 能量滿格光環特效 ── */
    setupAura() {
        /* 建立一個柔邊圓形粒子貼圖（16×16，只需建一次） */
        if (!this.textures.exists('aura_particle')) {
            const pg = this.make.graphics({ add: false });
            pg.fillStyle(0xffffff);
            pg.fillCircle(8, 8, 8);
            pg.generateTexture('aura_particle', 16, 16);
            pg.destroy();
        }

        const bodyH = FRAME_H * SCALE;
        const cfg = {
            speed:     { min: 55, max: 150 },
            angle:     { min: 257, max: 283 },   /* 270 = 正上方 */
            scale:     { start: 0.65, end: 0 },
            alpha:     { start: 0.9,  end: 0 },
            tint:      [0xffffff, 0xffee00, 0xffcc00, 0xff9900, 0xff4400],
            blendMode: 'ADD',
            lifespan:  { min: 280, max: 680 },
            quantity:  6,
            frequency: 30,
            /* 從腳底到頭頂整個身體高度隨機散射 */
            emitZone:  { type: 'random', source: new Phaser.Geom.Rectangle(-22, -bodyH, 44, bodyH) },
        };

        this.localAura  = this.add.particles(this.local.x,  this.local.y,  'aura_particle', { ...cfg }).setDepth(1);
        this.localAura.stop();
        this.remoteAura = this.add.particles(this.remote.x, this.remote.y, 'aura_particle', { ...cfg }).setDepth(1);
        this.remoteAura.stop();
    }

    updateAura() {
        /* 本地玩家 */
        this.localAura.setPosition(this.local.x, this.local.y);
        const lFull = this.local.energy >= 100;
        if (lFull  && !this.localAuraOn)  { this.localAura.start();  this.localAuraOn  = true;  }
        if (!lFull && this.localAuraOn)   { this.localAura.stop();   this.localAuraOn  = false; }

        /* 遠端玩家 */
        this.remoteAura.setPosition(this.remote.x, this.remote.y);
        const rFull = this.remoteEnergy >= 100;
        if (rFull  && !this.remoteAuraOn) { this.remoteAura.start(); this.remoteAuraOn = true;  }
        if (!rFull && this.remoteAuraOn)  { this.remoteAura.stop();  this.remoteAuraOn = false; }
    }

    /* ── 防禦護盾：黃色能量罩 ── */
    setupShield() {
        /* 產生圓頂罩貼圖（黃色填色 + 亮邊 + 高光），只建一次 */
        if (!this.textures.exists('shield_dome')) {
            const R = 60, g = this.make.graphics({ add: false });
            g.fillStyle(0xffee00, 0.14).fillCircle(R, R, R);          /* 黃色能量場 */
            g.lineStyle(3, 0xffdd33, 0.6).strokeCircle(R, R, R - 2);  /* 外圈亮邊 */
            g.fillStyle(0xffffff, 0.30).fillCircle(R * 0.62, R * 0.55, R * 0.18); /* 高光點 */
            g.generateTexture('shield_dome', R * 2, R * 2);
            g.destroy();
        }

        /* 依角色高度決定護盾大小（罩住整個角色），dome 貼圖為 120px */
        const base = (FRAME_H * SCALE) / 120;
        const makeShield = () => {
            const dome = this.add.image(0, 0, 'shield_dome').setScale(base).setDepth(4).setVisible(false);
            /* 圓頂持續輕微脈動（相對 base 縮放） */
            this.tweens.add({
                targets: dome, scale: { from: base * 0.96, to: base * 1.06 },
                duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut',
            });
            return { dome };
        };

        this.localShield  = makeShield();
        this.remoteShield = makeShield();
    }

    updateShield() {
        const cy = FRAME_H * SCALE * 0.5;
        const apply = (sh, p, onKey) => {
            sh.dome.setPosition(p.x, p.y - cy);
            if (p.blocking && !this[onKey]) {
                sh.dome.setVisible(true);  this[onKey] = true;
            } else if (!p.blocking && this[onKey]) {
                sh.dome.setVisible(false); this[onKey] = false;
            }
        };
        apply(this.localShield,  this.local,  'localShieldOn');
        apply(this.remoteShield, this.remote, 'remoteShieldOn');
    }

    /* ── 格擋火花（一次性爆發） ── */
    blockSparkFX(x, y) {
        const e = this.add.particles(x, y, 'aura_particle', {
            speed:     { min: 90, max: 260 },
            lifespan:  380,
            scale:     { start: 0.7, end: 0 },
            alpha:     { start: 1, end: 0 },
            tint:      [0x88ddff, 0xffffff, 0x44aaff],
            blendMode: 'ADD',
            emitting:  false,
        }).setDepth(26);
        e.explode(22, x, y);
        this.time.delayedCall(450, () => e.destroy());

        const t = this.add.text(x, y - 20, 'GUARD', {
            fontSize: '24px', color: '#88ddff', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(27);
        this.tweens.add({ targets: t, y: y - 55, alpha: 0, duration: 500, onComplete: () => t.destroy() });
    }

    /* ── 防禦破壞特效 ── */
    guardBreakFX(p) {
        const y = p.y - FRAME_H * SCALE * 0.5;
        const e = this.add.particles(p.x, y, 'aura_particle', {
            speed:     { min: 120, max: 320 },
            lifespan:  450,
            scale:     { start: 0.8, end: 0 },
            alpha:     { start: 1, end: 0 },
            tint:      [0xffdd33, 0xff8800, 0xffffff],
            blendMode: 'ADD',
            emitting:  false,
        }).setDepth(26);
        e.explode(28, p.x, y);
        this.time.delayedCall(500, () => e.destroy());

        const t = this.add.text(p.x, y - 20, 'GUARD BREAK!', {
            fontSize: '22px', color: '#ff5522', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(27);
        this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 700, onComplete: () => t.destroy() });
        this.cameras.main.shake(150, 0.008);
    }

    /* ── 投射物：射出（textureKey / 顯示尺寸 / 選項可自訂） ── */
    fireProjectile(player, textureKey, dispW, dispH, opts = {}) {
        const {
            damage = GAME_SETTINGS.specialDmg,   /* 命中傷害 */
            single = true,      /* true: 畫面上只能有一顆 */
            vx     = player.facing * 650,
            vy     = 0,         /* 垂直速度（彈幕散射用） */
            spin   = 300,       /* 旋轉速度 */
            grow   = 0,         /* 每秒放大的像素數（飛行時越來越大） */
            startX = player.x + player.facing * 55,
            startY = player.y - FRAME_H * SCALE * 0.5,
            homeX  = false,     /* 落下時水平輕微追蹤對手（砸頭用） */
        } = opts;

        /* 限制單發的投射物，畫面上已有一顆就不再射 */
        if (single && this.projectiles.some(p => p.isLocal && p.single)) return;

        const img = this.add.image(startX, startY, textureKey)
            .setDisplaySize(dispW, dispH).setDepth(3).setFlipX(vx < 0);
        this.projectiles.push({ img, vx, vy, spin, damage, single, isLocal: true, dispW, dispH, grow, homeX, born: this.time.now });

        /* 告訴對手也顯示投射物（練習模式不送） */
        if (!this.practice) {
            socket.emit('projectileFired', {
                roomId: this.roomId, x: startX, y: startY, vx, vy, spin, grow,
                textureKey, dispW, dispH,
            });
        }
    }

    /* ── 皇 大招：丟出一連串垃圾彈幕 ── */
    fireGarbageBarrage(player) {
        const COUNT = 8;
        for (let n = 0; n < COUNT; n++) {
            this.time.delayedCall(n * 90, () => {
                if (!this.active) return;
                const tex   = `trash${Phaser.Math.Between(1, 8)}`;
                const size  = Phaser.Math.Between(48, 72);
                const vyArc = Phaser.Math.Between(-160, 160);   /* 上下散射 */
                const vxVar = player.facing * Phaser.Math.Between(520, 740);
                this.fireProjectile(player, tex, size, size, {
                    damage: Math.max(1, Math.round(GAME_SETTINGS.specialDmg * 0.2)),   /* 每顆=大招的 20% */
                    single: false,        /* 可同時多顆 */
                    vx: vxVar,
                    vy: vyArc,
                    spin: Phaser.Math.Between(-400, 400),
                    startY: player.y - FRAME_H * SCALE * (0.4 + Math.random() * 0.3),
                });
            });
        }
    }

    /* ── 送出攻擊/跳躍動作事件（確保對手一定播到動畫） ── */
    emitAction(action) {
        if (!this.practice) socket.emit('playerAction', { roomId: this.roomId, action });
    }

    /* ── 收到對手動作 → 立即在對手身上播放該動畫 ── */
    onOpponentAction(action) {
        if (!this.active) return;
        const p = this.remote;
        p.anim = '';
        this.playAnim(p, action);
        if (action === 'special') this.playCharSfx(`special_${p.ch}`);
    }

    /* 部分音檔本身偏小聲，這裡加大增益（WebAudio 音量可 > 1） */
    static SFX_VOLUME = { 'death_皇': 2.2 };

    /* ── 播放角色音效（全音量；同時把 BGM 壓低突顯） ── */
    playCharSfx(key) {
        if (!this.cache.audio.exists(key)) return;
        const vol = FightScene.SFX_VOLUME[key] ?? 1;
        const s = this.sound.add(key, { volume: vol });
        s.play();
        s.once('complete', () => s.destroy());
        this.duckBgm(s);
    }

    /* ── 角色音效播放期間壓低 BGM，結束再淡回 ── */
    duckBgm(sfx) {
        if (!this.bgm || !this.bgm.isPlaying) return;
        this.tweens.killTweensOf(this.bgm);
        this.bgm.setVolume(0.05);
        const restore = () => {
            if (this.bgm) this.tweens.add({ targets: this.bgm, volume: this.bgmBaseVol, duration: 450 });
        };
        if (sfx && sfx.once) sfx.once('complete', restore);
        else this.time.delayedCall(1000, restore);
    }

    /* ── 投射物移動 & 碰撞 ── */
    updateProjectiles(dt) {
        const bodyW = FRAME_W * SCALE * 0.32;
        const bodyH = FRAME_H * SCALE * 0.55;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.img.x     += proj.vx * dt;
            proj.img.y     += (proj.vy || 0) * dt;
            proj.img.angle += (proj.spin ?? 300) * dt;   /* 旋轉特效 */
            /* 飛行時越來越大 */
            if (proj.grow) {
                proj.dispW += proj.grow * dt;
                proj.dispH += proj.grow * dt;
                proj.img.setDisplaySize(proj.dispW, proj.dispH);
            }
            /* 砸落型大招：輕微水平追蹤對手，確保落在頭上 */
            if (proj.homeX && proj.isLocal && this.remote) {
                proj.img.x += (this.remote.x - proj.img.x) * Math.min(1, dt * 4);
            }

            /* 生成後 80ms 內先飛行、不判定（避免貼身發大招瞬間命中、自己看不到） */
            const armed = (this.time.now - (proj.born ?? 0)) > 80;
            if (proj.isLocal && armed) {
                const tgt  = this.remote;
                const tgtY = tgt.y - bodyH * 0.5;
                if (Math.abs(proj.img.x - tgt.x)        < bodyW + 30 &&
                    Math.abs(proj.img.y - tgtY) < bodyH) {
                    const dmg = Math.round((proj.damage ?? 30) * this.comboMult());   /* 連擊加成 */
                    if (tgt.blocking) {
                        this.blockSparkFX(tgt.x + tgt.facing * 25, tgt.y - bodyH);
                    } else {
                        this.hitFX(tgt.x, tgt.y - bodyH, true);
                        this.addCombo();
                        if (!this.practice) this.playRemoteHurt('special');
                    }
                    const applied = tgt.blocking ? Math.max(1, Math.round(dmg * 0.15)) : dmg;
                    /* 本地預扣對手血量（與近戰一致，sync 會校正） */
                    this.remoteHP = Math.max(0, this.remoteHP - applied);
                    this.stats.special.dmg += applied;   /* 統計大招傷害 */
                    if (this.practice) {
                        this.dummyHit('special');
                    } else {
                        socket.emit('dealDamage', { roomId: this.roomId, amount: dmg, type: 'special' });
                    }
                    proj.img.destroy();
                    this.projectiles.splice(i, 1);
                    continue;
                }
            }

            /* 飛出畫面外就移除 */
            if (proj.img.x < -120 || proj.img.x > GAME_W + 120 ||
                proj.img.y < -120 || proj.img.y > GAME_H + 120) {
                proj.img.destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    /* ── Utility ── */
    playAnim(player, animName) {
        if (player.anim === animName) return;
        player.anim = animName;
        player.sprite.play(`${player.ch}_${animName}`);
    }

    /* ── 連擊傷害加成（每段 +4%，上限 +40%）── */
    comboMult() {
        return 1 + Math.min(this.comboCount * 0.04, 0.40);
    }

    /* ── 建立一組連擊徽章（combo 圖 × 次數） ── */
    makeComboBadge(x) {
        const img = this.add.image(-6, 0, 'combo').setOrigin(1, 0.5).setDisplaySize(150, 143);
        const num = this.add.text(8, 0, '', {
            fontSize: '44px', color: '#ffdd33', fontStyle: 'bold italic',
            stroke: '#000', strokeThickness: 7, padding: { top: 6, bottom: 4 },
        }).setOrigin(0, 0.5);
        const group = this.add.container(x, 175, [img, num]).setDepth(24).setVisible(false);
        return { group, num };
    }

    showComboBadge(badge, count) {
        badge.num.setText(`× ${count}`);
        badge.group.setVisible(true);
        this.tweens.killTweensOf(badge.group);
        badge.group.setScale(1.6).setAlpha(1);
        this.tweens.add({ targets: badge.group, scale: 1, duration: 250, ease: 'Back.Out' });
        badge.num.setColor(count >= 8 ? '#ff4422' : count >= 5 ? '#ff9933' : '#ffdd33');
    }

    hideComboBadge(badge) {
        if (!badge.group.visible) return;
        this.tweens.killTweensOf(badge.group);
        this.tweens.add({ targets: badge.group, alpha: 0, duration: 250,
            onComplete: () => badge.group.setVisible(false) });
    }

    /* ── 連擊：每次本地命中呼叫 ── */
    addCombo() {
        const now = this.time.now;
        if (now - this.lastHitTime > this.COMBO_WINDOW) this.comboCount = 0;   /* 超時重來 */
        this.comboCount++;
        this.lastHitTime = now;
        if (this.comboCount > this.stats.maxCombo) this.stats.maxCombo = this.comboCount;
        if (this.comboCount >= 2) this.showComboBadge(this.comboLocal, this.comboCount);
    }

    /* ── 連擊中斷（本地） ── */
    resetCombo() {
        if (this.comboCount === 0) return;
        this.comboCount = 0;
        this.hideComboBadge(this.comboLocal);
    }

    /* ── 回合結束：計分 → 重置回合或結束比賽 ── */
    onRoundEnd(localWon) {
        if (this.roundOver || !this.active) return;
        this.roundOver = true;

        /* 敗方血量歸零（連同黃色殘影），刷新血條（active 設 false 後 update 就不再更新血條） */
        if (localWon) { this.remoteHP = 0; this.remoteHPshown = 0; }
        else          { this.local.hp = 0; this.localHPshown  = 0; }
        this.refreshBars();

        this.active = false;

        /* 關掉光環/護盾，避免回合切換時停在舊位置噴粒子 */
        this.localAura.stop();  this.remoteAura.stop();
        this.localAuraOn = false; this.remoteAuraOn = false;
        this.localShield.dome.setVisible(false);  this.localShieldOn  = false;
        this.remoteShield.dome.setVisible(false); this.remoteShieldOn = false;

        if (localWon) this.roundWins.local++; else this.roundWins.remote++;
        this.updateRoundUI();

        /* 點亮剛贏得的獎盃：放大彈跳 + 閃光 + 火花 */
        const wonArr = localWon ? this.localDots : this.remoteDots;
        const wonIdx = (localWon ? this.roundWins.local : this.roundWins.remote) - 1;
        if (wonArr[wonIdx]) this.popTrophy(wonArr[wonIdx]);

        /* K.O. 提示 */
        const ko = this.add.text(GAME_W / 2, GAME_H / 2 - 30, 'K.O.', {
            fontSize: '90px', color: '#ff3322', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 12, padding: { top: 8, bottom: 5 },
        }).setOrigin(0.5).setDepth(30);
        this.tweens.add({ targets: ko, scale: { from: 1.6, to: 1 }, duration: 500, ease: 'Power2' });

        const matchOver = this.roundWins.local >= this.WINS_NEEDED
                       || this.roundWins.remote >= this.WINS_NEEDED;

        this.time.delayedCall(1800, () => {
            ko.destroy();
            if (matchOver) {
                this.endFight(this.roundWins.local >= this.WINS_NEEDED ? 'win' : 'lose');
            } else {
                this.resetRound();
            }
        });
    }

    /* ── 重置回合（保留比分，重新開打） ── */
    resetRound() {
        this.roundNum++;
        this.roundOver = false;
        this.hitDone   = false;
        this.syncTimer = 0;

        /* 清除投射物 */
        for (const proj of this.projectiles) proj.img.destroy();
        this.projectiles = [];

        /* 護盾/光環關閉 */
        this.localShield.dome.setVisible(false);  this.localShieldOn  = false;
        this.remoteShield.dome.setVisible(false); this.remoteShieldOn = false;

        const resetP = (p, start) => {
            p.hp = GAME_SETTINGS.maxHP; p.guard = 100; p.guardBroken = false;
            /* energy 跨回合保留，不歸零（讓大招用得到） */
            p.blocking = false; p.attacking = false; p.attackType = null;
            p.hurt = false; p.jumping = false; p.velY = 0;
            p.x = start.x; p.y = this.floorY; p.facing = start.facing;
            p.targetX = start.x; p.targetY = this.floorY;
            p.anim = ''; p.sprite.off('animationcomplete');
            p.sprite.setPosition(start.x, this.floorY).setFlipX(start.facing < 0);
            this.playAnim(p, 'walk');
        };
        resetP(this.local,  this.localStart);
        resetP(this.remote, this.remoteStart);

        this.remoteHP = GAME_SETTINGS.maxHP; this.remoteGuard = 100;   /* remoteEnergy 保留 */
        this.localHPshown = GAME_SETTINGS.maxHP; this.remoteHPshown = GAME_SETTINGS.maxHP;   /* 殘影歸滿 */
        this.resetCombo();
        this.remoteCombo = 0;
        this.hideComboBadge(this.comboRemote);

        /* 光環發射器移到新位置（保持停止，開局由 updateAura 依 SP 重新開啟） */
        this.localAura.stop().setPosition(this.local.x, this.local.y);
        this.remoteAura.stop().setPosition(this.remote.x, this.remote.y);
        this.localAuraOn = false; this.remoteAuraOn = false;

        /* 頭上 P1/P2 標籤、箭頭立即歸位（active 期間才會自動更新） */
        this.updateLabels();

        this.updateRoundUI();
        this.showRoundBanner(() => this.countdown());   /* 橫幅停留後再倒數 */
    }

    endFight(result) {
        if (this.matchEnded) return;
        this.matchEnded = true;
        this.active = false;
        this.roundOver = true;
        for (const proj of this.projectiles) proj.img.destroy();
        this.projectiles = [];
        socket.off('opponentState').off('takeDamage').off('opponentDied')
              .off('opponentDisconnected').off('projectileFired');
        const stats = this.stats;
        const score = { local: this.roundWins.local, remote: this.roundWins.remote };
        this.time.delayedCall(900, () => this.scene.start('Result', { result, stats, score }));
    }
}

/* ══════════════════════
   ResultScene
   ══════════════════════ */
class ResultScene extends Phaser.Scene {
    constructor() { super('Result'); }

    init(d) { this.result = d.result; this.stats = d.stats || null; this.score = d.score || null; }

    create() {
        const win = this.result === 'win';

        /* 勝負圖全螢幕（等比例填滿，cover） */
        const img = this.add.image(GAME_W / 2, GAME_H / 2, win ? 'youwin' : 'youlose');
        const scale = Math.max(GAME_W / img.width, GAME_H / img.height);
        img.setScale(scale);

        /* 勝負音效 */
        const sfxKey = win ? 'winSfx' : 'loseSfx';
        if (this.cache.audio.exists(sfxKey)) this.sound.play(sfxKey, { volume: 0.7 });

        makeImageButton(this, GAME_W / 2, GAME_H - 45, 'btnReplay', 240, () => this.scene.start('Select', { offline: false }));

        /* 3 秒後淡入戰鬥總結 */
        if (this.stats) this.time.delayedCall(3000, () => this.showSummary());
    }

    showSummary() {
        const s = this.stats;
        const myTotal  = s.punch.dmg + s.kick.dmg + s.special.dmg;
        const oppTotal = s.oppDmg || 0;
        const showFire = myTotal > oppTotal;
        const W = 440, H = showFire ? 366 : 332, cx = GAME_W / 2, cy = GAME_H / 2;
        const top = -H / 2;

        const box = this.add.container(cx, cy).setDepth(30).setAlpha(0).setScale(0.92);

        const bg = this.add.rectangle(0, 0, W, H, 0x0a0a18, 0.9)
            .setStrokeStyle(3, 0xffee00, 0.9);
        box.add(bg);

        /* 標題 + 回合比分 */
        let title = '戰鬥總結';
        if (this.score) title += `　（${this.score.local} - ${this.score.remote}）`;
        box.add(this.add.text(0, top + 28, title, {
            fontSize: '24px', color: '#ffee00', fontStyle: 'bold',
            stroke: '#000', strokeThickness: 5, padding: { top: 4, bottom: 2 },
        }).setOrigin(0.5));

        /* 表頭 */
        const colName = -W / 2 + 40, colN = 40, colDmg = W / 2 - 40;
        const mkRow = (y, name, n, dmg, color) => {
            box.add(this.add.text(colName, y, name, { fontSize: '16px', color, fontStyle: 'bold' }).setOrigin(0, 0.5));
            box.add(this.add.text(colN,   y, `${n} 次`,  { fontSize: '15px', color: '#dddddd' }).setOrigin(0.5));
            box.add(this.add.text(colDmg, y, `${dmg}`,   { fontSize: '16px', color: '#ff8844', fontStyle: 'bold' }).setOrigin(1, 0.5));
        };
        box.add(this.add.text(colName, top + 64, '招式', { fontSize: '12px', color: '#888' }).setOrigin(0, 0.5));
        box.add(this.add.text(colN,    top + 64, '次數', { fontSize: '12px', color: '#888' }).setOrigin(0.5));
        box.add(this.add.text(colDmg,  top + 64, '傷害', { fontSize: '12px', color: '#888' }).setOrigin(1, 0.5));

        mkRow(top + 96,  '出拳 J', s.punch.n,   s.punch.dmg,   '#ffaa44');
        mkRow(top + 126, '踢腳 K', s.kick.n,    s.kick.dmg,    '#ff7733');
        mkRow(top + 156, '大招 L', s.special.n, s.special.dmg, '#ff4444');

        box.add(this.add.rectangle(0, top + 182, W - 60, 1, 0xffee00, 0.4));
        box.add(this.add.text(colName, top + 206, `最高連擊  ${s.maxCombo}`, { fontSize: '14px', color: '#ffcc66', fontStyle: 'bold' }).setOrigin(0, 0.5));

        /* 雙方總傷害比較 */
        box.add(this.add.text(colName, top + 236, '我方總傷害', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5));
        box.add(this.add.text(colDmg,  top + 236, `${myTotal}`, { fontSize: '17px', color: '#ffee00', fontStyle: 'bold' }).setOrigin(1, 0.5));
        box.add(this.add.text(colName, top + 262, '對手總傷害', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5));
        box.add(this.add.text(colDmg,  top + 262, `${oppTotal}`, { fontSize: '17px', color: '#ff6666', fontStyle: 'bold' }).setOrigin(1, 0.5));

        /* 火力較高註記 */
        if (showFire) {
            box.add(this.add.text(0, top + 304, '🔥 你的火力較高！', {
                fontSize: '16px', color: '#ffdd33', fontStyle: 'bold',
                stroke: '#000', strokeThickness: 4, padding: { top: 3 },
            }).setOrigin(0.5));
        }

        this.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 600, ease: 'Back.Out' });
    }
}

/* ══════════════════════
   Game config & launch
   ══════════════════════ */
new Phaser.Game({
    type:   Phaser.AUTO,
    width:  GAME_W,
    height: GAME_H,
    backgroundColor: '#000000',
    scene:  [BootScene, LoadingScene, MenuScene, TutorialScene, SettingsScene, SelectScene, StageSelectScene, FightScene, ResultScene, CursorScene],
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { disableWebAudio: false },
});
