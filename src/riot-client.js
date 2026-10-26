// ========================================================
// PRODAILY VALORANT - STANDALONE CLIENT-SIDE RIOT API ENGINE
// 100% Standalone Mobile Execution via CapacitorHttp
// Zero Node.js / PC Dependency - Works Anywhere on 4G / Wi-Fi
// ========================================================

class ClientRiotEngineClass {
  constructor() {
    this.sessionKey = 'skinpeek_local_session';
    this.cacheKey = 'skinpeek_cached_player';
    this.metaKey = 'skinpeek_metadata_cache';
    
    this.session = this.loadSession();
    this.clientVersion = 'release-13.08-shipping-20-5715960';
    this.clientPlatform = 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';
    
    this.skinCache = new Map();
    this.buddyCache = new Map();
    this.cardCache = new Map();
    this.sprayCache = new Map();
    this.bundleCache = new Map();
    this.tierCache = new Map();
    this.agentsList = [];
    this.mapsList = [];
    this.isMetaLoaded = false;
  }

  loadSession() {
    try {
      const saved = localStorage.getItem(this.sessionKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      accessToken: null,
      idToken: null,
      entitlementToken: null,
      puuid: null,
      gameName: 'ValorantPlayer',
      tagLine: 'VN1',
      region: 'ap',
      shard: 'ap'
    };
  }

  saveSession(sessionData) {
    this.session = { ...this.session, ...sessionData };
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(this.session));
    } catch (e) {}
  }

  clearSession() {
    this.session = {
      accessToken: null,
      idToken: null,
      entitlementToken: null,
      puuid: null,
      gameName: 'ValorantPlayer',
      tagLine: 'VN1',
      region: 'ap',
      shard: 'ap'
    };
    try {
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem(this.cacheKey);
    } catch (e) {}
  }

  hasSession() {
    return !!(this.session && this.session.accessToken && this.session.puuid);
  }

  static parseJwt(token) {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      try {
        return JSON.parse(atob(token.split('.')[1]));
      } catch (err) {
        return null;
      }
    }
  }

  static estimatePrice(tierName) {
    const t = (tierName || '').toLowerCase();
    if (t.includes('ultra')) return 2475;
    if (t.includes('exclusive')) return 2175;
    if (t.includes('premium')) return 1775;
    if (t.includes('deluxe')) return 1275;
    return 875;
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

  // Official ZaloPay conversion table
  static calculateZaloPayWithBreakdown(vp) {
    if (!vp || vp <= 0) return { totalVnd: 0, packagesUsed: [] };
    const packages = [
      { vnd: 2000000, vp: 13250, label: 'Gói 2.000.000 đ (13.250 VP)' },
      { vnd: 1000000, vp: 6550,  label: 'Gói 1.000.000 đ (6.550 VP)' },
      { vnd: 500000,  vp: 3040,  label: 'Gói 500.000 đ (3.040 VP)' },
      { vnd: 200000,  vp: 1220,  label: 'Gói 200.000 đ (1.220 VP)' },
      { vnd: 100000,  vp: 610,   label: 'Gói 100.000 đ (610 VP)' },
      { vnd: 50000,   vp: 275,   label: 'Gói 50.000 đ (275 VP)' },
      { vnd: 20000,   vp: 110,   label: 'Gói 20.000 đ (110 VP)' },
      { vnd: 10000,   vp: 52,    label: 'Gói 10.000 đ (52 VP)' }
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

  // Preload Valorant Metadata
  async preloadMetadata() {
    if (this.isMetaLoaded) return;
    try {
      // 1. Version
      try {
        const vRes = await fetch('https://valorant-api.com/v1/version');
        const vJson = await vRes.json();
        if (vJson.data?.riotClientVersion) {
          this.clientVersion = vJson.data.riotClientVersion;
        }
      } catch (e) {}

      // 2. Skins & Tiers
      const [skinsRes, tiersRes, bundlesRes, agentsRes, cardsRes, buddiesRes, spraysRes] = await Promise.all([
        fetch('https://valorant-api.com/v1/weapons/skins').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/contenttiers').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/bundles').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/playercards').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/buddies').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/sprays').then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      (tiersRes.data || []).forEach(t => {
        this.tierCache.set(t.uuid, t.devName || t.displayName);
      });

      (skinsRes.data || []).forEach(s => {
        const tierName = this.tierCache.get(s.contentTierUuid) || 'Select';
        const displayIcon = s.displayIcon || (s.levels?.[0]?.displayIcon) || 'https://media.valorant-api.com/weaponskins/d8d5d7a1-4d81-8560-54bc-0692ab40f69b/displayicon.png';
        const streamedVideo = s.levels?.find(l => l.streamedVideo)?.streamedVideo || null;

        const info = {
          uuid: s.uuid,
          displayName: s.displayName,
          displayIcon,
          streamedVideo,
          tierName,
          levels: s.levels || [],
          chromas: s.chromas || []
        };
        this.skinCache.set(s.uuid, info);
        (s.levels || []).forEach(l => this.skinCache.set(l.uuid, info));
        (s.chromas || []).forEach(c => this.skinCache.set(c.uuid, info));
      });

      (bundlesRes.data || []).forEach(b => {
        this.bundleCache.set(b.uuid, b);
      });

      (cardsRes.data || []).forEach(c => {
        this.cardCache.set(c.uuid, c);
      });

      (buddiesRes.data || []).forEach(b => {
        this.buddyCache.set(b.uuid, b);
        (b.levels || []).forEach(l => this.buddyCache.set(l.uuid, b));
      });

      (spraysRes.data || []).forEach(s => {
        this.sprayCache.set(s.uuid, s);
      });

      this.agentsList = (agentsRes.data || []).map(a => ({
        uuid: a.uuid,
        displayName: a.displayName,
        displayIcon: a.displayIcon,
        displayIconSmall: a.displayIconSmall,
        fullPortrait: a.fullPortrait,
        role: a.role ? { displayName: a.role.displayName, displayIcon: a.role.displayIcon } : null,
        description: a.description
      }));

      this.isMetaLoaded = true;
    } catch (e) {
      console.warn('[Standalone] Preload metadata warning:', e.message);
    }
  }

  // Authenticate with redirect URL
  async authenticateWithUrl(redirectUrl) {
    if (!redirectUrl || typeof redirectUrl !== 'string') {
      throw new Error('Vui lòng dán link URL sau khi đăng nhập');
    }

    let fragment = '';
    if (redirectUrl.includes('#')) fragment = redirectUrl.split('#')[1];
    else if (redirectUrl.includes('?')) fragment = redirectUrl.split('?')[1];
    else fragment = redirectUrl;

    fragment = fragment.split(' ')[0].trim();
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');

    if (!accessToken) {
      throw new Error('Không tìm thấy mã access_token trong đường link!');
    }

    await this.preloadMetadata();

    // 1. Decode PUUID & Name if in tokens
    let puuid = null;
    let gameName = 'Player';
    let tagLine = 'VN1';

    if (idToken) {
      const decodedId = ClientRiotEngineClass.parseJwt(idToken);
      if (decodedId?.sub) puuid = decodedId.sub;
      if (decodedId?.acct?.game_name) gameName = decodedId.acct.game_name;
      if (decodedId?.acct?.tag_line) tagLine = decodedId.acct.tag_line;
    }
    if (!puuid && accessToken) {
      const decodedAt = ClientRiotEngineClass.parseJwt(accessToken);
      if (decodedAt?.sub) puuid = decodedAt.sub;
    }

    // 2. Fetch Entitlement Token
    const entRes = await fetch('https://entitlements.auth.riotgames.com/api/token/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    if (!entRes.ok) {
      throw new Error('Không thể lấy mã Entitlement từ Riot (HTTP ' + entRes.status + ')');
    }
    const entData = await entRes.json();
    const entitlementToken = entData.entitlements_token;

    // 3. Userinfo
    try {
      const uRes = await fetch('https://auth.riotgames.com/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (uRes.ok) {
        const uData = await uRes.json();
        if (uData.sub) puuid = uData.sub;
        if (uData.acct?.game_name) gameName = uData.acct.game_name;
        if (uData.acct?.tag_line) tagLine = uData.acct.tag_line;
      }
    } catch (e) {}

    // 4. Region / Shard
    let region = 'ap';
    let shard = 'ap';
    try {
      const geoRes = await fetch('https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_token: idToken })
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const affinity = geoData?.affinities?.live;
        const shardMap = { 'latam': 'na', 'br': 'na', 'na': 'na', 'eu': 'eu', 'ap': 'ap', 'kr': 'kr' };
        shard = shardMap[affinity] || affinity || 'ap';
        region = affinity || 'ap';
      }
    } catch (e) {}

    this.saveSession({
      accessToken,
      idToken,
      entitlementToken,
      puuid,
      gameName,
      tagLine,
      region,
      shard
    });

    return {
      success: true,
      puuid,
      gameName,
      tagLine,
      riotId: `${gameName}#${tagLine}`,
      region,
      shard
    };
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.session.accessToken}`,
      'X-Riot-Entitlements-JWT': this.session.entitlementToken,
      'X-Riot-ClientVersion': this.clientVersion,
      'X-Riot-ClientPlatform': this.clientPlatform,
      'Content-Type': 'application/json'
    };
  }

  // Get full player data (Wallet, Store, Loadout, MMR, Mezu Valuation)
  async getFullPlayerData() {
    if (!this.hasSession()) {
      throw new Error('Chưa đăng nhập tài khoản Riot');
    }
    await this.preloadMetadata();

    const headers = this.getHeaders();
    const puuid = this.session.puuid;
    const shard = this.session.shard || 'ap';

    // 1. Real Wallet
    let balances = { vp: 0, radianite: 0, kingdomCredits: 0 };
    try {
      const wRes = await fetch(`https://pd.${shard}.a.pvp.net/store/v1/wallet/${puuid}`, { headers });
      if (wRes.ok) {
        const wData = await wRes.json();
        const b = wData.Balances || {};
        balances.vp = b['85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741'] || 0;
        balances.radianite = b['e59aa87c-4cbf-517a-5983-6e81511be9b7'] || 0;
        const kcKey = Object.keys(b).find(k => k === '85ca954a-41f2-ce94-9b45-8ca3dd39a00d' || k.startsWith('85ca954'));
        balances.kingdomCredits = kcKey ? b[kcKey] : (b['85ca954a-41f2-ce94-9b45-8ca3dd39a00d'] || 0);
      }
    } catch (e) {}

    // 2. Real Storefront (Daily Skins, Bundles, Night Market, Accessories)
    let dailyOffers = [];
    let remainingDuration = 86400;
    let nightMarket = null;
    let featuredBundles = [];
    let accessoryStore = [];
    let accessoryRemainingDuration = 0;

    let storeData = null;
    // Try v3 POST first (Riot's latest API version)
    try {
      const sRes3 = await fetch(`https://pd.${shard}.a.pvp.net/store/v3/storefront/${puuid}`, {
        method: 'POST',
        headers,
        body: '{}'
      });
      if (sRes3.ok) storeData = await sRes3.json();
    } catch (e) {}

    // Fallback to v2 GET
    if (!storeData) {
      try {
        const sRes2 = await fetch(`https://pd.${shard}.a.pvp.net/store/v2/storefront/${puuid}`, { headers });
        if (sRes2.ok) storeData = await sRes2.json();
      } catch (e) {}
    }

    if (storeData) {
      remainingDuration = storeData.SkinsPanelLayout?.SingleItemOffersRemainingDurationInSeconds || 86400;
      const rawOffers = storeData.SkinsPanelLayout?.SingleItemOffers || [];

      dailyOffers = rawOffers.map(uuid => {
        const skin = this.skinCache.get(uuid);
        return {
          id: uuid,
          name: skin?.displayName || 'Vũ khí Valorant',
          icon: skin?.displayIcon || 'https://media.valorant-api.com/weaponskins/d8d5d7a1-4d81-8560-54bc-0692ab40f69b/displayicon.png',
          video: skin?.streamedVideo || null,
          tier: skin?.tierName || 'Premium',
          price: ClientRiotEngineClass.estimatePrice(skin?.tierName),
          levels: skin?.levels || [],
          chromas: skin?.chromas || []
        };
      });

      // Featured Bundles
      const rawBundles = storeData.FeaturedBundle?.Bundles || (storeData.FeaturedBundle?.Bundle ? [storeData.FeaturedBundle.Bundle] : []);
      rawBundles.forEach(b => {
        const meta = this.bundleCache.get(b.DataAssetID) || this.bundleCache.get(b.ID);
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

          if (this.skinCache.has(itemId)) {
            const s = this.skinCache.get(itemId);
            name = s.displayName;
            icon = s.displayIcon;
            type = 'Skin Vũ Khí';
            video = s.streamedVideo;
            levels = s.levels || [];
            chromas = s.chromas || [];
            tier = s.tierName || 'Exclusive';
          } else if (this.buddyCache.has(itemId)) {
            const bud = this.buddyCache.get(itemId);
            name = bud.displayName;
            icon = bud.displayIcon;
            type = 'Gun Buddy';
          } else if (this.cardCache.has(itemId)) {
            const card = this.cardCache.get(itemId);
            name = card.displayName;
            icon = card.largeArt || card.displayIcon;
            type = 'Thẻ Người Chơi';
          } else if (this.sprayCache.has(itemId)) {
            const sp = this.sprayCache.get(itemId);
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
          name: meta?.displayName || 'Featured Bundle',
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

      // Night Market
      if (storeData.BonusStore?.BonusStoreOffers && storeData.BonusStore.BonusStoreOffers.length > 0) {
        nightMarket = storeData.BonusStore.BonusStoreOffers.map(offer => {
          const skin = this.skinCache.get(offer.Offer.OfferID);
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
      }

      // Accessory Store
      if (storeData.AccessoryStore?.AccessoryStoreOffers) {
        accessoryRemainingDuration = storeData.AccessoryStore.AccessoryStoreRemainingDurationInSeconds || 0;
        accessoryStore = storeData.AccessoryStore.AccessoryStoreOffers.map(o => {
          const r = o.Offer?.Rewards?.[0];
          const cost = o.Offer?.Cost?.['85ca954a-41f2-ce94-9b45-8ca3dd39a00d'] || 4000;
          let name = 'Phụ kiện';
          let icon = '';
          let type = 'Phụ Kiện';

          if (r?.ItemID) {
            if (this.buddyCache.has(r.ItemID)) {
              const b = this.buddyCache.get(r.ItemID);
              name = b.displayName;
              icon = b.displayIcon;
              type = 'Phụ Kiện Súng';
            } else if (this.cardCache.has(r.ItemID)) {
              const c = this.cardCache.get(r.ItemID);
              name = c.displayName;
              icon = c.displayIcon;
              type = 'Thẻ Người Chơi';
            } else if (this.sprayCache.has(r.ItemID)) {
              const s = this.sprayCache.get(r.ItemID);
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
    }

    if (featuredBundles.length === 0) {
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

    // 3. Real Loadout
    let loadout = { weapons: [], accessories: { buddies: [], card: null, sprays: [] } };
    let playerCardAvatar = null;
    let loadoutData = null;

    try {
      const lRes2 = await fetch(`https://pd.${shard}.a.pvp.net/personalization/v2/players/${puuid}/playerloadout`, { headers });
      if (lRes2.ok) loadoutData = await lRes2.json();
    } catch (e) {}

    if (!loadoutData) {
      try {
        const lRes3 = await fetch(`https://pd.${shard}.a.pvp.net/personalization/v3/players/${puuid}/playerloadout`, { headers });
        if (lRes3.ok) loadoutData = await lRes3.json();
      } catch (e) {}
    }

    if (loadoutData) {
      const guns = loadoutData.Guns || [];
      loadout.weapons = guns.map(gun => {
        const skin = this.skinCache.get(gun.SkinLevelID) || this.skinCache.get(gun.SkinID);
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

      const cardId = loadoutData.Identity?.PlayerCardID;
      if (cardId) {
        const cardMeta = this.cardCache.get(cardId);
        if (cardMeta) {
          loadout.accessories.card = cardMeta;
          playerCardAvatar = cardMeta.largeArt || cardMeta.smallArt || cardMeta.displayIcon;
        }
      }

      const sprays = loadoutData.Sprays || [];
      loadout.accessories.sprays = sprays.map(s => this.sprayCache.get(s.SprayID)).filter(Boolean);

      guns.forEach(g => {
        if (g.CharmLevelID || g.CharmID) {
          const b = this.buddyCache.get(g.CharmLevelID) || this.buddyCache.get(g.CharmID);
          if (b && !loadout.accessories.buddies.some(x => x.uuid === b.uuid)) {
            loadout.accessories.buddies.push(b);
          }
        }
      });
    }

    // 4. Entitlements & Smart Spending (Mezu Standard)
    const dynamicUniqueSkins = new Map();
    const dynamicTiers = { exclusive: 0, ultra: 0, premium: 0, deluxe: 0, select: 0 };
    const storePurchases = [];
    const freeAgentGuns = [];
    const freeBpSkins = [];
    const paidBpActs = new Set();
    const paidBpSkins = [];
    let catalogVp = 0;

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

    try {
      const entRes = await fetch(`https://pd.${shard}.a.pvp.net/store/v1/entitlements/${puuid}/e7c63390-eda7-46e0-bb7a-a6abdacd2433`, { headers });
      if (entRes.ok) {
        const entData = await entRes.json();
        (entData.Entitlements || []).forEach(ent => {
          const s = this.skinCache.get(ent.ItemID);
          if (s && !dynamicUniqueSkins.has(s.uuid)) {
            const tierName = s.tierName || 'Select';
            const tierLower = tierName.toLowerCase();
            if (dynamicTiers[tierLower] !== undefined) dynamicTiers[tierLower]++;

            const cleanName = s.displayName.split(' Cấp')[0].split(' Level')[0].split(' Cp')[0].trim();
            const retailPrice = ClientRiotEngineClass.estimatePrice(tierName);
            catalogVp += retailPrice;

            const isAgent = agentGuns.some(g => cleanName.includes(g));
            const matchedBpTheme = bpThemes.find(t => cleanName.includes(t));

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
            } else if (matchedBpTheme) {
              paidBpSkins.push(skinEntry);
              paidBpActs.add(matchedBpTheme);
            } else {
              let price = retailPrice;
              const isMelee = cleanName.includes('Dao') || cleanName.includes('Fury') || cleanName.includes('Găm') || cleanName.includes('Rìu') || cleanName.includes('Lưỡi');
              if (isMelee) price = cleanName.includes('Fury') ? 3550 : (tierName === 'Exclusive' ? 4350 : 3550);
              storePurchases.push({ ...skinEntry, price });
            }
            dynamicUniqueSkins.set(s.uuid, skinEntry);
          }
        });
      }
    } catch (e) {
      loadout.weapons.forEach(w => {
        if (w.tier && w.tier !== 'Standard') {
          const tierLower = (w.tier || '').toLowerCase();
          if (dynamicTiers[tierLower] !== undefined) dynamicTiers[tierLower]++;
          const p = ClientRiotEngineClass.estimatePrice(w.tier);
          const entry = { uuid: w.name, name: w.name, fullName: w.name, tier: w.tier, price: p, icon: w.icon };
          storePurchases.push(entry);
          catalogVp += p;
          dynamicUniqueSkins.set(w.name, entry);
        }
      });
    }

    const hasXeroVandal = storePurchases.some(s => s.name.includes('Vandal XERØFANG'));
    const hasXeroGhost = storePurchases.some(s => s.name.includes('Ghost XERØFANG'));
    const hasXeroKnife = storePurchases.some(s => s.name.includes('Dao XERØFANG'));
    let bundleDiscount = (hasXeroVandal && hasXeroGhost && hasXeroKnife) ? 1735 : 0;

    const storeVp = Math.max(0, storePurchases.reduce((acc, s) => acc + s.price, 0) - bundleDiscount);
    const battlePassCount = Math.max(paidBpActs.size, Math.ceil(paidBpSkins.length / 6));
    const battlePassVp = battlePassCount * 1000;
    const currentWalletVp = balances.vp || 0;

    const netRechargedVp = storeVp + battlePassVp + currentWalletVp;
    const { totalVnd: netRechargedVnd, packagesUsed } = ClientRiotEngineClass.calculateZaloPayWithBreakdown(netRechargedVp);
    const catalogVnd = ClientRiotEngineClass.calculateZaloPayWithBreakdown(catalogVp + currentWalletVp).totalVnd;

    const spending = {
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

    // 5. XP & Account Level
    let level = 1;
    try {
      const xpRes = await fetch(`https://pd.${shard}.a.pvp.net/account-xp/v1/players/${puuid}`, { headers });
      if (xpRes.ok) {
        const xpData = await xpRes.json();
        if (xpData.Progress?.Level) level = xpData.Progress.Level;
      }
    } catch (e) {}

    // 6. Created Date
    let createdAt = '--';
    let createdAtRaw = 0;
    if (this.session.idToken) {
      try {
        const decoded = ClientRiotEngineClass.parseJwt(this.session.idToken);
        if (decoded?.country_at) {
          createdAtRaw = decoded.country_at;
          const d = new Date(decoded.country_at);
          createdAt = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
      } catch (e) {}
    }

    // 7. MMR & Rank
    let currentRank = 'UNRANKED';
    let currentRankTier = 0;
    let rankedRating = 0;
    let currentRankFull = 'UNRANKED';
    let currentRankIcon = 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/smallicon.png';
    let peakRank = 'UNRANKED';
    let peakRankTier = 0;
    let peakRankIcon = 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/smallicon.png';

    try {
      const mmrRes = await fetch(`https://pd.${shard}.a.pvp.net/mmr/v1/players/${puuid}`, { headers });
      if (mmrRes.ok) {
        const mmrData = await mmrRes.json();
        const comp = mmrData.LatestCompetitiveUpdate;
        if (comp?.TierAfterUpdate !== undefined && comp.TierAfterUpdate > 0) {
          currentRankTier = comp.TierAfterUpdate;
          rankedRating = comp.RankedRatingAfterUpdate || 0;
          currentRank = ClientRiotEngineClass.getTierName(currentRankTier);
          currentRankFull = `${currentRank} • ${rankedRating} RR`;
          currentRankIcon = `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${currentRankTier}/smallicon.png`;
        }

        const compSeasons = mmrData.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {};
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
        peakRank = ClientRiotEngineClass.getTierName(peakRankTier);
        peakRankIcon = `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${peakRankTier}/smallicon.png`;
      }
    } catch (e) {}

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

    const finalData = {
      user: {
        gameName: this.session.gameName,
        tagLine: this.session.tagLine,
        riotId: `${this.session.gameName}#${this.session.tagLine}`,
        puuid: this.session.puuid,
        region: (this.session.region || 'AP').toUpperCase(),
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

    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(finalData));
    } catch (e) {}

    return finalData;
  }

  searchSkins(query, weapon, tier, limit = 80) {
    let list = Array.from(this.skinCache.values());
    // Deduplicate by displayName
    const seen = new Set();
    list = list.filter(s => {
      if (!s.displayName || s.displayName.includes('Standard') || s.displayName.includes('Chuẩn') || seen.has(s.displayName)) return false;
      seen.add(s.displayName);
      return true;
    });

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(s => s.displayName.toLowerCase().includes(q));
    }
    if (weapon) {
      const w = weapon.toLowerCase();
      list = list.filter(s => s.displayName.toLowerCase().includes(w));
    }
    if (tier) {
      const t = tier.toLowerCase();
      list = list.filter(s => (s.tierName || '').toLowerCase().includes(t));
    }
    return list.slice(0, limit);
  }
}

// Global Singleton Instance
window.ClientRiotEngine = new ClientRiotEngineClass();
window.ClientRiotEngine.preloadMetadata();
