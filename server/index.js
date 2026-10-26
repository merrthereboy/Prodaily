const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ValorantClient = require('./riot-api');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE = path.join(__dirname, 'session.json');

app.use(cors());
app.use(express.json());

// Disable caching so mobile browsers and web embeds always get the latest code
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static('src'));

// Active client instance & session state
let valClient = new ValorantClient('ap', 'ap');
let cachedPlayerData = null;

// Load saved session on server start
function loadSavedSession() {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const raw = fs.readFileSync(SESSION_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.data) {
        cachedPlayerData = parsed.data;
        if (parsed.tokens) {
          valClient.accessToken = parsed.tokens.accessToken;
          valClient.idToken = parsed.tokens.idToken;
          valClient.entitlementToken = parsed.tokens.entitlementToken;
          valClient.puuid = parsed.tokens.puuid;
          valClient.region = parsed.tokens.region || 'ap';
          valClient.shard = parsed.tokens.shard || 'ap';
        }
        console.log(`[Session] Restored saved session for: ${parsed.data.user?.riotId || 'Player'}`);

        // Dynamically recompute fresh stats from live account
        if (valClient.accessToken) {
          valClient.getFullPlayerData().then(freshData => {
            cachedPlayerData = freshData;
            parsed.data = freshData;
            fs.writeFileSync(SESSION_FILE, JSON.stringify(parsed, null, 2), 'utf8');
            console.log(`[Session] Successfully dynamically refreshed live stats for: ${freshData.user?.riotId}`);
          }).catch(err => {
            console.warn('[Session] Could not refresh live stats (token may be expired):', err.message);
          });
        }
      }
    } catch (e) {
      console.warn('[Session] Could not parse session.json:', e.message);
    }
  }
}
loadSavedSession();

// 1. Get Default Login URL (Official Riot OAuth Prompt)
app.get('/api/auth/login-url', (req, res) => {
  const loginUrl = ValorantClient.getLocalhostLoginUrl();
  res.json({
    success: true,
    url: loginUrl,
    loginUrl: loginUrl
  });
});

// 2. Get Currently Authenticated Player Data (Zero Fake Data)
app.get('/api/player/current', (req, res) => {
  if (cachedPlayerData) {
    return res.json({ success: true, data: cachedPlayerData });
  }
  return res.json({ success: false, data: null, message: 'Chưa đăng nhập tài khoản Riot' });
});

// 3. Authenticate with Redirect URL & Save Real Session
app.post(['/api/auth/url', '/api/auth/login'], async (req, res) => {
  const url = req.body.url || req.body.redirectUrl;
  if (!url) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp link URL sau khi đăng nhập' });
  }
  try {
    valClient = new ValorantClient('ap', 'ap');
    await valClient.authenticateWithUrl(url);
    const fullData = await valClient.getFullPlayerData();
    
    // Save to disk so restarts or redeploys NEVER lose player data
    cachedPlayerData = fullData;
    const sessionToSave = {
      savedAt: new Date().toISOString(),
      data: fullData,
      tokens: {
        accessToken: valClient.accessToken,
        idToken: valClient.idToken,
        entitlementToken: valClient.entitlementToken,
        puuid: valClient.puuid,
        region: valClient.region,
        shard: valClient.shard
      }
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionToSave, null, 2), 'utf8');
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(sessionToSave, null, 2), 'utf8');
    console.log(`[Session] Authenticated and saved real player session for: ${fullData.user.gameName}#${fullData.user.tagLine}`);

    res.json({
      success: true,
      riotId: `${fullData.user.gameName}#${fullData.user.tagLine}`,
      user: fullData.user,
      data: fullData
    });
  } catch (error) {
    console.error('[Auth Error]:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 4. Logout & Completely Clear All Saved Sessions
app.post('/api/auth/logout', (req, res) => {
  cachedPlayerData = null;
  valClient = new ValorantClient('ap', 'ap');
  const filesToDelete = [
    SESSION_FILE,
    path.join(__dirname, 'session.backup.json')
  ];
  filesToDelete.forEach(f => {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  });
  instalockConfig.isSimulated = false;
  console.log('[Session] Completely cleared all session files, memory tokens, and caches!');
  res.json({ success: true, message: 'Đã đăng xuất toàn bộ tài khoản thành công' });
});

// Auto-lock & Pregame Lobby Configuration
let instalockConfig = {
  priorityAgent: 'Jett',
  priorityAgentId: 'add6443a-41bd-e414-f6ad-e58d267f4e95',
  autoLockUnrated: true,
  autoLockCompetitive: true,
  isSimulated: false
};

// Simulated Lobby for Demo & Testing
let simulatedLobby = {
  inPregame: true,
  isSimulated: true,
  matchId: 'simulated-match-live',
  queueId: 'competitive',
  isSupportedMode: true,
  queueName: 'Xếp Hạng (Competitive)',
  map: {
    id: '/Game/Maps/Ascent/Ascent',
    name: 'Ascent',
    splash: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png',
    icon: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/displayicon.png'
  },
  team: [
    {
      slot: 1,
      isMe: true,
      displayName: 'Bạn (Self)',
      agentId: 'add6443a-41bd-e414-f6ad-e58d267f4e95',
      agentName: 'Jett',
      agentIcon: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png',
      agentRole: 'Duelist',
      state: 'selected',
      stateText: 'ĐANG CHỌN'
    },
    {
      slot: 2,
      isMe: false,
      displayName: 'Đồng đội 2',
      agentId: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc',
      agentName: 'Reyna',
      agentIcon: 'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png',
      agentRole: 'Duelist',
      state: 'locked',
      stateText: 'ĐÃ KHÓA'
    },
    {
      slot: 3,
      isMe: false,
      displayName: 'Đồng đội 3',
      agentId: '8e253930-4c05-31dd-1b6c-968525494517',
      agentName: 'Omen',
      agentIcon: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png',
      agentRole: 'Controller',
      state: 'locked',
      stateText: 'ĐÃ KHÓA'
    },
    {
      slot: 4,
      isMe: false,
      displayName: 'Đồng đội 4',
      agentId: '320b2a48-4d9b-a075-30f1-1f93a9b638fa',
      agentName: 'Sova',
      agentIcon: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png',
      agentRole: 'Initiator',
      state: 'selected',
      stateText: 'ĐANG CHỌN'
    },
    {
      slot: 5,
      isMe: false,
      displayName: 'Đồng đội 5',
      agentId: null,
      agentName: 'Chưa chọn',
      agentIcon: null,
      agentRole: null,
      state: 'choosing',
      stateText: 'CHƯA CHỌN'
    }
  ],
  timeRemaining: 28,
  serverTime: Date.now()
};

// 4b. Quick Re-connect / Restore Previous Session
app.post('/api/auth/quick-restore', (req, res) => {
  const BACKUP_FILE = path.join(__dirname, 'session.backup.json');
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.data) {
        cachedPlayerData = parsed.data;
        fs.writeFileSync(SESSION_FILE, raw, 'utf8');
        console.log('[Session] Restored session from backup successfully');
        return res.json({ success: true, data: cachedPlayerData });
      }
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }
  return res.status(404).json({ success: false, message: 'Không tìm thấy phiên đã lưu trước đó' });
});

// 5. Storefront / Shop
app.get('/api/store/daily', async (req, res) => {
  try {
    if (valClient.accessToken) {
      const fullData = await valClient.getFullPlayerData();
      cachedPlayerData = fullData;
      return res.json({ success: true, data: fullData.store });
    }
    if (cachedPlayerData) {
      return res.json({ success: true, data: cachedPlayerData.store });
    }
    res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Pre-game status (Live Lobby, Teammate Picks & Map)
app.get('/api/pregame/status', async (req, res) => {
  try {
    if (valClient.accessToken) {
      const liveStatus = await valClient.getPregameMatch();
      if (liveStatus && liveStatus.inPregame) {
        // Auto-lock for Unrated & Competitive if enabled
        const isEligibleMode = (liveStatus.queueId === 'unrated' && instalockConfig.autoLockUnrated) ||
                               (liveStatus.queueId === 'competitive' && instalockConfig.autoLockCompetitive);
        const mySlot = liveStatus.team?.find(p => p.isMe);
        if (isEligibleMode && mySlot && mySlot.state !== 'locked' && instalockConfig.priorityAgentId) {
          try {
            await valClient.lockAgent(liveStatus.matchId, instalockConfig.priorityAgentId);
            mySlot.state = 'locked';
            mySlot.stateText = 'ĐÃ KHÓA';
            console.log(`[AutoLock] Successfully locked ${instalockConfig.priorityAgent} for ${liveStatus.queueId}`);
          } catch (lockErr) {
            console.warn('[AutoLock Error]:', lockErr.message);
          }
        }
        return res.json({ success: true, data: { ...liveStatus, config: instalockConfig } });
      }
    }

    if (instalockConfig.isSimulated) {
      return res.json({ success: true, data: { ...simulatedLobby, config: instalockConfig } });
    }

    res.json({
      success: true,
      data: {
        inPregame: false,
        config: instalockConfig,
        userOnline: !!valClient.accessToken
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6b. Agent selection / Hover in Pregame
app.post('/api/pregame/select', async (req, res) => {
  const { matchId, agentId } = req.body;
  try {
    if (instalockConfig.isSimulated || matchId === 'simulated-match-live') {
      const ag = ValorantClient.agentCache.get(agentId) || ValorantClient.agentsList.find(a => a.uuid === agentId);
      if (simulatedLobby.team[0]) {
        simulatedLobby.team[0].agentId = agentId;
        simulatedLobby.team[0].agentName = ag?.displayName || 'Agent';
        simulatedLobby.team[0].agentIcon = ag?.displayIcon || '';
        simulatedLobby.team[0].agentRole = ag?.role || '';
        simulatedLobby.team[0].state = 'selected';
        simulatedLobby.team[0].stateText = 'ĐANG CHỌN';
      }
      return res.json({ success: true, message: 'Đã chọn đặc vụ', data: simulatedLobby });
    }

    const data = await valClient.selectAgent(matchId, agentId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 6c. Hard Lock / Pick in Pregame
app.post('/api/pregame/lock', async (req, res) => {
  const { matchId, agentId } = req.body;
  try {
    if (instalockConfig.isSimulated || matchId === 'simulated-match-live') {
      const ag = ValorantClient.agentCache.get(agentId) || ValorantClient.agentsList.find(a => a.uuid === agentId);
      if (simulatedLobby.team[0]) {
        simulatedLobby.team[0].agentId = agentId;
        simulatedLobby.team[0].agentName = ag?.displayName || 'Agent';
        simulatedLobby.team[0].agentIcon = ag?.displayIcon || '';
        simulatedLobby.team[0].agentRole = ag?.role || '';
        simulatedLobby.team[0].state = 'locked';
        simulatedLobby.team[0].stateText = 'ĐÃ KHÓA';
      }
      return res.json({ success: true, message: 'Đã khóa tướng thành công!', data: simulatedLobby });
    }

    const data = await valClient.lockAgent(matchId, agentId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 6d. Update Auto-Lock Settings (Priority Agent & Modes)
app.post('/api/pregame/config', (req, res) => {
  instalockConfig = { ...instalockConfig, ...req.body };
  res.json({ success: true, data: instalockConfig });
});

app.get('/api/pregame/config', (req, res) => {
  res.json({ success: true, data: instalockConfig });
});

// 6e. Toggle Demo Mode for previewing pick lobby
app.post('/api/pregame/demo-toggle', (req, res) => {
  instalockConfig.isSimulated = !instalockConfig.isSimulated;
  res.json({ success: true, isSimulated: instalockConfig.isSimulated });
});

// 6e2. Cycle / Change Map in Demo Mode
const DEMO_MAP_POOL = [
  { id: '/Game/Maps/Ascent/Ascent', name: 'Ascent', uuid: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319' },
  { id: '/Game/Maps/Port/Port', name: 'Icebox', uuid: 'e2ad5c54-4114-a870-9641-8ea21279579a' },
  { id: '/Game/Maps/Duality/Duality', name: 'Bind', uuid: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba' },
  { id: '/Game/Maps/Triad/Triad', name: 'Haven', uuid: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047' },
  { id: '/Game/Maps/Bonsai/Bonsai', name: 'Split', uuid: 'd960549e-485c-e861-8d71-aa9d1aed12a2' },
  { id: '/Game/Maps/Juliett/Juliett', name: 'Sunset', uuid: '92584fbe-486a-b1b2-9faa-39b0f486b498' },
  { id: '/Game/Maps/Jam/Jam', name: 'Lotus', uuid: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9' },
  { id: '/Game/Maps/Infinity/Infinity', name: 'Abyss', uuid: '224b0a95-48b9-f703-1bd8-67aca101a61f' }
];

app.post('/api/pregame/demo-map', (req, res) => {
  const { mapName } = req.body;
  let target = DEMO_MAP_POOL.find(m => m.name.toLowerCase() === (mapName || '').toLowerCase());
  if (!target) {
    const curIdx = DEMO_MAP_POOL.findIndex(m => m.name.toLowerCase() === (simulatedLobby.map.name || '').toLowerCase());
    target = DEMO_MAP_POOL[(curIdx + 1) % DEMO_MAP_POOL.length];
  }
  simulatedLobby.map = {
    id: target.id,
    name: target.name,
    splash: `https://media.valorant-api.com/maps/${target.uuid}/splash.png`,
    icon: `https://media.valorant-api.com/maps/${target.uuid}/displayicon.png`
  };
  res.json({ success: true, map: simulatedLobby.map });
});

// 6e3. Refresh Live Metadata from Valorant-API (Auto-Fetch New Agents & Maps)
app.post('/api/admin/refresh-metadata', async (req, res) => {
  try {
    await ValorantClient.preloadMetadata();
    res.json({
      success: true,
      message: `Đã đồng bộ dữ liệu đặc vụ và bản đồ mới nhất!`,
      agentsCount: ValorantClient.agentsList.length,
      mapsCount: ValorantClient.mapsList.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6f. List all Valorant Playable Agents
app.get('/api/agents', (req, res) => {
  res.json({
    success: true,
    count: ValorantClient.agentsList.length,
    data: ValorantClient.agentsList
  });
});

// 7. Search skins for Alert Skin autocomplete, live video preview & Skin Library Catalog
app.get(['/api/skins/search', '/api/skins'], (req, res) => {
  const { q, weapon, tier, limit } = req.query;
  const lim = parseInt(limit, 10) || 80;
  const results = ValorantClient.searchSkins(q, weapon, tier, lim);
  res.json({ success: true, count: results.length, data: results });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 [SkinPeek Mobile] Server is running!`);
  console.log(`📱 Local Access:   http://localhost:${PORT}`);
  console.log(`📡 Phone Access:   http://192.168.1.205:${PORT}`);
  console.log(`=======================================================`);
});
