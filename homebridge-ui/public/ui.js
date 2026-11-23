'use strict';
async function initialize() {
  const hb = window.homebridge;
  const button = document.getElementById('discover');
  const status = document.getElementById('discovery-status');
  const results = document.getElementById('discovery-results');
  let detected = [], busy = false, form, schema;
  let pendingFormUpdate = Promise.resolve();
  function message(text) { status.textContent = text; }

  function showSettings(config) {
    form?.end();
    form = hb.createForm(schema, config);
    form.onChange(data => {
      pendingFormUpdate = pendingFormUpdate.then(async () => {
        const configs = await hb.getPluginConfig();
        const current = configs[0] || { platform: 'BeautyrestLocal' };
        await hb.updatePluginConfig([{ ...current, name: data.name, sides: data.sides }]);
        if (!busy) await render();
      }).catch(() => message('Could not update settings. Close and reopen settings before saving.'));
    });
  }

  async function render() {
    const configs = await hb.getPluginConfig();
    const sides = Array.isArray(configs[0]?.sides) ? configs[0].sides : [];
    results.replaceChildren();
    for (const bed of detected) {
      const row = document.createElement('div'); row.className = 'border rounded p-2 mb-2 d-flex align-items-center flex-wrap';
      row.style.gap = '0.75rem';
      const id = document.createElement('code'); id.textContent = bed.id; row.append(id);
      const assigned = sides.find(side => String(side?.id || '').toLowerCase() === bed.id);
      if (assigned) {
        const label = document.createElement('span'); label.textContent = ' — configured as ' + (assigned.name || 'a bed side'); row.append(label);
      } else {
        for (let index = 0; index < 2; index++) {
          if (sides[index]?.id || index > sides.length) continue;
          const use = document.createElement('button'); use.type = 'button'; use.className = 'btn btn-sm btn-outline-primary';
          use.textContent = 'Use for Side ' + (index + 1); use.disabled = busy;
          use.addEventListener('click', () => assign(bed.id, index)); row.append(use);
        }
      }
      results.append(row);
    }
  }
  async function assign(id, index) {
    if (busy) return;
    busy = true; button.disabled = true;
    try {
      await pendingFormUpdate;
      // Read current form data, rather than retaining the snapshot from the scan.
      const configs = JSON.parse(JSON.stringify(await hb.getPluginConfig()));
      if (configs.length > 1) throw new Error('Multiple platform entries');
      const config = configs[0] || { platform: 'BeautyrestLocal', name: 'Beautyrest Local', sides: [] };
      const sides = config.sides || [];
      if (!Array.isArray(sides) || sides.length > 2 || sides[index]?.id || sides.some(side => String(side?.id || '').toLowerCase() === id)) {
        message('That side is already configured. Existing controllers were not replaced.'); return;
      }
      if (index > sides.length) {
        message('Set up Side 1 first, then add Side 2.'); return;
      }
      sides[index] = { ...sides[index], name: sides[index]?.name || (index === 0 ? 'My Side' : 'Other Side'), id };
      config.sides = sides;
      await hb.updatePluginConfig([config]);
      showSettings(config);
      message('Controller added to Side ' + (index + 1) + '. Review its name below, then Save and restart Homebridge.');
    } catch { message('Could not fill the settings. Copy the controller ID into an empty side below.'); }
    finally { busy = false; button.disabled = false; await render().catch(() => message('Refresh the settings to see current assignments.')); }
  }

  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true; button.disabled = true; results.replaceChildren(); message('Listening for controllers…');
    try {
      const found = await hb.request('/discover');
      detected = Array.isArray(found) ? found.filter(bed => /^[0-9a-f]{12}$/.test(bed?.id)) : [];
      message(detected.length ? 'Found ' + detected.length + ' controller(s). Choose a side below.' : 'No controllers found. Check bed Wi-Fi, Homebridge’s network, guest isolation and multicast access. You can still enter IDs manually below.');
    } catch { detected = []; message('Discovery failed. Check network and multicast access, or enter IDs manually below.'); }
    finally { busy = false; button.disabled = false; await render().catch(() => message('Refresh the settings to see current assignments.')); }
  });
  schema = await hb.getPluginConfigSchema();
  const configs = await hb.getPluginConfig();
  if (configs.length > 1) throw new Error('Multiple platform entries');
  showSettings(configs[0] || { platform: 'BeautyrestLocal', name: 'Beautyrest Local', sides: [] });
  await render(); button.disabled = false;
}
window.homebridge.addEventListener('ready', () => initialize().catch(() => {
  document.getElementById('discovery-status').textContent = 'Settings could not load. Close this window and use JSON Config to enter IDs manually.';
}));
