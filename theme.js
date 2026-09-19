(() => {
  // Avatar Orb Gradients & Doctor Initials Helpers
  const AVATAR_GRADIENTS = [
    'radial-gradient(circle at 32% 28%, #bbf7d0 0%, #38bdf8 36%, #818cf8 68%, #4f46e5 100%)', // cyan-blue-violet (signature)
    'radial-gradient(circle at 32% 28%, #a5f3fc 0%, #60a5fa 38%, #a855f7 72%, #581c87 100%)', // sky-iris-purple
    'radial-gradient(circle at 32% 28%, #99f6e4 0%, #38bdf8 42%, #6366f1 78%, #312e81 100%)', // mint-azure-indigo
    'radial-gradient(circle at 32% 28%, #fbcfe8 0%, #c084fc 40%, #7c3aed 76%, #4c1d95 100%)', // lavender-violet
    'radial-gradient(circle at 32% 28%, #dbeafe 0%, #38bdf8 40%, #2563eb 75%, #1e1b4b 100%)'  // ice-sapphire
  ];

  window.getDoctorInitials = function(name) {
    if (!name || !name.trim()) return 'AP';
    const str = name.trim();
    // If already 1-2 initials (e.g. 'JR', 'JD', 'B', 'AP')
    if (/^[A-Za-z]{1,2}$/.test(str)) {
      return str.toUpperCase();
    }
    // If email
    if (str.includes('@')) {
      const emailUser = str.split('@')[0];
      const parts = emailUser.split(/[._-]+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return emailUser.slice(0, 2).toUpperCase();
    }
    const cleaned = str.replace(/^(?:dr\.|prof\.|conf\.|asist\.)\s*/i, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }
    return 'AP';
  };

  window.getDoctorGradient = function(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  };

  // Seed default doctor session if not present or update legacy session
  try {
    const raw = localStorage.getItem('medora_user');
    let user = raw ? JSON.parse(raw) : null;
    const defaultName = 'Dr. Andrei Popescu';
    if (!user) {
      user = {
        name: defaultName,
        email: 'andrei.popescu@spital.ro',
        fallback: window.getDoctorInitials(defaultName),
        gradient: AVATAR_GRADIENTS[0],
        role: 'Medicină de familie · Activ'
      };
      localStorage.setItem('medora_user', JSON.stringify(user));
    } else {
      user.fallback = window.getDoctorInitials(user.name || defaultName);
      user.gradient = user.gradient || window.getDoctorGradient(user.name || defaultName);
      localStorage.setItem('medora_user', JSON.stringify(user));
    }
  } catch (_) {}

  // HeroUI Avatar pattern:
  // <Avatar>
  //   <Avatar.Image alt="Name" src="..." />
  //   <Avatar.Fallback>Initials</Avatar.Fallback>
  // </Avatar>
  window.renderHeroUIAvatar = function (element, options = {}) {
    if (!element) return;
    const name = options.name || options.seed || 'Dr. Andrei Popescu';
    const initials = options.fallback || (window.getDoctorInitials ? window.getDoctorInitials(name) : 'AP');
    const gradient = options.gradient || (window.getDoctorGradient ? window.getDoctorGradient(name) : AVATAR_GRADIENTS[0]);
    const imageSrc = options.image || options.src || null;

    element.classList.add('heroui-avatar');
    element.style.background = gradient;
    element.style.overflow = 'hidden';

    if (imageSrc) {
      element.innerHTML = `<img class="heroui-avatar-img" src="${imageSrc}" alt="${name}" onerror="this.remove()" /><span class="heroui-avatar-fallback">${initials}</span>`;
    } else {
      element.innerHTML = `<span class="heroui-avatar-fallback">${initials}</span>`;
    }
  };

  // Primary paint function / backward compatibility
  window.renderMedoraAvatar = function (element, seed, imageSrc) {
    if (!element) return;
    window.renderHeroUIAvatar(element, {
      seed: seed,
      name: seed,
      image: imageSrc
    });
  };

  // SVG representation with initials fallback if requested
  window.medoraAvatarSvg = function (seed = 'Medora', size = 36) {
    const initials = window.getDoctorInitials(seed);
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Avatar ${initials}" style="display:block;border-radius:50%">
      <rect width="100" height="100" rx="50" fill="#6366f1"/>
      <text x="50" y="53" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="42" font-weight="650" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${initials}</text>
    </svg>`;
  };


  // ==========================================================================
  // HeroUI Country Select System (@heroui/react)
  // <Select><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
  // <Select.Popover><ListBox><ListBox.Item><ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select>
  // ==========================================================================
  window.MEDORA_COUNTRIES = [
    {
      id: 'ro', name: 'România', code: 'RO',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#fcd116"/><rect width="16" height="48" x="0" fill="#002b7f"/><rect width="16" height="48" x="32" fill="#ce1126"/></svg>'
    },
    {
      id: 'de', name: 'Germania', code: 'DE',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#dd0000"/><rect width="48" height="16" y="0" fill="#000000"/><rect width="48" height="16" y="32" fill="#ffce00"/></svg>'
    },
    {
      id: 'fr', name: 'Franța', code: 'FR',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#ffffff"/><rect width="16" height="48" x="0" fill="#002654"/><rect width="16" height="48" x="32" fill="#ed2939"/></svg>'
    },
    {
      id: 'it', name: 'Italia', code: 'IT',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#ffffff"/><rect width="16" height="48" x="0" fill="#009246"/><rect width="16" height="48" x="32" fill="#ce2b37"/></svg>'
    },
    {
      id: 'es', name: 'Spania', code: 'ES',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#f1bf00"/><rect width="48" height="12" y="0" fill="#aa151b"/><rect width="48" height="12" y="36" fill="#aa151b"/><circle cx="16" cy="24" r="4.5" fill="#aa151b" opacity="0.9"/></svg>'
    },
    {
      id: 'cz', name: 'Cehia', code: 'CZ',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#d7141a"/><rect width="48" height="24" y="0" fill="#ffffff"/><polygon points="0,0 24,24 0,48" fill="#11457e"/></svg>'
    },
    {
      id: 'hu', name: 'Ungaria', code: 'HU',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#ffffff"/><rect width="48" height="16" y="0" fill="#ce2939"/><rect width="48" height="16" y="32" fill="#477050"/></svg>'
    },
    {
      id: 'pl', name: 'Polonia', code: 'PL',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#dc143c"/><rect width="48" height="24" y="0" fill="#ffffff"/></svg>'
    },
    {
      id: 'gr', name: 'Grecia', code: 'GR',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#0d5eaf"/><rect width="48" height="5.33" y="5.33" fill="#fff"/><rect width="48" height="5.33" y="16" fill="#fff"/><rect width="48" height="5.33" y="26.66" fill="#fff"/><rect width="48" height="5.33" y="37.33" fill="#fff"/><rect width="21.33" height="21.33" fill="#0d5eaf"/><rect width="21.33" height="4.5" y="8.4" fill="#fff"/><rect width="4.5" height="21.33" x="8.4" fill="#fff"/></svg>'
    },
    {
      id: 'bg', name: 'Bulgaria', code: 'BG',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#00966e"/><rect width="48" height="16" y="0" fill="#ffffff"/><rect width="48" height="16" y="32" fill="#d62612"/></svg>'
    },
    {
      id: 'hr', name: 'Croația', code: 'HR',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#ffffff"/><rect width="48" height="16" y="0" fill="#ff0000"/><rect width="48" height="16" y="32" fill="#171796"/></svg>'
    },
    {
      id: 'rs', name: 'Serbia', code: 'RS',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#0c4076"/><rect width="48" height="16" y="0" fill="#c6363c"/><rect width="48" height="16" y="32" fill="#ffffff"/></svg>'
    },
    {
      id: 'si', name: 'Slovenia', code: 'SI',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#005ce6"/><rect width="48" height="16" y="0" fill="#ffffff"/><rect width="48" height="16" y="32" fill="#ed1c24"/></svg>'
    },
    {
      id: 'sk', name: 'Slovacia', code: 'SK',
      flag: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#0b4ea2"/><rect width="48" height="16" y="0" fill="#ffffff"/><rect width="48" height="16" y="32" fill="#ee1c25"/></svg>'
    }
  ];

  window.getSelectedCountry = function() {
    let saved = 'ro';
    try { saved = localStorage.getItem('medora_country') || 'ro'; } catch (_) {}
    return window.MEDORA_COUNTRIES.find(c => c.id === saved) || window.MEDORA_COUNTRIES[0];
  };

  window.setSelectedCountry = function(countryId) {
    const country = window.MEDORA_COUNTRIES.find(c => c.id === countryId) || window.MEDORA_COUNTRIES[0];
    try { localStorage.setItem('medora_country', country.id); } catch (_) {}
    
    // Update any select trigger in DOM
    document.querySelectorAll('.heroui-select[data-type="country"]').forEach(selectEl => {
      const flagEl = selectEl.querySelector('.heroui-selected-flag');
      const nameEl = selectEl.querySelector('.heroui-selected-name');
      if (flagEl) flagEl.innerHTML = country.flag;
      if (nameEl) nameEl.textContent = country.name;

      selectEl.querySelectorAll('.heroui-listbox-item').forEach(item => {
        const isMatch = item.dataset.id === country.id;
        item.classList.toggle('is-selected', isMatch);
        item.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });
    });

    // Sync medora.html sidebar country widget if present
    const sidebarCountry = document.querySelector('.sidebar-bottom .country');
    if (sidebarCountry) {
      const codeEl = sidebarCountry.querySelector('.country-code');
      const textEl = sidebarCountry.querySelector('div');
      if (codeEl) codeEl.textContent = country.code;
      if (textEl) textEl.innerHTML = country.name + '<small>Piață activă · Nomenclator ' + country.code + '</small>';
    }

    // Sync index.html network grid active cards if present
    document.querySelectorAll('.network-card').forEach(card => {
      const countryNameEl = card.querySelector('.network-country-name');
      if (countryNameEl) {
        const matches = countryNameEl.textContent.trim().toLowerCase() === country.name.toLowerCase();
        card.classList.toggle('is-active-market', matches);
      }
    });

    window.dispatchEvent(new CustomEvent('medora:country-change', { detail: country }));
  };

  window.initHeroUICountrySelect = function(container) {
    if (!container) return;
    const current = window.getSelectedCountry();

    container.innerHTML = `
      <div class="heroui-select" data-type="country">
        <button type="button" class="heroui-select-trigger" aria-haspopup="listbox" aria-expanded="false" title="Alege piața națională">
          <span class="heroui-select-value">
            <span class="heroui-country-flag heroui-selected-flag">${current.flag}</span>
            <span class="heroui-country-name heroui-selected-name">${current.name}</span>
          </span>
          <span class="heroui-select-indicator" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg>
          </span>
        </button>
        <div class="heroui-select-popover" role="dialog" aria-hidden="true">
          <div class="heroui-select-popover-header">Alege piața oficială</div>
          <ul class="heroui-listbox" role="listbox" aria-label="Alege țara">
            ${window.MEDORA_COUNTRIES.map(c => `
              <li class="heroui-listbox-item ${c.id === current.id ? 'is-selected' : ''}" role="option" data-id="${c.id}" data-name="${c.name}" aria-selected="${c.id === current.id ? 'true' : 'false'}">
                <span class="heroui-listbox-item-content">
                  <span class="heroui-country-flag">${c.flag}</span>
                  <span class="heroui-listbox-item-text">${c.name}</span>
                </span>
                <span class="heroui-listbox-item-indicator" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 4.5"/></svg>
                </span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;

    const selectEl = container.querySelector('.heroui-select');
    const trigger = selectEl.querySelector('.heroui-select-trigger');
    const popover = selectEl.querySelector('.heroui-select-popover');

    const togglePopover = (open) => {
      const willOpen = open !== undefined ? open : !popover.classList.contains('is-open');
      popover.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      popover.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
    };

    trigger.onclick = (e) => {
      e.stopPropagation();
      // Close other selects if open
      document.querySelectorAll('.heroui-select-popover.is-open').forEach(p => {
        if (p !== popover) {
          p.classList.remove('is-open');
          const t = p.closest('.heroui-select')?.querySelector('.heroui-select-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
      togglePopover();
    };

    selectEl.querySelectorAll('.heroui-listbox-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const cid = item.dataset.id;
        window.setSelectedCountry(cid);
        togglePopover(false);
      };
    });

    document.addEventListener('click', (e) => {
      if (!selectEl.contains(e.target)) {
        togglePopover(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popover.classList.contains('is-open')) {
        togglePopover(false);
      }
    });
  };

  // Auto-init on page load
  const autoInitCountrySelects = () => {
    document.querySelectorAll('[data-heroui-country-select]').forEach(el => {
      if (!el.hasAttribute('data-initialized')) {
        el.setAttribute('data-initialized', 'true');
        window.initHeroUICountrySelect(el);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitCountrySelects);
  } else {
    autoInitCountrySelects();
    window.setSelectedCountry(window.getSelectedCountry().id);
  }


  // Appearance follows iOS: system default, with light/dark override.
  // The old 7-palette picker (medora-theme) is retired — the brand is locked,
  // so any stored palette resolves to the same tokens and is cleaned up.
  try { localStorage.removeItem('medora-theme'); } catch (_) {}
  try { delete document.documentElement.dataset.medoraTheme; } catch (_) {}

  // The web stays light whatever the device asks for: the palette, the 3D icons and
  // the screenshots are all drawn on paper, and a dark web page next to a light app
  // reads as two products. The apps keep the switch, where someone chooses it.
  document.documentElement.dataset.medoraAppearance = 'light';
  try { localStorage.removeItem('medora-appearance'); } catch (_) {}

})();
