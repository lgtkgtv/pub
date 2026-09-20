// L'Impressionnisme Vivant: App Logic, Resolutions, Device Adaptation & 4K Wallpaper Gallery

// ==========================================================================
// THEME ENGINE (Light / Dark Gallery Mode)
// ==========================================================================
const THEME_STORAGE_KEY = 'monet_gallery_theme';

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    // Default to the warm parchment gallery mode unless visitor explicitly picked night mode
    const initialTheme = savedTheme || 'light';
    setTheme(initialTheme);
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
    updateThemeUI(theme);
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
}

function updateThemeUI(theme) {
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    const btn = document.getElementById('themeToggleBtn');
    const isDark = theme === 'dark';
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (label) label.textContent = isDark ? 'Light Mode' : 'Night Mode';
    if (btn) btn.setAttribute('title', isDark ? 'Switch to Light Parchment Gallery' : 'Switch to Night Exhibition Mode');
}

// Immediate theme execution to prevent flash of the wrong theme
try {
    const _savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (_savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
} catch (e) {}

// ==========================================================================
// DYNAMIC SCRIPT LOADER (Lazy-load JSZip on demand)
// ==========================================================================
let jszipLoadPromise = null;
function ensureJSZipLoaded() {
    if (typeof JSZip !== 'undefined') {
        return Promise.resolve(window.JSZip);
    }
    if (jszipLoadPromise) {
        return jszipLoadPromise;
    }
    jszipLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => {
            jszipLoadPromise = null;
            reject(new Error('Failed to load JSZip library'));
        };
        document.head.appendChild(script);
    });
    return jszipLoadPromise;
}

// ==========================================================================
// DEBOUNCE UTILITY FOR RESPONSIVE SEARCH
// ==========================================================================
function debounce(func, wait = 150) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function escapeQuotes(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeJsAttr(str) {
    return (str || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

let currentViewMode = 'videos'; // 'videos', 'wallpapers', or 'favorites'
let currentVideos = [];
let currentWallpapers = [];       // full scene set for the active filter — powers bulk ZIP & slideshow
let currentWallpaperCovers = [];  // one representative scene per video — what the grid actually renders
let currentModalVideoId = null;

// Reduce a flat wallpaper-scene list to one representative (first) scene per video,
// so the Wallpaper Gallery grid isn't a wall of 8-16 near-duplicate frames per title.
function getOneWallpaperPerVideo(wallpapers) {
    const seen = new Set();
    const covers = [];
    for (const wp of wallpapers) {
        if (!seen.has(wp.videoId)) {
            seen.add(wp.videoId);
            covers.push(wp);
        }
    }
    return covers;
}

// Favorites / Personal Collection State
const FAVORITES_STORAGE_KEY = 'monet_gallery_favorites_v1';
let favoriteVideoIds = new Set();

function loadFavorites() {
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // Ensure only non-empty strings corresponding to actual catalog videos are retained
                const validIds = parsed.filter(id => {
                    if (!id || typeof id !== 'string' || id.trim() === '' || id === 'undefined' || id === 'null') {
                        return false;
                    }
                    if (typeof ALL_VIDEOS !== 'undefined' && Array.isArray(ALL_VIDEOS) && ALL_VIDEOS.length > 0) {
                        return ALL_VIDEOS.some(v => v.id === id);
                    }
                    return true;
                });
                favoriteVideoIds = new Set(validIds);
                // Purge stale or corrupted IDs from localStorage immediately
                if (validIds.length !== parsed.length) {
                    saveFavorites();
                }
            }
        }
    } catch (e) {
        console.warn('Failed to load favorites from localStorage', e);
        favoriteVideoIds = new Set();
    }
    updateFavoritesCount();
}

function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoriteVideoIds]));
    } catch (e) {
        console.warn('Failed to save favorites to localStorage', e);
    }
    updateFavoritesCount();
}

function updateFavoritesCount() {
    const countEl = document.getElementById('favTabCount');
    if (countEl) countEl.textContent = favoriteVideoIds.size;
}

function isFavoriteVideo(videoId) {
    if (!videoId) return false;
    return favoriteVideoIds.has(videoId);
}

function toggleFavoriteVideo(videoId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!videoId || typeof videoId !== 'string' || videoId.trim() === '' || videoId === 'undefined' || videoId === 'null') {
        return;
    }
    if (typeof ALL_VIDEOS !== 'undefined' && Array.isArray(ALL_VIDEOS) && ALL_VIDEOS.length > 0) {
        const exists = ALL_VIDEOS.some(v => v.id === videoId);
        if (!exists) return;
    }

    if (favoriteVideoIds.has(videoId)) {
        favoriteVideoIds.delete(videoId);
    } else {
        favoriteVideoIds.add(videoId);
    }
    saveFavorites();

    // Update heart buttons across page
    document.querySelectorAll(`[data-fav-video="${videoId}"]`).forEach(btn => {
        const isFav = favoriteVideoIds.has(videoId);
        btn.classList.toggle('active', isFav);
        btn.setAttribute('title', isFav ? 'Remove from My Collection' : 'Save to My Collection');
        btn.innerHTML = isFav ? '❤️' : '🤍';
    });

    // Update modal favorite button if open
    if (currentModalVideoId === videoId) {
        const modalFav = document.getElementById('modalFavBtn');
        if (modalFav) {
            const isFav = favoriteVideoIds.has(videoId);
            modalFav.classList.toggle('active', isFav);
            modalFav.innerHTML = isFav ? '❤️ Saved in Collection' : '🤍 Save to Collection';
        }
    }

    // If currently viewing favorites, refresh grid view
    if (currentViewMode === 'favorites') {
        applyFilters();
    }
}

// ==========================================================================
// Cross-Device Collection Sharing & In-App Toast Feedback
// ==========================================================================
let toastTimeoutId = null;

function showNotificationToast(message, durationMs = 3500) {
    let toast = document.getElementById('monetToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'monetToast';
        toast.className = 'monet-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
        toast.classList.remove('visible');
    }, durationMs);
}

function sharePersonalCollection() {
    if (favoriteVideoIds.size === 0) {
        showNotificationToast('Your collection is currently empty. Heart some artworks first!');
        return;
    }
    const ids = Array.from(favoriteVideoIds).join(',');
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('fav', ids);
    const fullUrl = shareUrl.toString();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl).then(() => {
            showNotificationToast(`🔗 Share link copied to clipboard! (${favoriteVideoIds.size} works)`);
        }).catch(() => {
            prompt('Copy this share link to open your collection on another device:', fullUrl);
        });
    } else {
        prompt('Copy this share link to open your collection on another device:', fullUrl);
    }
}

function confirmClearCollection() {
    if (favoriteVideoIds.size === 0) return;
    if (confirm(`Are you sure you want to remove all ${favoriteVideoIds.size} works from your personal collection?`)) {
        clearAllFavorites();
        showNotificationToast('🗑️ Personal collection cleared');
    }
}

function checkSharedFavoritesUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedFavs = urlParams.get('fav') || urlParams.get('favorites');
        if (sharedFavs) {
            const rawIds = sharedFavs.split(',').map(s => s.trim()).filter(Boolean);
            if (rawIds.length > 0 && typeof ALL_VIDEOS !== 'undefined' && Array.isArray(ALL_VIDEOS)) {
                let addedCount = 0;
                rawIds.forEach(id => {
                    if (ALL_VIDEOS.some(v => v.id === id)) {
                        if (!favoriteVideoIds.has(id)) {
                            favoriteVideoIds.add(id);
                            addedCount++;
                        }
                    }
                });
                if (addedCount > 0) {
                    saveFavorites();
                    showNotificationToast(`🎉 Imported ${addedCount} shared work${addedCount === 1 ? '' : 's'} into your collection!`);
                } else if (favoriteVideoIds.size > 0) {
                    showNotificationToast(`✨ Loaded shared collection (${favoriteVideoIds.size} works)`);
                }
                switchMainTab('favorites');
                // Clean URL parameters smoothly without full page refresh
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            }
        }
    } catch (e) {
        console.warn('Failed to parse shared favorites from URL', e);
    }
}

function toggleFavoriteFromModal() {
    if (!currentModalVideoId) return;
    toggleFavoriteVideo(currentModalVideoId);
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    if (typeof applyConfigFlags === 'function') {
        applyConfigFlags();
    }
    updateAudioUI(false);

    detectDeviceFormFactor();
    window.addEventListener('resize', detectDeviceFormFactor);

    loadFavorites();
    initHeroStats();
    renderChannelCards();
    populatePlaylistFilter();
    populateArtistFilter();
    populateThemeFilter();
    populateChannelFilter();
    populateResolutionFilter();
    populateCopyrightFilter();
    populateContentTypeFilter();
    initSearchSuggestions();
    initFiltersAndEvents();
    buildAllWallpapersList();

    // Default to 4K UHD Only as requested
    const resSelect = document.getElementById('resSelect');
    if (resSelect) {
        resSelect.value = '4K';
    }

    initBackToTop();
    initCuratorMode();

    applyFilters();

    // Check if user opened a shared collection link (?fav=id1,id2,...)
    checkSharedFavoritesUrl();
});

// Floating Back to Top Functionality
function initBackToTop() {
    const btn = document.getElementById('backToTopBtn');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 450) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }, { passive: true });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Device Form-Factor Detection (Mobile vs Desktop)
function detectDeviceFormFactor() {
    const isMobile = window.innerWidth <= 768 || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    document.documentElement.classList.toggle('is-mobile-device', isMobile);
    document.documentElement.classList.toggle('is-desktop-device', !isMobile);

    return isMobile;
}

function formatViews(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M views';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K views';
    }
    return num.toLocaleString() + ' views';
}

function formatHours(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
}

function initHeroStats() {
    const meta = PLAYLIST_METADATA;
    if (document.getElementById('statTotalVideos')) {
        document.getElementById('statTotalVideos').textContent = meta.totalVideos;
    }
    if (document.getElementById('statTotalViews')) {
        document.getElementById('statTotalViews').textContent = (meta.totalViews / 1000000).toFixed(1) + 'M';
    }
    if (document.getElementById('statChannelCount')) {
        document.getElementById('statChannelCount').textContent = meta.channelCount;
    }
    if (document.getElementById('stat4kCount')) {
        document.getElementById('stat4kCount').textContent = `${meta.count4K} Works`;
    }
    if (document.getElementById('statWallpapersCount')) {
        document.getElementById('statWallpapersCount').textContent = `${meta.totalWallpapers}+`;
    }
}

function buildAllWallpapersList() {
    currentWallpapers = [];
    ALL_VIDEOS.forEach(v => {
        if (v.wallpapers && v.wallpapers.length > 0) {
            v.wallpapers.forEach(wp => {
                currentWallpapers.push({
                    ...wp,
                    videoTitle: v.title,
                    channel: v.channel,
                    videoUrl: v.url,
                    artist: v.artist,
                    theme: v.theme,
                    downloadProhibited: v.downloadProhibited,
                    copyrightStatus: v.copyrightStatus
                });
            });
        }
    });
}

function renderChannelCards() {
    const container = document.getElementById('channelsGrid');
    if (!container) return;
    container.innerHTML = '';

    const profiledKeys = Object.keys(CHANNEL_PROFILES);
    const sortedStats = [...CHANNEL_STATS].sort((a, b) => {
        const aProfiled = profiledKeys.includes(a.channel) ? 1 : 0;
        const bProfiled = profiledKeys.includes(b.channel) ? 1 : 0;
        if (aProfiled !== bProfiled) return bProfiled - aProfiled;
        return b.total_views - a.total_views;
    });

    // Render profiled channels plus any channels with >= 2 videos
    const channelsToRender = sortedStats.filter(s => profiledKeys.includes(s.channel) || s.count >= 2);

    const FALLBACK_PALETTES = [
        { accent: '#2e4053', icon: '🏛️', archetype: 'Archival Masterwork Contributor' },
        { accent: '#117864', icon: '🌿', archetype: 'Atmospheric Art Specialist' },
        { accent: '#7d6608', icon: '🎨', archetype: 'Living Canvas Artisan' },
        { accent: '#2874a6', icon: '🌊', archetype: 'Visual Landscape Pioneer' },
        { accent: '#78281f', icon: '✨', archetype: 'Impressionist Motion Curator' },
        { accent: '#6c3483', icon: '🎭', archetype: 'Classical & Aesthetic Curator' }
    ];

    channelsToRender.forEach((stats, idx) => {
        let profile = CHANNEL_PROFILES[stats.channel];
        if (!profile) {
            const pal = FALLBACK_PALETTES[idx % FALLBACK_PALETTES.length];
            profile = {
                name: stats.channel,
                archetype: stats.count >= 10 ? 'Major Archival Contributor' : (stats.count >= 4 ? 'Featured Impressionist Curator' : 'Independent Art Contributor'),
                icon: pal.icon,
                accent: pal.accent,
                tagline: `Collection of ${stats.count} curated Impressionist masterwork presentations`,
                characterization: `Contributing ${stats.count} presentations across this archive with ${formatViews(stats.total_views)} total views (averaging ${formatViews(stats.avg_views)} views per video).`,
                keyThemes: ['Living Impressionism', 'Masterwork Motion', 'Art History'],
                musicalTone: 'Classical and atmospheric ambient accompaniments.',
                targetAudience: 'Art enthusiasts and landscape connoisseurs.'
            };
        }

        const card = document.createElement('div');
        card.className = 'channel-card';
        card.innerHTML = `
            <div class="channel-card-top">
                <span class="channel-badge" style="background-color: ${profile.accent}15; color: ${profile.accent}">
                    ${profile.archetype}
                </span>
                <span class="channel-icon">${profile.icon}</span>
            </div>
            <h3 class="channel-name">${profile.name}</h3>
            <div class="channel-tagline">${profile.tagline}</div>
            <p class="channel-desc">${profile.characterization}</p>
            
            <div class="channel-theme-tags">
                ${(profile.keyThemes || []).map(t => `<span class="theme-tag">${t}</span>`).join('')}
            </div>

            <div class="channel-copyright-row">
                <span class="channel-copyright-pill ${(typeof isChannelDownloadProhibited === 'function' ? isChannelDownloadProhibited(profile.name) : !!profile.downloadProhibited) ? 'pill-prohibited' : 'pill-permitted'}">
                    ${(typeof isChannelDownloadProhibited === 'function' ? isChannelDownloadProhibited(profile.name) : !!profile.downloadProhibited) ? '🔒 Copyright Reserved · View Only' : (profile.copyrightStatus || '🛡️ Public Domain / Free Wallpapers')}
                </span>
            </div>

            <div class="channel-stats-row">
                <div>
                    <span>Playlist Videos</span>
                    <strong>${stats.count}</strong>
                </div>
                <div>
                    <span>Total Views</span>
                    <strong>${formatViews(stats.total_views)}</strong>
                </div>
                <div>
                    <span>Avg / Video</span>
                    <strong>${formatViews(stats.avg_views)}</strong>
                </div>
            </div>

            <div class="channel-actions">
                <button class="btn-filter-channel" onclick="filterByChannel('${escapeJsAttr(profile.name)}')" style="width: 100%;">
                    🏛️ Explore ${stats.count} Curated Works
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    // Update section badge dynamically
    const badgeSpan = document.getElementById('channelGuidesBadge');
    if (badgeSpan) {
        badgeSpan.textContent = `${channelsToRender.length} Featured Curators · ${CHANNEL_STATS.length} Source Channels`;
    }
}

function populatePlaylistFilter() {
    const select = document.getElementById('playlistSelect');
    if (!select) return;
    if (typeof PLAYLISTS_CONFIG === 'undefined' || !Array.isArray(PLAYLISTS_CONFIG) || PLAYLISTS_CONFIG.length <= 1) {
        select.style.display = 'none';
        return;
    }
    select.style.display = 'inline-block';
    select.innerHTML = `<option value="ALL">📚 All Playlists (${PLAYLISTS_CONFIG.length})</option>`;
    PLAYLISTS_CONFIG.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `📂 ${p.title}`;
        select.appendChild(opt);
    });
}

function populateArtistFilter() {
    const select = document.getElementById('artistSelect');
    if (!select) return;
    const currentVal = select.value || 'ALL';
    const artists = (typeof CATALOG_ARTISTS !== 'undefined' && Array.isArray(CATALOG_ARTISTS))
        ? CATALOG_ARTISTS
        : [];
    select.innerHTML = `<option value="ALL">🎨 All Artists (${artists.length} Masters)</option>`;

    artists.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.name;
        const resHint = a.count4K > 0 ? `4K & FHD` : `1080p`;
        const eraHint = a.era ? ` — ${a.era}` : '';
        opt.textContent = `${a.icon || '🎨'} ${a.name}${eraHint} (${a.count} · ${resHint})`;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

// Museum-placard style info strip shown above the grid when one artist is selected
function updateArtistInfoStrip(selectedArtist) {
    const strip = document.getElementById('artistInfoStrip');
    if (!strip) return;

    if (!selectedArtist || selectedArtist === 'ALL') {
        strip.style.display = 'none';
        return;
    }

    const artists = (typeof CATALOG_ARTISTS !== 'undefined' && Array.isArray(CATALOG_ARTISTS)) ? CATALOG_ARTISTS : [];
    const aObj = artists.find(a => a.name === selectedArtist);
    if (!aObj) {
        strip.style.display = 'none';
        return;
    }

    const iconEl = document.getElementById('artistInfoIcon');
    const nameEl = document.getElementById('artistInfoName');
    const eraEl = document.getElementById('artistInfoEra');
    const bioEl = document.getElementById('artistInfoBio');

    if (iconEl) iconEl.textContent = aObj.icon || '🎨';
    if (nameEl) nameEl.textContent = aObj.name;
    if (eraEl) eraEl.textContent = aObj.era || '';
    if (bioEl) bioEl.textContent = aObj.bio || '';

    strip.style.display = aObj.bio ? 'flex' : 'none';
}

function populateThemeFilter() {
    const select = document.getElementById('themeSelect');
    if (!select) return;
    const currentVal = select.value || 'ALL';
    const themes = (typeof CATALOG_THEMES !== 'undefined' && Array.isArray(CATALOG_THEMES))
        ? CATALOG_THEMES
        : [];
    select.innerHTML = `<option value="ALL">🏛️ All Themes & Motifs (${themes.length} Categories)</option>`;

    themes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        const resHint = t.count4K > 0 ? `4K & FHD` : `1080p`;
        opt.textContent = `${t.icon || '🏛️'} ${t.name} (${t.count} · ${resHint})`;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

function populateCopyrightFilter() {
    const select = document.getElementById('copyrightSelect');
    if (!select) return;
    const currentVal = select.value || 'ALL';
    const downloadableCount = ALL_VIDEOS.filter(v => !v.downloadProhibited).length;
    const prohibitedCount = ALL_VIDEOS.filter(v => v.downloadProhibited).length;

    select.innerHTML = `
        <option value="ALL">⚖️ All Licenses (${ALL_VIDEOS.length} works)</option>
        <option value="DOWNLOADABLE">✅ Free Wallpaper Downloads (${downloadableCount} works)</option>
        <option value="VIEW_ONLY">🔒 Copyright Reserved (${prohibitedCount} works · View Only)</option>
    `;
    select.value = currentVal;
}

function populateContentTypeFilter() {
    const select = document.getElementById('contentTypeSelect');
    if (!select) return;
    const currentVal = select.value || 'ALL';
    const archivalCount = ALL_VIDEOS.filter(v => v.contentType === 'Authentic Archival').length;
    const aiCount = ALL_VIDEOS.length - archivalCount;

    select.innerHTML = `
        <option value="ALL">🖼️ All Content Types (${ALL_VIDEOS.length} works)</option>
        <option value="ARCHIVAL">🏛️ Authentic Archival Scans (${archivalCount} works)</option>
        <option value="AI_ANIMATED">✨ AI-Animated Reimagining (${aiCount} works)</option>
    `;
    select.value = currentVal;
}

function checkContentTypeMatch(video, mode) {
    if (!mode || mode === 'ALL') return true;
    if (mode === 'ARCHIVAL') return video.contentType === 'Authentic Archival';
    if (mode === 'AI_ANIMATED') return video.contentType !== 'Authentic Archival';
    return true;
}

function onArtistFilterChange() {
    const artistSelect = document.getElementById('artistSelect');
    const resSelect = document.getElementById('resSelect');
    const channelSelect = document.getElementById('channelSelect');
    if (!artistSelect) return;
    const selectedArtist = artistSelect.value;
    updateArtistInfoStrip(selectedArtist);

    if (selectedArtist !== 'ALL') {
        const artists = (typeof CATALOG_ARTISTS !== 'undefined') ? CATALOG_ARTISTS : [];
        const aObj = artists.find(a => a.name === selectedArtist);
        
        // If user is on 4K filter and this artist has 0 works in 4K, auto-expand to 1080p/ALL
        if (resSelect && resSelect.value === '4K' && aObj && aObj.count4K === 0 && aObj.count > 0) {
            resSelect.value = 'ALL';
            showFilterAssistToast(`🎬 Switched to All Resolutions: <strong>${escapeQuotes(aObj.name)}</strong> masterworks are available in 1080p Full HD.`);
        }

        // If current channel has 0 works for this artist, auto-reset channel to ALL
        if (channelSelect && channelSelect.value !== 'ALL') {
            const hasInChannel = ALL_VIDEOS.some(v => v.channel === channelSelect.value && (v.artist === selectedArtist || (aObj && v.title.toLowerCase().includes(aObj.query.toLowerCase()))));
            if (!hasInChannel) {
                channelSelect.value = 'ALL';
            }
        }
    }

    applyFilters();
}

function onThemeFilterChange() {
    const themeSelect = document.getElementById('themeSelect');
    const resSelect = document.getElementById('resSelect');
    const channelSelect = document.getElementById('channelSelect');
    if (!themeSelect) return;
    const selectedTheme = themeSelect.value;

    if (selectedTheme !== 'ALL') {
        const themes = (typeof CATALOG_THEMES !== 'undefined') ? CATALOG_THEMES : [];
        const tObj = themes.find(t => t.name === selectedTheme);

        if (resSelect && resSelect.value === '4K' && tObj && tObj.count4K === 0 && tObj.count > 0) {
            resSelect.value = 'ALL';
            showFilterAssistToast(`🎬 Switched to All Resolutions: "<strong>${escapeQuotes(tObj.name)}</strong>" works are in 1080p Full HD.`);
        }

        if (channelSelect && channelSelect.value !== 'ALL') {
            const hasInChannel = ALL_VIDEOS.some(v => v.channel === channelSelect.value && (v.theme === selectedTheme || (tObj && (tObj.synonyms || []).some(s => v.title.toLowerCase().includes(s)))));
            if (!hasInChannel) {
                channelSelect.value = 'ALL';
            }
        }
    }

    applyFilters();
}

function selectArtistFromDropdown(artistName) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    updateActiveSearchChips('');
    const select = document.getElementById('artistSelect');
    if (select) {
        select.value = artistName;
        onArtistFilterChange();
    }
}

function matchesThemeQuery(title, themeName) {
    if (!themeName || themeName === 'ALL') return true;
    const tObj = (typeof CATALOG_THEMES !== 'undefined' ? CATALOG_THEMES : []).find(t => t.name === themeName || t.query === themeName);
    if (!tObj) return title.toLowerCase().includes(themeName.toLowerCase());
    const lower = title.toLowerCase();
    return (tObj.synonyms || []).some(s => lower.includes(s)) || lower.includes((tObj.query || '').toLowerCase());
}

function showFilterAssistToast(msg) {
    let toast = document.getElementById('filterAssistToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'filterAssistToast';
        toast.className = 'filter-assist-toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.classList.add('visible');
    setTimeout(() => {
        if (toast) toast.classList.remove('visible');
    }, 4500);
}

function populateChannelFilter() {
    const select = document.getElementById('channelSelect');
    if (!select) return;
    select.innerHTML = `<option value="ALL">All Source Channels (${CHANNEL_STATS.length})</option>`;

    CHANNEL_STATS.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.channel;
        opt.textContent = `${s.channel} (${s.count} videos · ${formatViews(s.total_views)})`;
        select.appendChild(opt);
    });
}

function populateResolutionFilter() {
    const select = document.getElementById('resSelect');
    if (!select) return;
    const currentVal = select.value || '4K';
    const count4K = ALL_VIDEOS.filter(v => v.is4K).length;
    const count1080Plus = ALL_VIDEOS.filter(v => v.height >= 1080).length;
    const count1080Exact = ALL_VIDEOS.filter(v => v.height === 1080).length;
    const countTotal = ALL_VIDEOS.length;
    const countOther = ALL_VIDEOS.filter(v => v.height < 1080).length;

    select.innerHTML = `
        <option value="4K">👑 4K UHD Only (${count4K} works)</option>
        <option value="1080P_PLUS">💎 1080p HD or better (${count1080Plus} works)</option>
        <option value="1080P_EXACT">✨ 1080p Full HD (${count1080Exact} works)</option>
        <option value="ALL">All Resolutions (${countTotal} works)</option>
        <option value="OTHER">Standard HD (720p / ${countOther} works)</option>
    `;
    select.value = currentVal;
}

function switchMainTab(tabKey) {
    const tabVideos = document.getElementById('tabBtnVideos');
    const tabWallpapers = document.getElementById('tabBtnWallpapers');
    const tabChannels = document.getElementById('tabBtnChannels');
    const tabFavorites = document.getElementById('tabBtnFavorites');

    const explorerSection = document.getElementById('explorerSection');
    const channelsSection = document.getElementById('channelsSection');
    const gridVid = document.getElementById('videosGrid');
    const gridWp = document.getElementById('wallpapersGrid');
    const downloadBar = document.getElementById('wallpaperDownloadBar');
    const favoritesBar = document.getElementById('favoritesActionBar');
    const headerTitle = document.getElementById('sectionHeaderTitle');
    const headerDesc = document.getElementById('sectionHeaderDesc');

    // Update tab button states
    [
        { key: 'videos', btn: tabVideos },
        { key: 'wallpapers', btn: tabWallpapers },
        { key: 'channels', btn: tabChannels },
        { key: 'favorites', btn: tabFavorites }
    ].forEach(({ key, btn }) => {
        if (!btn) return;
        const isActive = (key === tabKey);
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    currentViewMode = tabKey;

    if (tabKey === 'channels') {
        if (explorerSection) explorerSection.style.display = 'none';
        if (channelsSection) {
            channelsSection.style.display = 'block';
            channelsSection.classList.remove('tab-fade-in');
            void channelsSection.offsetWidth;
            channelsSection.classList.add('tab-fade-in');
        }
        // Smooth scroll to content top if visitor has scrolled down
        const container = document.querySelector('main.container');
        if (container && window.scrollY > container.offsetTop) {
            window.scrollTo({ top: container.offsetTop - 20, behavior: 'smooth' });
        }
        return;
    }

    // For videos, wallpapers, and favorites: hide channels, show explorer section
    if (channelsSection) channelsSection.style.display = 'none';
    if (explorerSection) {
        explorerSection.style.display = 'block';
        explorerSection.classList.remove('tab-fade-in');
        void explorerSection.offsetWidth;
        explorerSection.classList.add('tab-fade-in');
    }

    if (tabKey === 'videos') {
        if (gridVid) gridVid.style.display = 'grid';
        if (gridWp) gridWp.style.display = 'none';
        if (downloadBar) downloadBar.style.display = 'none';
        if (favoritesBar) favoritesBar.style.display = 'none';
        if (headerTitle) headerTitle.textContent = '🎨 The Impressionist Video Explorer';
        if (headerDesc) headerDesc.innerHTML = 'Explore high-definition Impressionist masterworks, living canvas motion, and museum-grade reproductions.';
    } else if (tabKey === 'wallpapers') {
        if (gridVid) gridVid.style.display = 'none';
        if (gridWp) gridWp.style.display = 'grid';
        if (downloadBar) downloadBar.style.display = 'flex';
        if (favoritesBar) favoritesBar.style.display = 'none';
        if (headerTitle) headerTitle.textContent = '🖼️ The Impressionist Wallpaper Gallery';
        if (headerDesc) headerDesc.innerHTML = 'One cover scene per title — open any card for the full set of extracted scenes, or download/slideshow everything at once below.';
    } else if (tabKey === 'favorites') {
        if (gridVid) gridVid.style.display = 'grid';
        if (gridWp) gridWp.style.display = 'none';
        if (downloadBar) downloadBar.style.display = 'none';
        if (favoritesBar) favoritesBar.style.display = (favoriteVideoIds.size > 0) ? 'flex' : 'none';
        if (headerTitle) headerTitle.textContent = '❤️ My Saved Collection';
        if (headerDesc) headerDesc.innerHTML = 'Your personal gallery of bookmarked Impressionist masterworks. Saved in your browser for contemplation anytime.';

        // Auto-reset search, channel, and resolution filters so saved works are never hidden by lingering filters
        const searchInput = document.getElementById('searchInput');
        const channelSelect = document.getElementById('channelSelect');
        const resSelect = document.getElementById('resSelect');
        if (searchInput && searchInput.value !== '') {
            searchInput.value = '';
            updateActiveSearchChips('');
        }
        if (channelSelect && channelSelect.value !== 'ALL') channelSelect.value = 'ALL';
        if (resSelect && resSelect.value !== 'ALL') resSelect.value = 'ALL';
    }

    applyFilters();

    const container = document.querySelector('main.container');
    if (container && window.scrollY > container.offsetTop) {
        window.scrollTo({ top: container.offsetTop - 20, behavior: 'smooth' });
    }
}

function switchViewMode(mode) {
    switchMainTab(mode);
}

function renderCurrentView() {
    if (currentViewMode === 'videos') {
        renderVideos(currentVideos);
    } else {
        renderWallpapers(currentWallpapers);
    }
}

const PAGE_BATCH_SIZE = 24;
let renderedVideoCount = 0;
let renderedWallpaperCount = 0;
let videoObserver = null;
let wallpaperObserver = null;

function createVideoCard(v) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.videoId = v.id;
    const resBadgeClass = v.is4K ? 'badge-4k' : (v.height >= 1080 ? 'badge-fhd' : 'badge-sd');
    let thumbSrc = v.thumb;
    if (v.channel === 'Cupid Studio' && v.wallpapers && v.wallpapers.length > 0) {
        thumbSrc = v.wallpapers[0].path;
    }
    const isFav = isFavoriteVideo(v.id);
    const videoDesc = `${escapeQuotes(v.title)} - ${v.qualityLabel} by ${escapeQuotes(v.channel)}`;

    const archivalPillHtml = v.contentType === 'Authentic Archival'
        ? `<span class="pill-archival-tag" title="Authentic archival scan of the real historical painting, not an AI reinterpretation">🏛️ Authentic Archival</span>`
        : '';

    card.innerHTML = `
        <div class="thumb-container">
            <img class="thumb-img" src="${thumbSrc}" alt="${videoDesc}" loading="lazy" decoding="async" onclick="openVideoModal('${v.id}', null, 0, this)" />
            <span class="thumb-badge-views">${formatViews(v.views)}</span>
            <span class="thumb-badge-res ${resBadgeClass}">${v.qualityLabel}</span>
            <span class="thumb-badge-duration">${v.durationFormatted}</span>
            <button class="thumb-badge-fav ${isFav ? 'active' : ''}" data-fav-video="${v.id}" onclick="toggleFavoriteVideo('${v.id}', event)" title="${isFav ? 'Remove from My Collection' : 'Save to My Collection'}" aria-label="${isFav ? 'Remove from My Collection' : 'Save to My Collection'}">
                ${isFav ? '❤️' : '🤍'}
            </button>
            <div class="play-overlay" role="button" aria-label="Play video: ${escapeQuotes(v.title)}" onclick="openVideoModal('${v.id}', null, 0, this)">
                <div class="play-circle">▶</div>
            </div>
        </div>
        <div class="video-content">
            <div class="video-channel" onclick="filterByChannel('${escapeJsAttr(v.channel)}')" style="cursor: pointer;" title="Click to view all from this channel">
                ${v.channel}
            </div>
            <h4 class="video-title" onclick="openVideoModal('${v.id}', null, 0, this)" style="cursor: pointer;" title="${escapeQuotes(v.title)}">
                ${v.title}
            </h4>
            
            <div class="video-meta-pills">
                <span class="pill-res-tag ${v.is4K ? 'tag-4k' : ''}">📐 ${v.resolution}</span>
                <span class="pill-res-tag">${v.qualityLabel}</span>
                ${archivalPillHtml}
            </div>

            <div class="video-actions">
                <button class="btn-card-play" onclick="openVideoModal('${v.id}', null, 0, this)" aria-label="Play video ${escapeQuotes(v.title)}" title="Watch in embedded gallery player">
                    ▶ Play Video
                </button>
                <button class="btn-card-wallpaper" onclick="openWallpaperModal('${v.id}', 0, this)" aria-label="View wallpapers for ${escapeQuotes(v.title)}" title="View wallpaper scene snapshots for this video">
                    🖼️ Wallpapers ${v.wallpaperCount > 0 ? `<span class="badge-count">${v.wallpaperCount}</span>` : ''}
                </button>
            </div>
        </div>
    `;
    return card;
}

function createWallpaperCard(wp) {
    const card = document.createElement('div');
    card.className = 'wallpaper-card';
    card.onclick = () => openWallpaperModal(wp.videoId, wp.snapshotIndex - 1, card);
    const wpAlt = `${escapeQuotes(wp.videoTitle)} - High-resolution Impressionist scene snapshot at ${wp.timestampFormatted} (${wp.width}×${wp.height})`;
    const isProhibited = (typeof isChannelDownloadProhibited === 'function')
        ? isChannelDownloadProhibited(wp.channel)
        : (wp.downloadProhibited || false);

    const rightsBadge = isProhibited
        ? `<span class="wp-card-rights-pill rights-restricted" title="Copyright Reserved · View-Only Contemplation in Gallery">🔒 View Only</span>`
        : `<span class="wp-card-rights-pill rights-public" title="Public Domain Artwork · Free Wallpaper Download">✅ Free DL</span>`;

    const actionBtnLabel = isProhibited
        ? `View Artwork (${wp.width}×${wp.height}) 🔒`
        : `View & Download (${wp.width}×${wp.height})`;
    const actionBtnTitle = isProhibited
        ? `Downloads prohibited by channel copyright; available for contemplation in gallery`
        : `View and download wallpaper for ${escapeQuotes(wp.videoTitle)}`;

    const sceneLabel = (wp.wallpaperCount && wp.wallpaperCount > 1)
        ? `🎞️ ${wp.wallpaperCount} Scenes`
        : `Scene at ${wp.timestampFormatted}`;

    card.innerHTML = `
        <div class="wp-thumb-wrapper">
            <img class="wp-thumb-img" src="${wp.path}" alt="${wpAlt}" loading="lazy" decoding="async" />
            <span class="wp-pill-res">${wp.qualityLabel || '4K UHD'} (${wp.width}×${wp.height})</span>
            <span class="wp-pill-time">${isProhibited ? '🔒 View Only · ' : ''}${sceneLabel}</span>
        </div>
        <div class="wp-card-info">
            <div class="wp-card-meta-row">
                <span class="wp-card-channel" title="${escapeQuotes(wp.channel)}">${wp.channel}</span>
                ${rightsBadge}
            </div>
            <h4 class="wp-card-title">${wp.videoTitle}</h4>
            <div class="wp-card-actions">
                <button class="btn-wp-view" aria-label="${actionBtnTitle}" title="${actionBtnTitle}">${actionBtnLabel}</button>
            </div>
        </div>
    `;
    return card;
}

function loadMoreVideos() {
    if (renderedVideoCount >= currentVideos.length) return;
    const sentinel = document.getElementById('videoSentinel');
    if (sentinel) sentinel.remove();
    renderVideos(currentVideos, true);
}

function loadMoreWallpapers() {
    if (renderedWallpaperCount >= currentWallpaperCovers.length) return;
    const sentinel = document.getElementById('wallpaperSentinel');
    if (sentinel) sentinel.remove();
    renderWallpapers(currentWallpaperCovers, true, currentWallpapers.length);
}

function buildEmptyStateHTML(type = 'paintings') {
    const channelEl = document.getElementById('channelSelect');
    const searchEl = document.getElementById('searchInput');
    const resEl = document.getElementById('resSelect');
    const artistEl = document.getElementById('artistSelect');
    const themeEl = document.getElementById('themeSelect');
    const copyrightEl = document.getElementById('copyrightSelect');

    const selectedChannel = channelEl ? channelEl.value : 'ALL';
    const rawQuery = searchEl ? searchEl.value.trim() : '';
    const selectedRes = resEl ? resEl.value : '4K';
    const selectedArtist = artistEl ? artistEl.value : 'ALL';
    const selectedTheme = themeEl ? themeEl.value : 'ALL';
    const selectedCopyright = copyrightEl ? copyrightEl.value : 'ALL';

    const title = type === 'paintings' ? 'No paintings or videos found' : 'No wallpapers match your criteria';
    const subtitle = 'Try adjusting your search query, artist, motif, resolution, or channel filters.';
    let conflictHTML = '';
    let actionButtons = `
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="resetFilters()">Reset All Filters</button>
    `;

    // 1. Cross-resolution conflict: query or artist has 0 in 4K, but exists in 1080p FHD / All
    if (rawQuery && (selectedRes === '4K' || selectedRes === '1080P_EXACT')) {
        const matchesInCatalog = ALL_VIDEOS.filter(v => matchesSearch(v.title, v.channel, rawQuery)).length;
        if (matchesInCatalog > 0) {
            conflictHTML = `
                <div class="empty-state-assistance-box">
                    <div class="empty-assist-msg">
                        💡 Found <strong>${matchesInCatalog} work(s)</strong> matching "<em>${escapeQuotes(rawQuery)}</em>" in 1080p Full HD.
                    </div>
                    <div class="empty-assist-buttons">
                        <button class="btn btn-primary" onclick="searchAllResolutionsForQuery('${escapeJsAttr(rawQuery)}')">
                            🎬 View in All Resolutions (${matchesInCatalog})
                        </button>
                        <button class="btn btn-outline-white" onclick="resetFilters()">
                            Reset All Filters
                        </button>
                    </div>
                </div>
            `;
            actionButtons = '';
        }
    }

    // 2. Cross-channel conflict: query has matches across other channels
    if (!conflictHTML && rawQuery && selectedChannel !== 'ALL') {
        const matchesInCatalog = ALL_VIDEOS.filter(v => matchesSearch(v.title, v.channel, rawQuery)).length;
        if (matchesInCatalog > 0) {
            conflictHTML = `
                <div class="empty-state-assistance-box">
                    <div class="empty-assist-msg">
                        💡 Found <strong>${matchesInCatalog} work(s)</strong> matching "<em>${escapeQuotes(rawQuery)}</em>" across other channels.
                    </div>
                    <div class="empty-assist-buttons">
                        <button class="btn btn-primary" onclick="searchAllChannelsForQuery('${escapeJsAttr(rawQuery)}')">
                            📺 Search All Channels (${matchesInCatalog})
                        </button>
                        <button class="btn btn-outline-white" onclick="resetFilters()">
                            Reset All Filters
                        </button>
                    </div>
                </div>
            `;
            actionButtons = '';
        }
    }

    // 3. Copyright conflict: downloadable filter active but matches exist under view-only
    if (!conflictHTML && rawQuery && selectedCopyright === 'DOWNLOADABLE') {
        const matchesInCatalog = ALL_VIDEOS.filter(v => matchesSearch(v.title, v.channel, rawQuery)).length;
        if (matchesInCatalog > 0) {
            conflictHTML = `
                <div class="empty-state-assistance-box">
                    <div class="empty-assist-msg">
                        💡 Found <strong>${matchesInCatalog} work(s)</strong> matching "<em>${escapeQuotes(rawQuery)}</em>" under Copyright Reserved (View-Only).
                    </div>
                    <div class="empty-assist-buttons">
                        <button class="btn btn-primary" onclick="showAllLicensesForQuery('${escapeJsAttr(rawQuery)}')">
                            ⚖️ View Under All Licenses (${matchesInCatalog})
                        </button>
                        <button class="btn btn-outline-white" onclick="resetFilters()">
                            Reset All Filters
                        </button>
                    </div>
                </div>
            `;
            actionButtons = '';
        }
    }

    // 4. Zero matches in entire collection (e.g. "Pissarro", "Renoir", or uncataloged search)
    if (!conflictHTML && rawQuery) {
        const totalMatchesAnywhere = ALL_VIDEOS.filter(v => matchesSearch(v.title, v.channel, rawQuery)).length;
        if (totalMatchesAnywhere === 0) {
            const artists = (typeof CATALOG_ARTISTS !== 'undefined' && Array.isArray(CATALOG_ARTISTS))
                ? CATALOG_ARTISTS
                : [];
            const featuredArtists = artists.slice(0, 8);
            const pillsHTML = featuredArtists.map(a => `
                <button type="button" class="artist-pill-btn" onclick="selectArtistFromDropdown('${escapeJsAttr(a.name)}')">
                    ${a.icon || '🎨'} ${escapeQuotes(a.name)} (${a.count})
                </button>
            `).join('');

            conflictHTML = `
                <div class="empty-state-guidance-box">
                    <div class="empty-assist-msg">
                        🎨 "<strong>${escapeQuotes(rawQuery)}</strong>" was not found in this ${ALL_VIDEOS.length}-title exhibition.
                        <br><span style="font-size: 0.88rem; color: var(--text-muted);">The Impressionist Living Gallery features 18 masters. Explore our featured artists:</span>
                    </div>
                    <div class="artist-discovery-pills">
                        ${pillsHTML}
                    </div>
                </div>
            `;
            actionButtons = `
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px;">
                    <button class="btn btn-outline-white" onclick="resetFilters()">Reset All Filters</button>
                </div>
            `;
        }
    }

    return `
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
            <h3 style="color: var(--text-main); margin-bottom: 8px;">${title}</h3>
            <p>${subtitle}</p>
            ${conflictHTML}
            ${actionButtons}
        </div>
    `;
}

function searchAllChannelsForQuery(query) {
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) channelSelect.value = 'ALL';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = query;
    updateActiveSearchChips(query);
    applyFilters();
}

function searchAllResolutionsForQuery(query) {
    const resSelect = document.getElementById('resSelect');
    if (resSelect) resSelect.value = 'ALL';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = query;
    updateActiveSearchChips(query);
    showFilterAssistToast(`🎬 Switched to All Resolutions for "${escapeQuotes(query)}"`);
    applyFilters();
}

function showAllLicensesForQuery(query) {
    const copyrightSelect = document.getElementById('copyrightSelect');
    if (copyrightSelect) copyrightSelect.value = 'ALL';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = query;
    updateActiveSearchChips(query);
    showFilterAssistToast(`⚖️ Showing All Licenses for "${escapeQuotes(query)}"`);
    applyFilters();
}

function clearRestrictionsForQuery(query) {
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) channelSelect.value = 'ALL';
    const resSelect = document.getElementById('resSelect');
    if (resSelect) resSelect.value = 'ALL';
    const copyrightSelect = document.getElementById('copyrightSelect');
    if (copyrightSelect) copyrightSelect.value = 'ALL';
    const artistSelect = document.getElementById('artistSelect');
    if (artistSelect) artistSelect.value = 'ALL';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = 'ALL';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = query;
    updateActiveSearchChips(query);
    applyFilters();
}

function renderVideos(videos, append = false) {
    const grid = document.getElementById('videosGrid');
    const countSpan = document.getElementById('resultsCount');
    if (!grid) return;

    if (!append) {
        renderedVideoCount = 0;
        if (videoObserver) {
            videoObserver.disconnect();
            videoObserver = null;
        }
        grid.innerHTML = '';

        if (videos.length === 0) {
            if (countSpan) countSpan.textContent = `Showing 0 of ${ALL_VIDEOS.length} works`;
            grid.innerHTML = buildEmptyStateHTML('paintings');
            return;
        }
    } else {
        const oldSentinel = document.getElementById('videoSentinel');
        if (oldSentinel) oldSentinel.remove();
    }

    const batch = videos.slice(renderedVideoCount, renderedVideoCount + PAGE_BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    batch.forEach(v => fragment.appendChild(createVideoCard(v)));
    grid.appendChild(fragment);
    renderedVideoCount += batch.length;

    if (countSpan) {
        if (renderedVideoCount < videos.length) {
            countSpan.textContent = `Showing ${renderedVideoCount} of ${videos.length} works (scroll for more)`;
        } else {
            countSpan.textContent = `Showing ${videos.length} of ${ALL_VIDEOS.length} works`;
        }
    }

    if (renderedVideoCount < videos.length) {
        const remaining = videos.length - renderedVideoCount;
        const sentinel = document.createElement('div');
        sentinel.id = 'videoSentinel';
        sentinel.className = 'progressive-sentinel';
        sentinel.innerHTML = `
            <button type="button" class="btn-load-more" onclick="loadMoreVideos()">
                <span>Load More Paintings (${remaining} remaining)</span> ↓
            </button>
        `;
        grid.appendChild(sentinel);

        if ('IntersectionObserver' in window) {
            if (videoObserver) videoObserver.disconnect();
            videoObserver = new IntersectionObserver((entries) => {
                if (entries[0] && entries[0].isIntersecting) {
                    loadMoreVideos();
                }
            }, { rootMargin: '400px' });
            videoObserver.observe(sentinel);
        }
    }
}

function renderWallpapers(wallpapers, append = false, totalSceneCount = null) {
    const grid = document.getElementById('wallpapersGrid');
    const countSpan = document.getElementById('resultsCount');
    if (!grid) return;

    const sceneCount = (typeof totalSceneCount === 'number') ? totalSceneCount : wallpapers.length;
    const sceneSuffix = (sceneCount > wallpapers.length) ? ` · ${sceneCount.toLocaleString()} total scenes available` : '';

    if (!append) {
        renderedWallpaperCount = 0;
        if (wallpaperObserver) {
            wallpaperObserver.disconnect();
            wallpaperObserver = null;
        }
        grid.innerHTML = '';

        if (wallpapers.length === 0) {
            if (countSpan) countSpan.textContent = `Showing 0 wallpapers`;
            grid.innerHTML = buildEmptyStateHTML('wallpapers');
            return;
        }
    } else {
        const oldSentinel = document.getElementById('wallpaperSentinel');
        if (oldSentinel) oldSentinel.remove();
    }

    const batch = wallpapers.slice(renderedWallpaperCount, renderedWallpaperCount + PAGE_BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    batch.forEach(wp => fragment.appendChild(createWallpaperCard(wp)));
    grid.appendChild(fragment);
    renderedWallpaperCount += batch.length;

    if (countSpan) {
        if (renderedWallpaperCount < wallpapers.length) {
            countSpan.textContent = `Showing ${renderedWallpaperCount} of ${wallpapers.length} works (scroll for more)${sceneSuffix}`;
        } else {
            countSpan.textContent = `Showing ${wallpapers.length} work${wallpapers.length === 1 ? '' : 's'}${sceneSuffix}`;
        }
    }

    if (renderedWallpaperCount < wallpapers.length) {
        const remaining = wallpapers.length - renderedWallpaperCount;
        const sentinel = document.createElement('div');
        sentinel.id = 'wallpaperSentinel';
        sentinel.className = 'progressive-sentinel';
        sentinel.innerHTML = `
            <button type="button" class="btn-load-more" onclick="loadMoreWallpapers()">
                <span>Load More Wallpapers (${remaining} remaining)</span> ↓
            </button>
        `;
        grid.appendChild(sentinel);

        if ('IntersectionObserver' in window) {
            if (wallpaperObserver) wallpaperObserver.disconnect();
            wallpaperObserver = new IntersectionObserver((entries) => {
                if (entries[0] && entries[0].isIntersecting) {
                    loadMoreWallpapers();
                }
            }, { rootMargin: '400px' });
            wallpaperObserver.observe(sentinel);
        }
    }
}

// Search Guidance & Pre-Curated Artist / Theme Suggestions
const SEARCH_GUIDE = {
    artists: [
        { name: 'Claude Monet', query: 'Monet', icon: '🎨' },
        { name: 'Pierre-Auguste Renoir', query: 'Renoir', icon: '🎨' },
        { name: 'Alfred Sisley', query: 'Sisley', icon: '🎨' },
        { name: 'Eugène Boudin', query: 'Boudin', icon: '🎨' },
        { name: 'Isaac Levitan', query: 'Levitan', icon: '🎨' },
        { name: 'Gustave Loiseau', query: 'Loiseau', icon: '🎨' },
        { name: 'Henri Rousseau', query: 'Rousseau', icon: '🎨' },
        { name: 'Charles Leickert', query: 'Leickert', icon: '🎨' },
        { name: 'Edouard-Léon Cortès', query: 'Cortès', icon: '🎨' },
        { name: 'Antonio Parreiras', query: 'Parreiras', icon: '🎨' }
    ],
    themes: [
        { name: 'Winter & Snow', query: 'Winter', icon: '❄️' },
        { name: 'Water Lilies', query: 'Water Lilies', icon: '🪷' },
        { name: 'Garden Sanctuaries', query: 'Garden', icon: '🌿' },
        { name: 'Paris Belle Époque', query: 'Paris', icon: '🗼' },
        { name: 'Venice Canals', query: 'Venice', icon: '🎭' },
        { name: 'Coastal & Étretat', query: 'Étretat', icon: '🌊' },
        { name: 'Sunrise & Sunlight', query: 'Sunrise', icon: '🌅' },
        { name: 'River Seine', query: 'Seine', icon: '⛵' },
        { name: 'Steam Trains', query: 'Train', icon: '🚂' },
        { name: 'France Countryside', query: 'France', icon: '🇫🇷' }
    ]
};

function initSearchSuggestions() {
    const container = document.getElementById('suggestionsScroll');
    if (!container) return;
    container.innerHTML = '';

    const createChip = (item, typeClass) => {
        const count = ALL_VIDEOS.filter(v => matchesSearch(v.title, v.channel, item.query)).length;
        const chip = document.createElement('button');
        chip.className = `suggestion-chip ${typeClass}`;
        chip.textContent = count > 0 ? `${item.icon} ${item.name} (${count})` : `${item.icon} ${item.name}`;
        chip.dataset.query = item.query;
        chip.setAttribute('type', 'button');
        chip.setAttribute('title', `Filter by: ${item.name} (${count} works found)`);
        chip.onclick = () => applySearchChip(item.query);
        container.appendChild(chip);
    };

    SEARCH_GUIDE.artists.forEach(item => createChip(item, 'chip-artist'));
    SEARCH_GUIDE.themes.forEach(item => createChip(item, 'chip-theme'));
}

function applySearchChip(query) {
    const searchInput = document.getElementById('searchInput');
    const channelSelect = document.getElementById('channelSelect');
    if (!searchInput) return;

    const currentNorm = normalizeSearchText(searchInput.value);
    const targetNorm = normalizeSearchText(query);

    // Toggle off if already matching
    if (currentNorm === targetNorm) {
        searchInput.value = '';
    } else {
        searchInput.value = query;

        // Smart cross-filter: if current channel has no works matching this chip, auto-switch to ALL
        if (channelSelect && channelSelect.value !== 'ALL') {
            const hasMatchInChannel = ALL_VIDEOS.some(v => 
                v.channel === channelSelect.value && matchesSearch(v.title, v.channel, query)
            );
            if (!hasMatchInChannel) {
                channelSelect.value = 'ALL';
            }
        }
    }

    updateActiveSearchChips(searchInput.value);
    applyFilters();

    const explorer = document.getElementById('explorerSection');
    if (explorer && typeof explorer.scrollIntoView === 'function') {
        explorer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    updateActiveSearchChips('');
    applyFilters();
}

function updateActiveSearchChips(rawQuery) {
    const norm = normalizeSearchText(rawQuery);
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn) {
        clearBtn.style.display = norm ? 'flex' : 'none';
    }

    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        const chipQuery = normalizeSearchText(chip.dataset.query);
        if (norm && (norm === chipQuery || chipQuery.includes(norm) || norm.includes(chipQuery))) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function normalizeSearchText(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function matchesSearch(title, channel, query) {
    if (!query) return true;
    const nTitle = normalizeSearchText(title);
    const nChannel = normalizeSearchText(channel);
    const nQuery = normalizeSearchText(query);

    if (nTitle.includes(nQuery) || nChannel.includes(nQuery)) return true;

    // Friendly semantic matching aliases
    if (nQuery === 'water lilies' || nQuery === 'water lily') {
        return nTitle.includes('water lil');
    }
    if (nQuery === 'sunrise' || nQuery === 'sunlight') {
        return nTitle.includes('sun');
    }
    if (nQuery === 'train' || nQuery === 'trains') {
        return nTitle.includes('train') || nTitle.includes('railway');
    }
    if (nQuery === 'etretat' || nQuery === 'coastal') {
        return nTitle.includes('etretat') || nTitle.includes('cliffs');
    }
    if (nQuery === 'bridge') {
        return nTitle.includes('bridge') || nTitle.includes('footbridge');
    }

    return false;
}

function checkArtistMatch(video, artistName) {
    if (!artistName || artistName === 'ALL') return true;
    if (video.artist === artistName) return true;
    const artists = (typeof CATALOG_ARTISTS !== 'undefined' && Array.isArray(CATALOG_ARTISTS))
        ? CATALOG_ARTISTS
        : [];
    const aObj = artists.find(a => a.name === artistName);
    if (aObj && aObj.query && video.title.toLowerCase().includes(aObj.query.toLowerCase())) return true;
    return video.title.toLowerCase().includes(artistName.toLowerCase());
}

function checkThemeMatch(video, themeName) {
    if (!themeName || themeName === 'ALL') return true;
    if (video.theme === themeName) return true;
    return matchesThemeQuery(video.title, themeName);
}

function checkCopyrightMatch(video, copyrightMode) {
    if (!copyrightMode || copyrightMode === 'ALL') return true;
    if (copyrightMode === 'DOWNLOADABLE') return !video.downloadProhibited;
    if (copyrightMode === 'VIEW_ONLY') return video.downloadProhibited === true;
    return true;
}

function applyFilters() {
    const searchEl = document.getElementById('searchInput');
    const channelEl = document.getElementById('channelSelect');
    const resEl = document.getElementById('resSelect');
    const sortEl = document.getElementById('sortSelect');
    const playlistEl = document.getElementById('playlistSelect');
    const artistEl = document.getElementById('artistSelect');
    const themeEl = document.getElementById('themeSelect');
    const copyrightEl = document.getElementById('copyrightSelect');
    const contentTypeEl = document.getElementById('contentTypeSelect');

    const emptyState = document.getElementById('favoritesEmptyState');
    const gridVid = document.getElementById('videosGrid');
    const gridWp = document.getElementById('wallpapersGrid');
    const resultsCountEl = document.getElementById('resultsCount');

    const rawQuery = searchEl ? searchEl.value.trim() : '';
    const selectedChannel = channelEl ? channelEl.value : 'ALL';
    const selectedRes = resEl ? resEl.value : '4K';
    const sortBy = sortEl ? sortEl.value : 'views_desc';
    const selectedPlaylist = (playlistEl && playlistEl.value) ? playlistEl.value : 'ALL';
    const selectedArtist = (artistEl && artistEl.value) ? artistEl.value : 'ALL';
    const selectedTheme = (themeEl && themeEl.value) ? themeEl.value : 'ALL';
    const selectedCopyright = (copyrightEl && copyrightEl.value) ? copyrightEl.value : 'ALL';
    const selectedContentType = (contentTypeEl && contentTypeEl.value) ? contentTypeEl.value : 'ALL';

    updateActiveSearchChips(rawQuery);

    if (currentViewMode === 'favorites') {
        const favBar = document.getElementById('favoritesActionBar');
        if (favoriteVideoIds.size === 0) {
            if (gridVid) gridVid.style.display = 'none';
            if (gridWp) gridWp.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            if (resultsCountEl) resultsCountEl.textContent = 'Your personal collection is currently empty';
            const downloadBar = document.getElementById('wallpaperDownloadBar');
            if (downloadBar) downloadBar.style.display = 'none';
            if (favBar) favBar.style.display = 'none';
            return;
        }

        if (favBar) favBar.style.display = 'flex';

        let filtered = ALL_VIDEOS.filter(v => {
            if (!isFavoriteVideo(v.id)) return false;
            const matchesQuery = matchesSearch(v.title, v.channel, rawQuery);
            const matchesChannel = (selectedChannel === 'ALL') || (v.channel === selectedChannel);
            const matchesPlaylist = (selectedPlaylist === 'ALL') || 
                (v.playlistId === selectedPlaylist) || 
                (Array.isArray(v.sourcePlaylistIds) && v.sourcePlaylistIds.includes(selectedPlaylist));

            let matchesRes = true;
            if (selectedRes === '1080P_PLUS' || selectedRes === '1080P_OR_BETTER' || selectedRes === 'FHD_PLUS' || selectedRes === '1080P') {
                matchesRes = (v.is4K || v.height >= 1080);
            } else if (selectedRes === '1080P_EXACT' || selectedRes === 'FHD_EXACT' || selectedRes === '1080P_FHD' || selectedRes === 'FHD') {
                matchesRes = (!v.is4K && v.height === 1080);
            } else if (selectedRes === '4K') {
                matchesRes = v.is4K;
            } else if (selectedRes === 'OTHER') {
                matchesRes = (!v.is4K && v.height < 1080);
            }

            const matchesArtist = checkArtistMatch(v, selectedArtist);
            const matchesTheme = checkThemeMatch(v, selectedTheme);
            const matchesCopyright = checkCopyrightMatch(v, selectedCopyright);
            const matchesContentType = checkContentTypeMatch(v, selectedContentType);

            return matchesQuery && matchesChannel && matchesRes && matchesPlaylist && matchesArtist && matchesTheme && matchesCopyright && matchesContentType;
        });

        if (sortBy === 'views_desc') filtered.sort((a, b) => b.views - a.views);
        else if (sortBy === 'views_asc') filtered.sort((a, b) => a.views - b.views);
        else if (sortBy === 'res_desc') filtered.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        else if (sortBy === 'duration_desc') filtered.sort((a, b) => b.durationSec - a.durationSec);
        else if (sortBy === 'duration_asc') filtered.sort((a, b) => a.durationSec - b.durationSec);
        else if (sortBy === 'title_asc') filtered.sort((a, b) => a.title.localeCompare(b.title));

        currentVideos = filtered;
        if (emptyState) emptyState.style.display = 'none';

        if (filtered.length === 0) {
            if (gridWp) gridWp.style.display = 'none';
            if (gridVid) {
                gridVid.style.display = 'grid';
                gridVid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted);">
                        <h3 style="color: var(--text-main); margin-bottom: 8px;">No matching saved works</h3>
                        <p>You have ${favoriteVideoIds.size} saved work(s) in your collection, but none match the active filters.</p>
                        <button class="btn btn-primary" style="margin-top: 16px;" onclick="resetFavoritesFilters()">
                            Show All Saved Works (${favoriteVideoIds.size})
                        </button>
                    </div>
                `;
            }
            if (resultsCountEl) resultsCountEl.textContent = `0 of ${favoriteVideoIds.size} saved works match active filters`;
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (gridWp) gridWp.style.display = 'none';
            if (gridVid) gridVid.style.display = 'grid';
            renderVideos(filtered);
            if (resultsCountEl) {
                resultsCountEl.textContent = (filtered.length === favoriteVideoIds.size)
                    ? `Showing ${filtered.length} saved work${filtered.length === 1 ? '' : 's'} in your collection`
                    : `Showing ${filtered.length} of ${favoriteVideoIds.size} saved work${favoriteVideoIds.size === 1 ? '' : 's'}`;
            }
        }
        const downloadBar = document.getElementById('wallpaperDownloadBar');
        if (downloadBar) downloadBar.style.display = 'none';
        return;
    }

    const favBar = document.getElementById('favoritesActionBar');
    if (favBar) favBar.style.display = 'none';

    if (emptyState) emptyState.style.display = 'none';

    if (currentViewMode === 'videos') {
        let filtered = ALL_VIDEOS.filter(v => {
            const matchesQuery = matchesSearch(v.title, v.channel, rawQuery);
            const matchesChannel = (selectedChannel === 'ALL') || (v.channel === selectedChannel);
            const matchesPlaylist = (selectedPlaylist === 'ALL') || 
                (v.playlistId === selectedPlaylist) || 
                (Array.isArray(v.sourcePlaylistIds) && v.sourcePlaylistIds.includes(selectedPlaylist));

            let matchesRes = true;
            if (selectedRes === '1080P_PLUS' || selectedRes === '1080P_OR_BETTER' || selectedRes === 'FHD_PLUS' || selectedRes === '1080P') {
                matchesRes = (v.is4K || v.height >= 1080);
            } else if (selectedRes === '1080P_EXACT' || selectedRes === 'FHD_EXACT' || selectedRes === '1080P_FHD' || selectedRes === 'FHD') {
                matchesRes = (!v.is4K && v.height === 1080);
            } else if (selectedRes === '4K') {
                matchesRes = v.is4K;
            } else if (selectedRes === 'OTHER') {
                matchesRes = (!v.is4K && v.height < 1080);
            }

            const matchesArtist = checkArtistMatch(v, selectedArtist);
            const matchesTheme = checkThemeMatch(v, selectedTheme);
            const matchesCopyright = checkCopyrightMatch(v, selectedCopyright);
            const matchesContentType = checkContentTypeMatch(v, selectedContentType);

            return matchesQuery && matchesChannel && matchesRes && matchesPlaylist && matchesArtist && matchesTheme && matchesCopyright && matchesContentType;
        });

        if (sortBy === 'views_desc') filtered.sort((a, b) => b.views - a.views);
        else if (sortBy === 'views_asc') filtered.sort((a, b) => a.views - b.views);
        else if (sortBy === 'res_desc') filtered.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        else if (sortBy === 'duration_desc') filtered.sort((a, b) => b.durationSec - a.durationSec);
        else if (sortBy === 'duration_asc') filtered.sort((a, b) => a.durationSec - b.durationSec);
        else if (sortBy === 'title_asc') filtered.sort((a, b) => a.title.localeCompare(b.title));

        currentVideos = filtered;
        renderVideos(filtered);
        const downloadBar = document.getElementById('wallpaperDownloadBar');
        if (downloadBar) downloadBar.style.display = 'none';
    } else {
        let filteredWp = [];
        ALL_VIDEOS.forEach(v => {
            const matchesQuery = matchesSearch(v.title, v.channel, rawQuery);
            const matchesChannel = (selectedChannel === 'ALL') || (v.channel === selectedChannel);
            const matchesPlaylist = (selectedPlaylist === 'ALL') || 
                (v.playlistId === selectedPlaylist) || 
                (Array.isArray(v.sourcePlaylistIds) && v.sourcePlaylistIds.includes(selectedPlaylist));

            let matchesRes = true;
            if (selectedRes === '1080P_PLUS' || selectedRes === '1080P_OR_BETTER' || selectedRes === 'FHD_PLUS' || selectedRes === '1080P') {
                matchesRes = (v.is4K || v.height >= 1080);
            } else if (selectedRes === '1080P_EXACT' || selectedRes === 'FHD_EXACT' || selectedRes === '1080P_FHD' || selectedRes === 'FHD') {
                matchesRes = (!v.is4K && v.height === 1080);
            } else if (selectedRes === '4K') {
                matchesRes = v.is4K;
            } else if (selectedRes === 'OTHER') {
                matchesRes = (!v.is4K && v.height < 1080);
            }

            const matchesArtist = checkArtistMatch(v, selectedArtist);
            const matchesTheme = checkThemeMatch(v, selectedTheme);
            const matchesCopyright = checkCopyrightMatch(v, selectedCopyright);
            const matchesContentType = checkContentTypeMatch(v, selectedContentType);

            if (matchesQuery && matchesChannel && matchesRes && matchesPlaylist && matchesArtist && matchesTheme && matchesCopyright && matchesContentType && v.wallpapers) {
                v.wallpapers.forEach(wp => {
                    filteredWp.push({
                        ...wp,
                        videoTitle: v.title,
                        channel: v.channel,
                        videoUrl: v.url,
                        artist: v.artist,
                        theme: v.theme,
                        contentType: v.contentType,
                        downloadProhibited: v.downloadProhibited,
                        copyrightStatus: v.copyrightStatus,
                        wallpaperCount: v.wallpaperCount
                    });
                });
            }
        });

        if (sortBy === 'res_desc') filteredWp.sort((a, b) => (b.width * b.height) - (a.width * a.height));

        // The full scene set powers bulk ZIP download & fullscreen slideshow (richness intact).
        currentWallpapers = filteredWp;
        // The visible grid shows one cover scene per video — avoids a wall of 8-16 near-duplicate
        // frames per video. Clicking a card still opens the full per-video scene carousel.
        currentWallpaperCovers = getOneWallpaperPerVideo(filteredWp);
        renderWallpapers(currentWallpaperCovers, false, filteredWp.length);
        updateWallpaperDownloadBar(filteredWp);
    }
    updateMobileFilterCount();
}

function updateMobileFilterCount() {
    const artistSelect = document.getElementById('artistSelect');
    const themeSelect = document.getElementById('themeSelect');
    const channelSelect = document.getElementById('channelSelect');
    const resSelect = document.getElementById('resSelect');
    const copyrightSelect = document.getElementById('copyrightSelect');
    const sortSelect = document.getElementById('sortSelect');
    const contentTypeSelect = document.getElementById('contentTypeSelect');
    const badge = document.getElementById('mobileActiveFilterCount');
    const toggleBtn = document.getElementById('mobileFilterToggleBtn');

    let count = 0;
    if (artistSelect && artistSelect.value !== 'ALL') count++;
    if (themeSelect && themeSelect.value !== 'ALL') count++;
    if (channelSelect && channelSelect.value !== 'ALL') count++;
    if (resSelect && resSelect.value !== '4K' && resSelect.value !== 'ALL') count++;
    if (copyrightSelect && copyrightSelect.value !== 'ALL') count++;
    if (sortSelect && sortSelect.value !== 'views_desc') count++;
    if (contentTypeSelect && contentTypeSelect.value !== 'ALL') count++;

    if (badge) badge.textContent = count;
    if (toggleBtn) {
        toggleBtn.classList.toggle('has-active-filters', count > 0);
    }
}

function toggleMobileFilters() {
    const group = document.getElementById('filterGroup');
    const btn = document.getElementById('mobileFilterToggleBtn');
    const arrow = document.getElementById('mobileFilterArrow');
    if (!group) return;
    const isOpen = group.classList.toggle('mobile-open');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (arrow) arrow.textContent = isOpen ? '▴' : '▾';
}

function filterTo4K() {
    switchMainTab('videos');
    const resSelect = document.getElementById('resSelect');
    if (resSelect) resSelect.value = '4K';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) channelSelect.value = 'ALL';
    const artistSelect = document.getElementById('artistSelect');
    if (artistSelect) artistSelect.value = 'ALL';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = 'ALL';
    const copyrightSelect = document.getElementById('copyrightSelect');
    if (copyrightSelect) copyrightSelect.value = 'ALL';
    const contentTypeSelect = document.getElementById('contentTypeSelect');
    if (contentTypeSelect) contentTypeSelect.value = 'ALL';
    updateArtistInfoStrip('ALL');
    updateActiveSearchChips('');
    applyFilters();
    const container = document.querySelector('main.container');
    if (container && window.scrollY > container.offsetTop) {
        window.scrollTo({ top: container.offsetTop - 20, behavior: 'smooth' });
    }
}

function filterByChannel(channelName) {
    switchMainTab('videos');
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) channelSelect.value = channelName;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // Switch to all resolutions so channel videos aren't hidden
    const resSelect = document.getElementById('resSelect');
    if (resSelect) resSelect.value = 'ALL';

    const explorer = document.getElementById('explorerSection');
    if (explorer && typeof explorer.scrollIntoView === 'function') explorer.scrollIntoView({ behavior: 'smooth' });
    applyFilters();
}

function selectPathway(pathwayKey) {
    document.querySelectorAll('.pathway-chip').forEach(c => c.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }

    const searchInput = document.getElementById('searchInput');
    const channelSelect = document.getElementById('channelSelect');
    const resSelect = document.getElementById('resSelect');

    if (pathwayKey === '1080p_plus' || pathwayKey === '1080p') {
        if (searchInput) searchInput.value = '';
        if (channelSelect) channelSelect.value = 'ALL';
        if (resSelect) resSelect.value = '1080P_PLUS';
    } else if (pathwayKey === '1080p_exact' || pathwayKey === '1080p_fhd' || pathwayKey === 'fhd') {
        if (searchInput) searchInput.value = '';
        if (channelSelect) channelSelect.value = 'ALL';
        if (resSelect) resSelect.value = '1080P_EXACT';
    } else if (pathwayKey === '4k') {
        if (searchInput) searchInput.value = '';
        if (channelSelect) channelSelect.value = 'ALL';
        if (resSelect) resSelect.value = '4K';
    } else if (pathwayKey === 'all') {
        if (searchInput) searchInput.value = '';
        if (channelSelect) channelSelect.value = 'ALL';
        if (resSelect) resSelect.value = 'ALL';
    } else if (pathwayKey === 'archives') {
        if (searchInput) searchInput.value = '';
        if (channelSelect) channelSelect.value = 'LearnFromMasters';
        if (resSelect) resSelect.value = 'ALL';
    } else if (pathwayKey === 'waterlilies') {
        if (channelSelect) channelSelect.value = 'ALL';
        if (searchInput) searchInput.value = 'water lilies';
        if (resSelect) resSelect.value = 'ALL';
    } else if (pathwayKey === 'immersion') {
        if (searchInput) searchInput.value = 'living';
        if (channelSelect) channelSelect.value = 'ALL';
        if (resSelect) resSelect.value = 'ALL';
    } else if (pathwayKey === 'masters') {
        if (channelSelect) channelSelect.value = 'K A R O L A';
        if (searchInput) searchInput.value = '';
        if (resSelect) resSelect.value = 'ALL';
    } else if (pathwayKey === 'romance') {
        if (channelSelect) channelSelect.value = 'Cupid Studio';
        if (searchInput) searchInput.value = '';
        if (resSelect) resSelect.value = 'ALL';
    }

    const explorer = document.getElementById('explorerSection');
    if (explorer && typeof explorer.scrollIntoView === 'function') explorer.scrollIntoView({ behavior: 'smooth' });
    applyFilters();
}

function resetFilters() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const playlistSelect = document.getElementById('playlistSelect');
    if (playlistSelect) playlistSelect.value = 'ALL';
    const artistSelect = document.getElementById('artistSelect');
    if (artistSelect) artistSelect.value = 'ALL';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = 'ALL';
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) channelSelect.value = 'ALL';
    const resSelect = document.getElementById('resSelect');
    if (resSelect) resSelect.value = '4K';
    const copyrightSelect = document.getElementById('copyrightSelect');
    if (copyrightSelect) copyrightSelect.value = 'ALL';
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = 'views_desc';
    const contentTypeSelect = document.getElementById('contentTypeSelect');
    if (contentTypeSelect) contentTypeSelect.value = 'ALL';
    updateArtistInfoStrip('ALL');

    applyFilters();
}

function resetFavoritesFilters() {
    const playlistSelect = document.getElementById('playlistSelect');
    if (playlistSelect) playlistSelect.value = 'ALL';
    const artistSelect = document.getElementById('artistSelect');
    if (artistSelect) artistSelect.value = 'ALL';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = 'ALL';
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) channelSelect.value = 'ALL';
    const resSelect = document.getElementById('resSelect');
    if (resSelect) resSelect.value = 'ALL';
    const copyrightSelect = document.getElementById('copyrightSelect');
    if (copyrightSelect) copyrightSelect.value = 'ALL';
    const contentTypeSelect = document.getElementById('contentTypeSelect');
    if (contentTypeSelect) contentTypeSelect.value = 'ALL';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    updateArtistInfoStrip('ALL');
    applyFilters();
}

function clearAllFavorites() {
    if (favoriteVideoIds.size === 0) return;
    favoriteVideoIds.clear();
    saveFavorites();
    document.querySelectorAll('[data-fav-video]').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('title', 'Save to My Collection');
        btn.innerHTML = '🤍';
    });
    const modalFav = document.getElementById('modalFavBtn');
    if (modalFav) {
        modalFav.classList.remove('active');
        modalFav.innerHTML = '🤍 Save to Collection';
    }
    if (currentViewMode === 'favorites') {
        applyFilters();
    }
}

function initFiltersAndEvents() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 150));

    const artistSelect = document.getElementById('artistSelect');
    if (artistSelect) artistSelect.addEventListener('change', onArtistFilterChange);

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.addEventListener('change', onThemeFilterChange);

    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) channelSelect.addEventListener('change', applyFilters);

    const resSelect = document.getElementById('resSelect');
    if (resSelect) resSelect.addEventListener('change', applyFilters);

    const copyrightSelect = document.getElementById('copyrightSelect');
    if (copyrightSelect) copyrightSelect.addEventListener('change', applyFilters);

    const contentTypeSelect = document.getElementById('contentTypeSelect');
    if (contentTypeSelect) contentTypeSelect.addEventListener('change', applyFilters);


    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.addEventListener('change', applyFilters);

    // Robust delegated click handler on videosGrid to ensure video play actions always launch reliably
    const videosGrid = document.getElementById('videosGrid');
    if (videosGrid) {
        videosGrid.addEventListener('click', (e) => {
            const playTrigger = e.target.closest('.btn-card-play, .play-overlay, .video-title, .thumb-img');
            if (playTrigger) {
                const card = playTrigger.closest('.video-card');
                if (card && card.dataset.videoId) {
                    const videoId = card.dataset.videoId;
                    const modal = document.getElementById('modalOverlay');
                    if (!modal || !modal.classList.contains('open') || currentModalVideoId !== videoId) {
                        openVideoModal(videoId, null, 0, playTrigger);
                    }
                }
            }
        });
    }

    // Modal click-outside listeners
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') closeVideoModal();
        });
    }

    const wallpaperModalOverlay = document.getElementById('wallpaperModalOverlay');
    if (wallpaperModalOverlay) {
        wallpaperModalOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'wallpaperModalOverlay') closeWallpaperModal();
        });
    }

    const legalModalOverlay = document.getElementById('legalModalOverlay');
    if (legalModalOverlay) {
        legalModalOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'legalModalOverlay') closeLegalModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = getActiveOpenModal();
            if (activeModal) {
                if (activeModal.id === 'modalOverlay') closeVideoModal();
                else if (activeModal.id === 'wallpaperModalOverlay') closeWallpaperModal();
                else if (activeModal.id === 'legalModalOverlay') closeLegalModal();
                else if (activeModal.id === 'slideshowOverlay') closeSlideshow();
            }
        } else if (e.key === 'Tab') {
            const activeModal = getActiveOpenModal();
            if (activeModal) {
                trapModalFocus(activeModal, e);
            }
        }
    });
}

// ==========================================================================
// ACCESSIBILITY & FOCUS MANAGEMENT (P5 #8)
// ==========================================================================
let lastFocusedElement = null;

function restoreFocus() {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        try {
            lastFocusedElement.focus();
        } catch (e) {}
        lastFocusedElement = null;
    }
}

function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
}

function getActiveOpenModal() {
    const videoModal = document.getElementById('modalOverlay');
    if (videoModal && videoModal.classList.contains('open')) return videoModal;

    const wpModal = document.getElementById('wallpaperModalOverlay');
    if (wpModal && wpModal.classList.contains('open')) return wpModal;

    const legalModal = document.getElementById('legalModalOverlay');
    if (legalModal && (legalModal.classList.contains('open') || legalModal.style.display === 'flex')) return legalModal;

    const ssModal = document.getElementById('slideshowOverlay');
    if (ssModal && (ssModal.classList.contains('active') || ssModal.style.display === 'flex')) return ssModal;

    return null;
}

function trapModalFocus(modalEl, e) {
    if (e.key !== 'Tab') return;
    const focusables = getFocusableElements(modalEl);
    if (focusables.length === 0) {
        e.preventDefault();
        return;
    }
    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];

    if (e.shiftKey) {
        if (document.activeElement === firstEl || !modalEl.contains(document.activeElement)) {
            e.preventDefault();
            lastEl.focus();
        }
    } else {
        if (document.activeElement === lastEl || !modalEl.contains(document.activeElement)) {
            e.preventDefault();
            firstEl.focus();
        }
    }
}

// Modal 1: Video Player Lightbox
let currentModalTitle = '';
let currentModalStartSec = 0;

function loadPlayerIframe(videoId, title, startSec = 0) {
    const iframeWrapper = document.getElementById('playerFrameWrapper');
    if (!iframeWrapper || !videoId) return;

    const startParam = startSec > 0 ? `&start=${startSec}` : '';
    const originParam = (window.location.protocol.startsWith('http') && window.location.origin && window.location.origin !== 'null')
        ? `&origin=${encodeURIComponent(window.location.origin)}`
        : '';

    // Standard Privacy-Enhanced Mode (youtube-nocookie.com, modestbranding, rel=0, no tracking cookies)
    iframeWrapper.innerHTML = `
        <iframe 
            src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1${startParam}${originParam}" 
            title="${escapeQuotes(title)}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen>
        </iframe>
    `;
}

// ==========================================================================
// CURATOR MODE (local-only, ?curator=1) — mark videos/channels for copyright
// protection, theme reclassification, deletion, or priority extraction.
// Marks are drafted in localStorage only; nothing is published until the
// curator exports curation_overrides.json and commits it to the repo, which
// build_webpage.py then reads on the next build. Reachable on the public
// site, but harmless there — it only ever edits the visitor's own local
// draft, never anything live.
// ==========================================================================
const CURATOR_MODE_KEY = 'monet_curator_mode';
const CURATION_DRAFT_KEY = 'monet_curation_draft_v1';

function isCuratorModeActive() {
    try {
        return localStorage.getItem(CURATOR_MODE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function initCuratorMode() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('curator')) {
            const on = params.get('curator') !== '0';
            localStorage.setItem(CURATOR_MODE_KEY, on ? '1' : '0');
            const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
    } catch (e) {}

    const toolbar = document.getElementById('curatorToolbar');
    if (toolbar) toolbar.style.display = isCuratorModeActive() ? 'flex' : 'none';
    updateCuratorDraftCount();
}

function exitCuratorMode() {
    try { localStorage.setItem(CURATOR_MODE_KEY, '0'); } catch (e) {}
    const toolbar = document.getElementById('curatorToolbar');
    if (toolbar) toolbar.style.display = 'none';
    const bar = document.getElementById('modalCuratorBar');
    if (bar) bar.style.display = 'none';
}

function loadCurationDraft() {
    try {
        const raw = localStorage.getItem(CURATION_DRAFT_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                channelOverrides: parsed.channelOverrides || {},
                videoOverrides: parsed.videoOverrides || {}
            };
        }
    } catch (e) {
        console.warn('Failed to load curation draft', e);
    }
    return { channelOverrides: {}, videoOverrides: {} };
}

function saveCurationDraft(draft) {
    try {
        localStorage.setItem(CURATION_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
        console.warn('Failed to save curation draft', e);
    }
    updateCuratorDraftCount();
}

function updateCuratorDraftCount() {
    const el = document.getElementById('curatorDraftCount');
    if (!el) return;
    const draft = loadCurationDraft();
    const count = Object.keys(draft.channelOverrides).length + Object.keys(draft.videoOverrides).length;
    el.textContent = `${count} marked`;
}

function clearCurationDraft() {
    if (!confirm('Clear all local curation marks? This cannot be undone (nothing has been exported yet).')) return;
    saveCurationDraft({ channelOverrides: {}, videoOverrides: {} });
    if (currentModalVideoId) {
        updateModalCuratorBar(ALL_VIDEOS.find(v => v.id === currentModalVideoId));
    }
    showNotificationToast('🔧 Curation draft cleared');
}

function exportCurationOverrides() {
    const draft = loadCurationDraft();
    const json = JSON.stringify(draft, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curation_overrides.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    showNotificationToast('⬇️ Exported curation_overrides.json — move it into the repo root and rebuild');
}

function curatorGetVideoOverride(videoId) {
    return loadCurationDraft().videoOverrides[videoId] || {};
}

function curatorSetVideoField(videoId, field, value) {
    const draft = loadCurationDraft();
    const existing = draft.videoOverrides[videoId] || {};
    if (value === false || value === null || value === '') {
        delete existing[field];
    } else {
        existing[field] = value;
    }
    if (Object.keys(existing).length === 0) {
        delete draft.videoOverrides[videoId];
    } else {
        draft.videoOverrides[videoId] = existing;
    }
    saveCurationDraft(draft);
}

function curatorGetChannelOverride(channelName) {
    return loadCurationDraft().channelOverrides[channelName] || {};
}

function curatorSetChannelField(channelName, field, value) {
    const draft = loadCurationDraft();
    const existing = draft.channelOverrides[channelName] || {};
    if (value === false || value === null || value === '') {
        delete existing[field];
    } else {
        existing[field] = value;
    }
    if (Object.keys(existing).length === 0) {
        delete draft.channelOverrides[channelName];
    } else {
        draft.channelOverrides[channelName] = existing;
    }
    saveCurationDraft(draft);
}

function curatorSetTheme(themeName) {
    if (!currentModalVideoId) return;
    const video = ALL_VIDEOS.find(v => v.id === currentModalVideoId);
    if (!video) return;
    // No override needed if the curator just re-selected the auto-detected theme
    curatorSetVideoField(currentModalVideoId, 'theme', themeName === video.theme ? false : themeName);
}

function curatorSetMaxFrames(value) {
    if (!currentModalVideoId) return;
    curatorSetVideoField(currentModalVideoId, 'maxFrames', value ? parseInt(value, 10) : false);
}

function curatorToggleVideoCopyright() {
    if (!currentModalVideoId) return;
    const current = curatorGetVideoOverride(currentModalVideoId);
    curatorSetVideoField(currentModalVideoId, 'copyrightProtected', !current.copyrightProtected);
    updateModalCuratorBar(ALL_VIDEOS.find(v => v.id === currentModalVideoId));
}

function curatorToggleChannelCopyright() {
    if (!currentModalVideoId) return;
    const video = ALL_VIDEOS.find(v => v.id === currentModalVideoId);
    if (!video) return;
    const current = curatorGetChannelOverride(video.channel);
    curatorSetChannelField(video.channel, 'copyrightProtected', !current.copyrightProtected);
    updateModalCuratorBar(video);
}

function curatorTogglePriority() {
    if (!currentModalVideoId) return;
    const current = curatorGetVideoOverride(currentModalVideoId);
    curatorSetVideoField(currentModalVideoId, 'priorityExtraction', !current.priorityExtraction);
    updateModalCuratorBar(ALL_VIDEOS.find(v => v.id === currentModalVideoId));
}

function curatorToggleReextract() {
    if (!currentModalVideoId) return;
    const current = curatorGetVideoOverride(currentModalVideoId);
    curatorSetVideoField(currentModalVideoId, 'reextractRequested', !current.reextractRequested);
    updateModalCuratorBar(ALL_VIDEOS.find(v => v.id === currentModalVideoId));
}

function curatorToggleDeletion() {
    if (!currentModalVideoId) return;
    const current = curatorGetVideoOverride(currentModalVideoId);
    const next = !current.flaggedForDeletion;
    if (next && !confirm('Flag this video for deletion? It will be excluded from the catalog once you export overrides and rebuild.')) {
        return;
    }
    curatorSetVideoField(currentModalVideoId, 'flaggedForDeletion', next);
    updateModalCuratorBar(ALL_VIDEOS.find(v => v.id === currentModalVideoId));
}

function updateModalCuratorBar(video) {
    const bar = document.getElementById('modalCuratorBar');
    if (!bar) return;

    if (!isCuratorModeActive() || !video) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';

    const videoOverride = curatorGetVideoOverride(video.id);
    const channelOverride = curatorGetChannelOverride(video.channel);

    const themeSelect = document.getElementById('modalCuratorThemeSelect');
    if (themeSelect) {
        const themes = (typeof CATALOG_THEMES !== 'undefined' && Array.isArray(CATALOG_THEMES)) ? CATALOG_THEMES : [];
        const effectiveTheme = videoOverride.theme || video.theme;
        themeSelect.innerHTML = themes.map(t =>
            `<option value="${escapeJsAttr(t.name)}" ${t.name === effectiveTheme ? 'selected' : ''}>${t.icon || ''} ${escapeQuotes(t.name)}</option>`
        ).join('');
    }

    const maxFramesSelect = document.getElementById('modalCuratorMaxFrames');
    if (maxFramesSelect) {
        maxFramesSelect.value = videoOverride.maxFrames ? String(videoOverride.maxFrames) : '';
    }

    const videoCopyrightBtn = document.getElementById('modalCuratorVideoCopyright');
    if (videoCopyrightBtn) videoCopyrightBtn.classList.toggle('active', !!videoOverride.copyrightProtected);

    const channelCopyrightBtn = document.getElementById('modalCuratorChannelCopyright');
    if (channelCopyrightBtn) channelCopyrightBtn.classList.toggle('active', !!channelOverride.copyrightProtected);

    const priorityBtn = document.getElementById('modalCuratorPriority');
    if (priorityBtn) priorityBtn.classList.toggle('active', !!videoOverride.priorityExtraction);

    const reextractBtn = document.getElementById('modalCuratorReextract');
    if (reextractBtn) reextractBtn.classList.toggle('active', !!videoOverride.reextractRequested);

    const deleteBtn = document.getElementById('modalCuratorDelete');
    if (deleteBtn) deleteBtn.classList.toggle('active', !!videoOverride.flaggedForDeletion);
}

function openVideoModal(videoId, title = null, startSec = 0, triggerEl = null) {
    const video = ALL_VIDEOS.find(v => v.id === videoId);
    const resolvedTitle = title || (video ? video.title : 'Impressionist Masterwork');
    currentModalVideoId = videoId;
    currentModalTitle = resolvedTitle;
    currentModalStartSec = startSec;

    if (triggerEl) {
        lastFocusedElement = triggerEl;
    } else if (document.activeElement && document.activeElement !== document.body) {
        const insideModal = document.activeElement.closest('.modal-overlay');
        if (!insideModal) {
            lastFocusedElement = document.activeElement;
        }
    }

    // Gently pause ambient audio so it does not conflict with video soundtrack
    if (ambientAudio && isAudioPlaying) {
        ambientAudio.pause();
        isAudioPlaying = false;
        updateAudioUI(false);
    }

    const modal = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const resEl = document.getElementById('modalVideoRes');
    const footerChannel = document.getElementById('modalFooterChannel');
    const footerChannelLink = document.getElementById('modalFooterChannelLink');
    const footerQuality = document.getElementById('modalFooterQuality');
    const modalWpCount = document.getElementById('modalWpCount');
    const wpBtn = document.getElementById('modalViewWallpapersBtn');

    if (titleEl) titleEl.textContent = resolvedTitle;
    if (resEl && video) {
        resEl.textContent = video.is4K ? `👑 Native 4K UHD (${video.resolution})` : `Native Quality: ${video.qualityLabel} (${video.resolution})`;
    }

    if (footerChannel && video) {
        footerChannel.textContent = video.channel;
    }
    if (footerChannelLink && video) {
        footerChannelLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(video.channel)}`;
        footerChannelLink.title = `Explore ${escapeQuotes(video.channel)} on YouTube`;
    }
    if (footerQuality && video) {
        footerQuality.textContent = video.is4K ? '👑 4K UHD Masterwork' : video.qualityLabel;
    }

    const wpCount = video ? (video.wallpaperCount || (video.wallpapers ? video.wallpapers.length : 0)) : 0;
    if (modalWpCount) modalWpCount.textContent = wpCount;
    if (wpBtn) wpBtn.style.display = wpCount > 0 ? 'inline-flex' : 'none';

    const favBtn = document.getElementById('modalFavBtn');
    if (favBtn) {
        const isFav = isFavoriteVideo(videoId);
        favBtn.classList.toggle('active', isFav);
        favBtn.innerHTML = isFav ? '❤️ Saved in Collection' : '🤍 Save to Collection';
    }

    const ytDirectLink = document.getElementById('modalYtDirectLink');
    if (ytDirectLink) {
        const startParam = startSec > 0 ? `&t=${startSec}s` : '';
        ytDirectLink.href = `https://www.youtube.com/watch?v=${videoId}${startParam}`;
    }

    updateModalCuratorBar(video);

    loadPlayerIframe(videoId, resolvedTitle, startSec);

    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const closeBtn = modal ? modal.querySelector('.btn-close-modal') : null;
        if (closeBtn) closeBtn.focus();
    }, 50);
}

function openWallpaperFromModal() {
    if (!currentModalVideoId) return;
    const vid = currentModalVideoId;
    const savedTrigger = lastFocusedElement;
    closeVideoModalQuiet();
    openWallpaperModal(vid, 0, savedTrigger);
}

function closeVideoModalQuiet() {
    const modal = document.getElementById('modalOverlay');
    const iframeWrapper = document.getElementById('playerFrameWrapper');
    if (iframeWrapper) iframeWrapper.innerHTML = '';
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
}

function closeVideoModal() {
    closeVideoModalQuiet();
    restoreFocus();
}

// Modal 2: Wallpaper Gallery Lightbox
let activeWallpaperList = [];
let activeWallpaperIndex = 0;
let isDownloadingCurrent = false;
let isDownloadingAll = false;
const videoZipCache = new Map(); // Cache generated ZIP blobs per video to prevent duplicate downloads

function openWallpaperModal(videoId, initialIdx = 0, triggerEl = null) {
    const video = ALL_VIDEOS.find(v => v.id === videoId);
    if (!video) return;

    if (triggerEl) {
        lastFocusedElement = triggerEl;
    } else if (document.activeElement && document.activeElement !== document.body) {
        const insideModal = document.activeElement.closest('.modal-overlay');
        if (!insideModal) {
            lastFocusedElement = document.activeElement;
        }
    }

    const modal = document.getElementById('wallpaperModalOverlay');
    const titleEl = document.getElementById('wpModalTitle');
    const subTitleEl = document.getElementById('wpModalSubtitle');
    const trayEl = document.getElementById('wpCarouselTray');

    if (titleEl) titleEl.textContent = video.title;
    if (subTitleEl) {
        // Drop resolution and scene timestamp from subtitle (already displayed directly on active image badge)
        // Display originating artist/channel and direct channel link (P2 #3 & P7 #12)
        const channelQuery = encodeURIComponent(video.channel);
        subTitleEl.innerHTML = `<span>${escapeQuotes(video.channel)}</span> · <a href="https://www.youtube.com/results?search_query=${channelQuery}" target="_blank" rel="noopener noreferrer" class="wp-modal-channel-link" title="Explore ${escapeQuotes(video.channel)} on YouTube">Channel Source ↗</a>`;
    }

    activeWallpaperList = [];
    if (video.wallpapers && video.wallpapers.length > 0) {
        activeWallpaperList = video.wallpapers.map(w => ({
            ...w,
            videoId: video.id,
            videoTitle: video.title
        }));
    } else {
        activeWallpaperList.push({
            path: video.maxresThumb,
            qualityLabel: `${video.qualityLabel} Master Cover`,
            timestampFormatted: 'Cover Masterwork',
            timestampSec: 0,
            width: video.width || 1920,
            height: video.height || 1080,
            videoId: video.id,
            videoTitle: video.title
        });
    }

    activeWallpaperIndex = Math.min(initialIdx, activeWallpaperList.length - 1);
    if (activeWallpaperIndex < 0) activeWallpaperIndex = 0;

    if (trayEl) {
        trayEl.innerHTML = '';
        activeWallpaperList.forEach((wp, idx) => {
            const thumb = document.createElement('img');
            thumb.src = wp.path;
            thumb.className = `wp-tray-thumb ${idx === activeWallpaperIndex ? 'active' : ''}`;
            thumb.title = `Scene at ${wp.timestampFormatted} (${wp.width}×${wp.height})`;
            thumb.alt = `${escapeQuotes(wp.videoTitle)} thumbnail scene ${idx + 1}`;
            thumb.setAttribute('tabindex', '0');
            thumb.setAttribute('role', 'button');
            thumb.setAttribute('aria-label', `Select scene ${idx + 1} at ${wp.timestampFormatted}`);
            thumb.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectWallpaperSnapshot(idx);
                }
            };
            thumb.onclick = () => selectWallpaperSnapshot(idx);
            trayEl.appendChild(thumb);
        });
    }

    displayActiveWallpaper();
    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const closeBtn = modal ? modal.querySelector('.btn-close-modal') : null;
        if (closeBtn) closeBtn.focus();
    }, 50);
}

function selectWallpaperSnapshot(idx) {
    activeWallpaperIndex = idx;
    const thumbs = document.querySelectorAll('.wp-tray-thumb');
    thumbs.forEach((t, i) => {
        t.classList.toggle('active', i === idx);
    });
    displayActiveWallpaper();
}

function displayActiveWallpaper() {
    const wp = activeWallpaperList[activeWallpaperIndex];
    if (!wp) return;

    const mainImg = document.getElementById('wpMainImage');
    const badgeRes = document.getElementById('wpBadgeResolution');
    const sceneNumEl = document.getElementById('wpCurrentSceneNum');
    const allCountEl = document.getElementById('wpAllCount');
    const jumpTimeEl = document.getElementById('wpJumpTimestamp');

    if (mainImg) {
        mainImg.src = wp.path;
        mainImg.alt = `${wp.videoTitle || 'Claude Monet Masterwork'} - High-resolution scene at ${wp.timestampFormatted || 'snapshot'}`;
    }
    const resText = `${wp.qualityLabel || '4K UHD'} · ${wp.width || 3840}×${wp.height || 2160}`;
    const timeText = wp.timestampFormatted ? ` · Scene at ${wp.timestampFormatted}` : '';
    if (badgeRes) badgeRes.textContent = `${resText}${timeText}`;

    if (sceneNumEl) {
        sceneNumEl.textContent = activeWallpaperIndex + 1;
    }
    if (allCountEl) {
        allCountEl.textContent = activeWallpaperList.length;
    }
    if (jumpTimeEl) {
        jumpTimeEl.textContent = wp.timestampFormatted || '00:00';
    }

    const isProhibited = (typeof isChannelDownloadProhibited === 'function') 
        ? isChannelDownloadProhibited(wp.channel)
        : (wp.downloadProhibited || false);

    const rightsBanner = document.getElementById('wpModalRightsBanner');
    const rightsIcon = document.getElementById('wpModalRightsIcon');
    const rightsText = document.getElementById('wpModalRightsText');

    if (rightsBanner) {
        if (isProhibited) {
            rightsBanner.className = 'wp-modal-rights-banner banner-restricted';
            if (rightsIcon) rightsIcon.textContent = '🔒';
            if (rightsText) {
                rightsText.textContent = `Copyright Reserved Artwork (${escapeQuotes(wp.channel)}) · View-Only Contemplation in Gallery · Downloads Prohibited`;
            }
        } else {
            rightsBanner.className = 'wp-modal-rights-banner banner-public';
            if (rightsIcon) rightsIcon.textContent = '⚖️';
            if (rightsText) {
                rightsText.textContent = `Public Domain Artwork (${escapeQuotes(wp.channel)}) · Free Wallpaper Download & Personal Use`;
            }
        }
    }

    const dlCurBtn = document.getElementById('wpDownloadCurrentBtn');
    const dlAllBtn = document.getElementById('wpDownloadAllBtn');

    if (isProhibited) {
        if (dlCurBtn) {
            dlCurBtn.disabled = true;
            dlCurBtn.title = "Downloads prohibited due to channel copyright / licensing policies";
            dlCurBtn.innerHTML = "🔒 Downloads Prohibited";
            dlCurBtn.classList.add('btn-disabled-prohibited');
        }
        if (dlAllBtn) {
            dlAllBtn.disabled = true;
            dlAllBtn.title = "Downloads prohibited due to channel copyright / licensing policies";
            dlAllBtn.innerHTML = "🔒 Downloads Prohibited";
            dlAllBtn.classList.add('btn-disabled-prohibited');
        }
    } else {
        if (dlCurBtn) {
            dlCurBtn.disabled = false;
            dlCurBtn.title = "Download current scene wallpaper";
            dlCurBtn.innerHTML = `⬇ Current Scene <span class="btn-count-pill" id="wpCurrentSceneNum">${activeWallpaperIndex + 1}</span>`;
            dlCurBtn.classList.remove('btn-disabled-prohibited');
        }
        if (dlAllBtn) {
            dlAllBtn.disabled = false;
            dlAllBtn.title = "Download all wallpapers as ZIP package";
            dlAllBtn.innerHTML = `📦 Download All <span class="btn-count-pill" id="wpAllCount">${activeWallpaperList.length}</span>`;
            dlAllBtn.classList.remove('btn-disabled-prohibited');
        }
    }
}

// In-Page Scene Jump: seamlessly launches the in-page video player modal at exact scene timestamp
function jumpToSceneInPlayer() {
    const wp = activeWallpaperList[activeWallpaperIndex];
    if (!wp) return;

    const videoId = wp.videoId || currentModalVideoId;
    if (!videoId) return;

    const video = ALL_VIDEOS.find(v => v.id === videoId);
    const title = video ? video.title : 'Claude Monet Masterwork';
    const startSec = wp.timestampSec || 0;
    const savedTrigger = lastFocusedElement;

    closeWallpaperModalQuiet();
    openVideoModal(videoId, title, startSec, savedTrigger);
}

function closeWallpaperModalQuiet() {
    const modal = document.getElementById('wallpaperModalOverlay');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
}

function closeWallpaperModal() {
    closeWallpaperModalQuiet();
    restoreFocus();
}

// Download currently viewed wallpaper snapshot with sanitized, descriptive title and timestamp
function downloadCurrentWallpaper() {
    const wp = activeWallpaperList[activeWallpaperIndex];
    if (!wp || isDownloadingCurrent) return;

    const video = ALL_VIDEOS.find(v => v.id === wp.videoId) || {};
    if (typeof isChannelDownloadProhibited === 'function' && isChannelDownloadProhibited(wp.channel || video.channel)) {
        alert('Wallpaper downloads are prohibited for this title due to channel copyright / licensing policies. Fullscreen viewing and slideshow remain available for personal contemplation.');
        return;
    }
    const rawTitle = wp.videoTitle || video.title || 'Monet_Impressionism';
    const safeTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_').substring(0, 45);
    const sceneIdx = String(activeWallpaperIndex + 1).padStart(2, '0');
    const timeClean = (wp.timestampFormatted || '00m00s').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Monet_${safeTitle}_Scene_${sceneIdx}_${timeClean}_${wp.width || 3840}x${wp.height || 2160}.jpg`;

    isDownloadingCurrent = true;
    const btn = document.getElementById('wpDownloadCurrentBtn');
    const originalText = btn ? btn.innerHTML : '';

    if (btn) btn.innerHTML = '✓ Downloading...';

    showFilterAssistToast(`⚖️ Downloading wallpaper for personal contemplation · Artwork in Public Domain · Channel: ${escapeQuotes(wp.channel || video.channel || 'Curated')}`);

    const a = document.createElement('a');
    a.href = wp.path;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
        if (btn) btn.innerHTML = originalText;
        isDownloadingCurrent = false;
    }, 1200);
}

function buildZipAttributionText(items, collectionScope = 'Curated Impressionist Collection') {
    const dateStr = new Date().toISOString().split('T')[0];
    const channelMap = new Map();

    items.forEach(item => {
        const ch = item.channel || 'Curated Contributor';
        if (!channelMap.has(ch)) {
            channelMap.set(ch, []);
        }
        const titles = channelMap.get(ch);
        const title = item.videoTitle || 'Impressionist Masterwork';
        if (!titles.includes(title)) {
            titles.push(title);
        }
    });

    let channelsSection = '';
    channelMap.forEach((titles, ch) => {
        channelsSection += `\nChannel: ${ch}\n`;
        titles.slice(0, 15).forEach(t => {
            channelsSection += `  - ${t}\n`;
        });
        if (titles.length > 15) {
            channelsSection += `  - ...and ${titles.length - 15} additional works\n`;
        }
    });

    return `================================================================================
IMPRESSIONIST LIVING GALLERY · WALLPAPER ARCHIVE ATTRIBUTION & RIGHTS
================================================================================
Generated: ${dateStr}
Scope: ${collectionScope}
Total Wallpapers: ${items.length}

--------------------------------------------------------------------------------
1. ARTWORK & HISTORICAL CONTEXT
--------------------------------------------------------------------------------
The historical paintings featured in these wallpapers (including masterworks by
Claude Monet, Vincent van Gogh, Alfred Sisley, Eugène Boudin, Gustave Loiseau,
Isaac Levitan, and others) are in the Public Domain worldwide due to the
expiration of their copyright terms (author's life + 70 to 100 years).

--------------------------------------------------------------------------------
2. VIDEO CREATOR ATTRIBUTION & ORIGINATING CHANNELS
--------------------------------------------------------------------------------
These 4K/FHD wallpaper scenes originate from video presentations curated and
streamed on YouTube. Please support and subscribe to the creators:${channelsSection}

--------------------------------------------------------------------------------
3. TERMS OF USE & LICENSING
--------------------------------------------------------------------------------
• Non-commercial Personal Contemplation: Permitted. You may use these images as
  desktop wallpapers, personal art frames, screensavers, and private art study.
• Commercial Redistribution: Prohibited. Video presentations, channel branding,
  and digital curation may be protected by respective channel copyrights.
• Channel Copyright Reserved Titles: Titles originating from channels with explicit
  reservation (e.g. "Living Art Moments") are restricted to view-only contemplation
  within the living gallery and are excluded from bulk download archives.

================================================================================
Impressionist Living Gallery — Celebrating Fine Art & Digital Preservation
================================================================================
`;
}

// Download all wallpapers for this video packaged cleanly into a single ZIP archive
async function downloadAllWallpapers() {
    if (isDownloadingAll) return;
    if (!activeWallpaperList || activeWallpaperList.length === 0) return;

    const btn = document.getElementById('wpDownloadAllBtn');
    const originalText = btn ? btn.innerHTML : '';

    const firstWp = activeWallpaperList[0];
    const videoId = firstWp.videoId || currentModalVideoId;
    const video = ALL_VIDEOS.find(v => v.id === videoId) || {};
    if (typeof isChannelDownloadProhibited === 'function' && isChannelDownloadProhibited(firstWp.channel || video.channel)) {
        alert('Wallpaper downloads are prohibited for this title due to channel copyright / licensing policies. Fullscreen viewing and slideshow remain available for personal contemplation.');
        return;
    }
    const rawTitle = firstWp.videoTitle || video.title || 'Monet_Impressionism';
    const safeTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_').substring(0, 45);
    const zipFilename = `Monet_${safeTitle}_All_${activeWallpaperList.length}_Wallpapers.zip`;

    // 1. Return cached archive if already built during this session
    if (videoZipCache.has(videoId)) {
        const cachedBlob = videoZipCache.get(videoId);
        triggerBlobDownload(cachedBlob, zipFilename);
        if (btn) {
            btn.innerHTML = '✓ Downloaded!';
            setTimeout(() => { if (btn) btn.innerHTML = originalText; }, 1500);
        }
        return;
    }

    // 2. Ensure JSZip library is loaded dynamically
    try {
        if (btn) btn.innerHTML = '⏳ Loading ZIP engine...';
        await ensureJSZipLoaded();
    } catch (e) {
        alert('ZIP packaging library could not be loaded. Downloading current wallpaper snapshot instead.');
        downloadCurrentWallpaper();
        return;
    }

    isDownloadingAll = true;
    try {
        const zip = new JSZip();
        const total = activeWallpaperList.length;

        for (let i = 0; i < total; i++) {
            const item = activeWallpaperList[i];
            if (btn) btn.innerHTML = `📦 Packaging ${i + 1}/${total}...`;
            await new Promise(r => setTimeout(r, 0)); // Yield to event loop to keep UI responsive

            const res = await fetch(item.path);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${item.path}`);
            const blob = await res.blob();

            const sceneIdx = String(i + 1).padStart(2, '0');
            const timeClean = (item.timestampFormatted || '').replace(/[^a-zA-Z0-9]/g, '');
            const itemFilename = `${safeTitle}_Scene_${sceneIdx}_${timeClean}_${item.width}x${item.height}.jpg`;

            zip.file(itemFilename, blob);
        }

        const attrText = buildZipAttributionText(activeWallpaperList, safeTitle);
        zip.file('COPYRIGHT_AND_ATTRIBUTION.txt', attrText);

        if (btn) btn.innerHTML = '📦 Compressing...';
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'STORE'
        });

        videoZipCache.set(videoId, zipBlob);
        triggerBlobDownload(zipBlob, zipFilename);

        if (btn) btn.innerHTML = '✓ Complete!';
        setTimeout(() => {
            if (btn) btn.innerHTML = originalText;
            isDownloadingAll = false;
        }, 1800);
    } catch (err) {
        console.error('Error packaging wallpapers zip:', err);
        if (btn) btn.innerHTML = '⚠️ Error. Try Single';
        setTimeout(() => {
            if (btn) btn.innerHTML = originalText;
            isDownloadingAll = false;
        }, 2000);
    }
}

function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function updateWallpaperDownloadBar(filteredWp) {
    const downloadBar = document.getElementById('wallpaperDownloadBar');
    const countSpan = document.getElementById('wpDownloadFilteredCount');
    const slideshowCountSpan = document.getElementById('wpSlideshowCount');
    const titleEl = document.getElementById('wpDownloadFilterTitle');
    const subtitleEl = document.getElementById('wpDownloadFilterSubtitle');
    const downloadBtn = document.getElementById('wpDownloadFilteredBtn');
    const slideshowBtn = document.getElementById('wpPlaySlideshowBtn');

    if (!downloadBar) return;

    const channelEl = document.getElementById('channelSelect');
    const resEl = document.getElementById('resSelect');
    const channelText = (channelEl && channelEl.value !== 'ALL') ? channelEl.value : 'All Channels';
    const resText = resEl ? resEl.options[resEl.selectedIndex].text.replace(/^[^\w]+/, '').trim() : 'All Resolutions';

    const count = filteredWp ? filteredWp.length : 0;
    if (countSpan) countSpan.textContent = count;
    if (slideshowCountSpan) slideshowCountSpan.textContent = count;

    if (titleEl) {
        titleEl.textContent = `Curated Wallpaper Collection (${count} items)`;
    }
    if (subtitleEl) {
        subtitleEl.textContent = `Channel: ${channelText} · Resolution: ${resText} · Packaged into a ZIP or Fullscreen Slideshow`;
    }

    if (downloadBtn) {
        if (count === 0) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '⚠️ No Wallpapers for Current Filter';
        } else {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = `📦 Download All (${count}) (ZIP)`;
        }
    }

    if (slideshowBtn) {
        slideshowBtn.disabled = (count === 0);
    }
}

let isDownloadingFiltered = false;
async function downloadAllFilteredWallpapers() {
    if (isDownloadingFiltered) return;
    if (!currentWallpapers || currentWallpapers.length === 0) {
        alert('No wallpapers match the current filter criteria.');
        return;
    }

    const downloadableItems = currentWallpapers.filter(wp => {
        const isProhibited = (typeof isChannelDownloadProhibited === 'function') 
            ? isChannelDownloadProhibited(wp.channel) 
            : (wp.downloadProhibited || false);
        return !isProhibited;
    });

    if (downloadableItems.length === 0) {
        alert('All matching wallpapers in this selection have view-only copyright protections. Fullscreen viewing and slideshows remain available.');
        return;
    }

    const skippedCount = currentWallpapers.length - downloadableItems.length;
    const btn = document.getElementById('wpDownloadFilteredBtn');
    const originalText = btn ? btn.innerHTML : '';

    // Ensure JSZip library is loaded dynamically
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Loading ZIP engine...';
        }
        await ensureJSZipLoaded();
    } catch (e) {
        alert('ZIP packaging library could not be loaded. Please try again.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
        return;
    }

    const channelEl = document.getElementById('channelSelect');
    const resEl = document.getElementById('resSelect');
    const channelName = (channelEl && channelEl.value !== 'ALL') 
        ? channelEl.value.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_') 
        : 'All_Channels';
    const resName = resEl ? resEl.value : 'Filtered';
    const total = downloadableItems.length;
    const zipFilename = `Monet_Wallpapers_${channelName}_${resName}_(${total}_items).zip`;

    isDownloadingFiltered = true;
    if (btn) btn.disabled = true;

    try {
        const zip = new JSZip();
        let completed = 0;
        let successful = 0;

        // Download in parallel batches of 6 for high speed
        const batchSize = 6;
        for (let i = 0; i < total; i += batchSize) {
            await new Promise(r => setTimeout(r, 0)); // Yield to event loop to keep UI smooth and reactive
            const batch = downloadableItems.slice(i, i + batchSize);
            await Promise.all(batch.map(async (wp, bIdx) => {
                const globalIdx = i + bIdx + 1;
                const safeTitle = (wp.videoTitle || 'Impressionism').replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_').substring(0, 30);
                const safeChannel = (wp.channel || '').replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
                const timeClean = (wp.timestampFormatted || '').replace(/[^a-zA-Z0-9]/g, '');
                const fileName = `${safeChannel}_${safeTitle}_scene${wp.snapshotIndex || globalIdx}_${timeClean}_${wp.width}x${wp.height}.jpg`;

                try {
                    const res = await fetch(wp.path);
                    if (res.ok) {
                        const blob = await res.blob();
                        zip.file(fileName, blob);
                        successful++;
                    }
                } catch (fetchErr) {
                    console.warn(`Could not load wallpaper ${wp.path}:`, fetchErr);
                }
                completed++;
            }));

            if (btn) btn.innerHTML = `📦 Packaging ${completed}/${total}...`;
        }

        if (successful === 0) {
            throw new Error('No wallpaper files could be loaded');
        }

        const attrText = buildZipAttributionText(downloadableItems, `Channel: ${channelName} | Resolution: ${resName}`);
        zip.file('COPYRIGHT_AND_ATTRIBUTION.txt', attrText);

        if (btn) btn.innerHTML = '📦 Compressing ZIP...';
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'STORE'
        });

        triggerBlobDownload(zipBlob, zipFilename);

        if (btn) btn.innerHTML = `✓ Downloaded ${successful} Wallpapers!`;
        if (skippedCount > 0) {
            showFilterAssistToast(`⚖️ Packaged ${successful} downloadable wallpapers. Excluded ${skippedCount} copyright-reserved view-only works.`);
        }
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
            isDownloadingFiltered = false;
        }, 2500);
    } catch (err) {
        console.error('Error packaging filtered wallpapers:', err);
        if (btn) {
            btn.innerHTML = '⚠️ Download Error. Try Again';
            btn.disabled = false;
        }
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
            isDownloadingFiltered = false;
        }, 3000);
    }
}

// ==========================================================================
// FULLSCREEN WALLPAPER SLIDESHOW CONTROLLER
// ==========================================================================

function isMobileFormFactor(wp) {
    if (!wp) return false;
    if (wp.formFactor === 'mobile') return true;
    if (wp.formFactor === 'desktop') return false;
    return (wp.height > wp.width);
}

let slideshowRawList = [];
let slideshowList = [];
let slideshowCurrentIndex = 0;
let slideshowIsPlaying = true;
let slideshowIntervalMs = 5000;
let slideshowTimer = null;
let slideshowIdleTimer = null;
let slideshowFormFactorMode = 'desktop'; // 'desktop' | 'mobile' | 'all'
let slideshowFitMode = 'contain'; // 'contain' | 'cover'

// Hero Spotlight: skip the filters entirely and jump straight into a full-screen
// highlight reel — one representative wallpaper per video, best quality first.
const HERO_SPOTLIGHT_MAX = 40;

function shuffleArray(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function launchArtistSpotlight(artistName, triggerEl = null) {
    let candidateVideos = ALL_VIDEOS.filter(v => v.wallpapers && v.wallpapers.length > 0 &&
        (!artistName || v.artist === artistName));

    if (candidateVideos.length === 0) {
        showNotificationToast('No wallpapers available for this spotlight yet.');
        return;
    }

    if (artistName) {
        // Best-known works first: native 4K, then by popularity.
        candidateVideos.sort((a, b) => {
            if (!!a.is4K !== !!b.is4K) return a.is4K ? -1 : 1;
            return (b.views || 0) - (a.views || 0);
        });
    } else {
        candidateVideos = shuffleArray(candidateVideos);
    }

    const spotlightWallpapers = candidateVideos.slice(0, HERO_SPOTLIGHT_MAX).map(v => ({
        ...v.wallpapers[0],
        videoTitle: v.title,
        channel: v.channel,
        videoUrl: v.url,
        artist: v.artist,
        theme: v.theme,
        downloadProhibited: v.downloadProhibited,
        copyrightStatus: v.copyrightStatus
    }));

    startSlideshow(0, spotlightWallpapers, false, triggerEl);
}

function startSlideshow(startIndex = 0, customList = null, isSingleVideo = false, triggerEl = null) {
    if (triggerEl) {
        lastFocusedElement = triggerEl;
    } else if (document.activeElement && document.activeElement !== document.body) {
        const insideModal = document.activeElement.closest('.modal-overlay');
        if (!insideModal) {
            lastFocusedElement = document.activeElement;
        }
    }

    slideshowRawList = customList || currentWallpapers;
    if (!slideshowRawList || slideshowRawList.length === 0) {
        alert('No wallpapers available to display for the current filter selection.');
        return;
    }

    const overlay = document.getElementById('slideshowOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    overlay.classList.add('active');
    overlay.classList.remove('controls-hidden');
    document.body.style.overflow = 'hidden';

    // Auto-detect device form factor: on desktop screen, default to desktop widescreen
    const isDesktopDevice = window.innerWidth > 768 && (window.innerWidth >= window.innerHeight);
    if (isSingleVideo) {
        slideshowFormFactorMode = 'all';
    } else {
        slideshowFormFactorMode = isDesktopDevice ? 'desktop' : 'all';
    }

    const formFactorSelect = document.getElementById('slideshowFormFactorSelect');
    if (formFactorSelect) {
        formFactorSelect.value = slideshowFormFactorMode;
    }

    slideshowIsPlaying = true;
    const playBtn = document.getElementById('slideshowPlayBtn');
    if (playBtn) playBtn.innerHTML = '⏸️ Pause';

    filterSlideshowByFormFactor(startIndex);
    startSlideshowTimer();

    // Auto-start ambient classical music on slideshow launch if not already playing
    if (!isAudioPlaying) {
        toggleSlideshowAudio();
    }

    // Request native browser fullscreen if supported
    try {
        if (overlay.requestFullscreen) {
            overlay.requestFullscreen().catch(() => {});
        } else if (overlay.webkitRequestFullscreen) {
            overlay.webkitRequestFullscreen();
        }
    } catch (e) {}

    // Attach idle listeners
    overlay.removeEventListener('mousemove', handleSlideshowMouseMove);
    overlay.addEventListener('mousemove', handleSlideshowMouseMove);
    overlay.removeEventListener('touchstart', handleSlideshowMouseMove);
    overlay.addEventListener('touchstart', handleSlideshowMouseMove);
}

function filterSlideshowByFormFactor(requestedIndex = 0) {
    if (!slideshowRawList || slideshowRawList.length === 0) return;

    if (slideshowFormFactorMode === 'desktop') {
        slideshowList = slideshowRawList.filter(wp => !isMobileFormFactor(wp));
        if (slideshowList.length === 0) slideshowList = slideshowRawList;
    } else if (slideshowFormFactorMode === 'mobile') {
        slideshowList = slideshowRawList.filter(wp => isMobileFormFactor(wp));
        if (slideshowList.length === 0) slideshowList = slideshowRawList;
    } else {
        slideshowList = [...slideshowRawList];
    }

    slideshowCurrentIndex = Math.min(Math.max(0, requestedIndex), slideshowList.length - 1);
    showSlide(slideshowCurrentIndex);
}

function changeSlideshowFormFactor(val) {
    slideshowFormFactorMode = val;
    filterSlideshowByFormFactor(0);
    if (slideshowIsPlaying) {
        startSlideshowTimer();
    }
}

// ==========================================================================
// AMBIENT CLASSICAL AUDIO CONTROLLER (Debussy, Satie & Ravel)
// ==========================================================================
const AMBIENT_TRACKS = [
    { title: 'Debussy: Clair de Lune', src: 'audio/clair_de_lune.mp3' },
    { title: 'Satie: Gymnopédie No. 1', src: 'audio/gymnopedie_no1.mp3' },
    { title: 'Debussy: Première Arabesque', src: 'audio/debussy_arabesque_no1.mp3' },
    { title: 'Ravel: Pavane pour une infante défunte', src: 'audio/ravel_pavane.mp3' }
];
let currentAudioTrackIndex = 0;
let ambientAudio = null;
let isAudioPlaying = false;

function initAmbientAudio() {
    if (!ambientAudio) {
        ambientAudio = new Audio();
        ambientAudio.volume = 0.45;
        ambientAudio.preload = 'metadata';
        ambientAudio.addEventListener('ended', () => {
            nextAmbientTrack(true);
        });
        ambientAudio.addEventListener('error', (e) => {
            console.warn('Audio playback error:', e);
            isAudioPlaying = false;
            updateAudioUI(false);
        });
    }
}

function toggleSlideshowAudio() {
    const videoModal = document.getElementById('modalOverlay');
    if (window.GALLERY_CONFIG && window.GALLERY_CONFIG.STRICT_VIDEO_AUDIO_ISOLATION && videoModal && videoModal.classList.contains('open')) {
        console.info('Strict audio isolation active: ambient classical music paused while video player is open.');
        return;
    }
    initAmbientAudio();
    if (isAudioPlaying) {
        ambientAudio.pause();
        isAudioPlaying = false;
        updateAudioUI(false);
    } else {
        if (!ambientAudio.src || !ambientAudio.src.includes('.mp3')) {
            ambientAudio.src = AMBIENT_TRACKS[currentAudioTrackIndex].src;
        }
        ambientAudio.play().then(() => {
            isAudioPlaying = true;
            updateAudioUI(true);
        }).catch(err => {
            console.log('Audio playback prevented or waiting for gesture:', err);
            isAudioPlaying = false;
            updateAudioUI(false);
        });
    }
}

function nextAmbientTrack(autoPlay = true) {
    const videoModal = document.getElementById('modalOverlay');
    if (window.GALLERY_CONFIG && window.GALLERY_CONFIG.STRICT_VIDEO_AUDIO_ISOLATION && videoModal && videoModal.classList.contains('open')) {
        autoPlay = false;
    }
    currentAudioTrackIndex = (currentAudioTrackIndex + 1) % AMBIENT_TRACKS.length;
    initAmbientAudio();
    ambientAudio.src = AMBIENT_TRACKS[currentAudioTrackIndex].src;
    if (autoPlay || isAudioPlaying) {
        ambientAudio.play().then(() => {
            isAudioPlaying = true;
            updateAudioUI(true);
        }).catch(() => {
            isAudioPlaying = false;
            updateAudioUI(false);
        });
    } else {
        updateAudioUI(false);
    }
}

function updateAudioUI(playing) {
    const currentTrack = AMBIENT_TRACKS[currentAudioTrackIndex];

    // 1. Fullscreen Slideshow controls
    const btn = document.getElementById('slideshowAudioBtn');
    const title = document.getElementById('slideshowAudioTitle');
    if (btn) {
        btn.innerHTML = playing ? '🔊' : '🎵';
        btn.classList.toggle('audio-active', playing);
        btn.setAttribute('title', playing ? 'Pause Ambient Music (A)' : 'Play Ambient Music (A)');
    }
    if (title) {
        title.textContent = playing ? currentTrack.title : `${currentTrack.title} (Paused)`;
        title.classList.toggle('playing', playing);
    }

    // 2. Global header toolbar controls
    const globalPlayIcon = document.getElementById('globalAudioPlayIcon');
    const globalPlayBtn = document.getElementById('globalAudioPlayBtn');
    const globalTrackTitle = document.getElementById('globalAudioTrackTitle');
    if (globalPlayIcon) {
        globalPlayIcon.textContent = playing ? '🔊' : '🎵';
    }
    if (globalPlayBtn) {
        globalPlayBtn.classList.toggle('playing', playing);
        globalPlayBtn.setAttribute('title', playing ? 'Pause Ambient Music' : 'Play Ambient Music (Debussy, Satie & Ravel)');
    }
    if (globalTrackTitle) {
        globalTrackTitle.textContent = playing ? currentTrack.title : `${currentTrack.title} (Paused)`;
        globalTrackTitle.classList.toggle('playing', playing);
    }
}

function toggleGlobalAudio() {
    toggleSlideshowAudio();
}

let slideshowKenBurnsEnabled = true;

function toggleSlideshowFit() {
    slideshowFitMode = (slideshowFitMode === 'contain') ? 'cover' : 'contain';
    const img = document.getElementById('slideshowImage');
    const fitBtn = document.getElementById('slideshowFitBtn');
    if (img) {
        img.style.objectFit = slideshowFitMode;
    }
    if (fitBtn) {
        fitBtn.innerHTML = (slideshowFitMode === 'cover') ? '🔍' : '🖼️';
        fitBtn.title = (slideshowFitMode === 'cover') 
            ? 'Fill Mode active (Image fills screen) — Click for Fit' 
            : 'Fit Mode active (Entire painting visible) — Click for Fill';
    }
}

function toggleSlideshowKenBurns() {
    slideshowKenBurnsEnabled = !slideshowKenBurnsEnabled;
    const btn = document.getElementById('slideshowKenBurnsBtn');
    const img = document.getElementById('slideshowImage');
    if (btn) {
        btn.classList.toggle('active', slideshowKenBurnsEnabled);
        btn.title = slideshowKenBurnsEnabled 
            ? 'Ken Burns Cinematic Motion active — Click to disable (K)' 
            : 'Ken Burns Motion disabled — Click to enable slow pan & zoom (K)';
    }
    if (img) {
        if (slideshowKenBurnsEnabled) {
            img.classList.remove('ken-burns');
            void img.offsetWidth;
            img.classList.add('ken-burns');
        } else {
            img.classList.remove('ken-burns');
        }
    }
}

function startSlideshowFromCurrentModal() {
    if (!activeWallpaperList || activeWallpaperList.length === 0) return;
    const startIdx = activeWallpaperIndex || 0;
    const list = [...activeWallpaperList];
    const savedTrigger = lastFocusedElement;
    closeWallpaperModalQuiet();
    startSlideshow(startIdx, list, true, savedTrigger);
}

function showSlide(index) {
    if (!slideshowList || slideshowList.length === 0) return;
    slideshowCurrentIndex = (index + slideshowList.length) % slideshowList.length;
    const wp = slideshowList[slideshowCurrentIndex];

    const img = document.getElementById('slideshowImage');
    const ambientBg = document.getElementById('slideshowAmbientBg');
    const counter = document.getElementById('slideshowCounter');
    const title = document.getElementById('slideshowTitle');
    const channel = document.getElementById('slideshowChannel');
    const res = document.getElementById('slideshowRes');
    const time = document.getElementById('slideshowTime');

    if (counter) counter.textContent = `${slideshowCurrentIndex + 1} / ${slideshowList.length}`;
    if (title) title.textContent = wp.videoTitle || 'Impressionist Masterwork';
    if (channel) channel.textContent = wp.channel || '';
    if (res) res.textContent = wp.qualityLabel || `${wp.width}×${wp.height}`;
    if (time) time.textContent = wp.timestampFormatted ? `Scene at ${wp.timestampFormatted}` : '';

    if (ambientBg) {
        ambientBg.style.backgroundImage = `url("${wp.path}")`;
    }

    if (img) {
        img.style.opacity = '0.35';
        img.style.objectFit = slideshowFitMode;
        img.src = wp.path;
        img.onload = () => {
            img.style.opacity = '1';
            if (slideshowKenBurnsEnabled) {
                img.classList.remove('ken-burns');
                void img.offsetWidth; // Force layout reflow to smoothly restart keyframe animation
                img.classList.add('ken-burns');
            } else {
                img.classList.remove('ken-burns');
            }
        };
    }

    // Preload next 2 slides for instant rendering
    if (slideshowList.length > 1) {
        const nextIdx1 = (slideshowCurrentIndex + 1) % slideshowList.length;
        const nextImg1 = new Image();
        nextImg1.src = slideshowList[nextIdx1].path;

        const nextIdx2 = (slideshowCurrentIndex + 2) % slideshowList.length;
        const nextImg2 = new Image();
        nextImg2.src = slideshowList[nextIdx2].path;
    }

    restartProgressBar();
}

function navigateSlideshow(direction) {
    showSlide(slideshowCurrentIndex + direction);
    if (slideshowIsPlaying) {
        startSlideshowTimer();
    }
}

function toggleSlideshowPlayPause() {
    slideshowIsPlaying = !slideshowIsPlaying;
    const playBtn = document.getElementById('slideshowPlayBtn');
    
    if (slideshowIsPlaying) {
        if (playBtn) playBtn.innerHTML = '⏸️ Pause';
        startSlideshowTimer();
    } else {
        if (playBtn) playBtn.innerHTML = '▶️ Play';
        clearTimeout(slideshowTimer);
        const bar = document.getElementById('slideshowProgressBar');
        if (bar) bar.style.transition = 'none';
    }
}

function restartProgressBar() {
    const bar = document.getElementById('slideshowProgressBar');
    if (!bar) return;
    
    bar.style.transition = 'none';
    bar.style.width = '0%';
    
    if (slideshowIsPlaying) {
        void bar.offsetWidth; // Force layout reflow
        bar.style.transition = `width ${slideshowIntervalMs}ms linear`;
        bar.style.width = '100%';
    }
}

function startSlideshowTimer() {
    clearTimeout(slideshowTimer);
    restartProgressBar();
    if (!slideshowIsPlaying) return;

    slideshowTimer = setTimeout(() => {
        if (slideshowIsPlaying) {
            navigateSlideshow(1);
        }
    }, slideshowIntervalMs);
}

function changeSlideshowSpeed(val) {
    slideshowIntervalMs = parseInt(val, 10) || 5000;
    if (slideshowIsPlaying) {
        startSlideshowTimer();
    }
}

function toggleNativeFullscreen() {
    const overlay = document.getElementById('slideshowOverlay');
    if (!overlay) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (overlay.requestFullscreen) {
            overlay.requestFullscreen().catch(() => {});
        } else if (overlay.webkitRequestFullscreen) {
            overlay.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function downloadCurrentSlideshowImage() {
    if (!slideshowList || slideshowList.length === 0) return;
    const wp = slideshowList[slideshowCurrentIndex];
    if (!wp) return;

    const safeTitle = (wp.videoTitle || 'Impressionist_Masterwork').replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_').substring(0, 35);
    const filename = `${safeTitle}_scene${wp.snapshotIndex || (slideshowCurrentIndex + 1)}_${wp.width}x${wp.height}.jpg`;

    const a = document.createElement('a');
    a.href = wp.path;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function closeSlideshow() {
    clearTimeout(slideshowTimer);
    clearTimeout(slideshowIdleTimer);

    if (document.fullscreenElement || document.webkitFullscreenElement) {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        } catch (e) {}
    }

    const overlay = document.getElementById('slideshowOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('active', 'controls-hidden');
    }
    const img = document.getElementById('slideshowImage');
    if (img) {
        img.classList.remove('ken-burns');
    }
    document.body.style.overflow = '';

    // Ambient audio continues playing seamlessly across gallery and slideshow
    restoreFocus();
}

function handleSlideshowMouseMove() {
    const overlay = document.getElementById('slideshowOverlay');
    if (!overlay) return;

    overlay.classList.remove('controls-hidden');
    clearTimeout(slideshowIdleTimer);
    if (slideshowIsPlaying) {
        slideshowIdleTimer = setTimeout(() => {
            if (slideshowIsPlaying && overlay.classList.contains('active')) {
                overlay.classList.add('controls-hidden');
            }
        }, 2800);
    }
}

// Global keyboard navigation for Slideshow
window.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('slideshowOverlay');
    if (!overlay || overlay.style.display === 'none') return;

    if (e.key === 'Escape') {
        closeSlideshow();
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        navigateSlideshow(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
        navigateSlideshow(-1);
    } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        toggleSlideshowPlayPause();
    } else if (e.key === 'f' || e.key === 'F') {
        toggleNativeFullscreen();
    } else if (e.key === 'c' || e.key === 'C') {
        toggleSlideshowFit();
    } else if (e.key === 'k' || e.key === 'K') {
        toggleSlideshowKenBurns();
    } else if (e.key === 'a' || e.key === 'A') {
        toggleSlideshowAudio();
    } else if (e.key === 'n' || e.key === 'N') {
        nextAmbientTrack();
    } else if (e.key === 'd' || e.key === 'D' || e.key === 'm' || e.key === 'M') {
        const modes = ['desktop', 'mobile', 'all'];
        const nextMode = modes[(modes.indexOf(slideshowFormFactorMode) + 1) % modes.length];
        const formFactorSelect = document.getElementById('slideshowFormFactorSelect');
        if (formFactorSelect) formFactorSelect.value = nextMode;
        changeSlideshowFormFactor(nextMode);
    }
});

// Modal 5: Legal & Copyright Notice Lightbox
function openLegalModal(triggerEl = null) {
    if (triggerEl) {
        lastFocusedElement = triggerEl;
    } else if (document.activeElement && document.activeElement !== document.body) {
        const insideModal = document.activeElement.closest('.modal-overlay');
        if (!insideModal) {
            lastFocusedElement = document.activeElement;
        }
    }

    const overlay = document.getElementById('legalModalOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            const closeBtn = overlay.querySelector('.btn-close-modal');
            if (closeBtn) closeBtn.focus();
        }, 50);
    }
}

function closeLegalModalQuiet() {
    const overlay = document.getElementById('legalModalOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function closeLegalModal() {
    closeLegalModalQuiet();
    restoreFocus();
}

if (typeof window !== 'undefined') {
    window.openVideoModal = openVideoModal;
    window.closeVideoModal = closeVideoModal;
    window.openWallpaperModal = openWallpaperModal;
    window.closeWallpaperModal = closeWallpaperModal;
    window.filterByChannel = filterByChannel;
    window.toggleFavoriteVideo = toggleFavoriteVideo;
}



