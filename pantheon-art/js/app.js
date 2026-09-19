/**
 * PANTHEON: Fine Art Exhibition & 500-Year History Engine
 * Minimalist, Intuitive, Visual-First Architecture
 * Step 1: Foundation & Reliability
 * Step 2: Real-Life Size on Museum Wall (Human Silhouette Scale)
 * Step 3: The 5-Minute Guided Tour (10 Historical Milestones)
 */

(function() {
  'use strict';

  const data = window.PANTHEON_DATA;
  if (!data) {
    console.error('PANTHEON_DATA catalog failed to load.');
    return;
  }

  // Application State
  const state = {
    activeEpoch: 'all',
    searchQuery: '',
    currentView: 'gallery', // 'gallery' | 'timeline'
    spotlightIndex: 0,
    spotlightTimer: null,
    filteredMasterpieces: [],
    modalIndex: -1,
    zoomScale: 1.0,
    loupeActive: false,
    isWallMode: false,
    isDraggingSheet: false,
    sheetStartY: 0,
    sheetCurrentDeltaY: 0,
    // 5-Minute Tour State
    tourIndex: 0,
    tourAutoPlay: false,
    tourTimer: null
  };

  // Magnification constant for Curator's Detail Loupe
  const LOUPE_ZOOM = 3.0;

  // DOM Elements Cache
  const dom = {
    // Spotlight Hero
    heroBg: document.getElementById('heroBg'),
    heroTitle: document.getElementById('heroTitle'),
    heroMeta: document.getElementById('heroMeta'),
    heroMpBadge: document.getElementById('heroMpBadge'),
    heroMuseum: document.getElementById('heroMuseum'),
    heroInspectBtn: document.getElementById('heroInspectBtn'),
    heroPrevBtn: document.getElementById('heroPrevBtn'),
    heroNextBtn: document.getElementById('heroNextBtn'),
    heroDots: document.getElementById('heroDots'),
    startTourBtn: document.getElementById('startTourBtn'),
    // Sticky Floating Nav & Controls
    tabGallery: document.getElementById('tabGallery'),
    tabTimeline: document.getElementById('tabTimeline'),
    epochPills: document.querySelectorAll('.epoch-pill'),
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    // Views
    shelvesSection: document.getElementById('shelvesSection'),
    gallerySection: document.getElementById('gallerySection'),
    timelineSection: document.getElementById('timelineSection'),
    galleryGrid: document.getElementById('galleryGrid'),
    timelineContainer: document.getElementById('timelineContainer'),
    galleryCountBadge: document.getElementById('galleryCountBadge'),
    noResultsNotice: document.getElementById('noResultsNotice'),
    // Lightbox / Bottom Sheet
    lightboxModal: document.getElementById('lightboxModal'),
    modalSheetContainer: document.querySelector('.modal-sheet-container'),
    sheetHandleZone: document.getElementById('sheetHandleZone'),
    modalHeader: document.querySelector('.modal-sheet-container .h-14'),
    zoomContainer: document.getElementById('zoomContainer'),
    curatorLoupe: document.getElementById('curatorLoupe'),
    loupeToggleBtn: document.getElementById('loupeToggleBtn'),
    wallScaleToggleBtn: document.getElementById('wallScaleToggleBtn'),
    wallStage: document.getElementById('wallStage'),
    wallImage: document.getElementById('wallImage'),
    wallFrame: document.getElementById('wallFrame'),
    wallDimensionBadge: document.getElementById('wallDimensionBadge'),
    modalImage: document.getElementById('modalImage'),
    modalTitle: document.getElementById('modalTitle'),
    modalArtist: document.getElementById('modalArtist'),
    modalMuseum: document.getElementById('modalMuseum'),
    modalPhysicalDim: document.getElementById('modalPhysicalDim'),
    modalRes: document.getElementById('modalRes'),
    modalMp: document.getElementById('modalMp'),
    modalSize: document.getElementById('modalSize'),
    modalRightsBadge: document.getElementById('modalRightsBadge'),
    modalRightsStatement: document.getElementById('modalRightsStatement'),
    modalRawLink: document.getElementById('modalRawLink'),
    modalPrevBtn: document.getElementById('modalPrevBtn'),
    modalNextBtn: document.getElementById('modalNextBtn'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),
    // 5-Minute Guided Tour Story Mode
    tourModal: document.getElementById('tourModal'),
    tourStepLabel: document.getElementById('tourStepLabel'),
    tourProgressSegments: document.getElementById('tourProgressSegments'),
    tourAutoPlayBtn: document.getElementById('tourAutoPlayBtn'),
    tourPlayIcon: document.getElementById('tourPlayIcon'),
    tourPlayText: document.getElementById('tourPlayText'),
    tourExitBtn: document.getElementById('tourExitBtn'),
    tourPrevBtn: document.getElementById('tourPrevBtn'),
    tourNextBtn: document.getElementById('tourNextBtn'),
    tourAmbientBg: document.getElementById('tourAmbientBg'),
    tourImage: document.getElementById('tourImage'),
    tourEpochBadge: document.getElementById('tourEpochBadge'),
    tourYearBadge: document.getElementById('tourYearBadge'),
    tourWorkTitle: document.getElementById('tourWorkTitle'),
    tourWorkArtist: document.getElementById('tourWorkArtist'),
    tourStoryText: document.getElementById('tourStoryText'),
    tourBreakthroughText: document.getElementById('tourBreakthroughText'),
    tourInspectLoupeBtn: document.getElementById('tourInspectLoupeBtn')
  };

  // Helper: Image Source Resolver
  function resolveImgSrc(item) {
    if (!item) return '';
    if (window.location.protocol.startsWith('http')) {
      return item.HighResUrl || item.LocalRelativePath;
    }
    return item.LocalRelativePath || item.HighResUrl;
  }

  // =========================================================================
  // 1. SPOTLIGHT HERO ENGINE
  // =========================================================================
  function initSpotlightHero() {
    const spotlights = data.spotlights && data.spotlights.length > 0 
      ? data.spotlights 
      : data.masterpieces.slice(0, 5);

    function renderSpotlight(index, animate = true) {
      const item = spotlights[index];
      if (!item) return;

      state.spotlightIndex = index;

      if (dom.heroBg) {
        if (animate) dom.heroBg.style.opacity = '0.3';
        setTimeout(() => {
          dom.heroBg.src = resolveImgSrc(item);
          dom.heroBg.style.opacity = '1';
        }, animate ? 200 : 0);
      }

      if (dom.heroTitle) dom.heroTitle.textContent = item.Title;
      if (dom.heroMeta) dom.heroMeta.textContent = `${item.Artist} (${item.Year})`;
      if (dom.heroMuseum) dom.heroMuseum.textContent = item.Museum || 'Museum Collection';
      if (dom.heroMpBadge) dom.heroMpBadge.textContent = `${item.Megapixels.toFixed(1)} MP`;

      if (dom.heroInspectBtn) {
        dom.heroInspectBtn.onclick = () => window.openMasterpieceModal(item.FileName);
      }

      // Update dots
      if (dom.heroDots) {
        dom.heroDots.innerHTML = '';
        spotlights.forEach((_, i) => {
          const dot = document.createElement('button');
          dot.className = `w-2 h-2 rounded-full transition-all cursor-pointer ${i === index ? 'bg-amber-400 w-6' : 'bg-slate-600 hover:bg-slate-400'}`;
          dot.onclick = () => {
            renderSpotlight(i);
            resetSpotlightTimer();
          };
          dom.heroDots.appendChild(dot);
        });
      }
    }

    function nextSpotlight() {
      const nextIdx = (state.spotlightIndex + 1) % spotlights.length;
      renderSpotlight(nextIdx);
    }

    function prevSpotlight() {
      const prevIdx = (state.spotlightIndex - 1 + spotlights.length) % spotlights.length;
      renderSpotlight(prevIdx);
    }

    function resetSpotlightTimer() {
      if (state.spotlightTimer) clearInterval(state.spotlightTimer);
      state.spotlightTimer = setInterval(nextSpotlight, 6500);
    }

    if (dom.heroNextBtn) dom.heroNextBtn.onclick = () => { nextSpotlight(); resetSpotlightTimer(); };
    if (dom.heroPrevBtn) dom.heroPrevBtn.onclick = () => { prevSpotlight(); resetSpotlightTimer(); };

    renderSpotlight(0, false);
    resetSpotlightTimer();
  }

  // =========================================================================
  // 2. CURATED HORIZONTAL SHELVES ENGINE
  // =========================================================================
  function renderCuratedShelves() {
    if (!dom.shelvesSection) return;

    const shelves = [
      {
        id: 'shelf-crown-jewels',
        title: '👑 The Crown Jewels of Art History',
        subtitle: 'The universally recognized masterworks defining half a millennium of artistic genius.',
        items: data.masterpieces.filter(m => m.isCrownJewel).slice(0, 12)
      },
      {
        id: 'shelf-ultra-res',
        title: '🔬 Ultra-HD Museum Scans (20+ Megapixels)',
        subtitle: 'Peak resolution master captures—inspect microscopic brushstrokes, impasto, and cracked glaze.',
        items: data.masterpieces.filter(m => m.Megapixels >= 20.0)
      },
      {
        id: 'shelf-shadow-light',
        title: '🕯️ Masters of Shadow & Light (Baroque)',
        subtitle: 'The dramatic tenebrism of Caravaggio & the golden psychological impasto of Rembrandt.',
        items: data.masterpieces.filter(m => m.ArtistId === 'caravaggio' || m.ArtistId === 'rembrandt')
      },
      {
        id: 'shelf-impressionism',
        title: '🌸 The Plein-Air Revolution (Impressionism)',
        subtitle: 'Claude Monet’s fleeting optical vibrations & Vincent van Gogh’s raw emotional swirls.',
        items: data.masterpieces.filter(m => m.ArtistId === 'monet' || m.ArtistId === 'vangogh').slice(0, 12)
      }
    ];

    dom.shelvesSection.innerHTML = '';

    shelves.forEach((shelf) => {
      const block = document.createElement('div');
      block.className = 'space-y-3';

      block.innerHTML = `
        <div class="flex items-end justify-between px-1">
          <div>
            <h3 class="font-monumental text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              ${shelf.title}
            </h3>
            <p class="font-editorial text-xs sm:text-sm text-slate-400 italic mt-0.5">${shelf.subtitle}</p>
          </div>
          <div class="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            <button 
              onclick="window.scrollShelf('${shelf.id}', -420)" 
              title="Scroll Left" 
              class="w-7 h-7 rounded-full bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs flex items-center justify-center border border-slate-700 transition shadow cursor-pointer select-none"
            >
              &#10094;
            </button>
            <button 
              onclick="window.scrollShelf('${shelf.id}', 420)" 
              title="Scroll Right" 
              class="w-7 h-7 rounded-full bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs flex items-center justify-center border border-slate-700 transition shadow cursor-pointer select-none"
            >
              &#10095;
            </button>
          </div>
        </div>
        
        <div id="${shelf.id}" class="flex gap-4 overflow-x-auto no-scrollbar shelf-snap py-2 px-1 scroll-smooth">
          ${shelf.items.map(item => `
            <div 
              class="group flex-shrink-0 w-60 sm:w-72 bg-slate-900/80 border border-slate-800 hover:border-amber-400/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col"
              onclick="window.openMasterpieceModal('${item.FileName}')"
            >
              <div class="aspect-[4/3] w-full relative overflow-hidden bg-slate-950">
                <img 
                  src="${resolveImgSrc(item)}" 
                  alt="${item.Title}" 
                  loading="lazy" 
                  decoding="async"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  onerror="if (this.src !== '${item.HighResUrl}') { this.src = '${item.HighResUrl}'; }"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-75 group-hover:opacity-40 transition-opacity"></div>
                <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${item.Megapixels >= 20.0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'} backdrop-blur-md border">
                  ${item.Megapixels.toFixed(1)} MP
                </span>
                <span class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/60 text-slate-300 backdrop-blur-md">
                  ${item.Year}
                </span>
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <span class="bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-xs font-bold shadow-xl">
                    🔍 Inspect Loupe
                  </span>
                </div>
              </div>
              <div class="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <p class="text-[11px] font-mono text-amber-400/90 truncate">${item.Artist}</p>
                  <h4 class="font-editorial text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1 mt-0.5">${item.Title}</h4>
                </div>
                <p class="text-[10px] text-slate-400 truncate mt-2">🏛️ ${item.Museum || 'Museum Collection'}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      dom.shelvesSection.appendChild(block);
    });
  }

  // Horizontal Shelf Smooth Scroll
  window.scrollShelf = function(shelfId, offset) {
    const el = document.getElementById(shelfId);
    if (el) {
      el.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // =========================================================================
  // 3. MASTER GALLERY ENGINE (Grid View)
  // =========================================================================
  function applyFilters() {
    let list = [...data.masterpieces];

    // Epoch filter
    if (state.activeEpoch !== 'all') {
      list = list.filter(item => item.EpochId === state.activeEpoch);
    }

    // Search query filter
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        return (
          item.Title.toLowerCase().includes(q) ||
          item.Artist.toLowerCase().includes(q) ||
          (item.Museum && item.Museum.toLowerCase().includes(q)) ||
          item.Year.toLowerCase().includes(q)
        );
      });
    }

    state.filteredMasterpieces = list;
    renderGallery();
    renderTimeline();
  }

  function renderGallery() {
    if (!dom.galleryGrid) return;
    dom.galleryGrid.innerHTML = '';

    const list = state.filteredMasterpieces;
    if (dom.galleryCountBadge) {
      dom.galleryCountBadge.textContent = `${list.length} Works`;
    }

    if (list.length === 0) {
      if (dom.noResultsNotice) dom.noResultsNotice.classList.remove('hidden');
      return;
    }
    if (dom.noResultsNotice) dom.noResultsNotice.classList.add('hidden');

    const fragment = document.createDocumentFragment();

    list.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'group relative bg-slate-900/70 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col cursor-pointer';

      const isUltraRes = item.Megapixels >= 20.0;
      const badgeColor = isUltraRes 
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' 
        : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

      card.innerHTML = `
        <div class="img-container aspect-[4/3] w-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
          <img 
            src="${resolveImgSrc(item)}" 
            alt="${item.Title}" 
            loading="lazy" 
            decoding="async"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            onerror="if (this.src !== '${item.HighResUrl}') { this.src = '${item.HighResUrl}'; }"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-75 group-hover:opacity-50 transition-opacity"></div>
          
          <div class="absolute top-3 left-3 flex items-center gap-1.5 z-10">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border backdrop-blur-md ${badgeColor}">
              ${item.Megapixels.toFixed(1)} MP
            </span>
          </div>

          <div class="absolute top-3 right-3 z-10">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/60 backdrop-blur-md text-slate-300 border border-slate-700/50">
              ${item.Width} × ${item.Height}
            </span>
          </div>

          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <span class="bg-amber-500 text-slate-950 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl">
              🔍 Inspect High-Res
            </span>
          </div>
        </div>

        <div class="p-4 flex-1 flex flex-col justify-between bg-slate-900/90">
          <div>
            <div class="flex items-center justify-between text-xs text-amber-400/90 font-mono mb-1">
              <span>${item.Artist}</span>
              <span>${item.Year}</span>
            </div>
            <h3 class="font-editorial text-base font-bold text-slate-100 leading-snug group-hover:text-amber-300 transition-colors line-clamp-2">
              ${item.Title}
            </h3>
          </div>
          
          <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <span class="truncate max-w-[190px]" title="${item.Museum || 'Museum Collection'}">
              🏛️ ${item.Museum || 'Museum Collection'}
            </span>
            <span class="font-mono text-slate-400 font-semibold">${item.physicalWidthCm ? Math.round(item.physicalWidthCm) + '×' + Math.round(item.physicalHeightCm) + 'cm' : item.FileSizeMB + ' MB'}</span>
          </div>
        </div>
      `;

      card.onclick = () => openModal(index);
      fragment.appendChild(card);
    });

    dom.galleryGrid.appendChild(fragment);
  }

  // =========================================================================
  // 4. TIMELINE WITH CURATOR MICRO-PLAQUES & PROGRESSIVE DISCLOSURE
  // =========================================================================
  function renderTimeline() {
    if (!dom.timelineContainer) return;
    dom.timelineContainer.innerHTML = '';

    let list = [...data.artists];

    // Filter by epoch if active
    if (state.activeEpoch !== 'all') {
      list = list.filter(artist => artist.epochId === state.activeEpoch);
    }

    // Filter by search query if active
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(artist => {
        const works = data.masterpieces.filter(m => m.ArtistId === artist.id);
        const matchesArtist = (artist.name && artist.name.toLowerCase().includes(q)) ||
                              (artist.epochName && artist.epochName.toLowerCase().includes(q)) ||
                              (artist.tagline && artist.tagline.toLowerCase().includes(q));
        const matchesWorks = works.some(w => w.Title.toLowerCase().includes(q));
        return matchesArtist || matchesWorks;
      });
    }

    if (dom.galleryCountBadge && state.currentView === 'timeline') {
      dom.galleryCountBadge.textContent = `${list.length} Masters`;
    }

    if (list.length === 0) {
      dom.timelineContainer.innerHTML = `
        <div class="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800">
          <span class="text-3xl">🔍</span>
          <h3 class="font-editorial text-base font-bold text-white mt-2">No Masters Found</h3>
          <p class="text-xs text-slate-400 mt-1">Try resetting your epoch filter or searching another master name.</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    list.forEach((artist) => {
      const works = data.masterpieces.filter(m => m.ArtistId === artist.id);

      const section = document.createElement('article');
      section.className = 'relative bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md hover:border-amber-400/30 transition-all';

      // Innovations chips
      const innovationPills = (artist.innovations || []).map(inv => `
        <span class="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          ✦ ${inv}
        </span>
      `).join('');

      // Signature Works Horizontal Reel
      const worksReel = works.map(w => `
        <div 
          class="flex-shrink-0 w-44 sm:w-52 group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/3] cursor-pointer hover:border-amber-400 transition-all"
          onclick="window.openMasterpieceModal('${w.FileName}')"
        >
          <div class="relative w-full h-full">
            <img src="${resolveImgSrc(w)}" alt="${w.Title}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="if (this.src !== '${w.HighResUrl}') { this.src = '${w.HighResUrl}'; }" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-2.5">
              <p class="text-white text-xs font-bold line-clamp-1 group-hover:text-amber-300 transition-colors">${w.Title}</p>
              <p class="text-slate-400 text-[10px] font-mono">${w.Megapixels.toFixed(1)} MP &bull; ${w.Year}</p>
            </div>
          </div>
        </div>
      `).join('');

      section.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="badge-${artist.epochId} px-3 py-0.5 rounded-full text-xs font-mono font-semibold">
              ${artist.epochName}
            </span>
            <span class="text-xs font-mono text-slate-400">
              ${artist.lifespan}
            </span>
          </div>
          <span class="text-xs text-slate-400 font-sans">
            📍 ${artist.location}
          </span>
        </div>

        <!-- Master Name & Punchy Micro-Plaque Tagline -->
        <h3 class="font-monumental text-2xl sm:text-3xl font-bold text-white mt-1">
          ${artist.name}
        </h3>
        <p class="font-editorial italic text-base sm:text-lg text-amber-300/90 mt-1 max-w-3xl leading-relaxed">
          "${artist.tagline || artist.epithet}"
        </p>

        <!-- Technical Innovation Chips -->
        <div class="flex flex-wrap gap-2 mt-3 mb-5">
          ${innovationPills}
        </div>

        <!-- Horizontal Signature Works Reel -->
        <div class="my-4">
          <h5 class="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2.5">
            Key Masterworks in Collection (${works.length})
          </h5>
          <div class="flex gap-3 overflow-x-auto no-scrollbar shelf-snap py-1">
            ${worksReel}
          </div>
        </div>

        <!-- Progressive Disclosure: Expandable Curator Drawer -->
        <div class="mt-4 pt-4 border-t border-slate-800/80">
          <button 
            class="curator-toggle-btn text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors focus:outline-none cursor-pointer"
            onclick="window.toggleCuratorDrawer(this)"
          >
            <span>📖</span>
            <span class="btn-text">Read Curator's Historical Analysis</span>
            <span class="chevron">▾</span>
          </button>
          
          <div class="curator-drawer mt-3 grid sm:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed font-sans">
            <div class="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
              <strong class="text-amber-400 block font-mono uppercase tracking-wider mb-1">👑 Why They Belong:</strong>
              ${artist.whyBelongs}
            </div>
            <div class="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
              <strong class="text-cyan-400 block font-mono uppercase tracking-wider mb-1">⚡ Evolutionary Role:</strong>
              ${artist.evolutionRole}
            </div>
          </div>
        </div>
      `;

      fragment.appendChild(section);
    });

    dom.timelineContainer.appendChild(fragment);
  }

  // Toggle Curator Note Drawer (Accordion)
  window.toggleCuratorDrawer = function(btn) {
    const drawer = btn.parentElement.querySelector('.curator-drawer');
    const chevron = btn.querySelector('.chevron');
    const btnText = btn.querySelector('.btn-text');

    if (!drawer) return;

    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      chevron.textContent = '▾';
      btnText.textContent = "Read Curator's Historical Analysis";
    } else {
      drawer.classList.add('open');
      chevron.textContent = '▴';
      btnText.textContent = "Close Curator's Analysis";
    }
  };

  // =========================================================================
  // 5. LIGHTBOX MODAL & MOBILE BOTTOM SHEET
  // =========================================================================
  function openModal(index) {
    const list = state.filteredMasterpieces;
    if (index < 0 || index >= list.length) return;

    state.modalIndex = index;
    state.zoomScale = 1.0;
    deactivateLoupe();
    deactivateWallScale();
    updateModalContent();

    dom.lightboxModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Reset bottom sheet transform
    if (dom.modalSheetContainer) {
      dom.modalSheetContainer.style.transform = '';
    }
  }

  function closeModal() {
    deactivateLoupe();
    deactivateWallScale();
    dom.lightboxModal.classList.add('hidden');
    document.body.style.overflow = '';
    state.modalIndex = -1;
    state.zoomScale = 1.0;
    if (dom.modalSheetContainer) {
      dom.modalSheetContainer.style.transform = '';
    }
  }

  function updateModalContent() {
    const item = state.filteredMasterpieces[state.modalIndex];
    if (!item) return;

    // Apply shimmer placeholder while image loads
    dom.modalImage.classList.add('img-loading-shimmer');
    const imgSrc = resolveImgSrc(item);
    dom.modalImage.src = imgSrc;
    dom.modalImage.onload = () => {
      dom.modalImage.classList.remove('img-loading-shimmer');
    };
    dom.modalImage.onerror = () => {
      dom.modalImage.classList.remove('img-loading-shimmer');
      if (dom.modalImage.src !== item.HighResUrl) {
        dom.modalImage.src = item.HighResUrl;
      }
    };

    dom.modalImage.style.transform = `scale(${state.zoomScale})`;

    dom.modalTitle.textContent = item.Title;
    dom.modalArtist.textContent = `${item.Artist} (${item.Year})`;
    dom.modalMuseum.textContent = item.Museum || 'Museum Collection';
    
    if (dom.modalPhysicalDim) {
      dom.modalPhysicalDim.textContent = item.physicalDimensionsStr || '';
    }

    dom.modalRes.textContent = `${item.Width} × ${item.Height} px`;
    dom.modalMp.textContent = `${item.Megapixels.toFixed(2)} MP`;
    dom.modalSize.textContent = `${item.FileSizeMB} MB`;

    // Rights & Provenance Metadata (100% Public Domain)
    if (dom.modalRightsBadge) {
      dom.modalRightsBadge.textContent = 'PUBLIC DOMAIN';
      dom.modalRightsBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    }

    if (dom.modalRightsStatement) {
      dom.modalRightsStatement.textContent = item.rightsStatement || '🏛️ Public Domain Worldwide (Life + 70 Years Expired)';
    }

    dom.modalRawLink.href = item.HighResUrl || item.LocalRelativePath;

    // Refresh loupe if active
    if (state.loupeActive) {
      dom.curatorLoupe.style.backgroundImage = `url('${item.HighResUrl || imgSrc}')`;
    }

    // Refresh wall scale if active
    if (state.isWallMode) {
      renderWallScale(item);
    }
  }

  function stepModal(dir) {
    const list = state.filteredMasterpieces;
    const newIdx = state.modalIndex + dir;
    if (newIdx >= 0 && newIdx < list.length) {
      state.modalIndex = newIdx;
      state.zoomScale = 1.0;
      updateModalContent();
    }
  }

  function adjustZoom(delta) {
    if (state.isWallMode) return;
    state.zoomScale = Math.max(0.5, Math.min(4.0, state.zoomScale + delta));
    if (dom.modalImage) {
      dom.modalImage.style.transform = `scale(${state.zoomScale})`;
    }
  }

  function resetZoom() {
    state.zoomScale = 1.0;
    if (dom.modalImage) {
      dom.modalImage.style.transform = `scale(1.0)`;
    }
  }

  window.openMasterpieceModal = function(fileName) {
    const idx = state.filteredMasterpieces.findIndex(m => m.FileName === fileName);
    if (idx !== -1) {
      openModal(idx);
    } else {
      state.activeEpoch = 'all';
      state.searchQuery = '';
      if (dom.searchInput) dom.searchInput.value = '';
      if (dom.searchClearBtn) dom.searchClearBtn.classList.add('hidden');
      if (dom.epochPills) {
        dom.epochPills.forEach(p => {
          if (p.dataset.epoch === 'all') {
            p.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
            p.classList.remove('bg-slate-800/80', 'text-slate-300');
          } else {
            p.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
            p.classList.add('bg-slate-800/80', 'text-slate-300');
          }
        });
      }
      applyFilters();
      const newIdx = state.filteredMasterpieces.findIndex(m => m.FileName === fileName);
      if (newIdx !== -1) openModal(newIdx);
    }
  };

  // =========================================================================
  // 6. CURATOR'S DETAIL LOUPE ENGINE (3.0× Magnification)
  // =========================================================================
  function toggleLoupe() {
    if (state.isWallMode) deactivateWallScale();
    if (state.loupeActive) {
      deactivateLoupe();
    } else {
      activateLoupe();
    }
  }

  function activateLoupe() {
    state.loupeActive = true;
    if (dom.loupeToggleBtn) {
      dom.loupeToggleBtn.classList.add('bg-amber-500', 'text-slate-950', 'font-bold', 'border-amber-400');
      dom.loupeToggleBtn.classList.remove('bg-slate-800', 'text-slate-300');
    }
    if (dom.zoomContainer) dom.zoomContainer.classList.add('loupe-active-canvas');
    if (dom.modalImage) dom.modalImage.classList.add('loupe-active-canvas');

    const item = state.filteredMasterpieces[state.modalIndex];
    if (item && dom.curatorLoupe) {
      const highRes = item.HighResUrl || resolveImgSrc(item);
      dom.curatorLoupe.style.backgroundImage = `url('${highRes}')`;
    }
  }

  function deactivateLoupe() {
    state.loupeActive = false;
    if (dom.loupeToggleBtn) {
      dom.loupeToggleBtn.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold', 'border-amber-400');
      dom.loupeToggleBtn.classList.add('bg-slate-800', 'text-slate-300');
    }
    if (dom.zoomContainer) dom.zoomContainer.classList.remove('loupe-active-canvas');
    if (dom.modalImage) dom.modalImage.classList.remove('loupe-active-canvas');
    if (dom.curatorLoupe) dom.curatorLoupe.classList.remove('active');
  }

  function handleLoupeMove(e) {
    if (!state.loupeActive || !dom.curatorLoupe || !dom.modalImage || !dom.zoomContainer) return;

    const imgRect = dom.modalImage.getBoundingClientRect();
    const containerRect = dom.zoomContainer.getBoundingClientRect();

    const isTouch = !!e.touches;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    // Check bounds: within artwork image with a small tolerance
    if (
      clientX < imgRect.left - 5 || 
      clientX > imgRect.right + 5 || 
      clientY < imgRect.top - 5 || 
      clientY > imgRect.bottom + 5
    ) {
      dom.curatorLoupe.classList.remove('active');
      return;
    }

    dom.curatorLoupe.classList.add('active');

    // On mobile touch: position loupe 65px above finger contact so thumb doesn't obscure magnification!
    const offsetY = isTouch ? -65 : 0;
    const loupeX = clientX - containerRect.left;
    const loupeY = clientY - containerRect.top + offsetY;

    dom.curatorLoupe.style.left = `${loupeX}px`;
    dom.curatorLoupe.style.top = `${loupeY}px`;

    // High resolution background calculations
    const bgW = imgRect.width * LOUPE_ZOOM;
    const bgH = imgRect.height * LOUPE_ZOOM;
    dom.curatorLoupe.style.backgroundSize = `${bgW}px ${bgH}px`;

    const normX = Math.max(0, Math.min(1, (clientX - imgRect.left) / imgRect.width));
    const normY = Math.max(0, Math.min(1, (clientY - imgRect.top) / imgRect.height));

    const bgPosX = -(normX * bgW - 90);
    const bgPosY = -(normY * bgH - 90);
    dom.curatorLoupe.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
  }

  // =========================================================================
  // 7. REAL-LIFE SIZE "ON THE WALL" SCALE VISUALIZER (Step 2)
  // =========================================================================
  function toggleWallScale() {
    if (state.isWallMode) {
      deactivateWallScale();
    } else {
      activateWallScale();
    }
  }

  function activateWallScale() {
    state.isWallMode = true;
    deactivateLoupe();

    if (dom.wallScaleToggleBtn) {
      dom.wallScaleToggleBtn.classList.add('bg-amber-500', 'text-slate-950', 'font-bold', 'border-amber-400');
      dom.wallScaleToggleBtn.classList.remove('bg-slate-800', 'text-slate-300');
    }

    if (dom.wallStage) dom.wallStage.classList.remove('hidden');
    if (dom.modalImage) dom.modalImage.classList.add('hidden');

    const item = state.filteredMasterpieces[state.modalIndex];
    if (item) renderWallScale(item);
  }

  function deactivateWallScale() {
    state.isWallMode = false;

    if (dom.wallScaleToggleBtn) {
      dom.wallScaleToggleBtn.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold', 'border-amber-400');
      dom.wallScaleToggleBtn.classList.add('bg-slate-800', 'text-slate-300');
    }

    if (dom.wallStage) dom.wallStage.classList.add('hidden');
    if (dom.modalImage) dom.modalImage.classList.remove('hidden');
  }

  function renderWallScale(item) {
    if (!dom.wallFrame || !dom.wallImage || !dom.wallDimensionBadge) return;

    dom.wallImage.src = resolveImgSrc(item);

    // Baseline: 175 cm human silhouette reference height in px
    const isMobile = window.innerWidth <= 768;
    const humanHeightPx = isMobile ? 165 : 220;
    const pxPerCm = humanHeightPx / 175.0;

    let frameW = (item.physicalWidthCm || 80) * pxPerCm;
    let frameH = (item.physicalHeightCm || 80) * pxPerCm;

    // Stage constraints so giant murals fit elegantly alongside the human
    const maxStageH = isMobile ? 220 : 280;
    const maxStageW = isMobile ? 220 : 380;

    if (frameH > maxStageH || frameW > maxStageW) {
      const scaleDown = Math.min(maxStageH / frameH, maxStageW / frameW);
      frameW *= scaleDown;
      frameH *= scaleDown;
    }

    dom.wallFrame.style.width = `${Math.max(26, Math.round(frameW))}px`;
    dom.wallFrame.style.height = `${Math.max(26, Math.round(frameH))}px`;
    dom.wallDimensionBadge.textContent = item.physicalDimensionsStr || `${item.physicalWidthCm} × ${item.physicalHeightCm} cm`;
  }

  // =========================================================================
  // 8. THE 5-MINUTE GUIDED TOUR STORY MODE (Step 3)
  // =========================================================================
  window.startTour = function() {
    const tour = data.guidedTour;
    if (!tour || tour.length === 0) return;

    if (dom.tourModal) {
      dom.tourModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

      // Build 10 segmented progress bars
      if (dom.tourProgressSegments) {
        dom.tourProgressSegments.innerHTML = '';
        tour.forEach((_, i) => {
          const seg = document.createElement('div');
          seg.className = `tour-step-bar flex-1 ${i === 0 ? 'active' : ''}`;
          dom.tourProgressSegments.appendChild(seg);
        });
      }

      renderTourStep(0);
    }
  };

  function closeTour() {
    stopTourAutoPlay();
    if (dom.tourModal) {
      dom.tourModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function renderTourStep(index) {
    const tour = data.guidedTour;
    if (!tour || index < 0 || index >= tour.length) return;

    state.tourIndex = index;
    const stop = tour[index];

    if (dom.tourStepLabel) {
      dom.tourStepLabel.textContent = `Milestone ${index + 1} of ${tour.length} • Year ${stop.year}`;
    }
    if (dom.tourEpochBadge) dom.tourEpochBadge.textContent = stop.epoch;
    if (dom.tourYearBadge) dom.tourYearBadge.textContent = stop.year;
    if (dom.tourWorkTitle) dom.tourWorkTitle.textContent = stop.title;
    if (dom.tourWorkArtist) dom.tourWorkArtist.textContent = stop.artist;
    if (dom.tourStoryText) dom.tourStoryText.textContent = `"${stop.story}"`;
    if (dom.tourBreakthroughText) dom.tourBreakthroughText.textContent = stop.breakthrough;

    const matchFallback = data.masterpieces.find(m => m.Title.toLowerCase() === stop.title.toLowerCase() || m.FileName === stop.fileName);
    const imgSrc = resolveImgSrc(stop) || (matchFallback ? matchFallback.HighResUrl : '');

    if (dom.tourImage) {
      dom.tourImage.classList.add('img-loading-shimmer');
      dom.tourImage.onload = () => dom.tourImage.classList.remove('img-loading-shimmer');
      dom.tourImage.onerror = () => {
        dom.tourImage.classList.remove('img-loading-shimmer');
        if (matchFallback && dom.tourImage.src !== matchFallback.HighResUrl) {
          dom.tourImage.src = matchFallback.HighResUrl;
          if (dom.tourAmbientBg) dom.tourAmbientBg.src = matchFallback.HighResUrl;
        }
      };
      dom.tourImage.src = imgSrc;
    }
    if (dom.tourAmbientBg) dom.tourAmbientBg.src = imgSrc;

    // Update progress segments
    if (dom.tourProgressSegments) {
      const bars = dom.tourProgressSegments.querySelectorAll('.tour-step-bar');
      bars.forEach((bar, i) => {
        bar.className = `tour-step-bar flex-1 ${i < index ? 'completed' : (i === index ? 'active' : '')}`;
      });
    }
  }

  function nextTourStep() {
    const tour = data.guidedTour;
    if (!tour) return;
    const nextIdx = (state.tourIndex + 1) % tour.length;
    renderTourStep(nextIdx);
  }

  function prevTourStep() {
    const tour = data.guidedTour;
    if (!tour) return;
    const prevIdx = (state.tourIndex - 1 + tour.length) % tour.length;
    renderTourStep(prevIdx);
  }

  function toggleTourAutoPlay() {
    if (state.tourAutoPlay) {
      stopTourAutoPlay();
    } else {
      startTourAutoPlay();
    }
  }

  function startTourAutoPlay() {
    state.tourAutoPlay = true;
    if (dom.tourPlayIcon) dom.tourPlayIcon.textContent = '⏸';
    if (dom.tourPlayText) dom.tourPlayText.textContent = 'Pause';
    if (dom.tourAutoPlayBtn) dom.tourAutoPlayBtn.classList.add('bg-amber-500/20', 'text-amber-300', 'border-amber-500/40');

    if (state.tourTimer) clearInterval(state.tourTimer);
    state.tourTimer = setInterval(nextTourStep, 9500);
  }

  function stopTourAutoPlay() {
    state.tourAutoPlay = false;
    if (dom.tourPlayIcon) dom.tourPlayIcon.textContent = '▶';
    if (dom.tourPlayText) dom.tourPlayText.textContent = 'Auto-Play';
    if (dom.tourAutoPlayBtn) dom.tourAutoPlayBtn.classList.remove('bg-amber-500/20', 'text-amber-300', 'border-amber-500/40');

    if (state.tourTimer) {
      clearInterval(state.tourTimer);
      state.tourTimer = null;
    }
  }

  function inspectCurrentTourWork() {
    const tour = data.guidedTour;
    if (!tour) return;
    const stop = tour[state.tourIndex];
    closeTour();
    window.openMasterpieceModal(stop.fileName);
    setTimeout(activateLoupe, 250);
  }

  // =========================================================================
  // 9. MOBILE BOTTOM SHEET TOUCH SWIPE GESTURES
  // =========================================================================
  function initMobileSheetGestures() {
    const handleZone = dom.sheetHandleZone;
    const header = dom.modalHeader;
    const sheet = dom.modalSheetContainer;
    if (!sheet) return;

    function onTouchStart(e) {
      if (window.innerWidth > 768) return;
      state.isDraggingSheet = true;
      state.sheetStartY = e.touches[0].clientY;
      state.sheetCurrentDeltaY = 0;
      sheet.style.transition = 'none';
    }

    function onTouchMove(e) {
      if (!state.isDraggingSheet) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - state.sheetStartY;

      if (deltaY > 0) {
        state.sheetCurrentDeltaY = deltaY;
        sheet.style.transform = `translateY(${deltaY}px)`;
      } else {
        sheet.style.transform = `translateY(${deltaY * 0.15}px)`;
      }
    }

    function onTouchEnd() {
      if (!state.isDraggingSheet) return;
      state.isDraggingSheet = false;
      sheet.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';

      if (state.sheetCurrentDeltaY > 80) {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => {
          closeModal();
          sheet.style.transform = '';
        }, 220);
      } else {
        sheet.style.transform = 'translateY(0)';
      }
      state.sheetCurrentDeltaY = 0;
    }

    if (handleZone) {
      handleZone.addEventListener('touchstart', onTouchStart, { passive: true });
      handleZone.addEventListener('touchmove', onTouchMove, { passive: true });
      handleZone.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    if (header) {
      header.addEventListener('touchstart', onTouchStart, { passive: true });
      header.addEventListener('touchmove', onTouchMove, { passive: true });
      header.addEventListener('touchend', onTouchEnd, { passive: true });
    }
  }

  // =========================================================================
  // 10. EVENT LISTENERS & INITIALIZATION
  // =========================================================================
  function initEvents() {
    // View tabs: Gallery vs Timeline
    if (dom.tabGallery) {
      dom.tabGallery.onclick = () => switchView('gallery');
    }
    if (dom.tabTimeline) {
      dom.tabTimeline.onclick = () => switchView('timeline');
    }

    // Epoch filter pills
    dom.epochPills.forEach(pill => {
      pill.onclick = () => {
        dom.epochPills.forEach(p => {
          p.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
          p.classList.add('bg-slate-800/80', 'text-slate-300');
        });
        pill.classList.remove('bg-slate-800/80', 'text-slate-300');
        pill.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');

        state.activeEpoch = pill.dataset.epoch;
        applyFilters();
      };
    });

    // Search input (debounced)
    if (dom.searchInput) {
      let timeout = null;
      dom.searchInput.oninput = (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          state.searchQuery = e.target.value;
          if (dom.searchClearBtn) {
            dom.searchClearBtn.classList.toggle('hidden', !state.searchQuery);
          }
          applyFilters();
        }, 150);
      };
    }

    if (dom.searchClearBtn) {
      dom.searchClearBtn.onclick = () => {
        dom.searchInput.value = '';
        state.searchQuery = '';
        dom.searchClearBtn.classList.add('hidden');
        applyFilters();
      };
    }

    // Modal controls
    if (dom.modalCloseBtn) dom.modalCloseBtn.onclick = closeModal;
    if (dom.modalPrevBtn) dom.modalPrevBtn.onclick = () => stepModal(-1);
    if (dom.modalNextBtn) dom.modalNextBtn.onclick = () => stepModal(1);
    if (dom.zoomInBtn) dom.zoomInBtn.onclick = () => adjustZoom(0.3);
    if (dom.zoomOutBtn) dom.zoomOutBtn.onclick = () => adjustZoom(-0.3);
    if (dom.zoomResetBtn) dom.zoomResetBtn.onclick = resetZoom;

    // Loupe & Wall Scale toggles
    if (dom.loupeToggleBtn) dom.loupeToggleBtn.onclick = toggleLoupe;
    if (dom.wallScaleToggleBtn) dom.wallScaleToggleBtn.onclick = toggleWallScale;

    // Loupe cursor & touch tracking
    if (dom.zoomContainer) {
      dom.zoomContainer.addEventListener('mousemove', handleLoupeMove);
      dom.zoomContainer.addEventListener('touchmove', handleLoupeMove, { passive: true });
      dom.zoomContainer.addEventListener('mouseleave', () => {
        if (dom.curatorLoupe) dom.curatorLoupe.classList.remove('active');
      });
      dom.zoomContainer.addEventListener('touchend', () => {
        if (dom.curatorLoupe) dom.curatorLoupe.classList.remove('active');
      });
    }

    if (dom.lightboxModal) {
      dom.lightboxModal.onclick = (e) => {
        if (e.target === dom.lightboxModal) closeModal();
      };
    }

    // 5-Minute Guided Tour controls
    if (dom.tourExitBtn) dom.tourExitBtn.onclick = closeTour;
    if (dom.tourPrevBtn) dom.tourPrevBtn.onclick = prevTourStep;
    if (dom.tourNextBtn) dom.tourNextBtn.onclick = nextTourStep;
    if (dom.tourAutoPlayBtn) dom.tourAutoPlayBtn.onclick = toggleTourAutoPlay;
    if (dom.tourInspectLoupeBtn) dom.tourInspectLoupeBtn.onclick = inspectCurrentTourWork;

    // Mobile bottom sheet drag-to-dismiss gesture
    initMobileSheetGestures();

    // Keyboard shortcuts
    window.onkeydown = (e) => {
      // If Tour Modal is open
      if (dom.tourModal && !dom.tourModal.classList.contains('hidden')) {
        if (e.key === 'Escape') closeTour();
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextTourStep();
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevTourStep();
        else if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          toggleTourAutoPlay();
        }
        return;
      }

      // If Lightbox Modal is open
      if (dom.lightboxModal && !dom.lightboxModal.classList.contains('hidden')) {
        if (e.key === 'Escape') closeModal();
        else if (e.key === 'ArrowLeft') stepModal(-1);
        else if (e.key === 'ArrowRight') stepModal(1);
        else if (e.key === '+' || e.key === '=') adjustZoom(0.2);
        else if (e.key === '-') adjustZoom(-0.2);
        else if (e.key === '0') resetZoom();
        else if (e.key === 'l' || e.key === 'L') toggleLoupe();
        else if (e.key === 'w' || e.key === 'W') toggleWallScale();
      }
    };
  }

  // =========================================================================
  // UNIFIED NAVIGATION & SECTION ROUTER
  // =========================================================================
  window.navigateToSection = function(target) {
    const headerOffset = 72; // 64px header height + padding
    if (target === 'shelves') {
      const el = document.getElementById('shelvesSection');
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    } else if (target === 'gallery') {
      switchView('gallery');
      const el = document.getElementById('exhibitionSection') || document.getElementById('gallerySection');
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    } else if (target === 'timeline') {
      switchView('timeline');
      const el = document.getElementById('exhibitionSection') || document.getElementById('timelineSection');
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    } else if (target === 'tour') {
      window.startTour();
    }
  };

  function switchView(view) {
    state.currentView = view;

    const navGallery = document.getElementById('navBtnGallery');
    const navTimeline = document.getElementById('navBtnTimeline');
    const exhibitionTitle = document.getElementById('exhibitionTitle');
    const exhibitionSubtitle = document.getElementById('exhibitionSubtitle');

    if (view === 'gallery') {
      if (dom.tabGallery) {
        dom.tabGallery.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
        dom.tabGallery.classList.remove('text-slate-400', 'hover:text-white');
      }
      if (dom.tabTimeline) {
        dom.tabTimeline.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
        dom.tabTimeline.classList.add('text-slate-400', 'hover:text-white');
      }

      if (navGallery) {
        navGallery.classList.add('text-amber-400', 'bg-slate-800/80');
      }
      if (navTimeline) {
        navTimeline.classList.remove('text-amber-400', 'bg-slate-800/80');
      }

      if (exhibitionTitle) exhibitionTitle.textContent = 'Crown Jewels Master Gallery';
      if (exhibitionSubtitle) exhibitionSubtitle.textContent = 'High-resolution master scans curated at peak museum fidelity across 5 centuries.';

      if (dom.gallerySection) dom.gallerySection.classList.remove('hidden');
      if (dom.timelineSection) dom.timelineSection.classList.add('hidden');

      if (dom.galleryCountBadge) {
        dom.galleryCountBadge.textContent = `${state.filteredMasterpieces.length} Works`;
      }

      renderGallery();
    } else {
      if (dom.tabTimeline) {
        dom.tabTimeline.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
        dom.tabTimeline.classList.remove('text-slate-400', 'hover:text-white');
      }
      if (dom.tabGallery) {
        dom.tabGallery.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
        dom.tabGallery.classList.add('text-slate-400', 'hover:text-white');
      }

      if (navTimeline) {
        navTimeline.classList.add('text-amber-400', 'bg-slate-800/80');
      }
      if (navGallery) {
        navGallery.classList.remove('text-amber-400', 'bg-slate-800/80');
      }

      if (exhibitionTitle) exhibitionTitle.textContent = '500-Year Evolutionary Chronology';
      if (exhibitionSubtitle) exhibitionSubtitle.textContent = 'Bite-sized micro-plaques tracking 10 historic titans of art history from Botticelli (1470) to Munch (1944).';

      if (dom.gallerySection) dom.gallerySection.classList.add('hidden');
      if (dom.timelineSection) dom.timelineSection.classList.remove('hidden');

      renderTimeline();
    }
  }

  function init() {
    initSpotlightHero();
    renderCuratedShelves();
    state.filteredMasterpieces = [...data.masterpieces];
    renderGallery();
    renderTimeline();
    initEvents();
    console.log('Pantheon exhibition initialized: Step 1, Step 2, and Step 3 fully active.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
