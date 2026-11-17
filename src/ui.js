const PRESETS = {
  showtime: { screen: 1, stage: 1, house: 0.9, cove: 0.8, exits: 1, beam: 0.24, sway: 1, breeze: 1, exposure: 1.06, bloom: 1, grain: 1, haze: 1 },
  intermission: { screen: 0.62, stage: 0.6, house: 1.55, cove: 1.15, exits: 1, beam: 0, exposure: 1.16, bloom: 0.9, grain: 1, haze: 1.1, sway: 1, breeze: 1 },
  house: { screen: 0.2, stage: 0.34, house: 2.2, cove: 1.6, exits: 1, beam: 0, exposure: 1.24, bloom: 0.8, grain: 0.9, haze: 1, sway: 1, breeze: 1 },
  blackout: { screen: 0.02, stage: 0.02, house: 0.02, cove: 0.03, exits: 0.62, beam: 0, exposure: 0.92, bloom: 0.8, grain: 1.3, haze: 1, sway: 1, breeze: 1 },
};

const DISPLAY = {
  screen: (v) => v * 100,
  stage: (v) => v * 100,
  house: (v) => v * 40,
  cove: (v) => v * 50,
  exits: (v) => v * 50,
  beam: (v) => v * 50,
  sway: (v) => v * 100,
  breeze: (v) => v * 100,
  exposure: (v) => v * 100,
  bloom: (v) => v * 100,
  grain: (v) => v * 100,
  haze: (v) => v * 100,
};

export function createUI({ target, onChange, onPreset, onResetView, onToggleDrift }) {
  const panel = document.getElementById('panel');
  const sliders = [...document.querySelectorAll('input[data-param]')];
  const presetButtons = [...document.querySelectorAll('[data-preset]')];
  const stateName = document.getElementById('state-name');
  const stateDot = document.getElementById('state-dot');
  const openBtn = document.getElementById('open-panel');
  const hint = document.getElementById('hint');

  let activePreset = 'showtime';
  let hidden = false;

  function paint(input) {
    const p = input.dataset.param;
    const v = target[p];
    input.value = v;
    const pct = ((v - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', `${pct}%`);
    const out = input.parentElement.querySelector('output');
    if (out) out.textContent = Math.round(DISPLAY[p] ? DISPLAY[p](v) : v * 100);
  }

  function paintAll() {
    sliders.forEach(paint);
    presetButtons.forEach((b) => b.classList.toggle('on', b.dataset.preset === activePreset));
    if (activePreset) {
      const names = { showtime: 'SHOWTIME', intermission: 'INTERMISSION', house: 'HOUSE LIGHTS', blackout: 'BLACKOUT' };
      stateName.textContent = names[activePreset] || 'CUSTOM';
      stateDot.style.background = activePreset === 'blackout' ? '#8d8b86' : '#6ee7a8';
      stateDot.style.boxShadow = activePreset === 'blackout'
        ? '0 0 10px rgba(180,180,170,.35)'
        : '0 0 10px rgba(110,231,168,.8)';
    } else {
      stateName.textContent = 'CUSTOM';
      stateDot.style.background = '#e5b06a';
      stateDot.style.boxShadow = '0 0 10px rgba(229,176,106,.7)';
    }
  }

  sliders.forEach((input) => {
    input.addEventListener('input', () => {
      const p = input.dataset.param;
      target[p] = parseFloat(input.value);
      activePreset = null;
      paint(input);
      paintAll();
      onChange?.(p, target[p]);
    });
    paint(input);
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activePreset = btn.dataset.preset;
      applyPreset(btn.dataset.preset);
      onPreset?.(activePreset);
    });
  });

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    Object.assign(target, p);
    activePreset = name;
    paintAll();
    onChange?.('preset', name);
  }

  function setPresetVisual(name) {
    activePreset = name;
    paintAll();
  }

  document.getElementById('panel-toggle').addEventListener('click', () => hide());
  openBtn?.addEventListener('click', () => hide(false));

  document.getElementById('reset-cam').addEventListener('click', () => onResetView?.());
  const driftBtn = document.getElementById('drift');
  driftBtn.addEventListener('click', () => {
    const on = driftBtn.classList.toggle('on');
    onToggleDrift?.(on);
  });
  document.getElementById('hide-ui').addEventListener('click', () => hide(true));

  function hide(forceHidden) {
    hidden = forceHidden === undefined ? !hidden : forceHidden;
    panel.classList.toggle('collapsed', hidden);
    document.getElementById('brand').style.opacity = hidden ? '0' : '1';
    document.getElementById('hud').style.opacity = hidden ? '0' : '1';
    if (hint) hint.style.opacity = hidden ? '0' : '';
    openBtn.classList.toggle('show', hidden);
  }

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'h' || e.key === 'H') hide();
  });

  paintAll();

  return { applyPreset, paintAll, setPresetVisual, hide, get hidden() { return hidden; }, PRESETS };
}
