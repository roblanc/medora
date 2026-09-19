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
    const cleaned = name.replace(/^(?:dr\.|prof\.|conf\.|asist\.)\s*/i, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase() || 'AP';
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


  // Boring Avatars "beam", the same maths the iOS app draws natively, so a person
  // gets the same face on both. Seeded by email first: a rename must not change
  // someone's avatar.
  const AVATAR_PALETTES = [
    ['#8656B3', '#ACDAFD', '#F2A8CF', '#8FA99A', '#F4A261'],
    ['#2F6FD6', '#ACDAFD', '#F3E6D4', '#52B788', '#4A8BD4'],
    ['#E76F51', '#F4A261', '#E9C46A', '#2A9D8F', '#5FA8D3'],
    ['#9567BF', '#F8AD9D', '#FBC4AB', '#68D8D6', '#07B1CA'],
    ['#3D5A80', '#98C1D9', '#E0FBFC', '#EE6C4D', '#293241']
  ];

  const avatarHash = name => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    return Math.abs(hash);
  };
  const digit = (n, ntn) => Math.floor((n / Math.pow(10, ntn)) % 10);
  const bool = (n, ntn) => !(digit(n, ntn) % 2);
  const unit = (n, range, index) => {
    const value = n % range;
    return index && digit(n, index) % 2 === 0 ? -value : value;
  };
  const contrast = hex => {
    const h = hex.replace('#', '');
    const yiq = (parseInt(h.slice(0, 2), 16) * 299 + parseInt(h.slice(2, 4), 16) * 587 + parseInt(h.slice(4, 6), 16) * 114) / 1000;
    return yiq >= 128 ? '#181817' : '#FFFFFF';
  };

  // "Glass": a colour field with two heavily blurred letterforms floating over it,
  // in the spirit of DiceBear's style of the same name. Generated here rather than
  // fetched from their API on purpose — the seed is someone's email, and an avatar
  // is not worth sending a doctor's address, IP and referrer to a third party on
  // every page load, nor worth breaking when that service is slow.
  const GLASS_BACKGROUNDS = ['#ff2e88', '#00e5ff', '#ffe600', '#7cff00', '#ff6a00', '#b400ff'];
  const GLASS_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  window.medoraAvatarSvg = function (seed = 'Medora', size = 36) {
    const key = String(seed || 'Medora');
    const n = avatarHash(key);
    const id = 'g' + n.toString(36);
    const background = GLASS_BACKGROUNDS[n % GLASS_BACKGROUNDS.length];

    const shape = (index, offset) => {
      const h = avatarHash(key + index);
      return {
        letter: GLASS_LETTERS[h % GLASS_LETTERS.length],
        x: 20 + (h % 60),
        y: 30 + (digit(h, 2) * 5),
        rotate: unit(h, 360),
        scale: (1.1 + (h % 7) / 10).toFixed(2),
        opacity: (0.75 + (digit(h, offset) % 3) / 10).toFixed(2)
      };
    };

    const letters = [shape(1, 1), shape(2, 2)].map(part => `
        <g style="mix-blend-mode:screen" opacity="${part.opacity}" filter="url(#blur-${id})">
          <text x="${part.x}" y="${part.y}" fill="#fff" font-family="Karla, Helvetica, Arial, sans-serif"
                font-size="120" font-weight="700" text-anchor="middle" dominant-baseline="middle"
                transform="rotate(${part.rotate} ${part.x} ${part.y}) scale(${part.scale})"
                transform-origin="${part.x} ${part.y}">${part.letter}</text>
        </g>`).join('');

    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Avatar" style="display:block">
      <defs>
        <filter id="blur-${id}" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14"/>
        </filter>
        <clipPath id="clip-${id}"><rect width="100" height="100" rx="50"/></clipPath>
      </defs>
      <g clip-path="url(#clip-${id})">
        <rect width="100" height="100" fill="${background}"/>
        ${letters}
      </g>
    </svg>`;
  };

  // Paints one of the page's avatar elements, replacing the gradient-and-initials
  // placeholder the web used before.
  window.renderMedoraAvatar = function (element, seed) {
    if (!element) return;
    element.innerHTML = window.medoraAvatarSvg(seed, element.offsetWidth || 36);
    element.style.background = 'none';
    element.style.overflow = 'hidden';
  };

  // Appearance follows iOS: system default, with light/dark override.
  // The old 7-palette picker (medora-theme) is retired — the brand is locked,
  // so any stored palette resolves to the same tokens and is cleaned up.
  try { localStorage.removeItem('medora-theme'); } catch (_) {}
  try { delete document.documentElement.dataset.medoraTheme; } catch (_) {}

  const storageKey = 'medora-appearance';
  const modes = [
    { id: 'system', label: 'Sistem' },
    { id: 'light', label: 'Luminos' },
    { id: 'dark', label: 'Întunecat' }
  ];

  const validMode = id => modes.some(mode => mode.id === id) ? id : 'system';
  const getSavedMode = () => {
    try { return validMode(localStorage.getItem(storageKey)); }
    catch (_) { return 'system'; }
  };
  const saveMode = id => {
    try { localStorage.setItem(storageKey, id); }
    catch (_) {}
  };

  // Clinical workspace stays light for readability (anti-slop paper + ink).
  // System/dark mode is for marketing/cinematic pages only.
  const isClinicalApp = () => document.body?.classList.contains('medora-app')
    || document.documentElement.dataset.medoraWorkspace === 'clinical';

  const selected = isClinicalApp()
    ? 'light'
    : validMode(document.documentElement.dataset.medoraAppearance || getSavedMode());
  document.documentElement.dataset.medoraAppearance = selected;
  if (isClinicalApp()) {
    try { localStorage.setItem(storageKey, 'light'); } catch (_) {}
  }

  // No appearance control in the web pages: the palette follows the system, and
  // the switch lives in the app, where someone is already changing settings.
})();
