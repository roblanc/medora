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
