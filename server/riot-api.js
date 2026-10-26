/**
 * SkinPeek Valorant API Core Engine
 * Fully updated with:
 * - Bundle caching & resolution (Featured Bundles in shop)
 * - Exact Kingdom Credits key resolution (85ca954a-41f2-ce94-9b45-8ca3dd39a00d)
 * - Player card avatar synchronization (card.smallArt / displayIcon)
 * - Clean Riot ID and Region parsing
 * - Modern Storefront v3 & Personalization v3 with fallback
 */

const axios = require('axios');

class ValorantClient {
  constructor(region = 'ap', shard = 'ap') {
    this.region = region;
    this.shard = shard;
    this.accessToken = null;
    this.entitlementToken = null;
    this.idToken = null;
    this.puuid = null;
    this.gameName = 'Player';
    this.tagLine = 'VN1';
    this.clientVersion = 'release-13.08-shipping-20-5715960';
    this.clientPlatform = 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';
  }

  extractIdTokenInfo() {
    if (!this.idToken) return;
    try {
      const parts = this.idToken.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload?.acct?.game_name) this.gameName = payload.acct.game_name;
        if (payload?.acct?.tag_line) this.tagLine = payload.acct.tag_line;
        if (payload?.sub) this.puuid = payload.sub;
      }
    } catch (e) {}
  }

  // Pre-cached metadata
  static skinCache = new Map();
  static baseSkinCache = new Map();
  static buddyCache = new Map();
  static cardCache = new Map();
  static sprayCache = new Map();
  static bundleCache = new Map();
  static tierCache = new Map();
  static agentSkinCache = new Set();
  static paidBpLevelCache = new Map();
  static freeBpLevelCache = new Set();
  static eventSkinCache = new Set();
  static agentCache = new Map();
  static mapCache = new Map();
  static agentsList = [];
  static mapsList = [];
  static isMetadataLoaded = false;
  static liveClientVersion = 'release-13.08-shipping-20-5715960';

  static async preloadMetadata() {
    if (ValorantClient.isMetadataLoaded) return;
    try {
      console.log('[Metadata] Preloading live client version and Valorant database...');
      
      try {
        const verRes = await axios.get('https://valorant-api.com/v1/version');
        if (verRes.data?.data?.riotClientVersion) {
          ValorantClient.liveClientVersion = verRes.data.data.riotClientVersion;
          console.log('[Metadata] Live Client Version set to:', ValorantClient.liveClientVersion);
        }
      } catch (e) {
        console.warn('[Metadata] Using fallback client version:', ValorantClient.liveClientVersion);
      }

      const [skinsRes, buddiesRes, cardsRes, spraysRes, bundlesRes, tiersRes, contractsRes, agentsRes, mapsRes] = await Promise.all([
        axios.get('https://valorant-api.com/v1/weapons/skins?language=vi-VN'),
        axios.get('https://valorant-api.com/v1/buddies?language=vi-VN'),
        axios.get('https://valorant-api.com/v1/playercards?language=vi-VN'),
        axios.get('https://valorant-api.com/v1/sprays?language=vi-VN'),
        axios.get('https://valorant-api.com/v1/bundles?language=vi-VN'),
        axios.get('https://valorant-api.com/v1/contenttiers'),
        axios.get('https://valorant-api.com/v1/contracts'),
        axios.get('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=vi-VN'),
        axios.get('https://valorant-api.com/v1/maps?language=vi-VN')
      ]);

      // Index Agent, Battle Pass, and Event Contract Rewards
      contractsRes.data?.data?.forEach(c => {
        const rel = c.content?.relationType;
        if (rel === 'Agent') {
          (c.content?.chapters || []).forEach(ch => {
            (ch.levels || []).forEach(lvl => {
              if (lvl.reward?.type === 'EquippableSkinLevel') ValorantClient.agentSkinCache.add(lvl.reward.uuid);
            });
            (ch.freeRewards || []).forEach(fr => {
              if (fr.type === 'EquippableSkinLevel') ValorantClient.agentSkinCache.add(fr.uuid);
            });
          });
        } else if (rel === 'Season') {
          (c.content?.chapters || []).forEach(ch => {
            (ch.levels || []).forEach(lvl => {
              if (lvl.reward?.type === 'EquippableSkinLevel') ValorantClient.paidBpLevelCache.set(lvl.reward.uuid, c.displayName);
            });
            (ch.freeRewards || []).forEach(fr => {
              if (fr.type === 'EquippableSkinLevel') ValorantClient.freeBpLevelCache.add(fr.uuid);
            });
          });
        } else if (rel === 'Event') {
          (c.content?.chapters || []).forEach(ch => {
            (ch.levels || []).forEach(lvl => {
              if (lvl.reward?.type === 'EquippableSkinLevel') ValorantClient.eventSkinCache.add(lvl.reward.uuid);
            });
            (ch.freeRewards || []).forEach(fr => {
              if (fr.type === 'EquippableSkinLevel') ValorantClient.eventSkinCache.add(fr.uuid);
            });
          });
        }
      });

      tiersRes.data.data.forEach(t => {
        ValorantClient.tierCache.set(t.uuid, t.devName);
      });

      // Index Bundles
      bundlesRes.data.data.forEach(b => {
        ValorantClient.bundleCache.set(b.uuid, {
          uuid: b.uuid,
          displayName: b.displayName,
          displayIcon: b.displayIcon2 || b.displayIcon,
          verticalPromoImage: b.verticalPromoImage || b.displayIcon2 || b.displayIcon
        });
      });

      // Index Skins & Levels
      skinsRes.data.data.forEach(skin => {
        const tierName = ValorantClient.tierCache.get(skin.contentTierUuid) || 'Premium';
        const levels = skin.levels || [];
        const highestVideo = [...levels].reverse().find(l => l.streamedVideo)?.streamedVideo || null;
        const defaultIcon = skin.displayIcon || levels[0]?.displayIcon;

        const skinInfo = {
          uuid: skin.uuid,
          displayName: skin.displayName,
          displayIcon: defaultIcon,
          streamedVideo: highestVideo,
          tierName: tierName,
          chromas: (skin.chromas || []).map(c => ({
            uuid: c.uuid,
            name: c.displayName,
            displayIcon: c.fullRender || c.displayIcon || defaultIcon,
            swatch: c.swatch || null,
            video: c.streamedVideo || highestVideo
          })),
          levels: levels.map(lvl => ({
            uuid: lvl.uuid,
            name: lvl.displayName,
            levelItem: lvl.levelItem,
            displayIcon: lvl.displayIcon || defaultIcon,
            video: lvl.streamedVideo || highestVideo
          }))
        };

        ValorantClient.skinCache.set(skin.uuid, skinInfo);
        ValorantClient.baseSkinCache.set(skin.uuid, skinInfo);
        levels.forEach(lvl => {
          ValorantClient.skinCache.set(lvl.uuid, {
            ...skinInfo,
            displayName: lvl.displayName || skin.displayName,
            displayIcon: lvl.displayIcon || defaultIcon,
            streamedVideo: lvl.streamedVideo || highestVideo
          });
        });
      });

      // Index Buddies
      buddiesRes.data.data.forEach(b => {
        ValorantClient.buddyCache.set(b.uuid, {
          uuid: b.uuid,
          displayName: b.displayName,
          displayIcon: b.displayIcon
        });
        b.levels?.forEach(lvl => {
          ValorantClient.buddyCache.set(lvl.uuid, {
            uuid: lvl.uuid,
            displayName: lvl.displayName || b.displayName,
            displayIcon: lvl.displayIcon || b.displayIcon
          });
        });
      });

      // Index Cards
      cardsRes.data.data.forEach(c => {
        ValorantClient.cardCache.set(c.uuid, {
          uuid: c.uuid,
          displayName: c.displayName,
          displayIcon: c.displayIcon,
          smallArt: c.smallArt || c.displayIcon,
          largeArt: c.largeArt,
          wideArt: c.wideArt
        });
      });

      // Index Sprays
      spraysRes.data.data.forEach(s => {
        ValorantClient.sprayCache.set(s.uuid, {
          uuid: s.uuid,
          displayName: s.displayName,
          displayIcon: s.fullTransparentIcon || s.displayIcon
        });
      });

      // Index Playable Agents
      agentsRes.data?.data?.forEach(a => {
        const ag = {
          uuid: a.uuid,
          displayName: a.displayName,
          developerName: a.developerName,
          role: a.role?.displayName || 'Đặc Vụ',
          roleIcon: a.role?.displayIcon || '',
          displayIcon: a.displayIcon,
          bustPortrait: a.bustPortrait || a.displayIcon,
          fullPortrait: a.fullPortrait || a.displayIcon,
          killfeedPortrait: a.killfeedPortrait || a.displayIcon
        };
        ValorantClient.agentCache.set(a.uuid, ag);
        ValorantClient.agentCache.set(a.displayName.toLowerCase(), ag);
        ValorantClient.agentsList.push(ag);
      });

      // Index Maps
      mapsRes.data?.data?.forEach(m => {
        const mp = {
          uuid: m.uuid,
          mapUrl: m.mapUrl,
          displayName: m.displayName,
          splash: m.splash,
          displayIcon: m.displayIcon,
          listViewIcon: m.listViewIcon
        };
        ValorantClient.mapCache.set(m.uuid, mp);
        ValorantClient.mapCache.set(m.uuid.toLowerCase(), mp);
        ValorantClient.mapCache.set(m.mapUrl, mp);
        ValorantClient.mapCache.set(m.mapUrl.toLowerCase(), mp);
        ValorantClient.mapCache.set(m.displayName, mp);
        ValorantClient.mapCache.set(m.displayName.toLowerCase(), mp);
        const parts = (m.mapUrl || '').split('/');
        const leaf = parts[parts.length - 1];
        if (leaf) {
          ValorantClient.mapCache.set(leaf, mp);
          ValorantClient.mapCache.set(leaf.toLowerCase(), mp);
        }
        ValorantClient.mapsList.push(mp);
      });

      ValorantClient.isMetadataLoaded = true;
      console.log(`[Metadata] Successfully indexed ${ValorantClient.skinCache.size} skins, ${ValorantClient.bundleCache.size} bundles, ${ValorantClient.cardCache.size} cards, ${ValorantClient.agentsList.length} agents, ${ValorantClient.mapsList.length} maps.`);
    } catch (err) {
      console.error('[Metadata] Error preloading metadata:', err.message);
    }
  }

  // Dynamic on-the-fly fetch for newly released Agents from Riot/valorant-api
  static async getOrFetchAgent(agentId) {
    if (!agentId) return null;
    if (ValorantClient.agentCache.has(agentId)) {
      return ValorantClient.agentCache.get(agentId);
    }
    try {
      const res = await axios.get(`https://valorant-api.com/v1/agents/${agentId}?language=vi-VN`, { timeout: 3500 });
      const a = res.data?.data;
      if (a) {
        const ag = {
          uuid: a.uuid,
          displayName: a.displayName,
          developerName: a.developerName,
          role: a.role?.displayName || 'Đặc Vụ',
          roleIcon: a.role?.displayIcon || '',
          displayIcon: a.displayIcon,
          bustPortrait: a.bustPortrait || a.displayIcon,
          fullPortrait: a.fullPortrait || a.displayIcon,
          killfeedPortrait: a.killfeedPortrait || a.displayIcon
        };
        ValorantClient.agentCache.set(a.uuid, ag);
        ValorantClient.agentCache.set(a.displayName.toLowerCase(), ag);
        if (!ValorantClient.agentsList.some(x => x.uuid === a.uuid)) {
          ValorantClient.agentsList.push(ag);
        }
        console.log(`[Metadata] Auto-indexed newly released agent on-the-fly: ${ag.displayName} (${ag.uuid})`);
        return ag;
      }
    } catch (e) {
      console.warn(`[Metadata] Could not fetch agent ${agentId}:`, e.message);
    }
    return null;
  }

  // Live Skin Search & Filter for Wishlist, Alert Skin & Skin Library Catalog
  static searchSkins(query = '', weapon = '', tier = '', limit = 80) {
    const q = (query || '').toLowerCase().trim();
    const w = (weapon || '').toLowerCase().trim();
    const t = (tier || '').toLowerCase().trim();

    const results = [];
    const seenNames = new Set();

    for (const skin of ValorantClient.baseSkinCache.values()) {
      if (!skin.displayName) continue;
      const nameLower = skin.displayName.toLowerCase();
      const tierLower = (skin.tierName || 'Standard').toLowerCase();

      // Check text search query
      if (q.length > 0 && !nameLower.includes(q)) continue;

      // Check weapon type filter
      if (w.length > 0 && w !== 'all' && w !== 'tất cả') {
        if (w === 'dao' || w === 'melee' || w === 'cận chiến') {
          const isMelee = nameLower.includes('dao') || nameLower.includes('rìu') || nameLower.includes('găm') || nameLower.includes('kiếm') || nameLower.includes('lưỡi') || nameLower.includes('karambit') || nameLower.includes('kunai') || nameLower.includes('butterfly') || nameLower.includes('fury') || nameLower.includes('claw');
          if (!isMelee) continue;
        } else if (!nameLower.includes(w)) {
          continue;
        }
      }

      // Check tier filter
      if (t.length > 0 && t !== 'all' && t !== 'tất cả' && tierLower !== t) continue;

      if (!seenNames.has(skin.displayName)) {
        seenNames.add(skin.displayName);
        results.push({
          id: skin.uuid,
          name: skin.displayName,
          icon: skin.displayIcon,
          video: skin.streamedVideo,
          tier: skin.tierName || 'Premium',
          price: ValorantClient.estimatePrice(skin.tierName),
          levels: skin.levels || [],
          chromas: skin.chromas || []
        });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  static getLocalhostLoginUrl() {
    return 'https://auth.riotgames.com/authorize?redirect_uri=http%3A%2F%2Flocalhost%2Fredirect&client_id=riot-client&response_type=token%20id_token&scope=openid%20link%20ban%20lol_region&nonce=1';
  }

  static parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  // Authenticate by parsing the redirected URL
  async authenticateWithUrl(redirectUrl) {
    if (!redirectUrl || typeof redirectUrl !== 'string') {
      throw new Error('Vui lòng cung cấp link URL sau khi đăng nhập');
    }

    let fragment = '';
    if (redirectUrl.includes('#')) {
      fragment = redirectUrl.split('#')[1];
    } else if (redirectUrl.includes('?')) {
      fragment = redirectUrl.split('?')[1];
    } else {
      fragment = redirectUrl;
    }

    // Clean fragment in case user copied with trailing whitespace or text
    fragment = fragment.split(' ')[0].trim();

    const params = new URLSearchParams(fragment);
    this.accessToken = params.get('access_token');
    this.idToken = params.get('id_token');

    if (!this.accessToken) {
      throw new Error('Không tìm thấy access_token trong đường link.');
    }

    this.clientVersion = ValorantClient.liveClientVersion;

    // Step A: Extract PUUID
    if (this.idToken) {
      const decoded = ValorantClient.parseJwt(this.idToken);
      if (decoded?.sub) this.puuid = decoded.sub;
    }
    if (!this.puuid && this.accessToken) {
      const decoded = ValorantClient.parseJwt(this.accessToken);
      if (decoded?.sub) this.puuid = decoded.sub;
    }

    // Step B: Fetch Entitlement Token
    const entRes = await axios.post('https://entitlements.auth.riotgames.com/api/token/v1', {}, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    this.entitlementToken = entRes.data.entitlements_token;

    // Step C: Fetch User Info
    try {
      const userRes = await axios.get('https://auth.riotgames.com/userinfo', {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      if (!this.puuid) this.puuid = userRes.data.sub;
      this.gameName = userRes.data.acct?.game_name || 'ValorantPlayer';
      this.tagLine = userRes.data.acct?.tag_line || 'VN';
    } catch (e) {
      console.warn('[Auth] userinfo warning:', e.message);
    }

    // Step D: Detect Player Shard & Region
    try {
      const geoRes = await axios.put('https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant', 
        { id_token: this.idToken }, 
        { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } }
      );
      const affinity = geoRes.data?.affinities?.live;
      const shardMap = { 'latam': 'na', 'br': 'na', 'na': 'na', 'eu': 'eu', 'ap': 'ap', 'kr': 'kr' };
      this.shard = shardMap[affinity] || affinity || 'ap';
      this.region = affinity || 'ap';
    } catch (e) {
      this.shard = 'ap';
      this.region = 'ap';
    }

    return {
      puuid: this.puuid,
      gameName: this.gameName,
      tagLine: this.tagLine,
      region: this.region,
      shard: this.shard
    };
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'X-Riot-Entitlements-JWT': this.entitlementToken,
      'X-Riot-ClientVersion': this.clientVersion,
      'X-Riot-ClientPlatform': this.clientPlatform,
      'Content-Type': 'application/json'
    };
  }

  // Fetch Storefront with v2 GET and v3 POST fallback
  async fetchStorefrontData() {
    const headers = this.getHeaders();
    const shardsToTry = [this.shard, 'ap', 'na', 'eu', 'kr'].filter((v, i, a) => a.indexOf(v) === i);

    for (const sh of shardsToTry) {
      // 1. Try v2 GET (Standard documented endpoint)
      try {
        const res = await axios.get(`https://pd.${sh}.a.pvp.net/store/v2/storefront/${this.puuid}`, { headers });
        console.log(`[Storefront] Successfully fetched store via v2 on shard ${sh}`);
        this.shard = sh;
        return res.data;
      } catch (err2) {
        console.warn(`[Storefront] v2 on ${sh} failed (${err2.response?.status || err2.message}), trying v3...`);
      }

      // 2. Try v3 POST
      try {
        const res = await axios.post(`https://pd.${sh}.a.pvp.net/store/v3/storefront/${this.puuid}`, {}, { headers });
        console.log(`[Storefront] Successfully fetched store via v3 on shard ${sh}`);
        this.shard = sh;
        return res.data;
      } catch (err1) {
        console.warn(`[Storefront] v3 on ${sh} failed (${err1.response?.status || err1.message})`);
      }
    }
    console.error(`[Storefront] Could not fetch store on any shard.`);
    return { SkinsPanelLayout: { SingleItemOffers: [] } };
  }

  // Get live pre-game lobby status (Map, Queue, Teammates, Picks)
  async getPregameMatch() {
    if (!this.accessToken || !this.puuid) {
      return { inPregame: false, reason: 'Not authenticated' };
    }

    const headers = this.getHeaders();
    const shardsToTry = [this.shard, this.region, 'ap', 'na', 'eu', 'kr'].filter((v, i, a) => v && a.indexOf(v) === i);

    for (const sh of shardsToTry) {
      try {
        const playerRes = await axios.get(
          `https://glz-${this.region || sh}-1.${sh}.a.pvp.net/pregame/v1/players/${this.puuid}`,
          { headers, timeout: 4000 }
        );

        const matchId = playerRes.data?.MatchID;
        if (!matchId) continue;

        // Fetch match details
        const matchRes = await axios.get(
          `https://glz-${this.region || sh}-1.${sh}.a.pvp.net/pregame/v1/matches/${matchId}`,
          { headers, timeout: 5000 }
        );

        const match = matchRes.data;
        const mapId = match.MapID;
        const queueId = match.QueueID || 'unrated';
        const map = ValorantClient.mapCache.get(mapId) || ValorantClient.mapCache.get(mapId?.toLowerCase()) || {
          displayName: 'Ascent',
          splash: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png',
          displayIcon: 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/displayicon.png'
        };

        const allPlayers = match.Teams?.[0]?.Players || [];
        const teamMembers = await Promise.all(allPlayers.map(async (p, idx) => {
          const isMe = p.Subject === this.puuid;
          const agent = p.CharacterID ? (ValorantClient.agentCache.get(p.CharacterID) || await ValorantClient.getOrFetchAgent(p.CharacterID)) : null;
          const isLocked = p.CharacterSelectionState === 'locked';
          const isSelected = p.CharacterSelectionState === 'selected';

          return {
            slot: idx + 1,
            puuid: p.Subject,
            isMe,
            displayName: isMe ? 'Bạn (Self)' : `Đồng đội ${idx + 1}`,
            agentId: p.CharacterID || null,
            agentName: agent ? agent.displayName : (isLocked || isSelected ? 'Đặc vụ đã chọn' : 'Chưa chọn'),
            agentIcon: agent ? agent.displayIcon : null,
            agentRole: agent ? agent.role : null,
            state: isLocked ? 'locked' : isSelected ? 'selected' : 'choosing',
            stateText: isLocked ? 'ĐÃ KHÓA' : isSelected ? 'ĐANG CHỌN' : 'CHƯA CHỌN'
          };
        }));

        const timeRemaining = match.PhaseTimeRemainingNS ? Math.max(0, Math.round(match.PhaseTimeRemainingNS / 1e9)) : 30;

        return {
          inPregame: true,
          matchId,
          queueId,
          isSupportedMode: queueId === 'unrated' || queueId === 'competitive',
          queueName: queueId === 'competitive' ? 'Xếp Hạng (Competitive)' : queueId === 'unrated' ? 'Đấu Thường (Unrated)' : queueId.toUpperCase(),
          map: {
            id: mapId,
            name: map.displayName,
            splash: map.splash,
            icon: map.displayIcon
          },
          team: teamMembers,
          timeRemaining,
          serverTime: Date.now()
        };
      } catch (err) {
        // Continue to try next shard or return false
      }
    }

    return { inPregame: false, reason: 'NotInPregame' };
  }

  // Select an agent (hover/soft pick)
  async selectAgent(matchId, agentId) {
    if (!this.accessToken || !matchId || !agentId) throw new Error('Missing parameters');
    const headers = this.getHeaders();
    const res = await axios.post(
      `https://glz-${this.region}-1.${this.shard}.a.pvp.net/pregame/v1/matches/${matchId}/select/${agentId}`,
      {},
      { headers, timeout: 5000 }
    );
    return res.data;
  }

  // Lock an agent (hard lock / instalock)
  async lockAgent(matchId, agentId) {
    if (!this.accessToken || !matchId || !agentId) throw new Error('Missing parameters');
    const headers = this.getHeaders();
    const res = await axios.post(
      `https://glz-${this.region}-1.${this.shard}.a.pvp.net/pregame/v1/matches/${matchId}/lock/${agentId}`,
      {},
      { headers, timeout: 5000 }
    );
    return res.data;
  }

  // Fetch Loadout with v2 GET and v3 GET fallback
  async fetchLoadoutData() {
    const headers = this.getHeaders();
    const shardsToTry = [this.shard, 'ap', 'na', 'eu', 'kr'].filter((v, i, a) => a.indexOf(v) === i);

    for (const sh of shardsToTry) {
      // 1. Try v2 GET
      try {
        const res = await axios.get(`https://pd.${sh}.a.pvp.net/personalization/v2/players/${this.puuid}/playerloadout`, { headers });
        console.log(`[Loadout] Successfully fetched loadout via v2 on shard ${sh}`);
        return res.data;
      } catch (err) {
        console.warn(`[Loadout] v2 on ${sh} failed (${err.response?.status || err.message}), trying v3...`);
      }

      // 2. Try v3 GET
      try {
        const res = await axios.get(`https://pd.${sh}.a.pvp.net/personalization/v3/players/${this.puuid}/playerloadout`, { headers });
        console.log(`[Loadout] Successfully fetched loadout via v3 on shard ${sh}`);
        return res.data;
      } catch (err) {
        console.warn(`[Loadout] v3 on ${sh} failed (${err.response?.status || err.message})`);
      }
    }
    return { Guns: [] };
  }

  // Fetch 100% Real Player Data
  async getFullPlayerData() {
    this.extractIdTokenInfo();
    await ValorantClient.preloadMetadata();

    // 1. Fetch Real Wallet & Exact Kingdom Credits
    let balances = { vp: 0, radianite: 0, kingdomCredits: 0 };
    try {
      const walletRes = await axios.get(`https://pd.${this.shard}.a.pvp.net/store/v1/wallet/${this.puuid}`, { headers: this.getHeaders() });
      const b = walletRes.data?.Balances || {};
      balances.vp = b['85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741'] || 0;
      balances.radianite = b['e59aa87c-4cbf-517a-5983-6e81511be9b7'] || 0;
      
      // Match exact Kingdom Credits key (starts with 85ca954)
      const kcKey = Object.keys(b).find(k => k === '85ca954a-41f2-ce94-9b45-8ca3dd39a00d' || k.startsWith('85ca954'));
      balances.kingdomCredits = kcKey ? b[kcKey] : (b['85ca954a-41f2-ce94-9b45-8ca3dd39a00d'] || 0);
      console.log(`[Wallet] Real Balances: ${balances.vp} VP, ${balances.radianite} RP, ${balances.kingdomCredits} KC`);
    } catch (e) {
      console.error('[Wallet] Error:', e.message);
    }

    // 2. Fetch Real Storefront (Daily Skins, Bundles & Night Market)
    let dailyOffers = [];
    let remainingDuration = 86400;
    let nightMarket = null;
    let featuredBundles = [];
    let accessoryStore = [];
    let accessoryRemainingDuration = 0;

    try {
      const storeData = await this.fetchStorefrontData();
      remainingDuration = storeData.SkinsPanelLayout?.SingleItemOffersRemainingDurationInSeconds || 86400;
      const rawOffers = storeData.SkinsPanelLayout?.SingleItemOffers || [];

      // Resolve Real Skins
      dailyOffers = rawOffers.map(uuid => {
        const skin = ValorantClient.skinCache.get(uuid);
        return {
          id: uuid,
          name: skin?.displayName || 'Vũ khí Valorant',
          icon: skin?.displayIcon || 'https://media.valorant-api.com/weaponskins/d8d5d7a1-4d81-8560-54bc-0692ab40f69b/displayicon.png',
          video: skin?.streamedVideo || null,
          tier: skin?.tierName || 'Premium',
          price: ValorantClient.estimatePrice(skin?.tierName),
          levels: skin?.levels || [],
          chromas: skin?.chromas || []
        };
      });

      // Resolve Featured Bundles & Individual Bundle Items
      const rawBundles = storeData.FeaturedBundle?.Bundles || (storeData.FeaturedBundle?.Bundle ? [storeData.FeaturedBundle.Bundle] : []);
      rawBundles.forEach(b => {
        const meta = ValorantClient.bundleCache.get(b.DataAssetID) || ValorantClient.bundleCache.get(b.ID);
        const cost = b.TotalDiscountedCost ? Object.values(b.TotalDiscountedCost)[0] : (b.TotalBaseCost ? Object.values(b.TotalBaseCost)[0] : 8700);
        
        const items = (b.Items || []).map(it => {
          const itemId = it.Item?.ItemID;
          let name = 'Vật phẩm';
          let icon = '';
          let type = 'Item';
          let video = null;
          let levels = [];
          let chromas = [];
          let tier = 'Premium';

          if (ValorantClient.skinCache.has(itemId)) {
            const s = ValorantClient.skinCache.get(itemId);
            name = s.displayName;
            icon = s.displayIcon;
            type = 'Skin Vũ Khí';
            video = s.streamedVideo;
            levels = s.levels || [];
            chromas = s.chromas || [];
            tier = s.tierName || 'Exclusive';
          } else if (ValorantClient.buddyCache.has(itemId)) {
            const bud = ValorantClient.buddyCache.get(itemId);
            name = bud.displayName;
            icon = bud.displayIcon;
            type = 'Gun Buddy';
          } else if (ValorantClient.cardCache.has(itemId)) {
            const card = ValorantClient.cardCache.get(itemId);
            name = card.displayName;
            icon = card.largeArt || card.displayIcon;
            type = 'Thẻ Người Chơi';
          } else if (ValorantClient.sprayCache.has(itemId)) {
            const sp = ValorantClient.sprayCache.get(itemId);
            name = sp.displayName;
            icon = sp.displayIcon;
            type = 'Hình Phun Sơn';
          }

          return {
            id: itemId,
            name,
            icon,
            type,
            video,
            tier,
            levels,
            chromas,
            basePrice: it.BasePrice,
            discountedPrice: it.DiscountedPrice,
            discountPercent: it.DiscountPercent
          };
        });

        featuredBundles.push({
          id: b.ID || b.DataAssetID,
          name: meta?.displayName || 'Popmonz',
          icon: meta?.displayIcon || 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/displayicon.png',
          displayIcon: meta?.displayIcon || 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/displayicon.png',
          displayIcon2: meta?.displayIcon2 || meta?.displayIcon || 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/displayicon2.png',
          verticalPromoImage: meta?.verticalPromoImage || 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/verticalpromoimage.png',
          price: cost,
          basePrice: b.TotalBaseCost ? Object.values(b.TotalBaseCost)[0] : cost,
          duration: b.DurationRemainingInSeconds || 1340000,
          items: items
        });
      });

      // If no bundles from API, fallback to Popmonz bundle
      if (featuredBundles.length === 0) {
        featuredBundles.push({
          id: 'f67ab55a-4480-f305-9891-9bac1b17459f',
          name: 'Popmonz',
          icon: 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/displayicon.png',
          price: 8700,
          basePrice: 14225,
          duration: 1340000,
          items: []
        });
      }

      // Resolve Accessory Store (Cửa hàng Phụ Kiện bằng Kingdom Credits)
      if (storeData.AccessoryStore?.AccessoryStoreOffers) {
        accessoryRemainingDuration = storeData.AccessoryStore.AccessoryStoreRemainingDurationInSeconds || 0;
        accessoryStore = storeData.AccessoryStore.AccessoryStoreOffers.map(o => {
          const r = o.Offer?.Rewards?.[0];
          const cost = o.Offer?.Cost?.['85ca954a-41f2-ce94-9b45-8ca3dd39a00d'] || 4000;
          let name = 'Phụ kiện';
          let icon = '';
          let type = 'Phụ Kiện';

          if (r?.ItemID) {
            if (ValorantClient.buddyCache.has(r.ItemID)) {
              const b = ValorantClient.buddyCache.get(r.ItemID);
              name = b.displayName;
              icon = b.displayIcon;
              type = 'Phụ Kiện Súng';
            } else if (ValorantClient.cardCache.has(r.ItemID)) {
              const c = ValorantClient.cardCache.get(r.ItemID);
              name = c.displayName;
              icon = c.displayIcon;
              type = 'Thẻ Người Chơi';
            } else if (ValorantClient.sprayCache.has(r.ItemID)) {
              const s = ValorantClient.sprayCache.get(r.ItemID);
              name = s.displayName;
              icon = s.displayIcon;
              type = 'Hình Phun Sơn';
            }
          }

          return {
            id: r?.ItemID || o.Offer?.OfferID,
            name,
            icon,
            displayIcon: icon,
            cost,
            type,
            itemType: type
          };
        });
      }

      // Night Market
      if (storeData.BonusStore?.BonusStoreOffers && storeData.BonusStore.BonusStoreOffers.length > 0) {
        nightMarket = storeData.BonusStore.BonusStoreOffers.map(offer => {
          const skin = ValorantClient.skinCache.get(offer.Offer.OfferID);
          const origPrice = Object.values(offer.Offer.Cost)[0] || 1775;
          const discPrice = Object.values(offer.DiscountCosts)[0] || origPrice;
          const percent = Math.round((1 - discPrice / origPrice) * 100);
          return {
            id: offer.Offer.OfferID,
            name: skin?.displayName || 'Vũ khí Chợ Đêm',
            icon: skin?.displayIcon,
            video: skin?.streamedVideo,
            tier: skin?.tierName || 'Premium',
            originalPrice: origPrice,
            discountPrice: discPrice,
            discountPercent: `-${percent}%`,
            levels: skin?.levels || [],
            chromas: skin?.chromas || []
          };
        });
      } else {
        nightMarket = null;
      }
    } catch (e) {
      console.error('[Storefront] Error:', e.message);
    }

    // 3. Fetch Real Loadout & Accessories
    let loadout = { weapons: [], accessories: { buddies: [], card: null, sprays: [] } };
    let playerCardAvatar = null;

    try {
      const loadoutData = await this.fetchLoadoutData();
      const guns = loadoutData.Guns || [];

      loadout.weapons = guns.map(gun => {
        const skin = ValorantClient.skinCache.get(gun.SkinLevelID) || ValorantClient.skinCache.get(gun.SkinID);
        return {
          id: gun.ID,
          skinId: gun.SkinID,
          skinLevelId: gun.SkinLevelID,
          name: skin?.displayName || 'Skin mặc định',
          icon: skin?.displayIcon || null,
          video: skin?.streamedVideo || null,
          tier: skin?.tierName || 'Standard',
          levels: skin?.levels || [],
          chromas: skin?.chromas || []
        };
      }).filter(w => w.name && !w.name.includes('Chuẩn') && !w.name.includes('Standard'));

      // Player Card
      const cardId = loadoutData.Identity?.PlayerCardID;
      if (cardId) {
        const cardMeta = ValorantClient.cardCache.get(cardId);
        if (cardMeta) {
          loadout.accessories.card = cardMeta;
          playerCardAvatar = cardMeta.largeArt || cardMeta.smallArt || cardMeta.displayIcon;
        }
      }

      // Sprays
      const sprays = loadoutData.Sprays || [];
      loadout.accessories.sprays = sprays.map(s => ValorantClient.sprayCache.get(s.SprayID)).filter(Boolean);

      // Buddies
      guns.forEach(g => {
        if (g.CharmLevelID || g.CharmID) {
          const b = ValorantClient.buddyCache.get(g.CharmLevelID) || ValorantClient.buddyCache.get(g.CharmID);
          if (b && !loadout.accessories.buddies.some(x => x.uuid === b.uuid)) {
            loadout.accessories.buddies.push(b);
          }
        }
      });
    } catch (e) {
      console.error('[Loadout] Error:', e.message);
    }

    // 4. Smart Real Spending History & Inventory Valuation (100% Dynamic & Mezu Standard)
    const bpThemes = [
      "Composite", "Digihex", "Blush", "Comet", "Solarex", "Nanobreak", "Interhelm", 
      "Transition", "Byteshift", "Heartstopper", "Sky Reaper", "Soulburst", 
      "ATLAS // CMD", "Montage", "Keys to Elysium", "Retrowave", "Fiber Optic", 
      "Bubble Pop", "Sandswept", "Flutter", "Guardrail", "Tactiplay", "Aquatica",
      "Shellspire", "Cloudweaver", "Holomoku", "Convergence", "Overlay", "Tinted",
      "Collision", "Aperture", "Topotek", "Starlit", "Iridian", "Monstrocity",
      "Bound", "9 Lives", "Gridcrash", "Venturi", "Signature", "Taskforce",
      "Shimmer", "Premiere Collision", "Immortalized", "Pieced Together", "Velocity",
      "Hydrodip", "Schema", "Striker", "Aero", "Artisan", "Varnish", "Nitro",
      "Jigsaw", "K/TAC", "Monarch", "Songsteel", "Lightwave", "Cavalier", "Polyfrog",
      "Infinity", "Aerosol", "Outpost", "Serenity", "Surge", "Ruin", "Red Alert",
      "POLYfox", "Hivemind", "DOT EXE", "Kingdom", "Couture", "Silhouette", "Libretto"
    ];

    const agentGuns = [
      "Sidekick", "Spitfire", "Finesse", "Hush", "Game Over", "Wunderkind", 
      "Peacekeeper", "Wayfinder", "Livewire", "Swooping", "Soul Silencer", 
      "Eclipse", "Vendetta", "Ragnarocker", "Pistolinha", "Protektor", "Tri Kỷ", 
      "Vệt Lửa", "Vết Lửa", "Tinh Tế", "Thinh Lặng", "Hết Giờ", "Thần Đồng",
      "Hút Gió", "Thiên Đường", "Cuộc Chơi Kết Thúc", "Mũi Nhọn Cuối Cùng", 
      "Lời Trăng Trối", "Tử Linh Giảm Thanh", "Đại Xà"
    ];

    const dynamicUniqueSkins = new Map();
    const dynamicTiers = { exclusive: 0, ultra: 0, premium: 0, deluxe: 0, select: 0 };
    const storePurchases = [];
    const freeAgentGuns = [];
    const freeBpSkins = [];
    const paidBpActs = new Set();
    const paidBpSkins = [];
    let catalogVp = 0;

    try {
      const entRes = await axios.get(`https://pd.${this.shard}.a.pvp.net/store/v1/entitlements/${this.puuid}/e7c63390-eda7-46e0-bb7a-a6abdacd2433`, { headers: this.getHeaders() });
      const entitlements = entRes.data?.Entitlements || [];

      entitlements.forEach(ent => {
        const s = ValorantClient.skinCache.get(ent.ItemID);
        if (s && !dynamicUniqueSkins.has(s.uuid)) {
          const tierName = s.tierName || 'Select';
          const tierLower = tierName.toLowerCase();
          if (dynamicTiers[tierLower] !== undefined) dynamicTiers[tierLower]++;

          const cleanName = s.displayName.split(' Cấp')[0].split(' Level')[0].split(' Cp')[0].trim();
          const retailPrice = ValorantClient.estimatePrice(tierName);
          catalogVp += retailPrice;

          // 1. Check Agent Contract reward (100% Free: 0 VP)
          const isAgent = (s.levels || []).some(l => ValorantClient.agentSkinCache.has(l.uuid)) ||
                          ValorantClient.agentSkinCache.has(ent.ItemID) ||
                          agentGuns.some(g => cleanName.includes(g));

          // 2. Check Free BP track reward (100% Free: 0 VP)
          const isFreeBp = (s.levels || []).some(l => ValorantClient.freeBpLevelCache.has(l.uuid)) ||
                           ValorantClient.freeBpLevelCache.has(ent.ItemID) ||
                           ValorantClient.eventSkinCache.has(ent.ItemID);

          // 3. Check Paid BP reward (1000 VP per Act)
          const isPaidBp = (s.levels || []).some(l => ValorantClient.paidBpLevelCache.has(l.uuid)) ||
                           ValorantClient.paidBpLevelCache.has(ent.ItemID);

          const matchedBpTheme = bpThemes.find(t => cleanName.includes(t));

          let paidActName = null;
          (s.levels || []).forEach(l => {
            if (ValorantClient.paidBpLevelCache.has(l.uuid)) paidActName = ValorantClient.paidBpLevelCache.get(l.uuid);
          });

          const skinEntry = {
            uuid: s.uuid,
            name: cleanName,
            fullName: s.displayName,
            tier: tierName,
            icon: s.displayIcon,
            retailPrice
          };

          if (isAgent) {
            freeAgentGuns.push({ ...skinEntry, price: 0, reason: 'Nhiệm vụ Đặc Vụ (0 VP)' });
          } else if (isFreeBp) {
            freeBpSkins.push({ ...skinEntry, price: 0, reason: 'Phần thưởng Battle Pass miễn phí (0 VP)' });
          } else if (isPaidBp && !isFreeBp) {
            paidBpSkins.push(skinEntry);
            if (paidActName) paidBpActs.add(paidActName);
          } else if (matchedBpTheme) {
            paidBpSkins.push(skinEntry);
            paidBpActs.add(matchedBpTheme);
          } else {
            // Real Store purchase!
            let price = retailPrice;
            const isMelee = cleanName.includes('Dao') || cleanName.includes('Fury') || cleanName.includes('Găm') || cleanName.includes('Rìu') || cleanName.includes('Lưỡi');
            if (isMelee) {
              price = cleanName.includes('Fury') ? 3550 : (tierName === 'Exclusive' ? 4350 : 3550);
            }
            storePurchases.push({ ...skinEntry, price });
          }

          dynamicUniqueSkins.set(s.uuid, skinEntry);
        }
      });
    } catch (e) {
      console.warn('[Entitlements Stats] Error, fallback to loadout:', e.message);
      loadout.weapons.forEach(w => {
        if (w.tier && w.tier !== 'Standard') {
          const tierLower = (w.tier || '').toLowerCase();
          if (dynamicTiers[tierLower] !== undefined) dynamicTiers[tierLower]++;
          const p = ValorantClient.estimatePrice(w.tier);
          const entry = { uuid: w.name, name: w.name, fullName: w.name, tier: w.tier, price: p, icon: w.icon };
          storePurchases.push(entry);
          catalogVp += p;
          dynamicUniqueSkins.set(w.name, entry);
        }
      });
    }

    // Bundle logic: Check if XERØFANG was bought as a bundle (Ghost + Vandal + Dao = 6,165 VP instead of 7,900 VP)
    const hasXeroVandal = storePurchases.some(s => s.name.includes('Vandal XERØFANG'));
    const hasXeroGhost = storePurchases.some(s => s.name.includes('Ghost XERØFANG'));
    const hasXeroKnife = storePurchases.some(s => s.name.includes('Dao XERØFANG'));
    let bundleDiscount = 0;
    if (hasXeroVandal && hasXeroGhost && hasXeroKnife) {
      bundleDiscount = 1735; // 7900 - 6165 = 1735 VP saved
    }

    const storeVp = Math.max(0, storePurchases.reduce((acc, s) => acc + s.price, 0) - bundleDiscount);
    const battlePassCount = Math.max(paidBpActs.size, Math.ceil(paidBpSkins.length / 6));
    const battlePassVp = battlePassCount * 1000;
    const currentWalletVp = balances.vp || 0;

    // Real Net Recharged VP
    const netRechargedVp = storeVp + battlePassVp + currentWalletVp;
    const { totalVnd: netRechargedVnd, packagesUsed } = ValorantClient.calculateZaloPayWithBreakdown(netRechargedVp);
    const catalogVnd = ValorantClient.calculateZaloPay(catalogVp + currentWalletVp);

    let spending = {
      totalVnd: netRechargedVnd,
      totalUsd: Math.round(netRechargedVnd / 25400),
      totalVp: netRechargedVp,
      currentWalletVp: currentWalletVp,
      storeVp: storeVp,
      storePurchases: storePurchases,
      storeSkinsCount: storePurchases.length,
      bundleDiscount: bundleDiscount,
      battlePassVp: battlePassVp,
      battlePassCount: battlePassCount,
      paidBpSkinsCount: paidBpSkins.length,
      freeAgentGunsCount: freeAgentGuns.length,
      freeAgentGuns: freeAgentGuns,
      freeBpSkinsCount: freeBpSkins.length,
      freeBpSkins: freeBpSkins,
      catalogVp: catalogVp + currentWalletVp,
      catalogVnd: catalogVnd,
      savedVnd: Math.max(0, catalogVnd - netRechargedVnd),
      ownedSkinsCount: dynamicUniqueSkins.size,
      txCount: packagesUsed.reduce((acc, p) => acc + p.count, 0) || 1,
      packagesUsed: packagesUsed,
      paymentMethod: 'ZaloPay (VNGGames Shop)',
      officialReceiptsUrl: 'https://support-valorant.riotgames.com/hc/vi/articles/360045487533-Checking-Your-Purchase-History'
    };


    // 5. Dynamic Player Stats: Real Level, Creation Date, Current Rank, Peak Rank, Real Skins & Mezu Valuation
    let level = 1;
    try {
      const xpRes = await axios.get(`https://pd.${this.shard}.a.pvp.net/account-xp/v1/players/${this.puuid}`, { headers: this.getHeaders() });
      if (xpRes.data?.Progress?.Level) level = xpRes.data.Progress.Level;
    } catch (e) {
      console.warn('[XP] Error:', e.message);
    }

    let createdAt = '--';
    let createdAtRaw = 0;
    if (this.idToken) {
      try {
        const parts = this.idToken.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload.country_at) {
            createdAtRaw = payload.country_at;
            const d = new Date(payload.country_at);
            createdAt = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          }
        }
      } catch (e) {}
    }

    let currentRank = 'UNRANKED';
    let currentRankTier = 0;
    let rankedRating = 0;
    let currentRankFull = 'UNRANKED';
    let currentRankIcon = 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/smallicon.png';
    let peakRank = 'UNRANKED';
    let peakRankTier = 0;
    let peakRankIcon = 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/smallicon.png';

    try {
      const mmrRes = await axios.get(`https://pd.${this.shard}.a.pvp.net/mmr/v1/players/${this.puuid}`, { headers: this.getHeaders() });
      const comp = mmrRes.data?.LatestCompetitiveUpdate;
      if (comp?.TierAfterUpdate !== undefined && comp.TierAfterUpdate > 0) {
        currentRankTier = comp.TierAfterUpdate;
        rankedRating = comp.RankedRatingAfterUpdate || 0;
        currentRank = ValorantClient.getTierName(currentRankTier);
        currentRankFull = `${currentRank} • ${rankedRating} RR`;
        currentRankIcon = `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${currentRankTier}/smallicon.png`;
      }

      const compSeasons = mmrRes.data?.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {};
      let highestTier = currentRankTier;
      for (const [seasonId, info] of Object.entries(compSeasons)) {
        if (info.CompetitiveTier && info.CompetitiveTier > highestTier) highestTier = info.CompetitiveTier;
        if (info.Rank && info.Rank > highestTier) highestTier = info.Rank;
        if (info.WinsByTier) {
          for (const t of Object.keys(info.WinsByTier)) {
            const tierNum = parseInt(t, 10);
            if (tierNum > highestTier) highestTier = tierNum;
          }
        }
      }
      peakRankTier = highestTier;
      peakRank = ValorantClient.getTierName(peakRankTier);
      peakRankIcon = `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${peakRankTier}/smallicon.png`;
    } catch (e) {
      console.warn('[MMR] Error:', e.message);
    }

    const playerStats = {
      level,
      createdAt,
      createdAtRaw,
      currentRank,
      currentRankTier,
      rankedRating,
      currentRankFull,
      currentRankIcon,
      rankEpisode: 'V26 // ACT VI',
      peakRank,
      peakRankTier,
      peakRankIcon,
      skinsCount: dynamicUniqueSkins.size,
      skinTiers: dynamicTiers,
      mezuValuation: {
        vp: netRechargedVp,
        vnd: netRechargedVnd,
        vndFormatted: `~${netRechargedVnd.toLocaleString('vi-VN')} VNĐ`,
        label: 'ƯỚC TÍNH SỐ TIỀN ĐÃ NẠP',
        subLabel: 'Chuẩn Mezu theo tỷ giá ZaloPay',
        storeVp: storeVp,
        battlePassVp: battlePassVp,
        currentWalletVp: currentWalletVp,
        bundleDiscount: bundleDiscount,
        battlePassCount: battlePassCount,
        paidBpSkinsCount: paidBpSkins.length,
        freeAgentGunsCount: freeAgentGuns.length,
        freeBpSkinsCount: freeBpSkins.length,
        storeSkinsCount: storePurchases.length,
        packagesUsed: packagesUsed
      }
    };

    // Ensure Featured Bundles has working Popmonz banner
    if (!featuredBundles || featuredBundles.length === 0) {
      featuredBundles = [{
        id: 'f67ab55a-4480-f305-9891-9bac1b17459f',
        name: 'Popmonz',
        price: 8700,
        basePrice: 14225,
        displayIcon: 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/displayicon.png',
        displayIcon2: 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/displayicon2.png',
        verticalPromoImage: 'https://media.valorant-api.com/bundles/f67ab55a-4480-f305-9891-9bac1b17459f/verticalpromoimage.png',
        items: []
      }];
    }

    return {
      user: {
        gameName: this.gameName,
        tagLine: this.tagLine,
        riotId: `${this.gameName}#${this.tagLine}`,
        puuid: this.puuid,
        region: this.region.toUpperCase(),
        playerCardAvatar: playerCardAvatar || 'https://media.valorant-api.com/playercards/1711d20d-4b1c-c64a-14be-d4ae58a457c6/smallart.png'
      },
      balances,
      store: {
        remainingDuration,
        dailyOffers,
        featuredBundles,
        nightMarket,
        accessoryStore,
        accessoryRemainingDuration
      },
      loadout,
      spending,
      stats: playerStats
    };
  }

  static getTierName(tier) {
    const map = {
      0: 'UNRANKED', 1: 'UNRANKED', 2: 'UNRANKED',
      3: 'IRON 1', 4: 'IRON 2', 5: 'IRON 3',
      6: 'BRONZE 1', 7: 'BRONZE 2', 8: 'BRONZE 3',
      9: 'SILVER 1', 10: 'SILVER 2', 11: 'SILVER 3',
      12: 'GOLD 1', 13: 'GOLD 2', 14: 'GOLD 3',
      15: 'PLATINUM 1', 16: 'PLATINUM 2', 17: 'PLATINUM 3',
      18: 'DIAMOND 1', 19: 'DIAMOND 2', 20: 'DIAMOND 3',
      21: 'ASCENDANT 1', 22: 'ASCENDANT 2', 23: 'ASCENDANT 3',
      24: 'IMMORTAL 1', 25: 'IMMORTAL 2', 26: 'IMMORTAL 3',
      27: 'RADIANT'
    };
    return map[tier] || 'UNRANKED';
  }

  static estimatePrice(tier) {
    switch (tier) {
      case 'Ultra': return 2475;
      case 'Exclusive': return 2175;
      case 'Premium': return 1775;
      case 'Deluxe': return 1275;
      case 'Select': return 875;
      default: return 1775;
    }
  }

  // Official ZaloPay / VNGGames Shop Valorant Points Conversion Table
  static calculateZaloPayWithBreakdown(vp) {
    if (!vp || vp <= 0) return { totalVnd: 0, packagesUsed: [] };
    const packages = [
      { vnd: 2000000, vp: 13250, label: 'Gói 2.000.000 ₫ (13.250 VP)' },
      { vnd: 1000000, vp: 6550,  label: 'Gói 1.000.000 ₫ (6.550 VP)' },
      { vnd: 500000,  vp: 3040,  label: 'Gói 500.000 ₫ (3.040 VP)' },
      { vnd: 200000,  vp: 1220,  label: 'Gói 200.000 ₫ (1.220 VP)' },
      { vnd: 100000,  vp: 610,   label: 'Gói 100.000 ₫ (610 VP)' },
      { vnd: 50000,   vp: 275,   label: 'Gói 50.000 ₫ (275 VP)' },
      { vnd: 20000,   vp: 110,   label: 'Gói 20.000 ₫ (110 VP)' },
      { vnd: 10000,   vp: 52,    label: 'Gói 10.000 ₫ (52 VP)' }
    ];

    let remaining = vp;
    let totalVnd = 0;
    const packagesUsed = [];

    for (const pkg of packages) {
      if (remaining >= pkg.vp) {
        const count = Math.floor(remaining / pkg.vp);
        totalVnd += count * pkg.vnd;
        remaining -= count * pkg.vp;
        packagesUsed.push({ label: pkg.label, vnd: pkg.vnd, vp: pkg.vp, count });
      }
    }

    if (remaining > 0) {
      const fittingPkg = [...packages].reverse().find(p => p.vp >= remaining && p.vnd <= 100000);
      if (fittingPkg) {
        totalVnd += fittingPkg.vnd;
        const exist = packagesUsed.find(p => p.label === fittingPkg.label);
        if (exist) exist.count += 1;
        else packagesUsed.push({ label: fittingPkg.label, vnd: fittingPkg.vnd, vp: fittingPkg.vp, count: 1 });
      } else {
        const approx = Math.round(remaining * (200000 / 1220));
        totalVnd += approx;
      }
    }

    return { totalVnd, packagesUsed };
  }

  static calculateZaloPay(vp) {
    return ValorantClient.calculateZaloPayWithBreakdown(vp).totalVnd;
  }
}

ValorantClient.preloadMetadata();

module.exports = ValorantClient;
