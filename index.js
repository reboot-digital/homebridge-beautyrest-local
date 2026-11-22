'use strict';

const { COMMANDS, send } = require('./bed');

const PLUGIN = 'homebridge-beautyrest-local';
const PLATFORM = 'BeautyrestLocal';

class BeautyrestLocal {
  constructor(log, config, api) {
    this.log = log;
    this.config = config ?? {};
    this.api = api;
    this.cached = new Map();
    this.active = new Set();
    api.on('didFinishLaunching', () => this.registerControls());
  }

  configureAccessory(accessory) {
    this.cached.set(accessory.UUID, accessory);
  }

  registerControls() {
    const { api, config, log } = this;
    const { uuid, Service, Characteristic } = api.hap;
    const sides = Array.isArray(config.sides) ? config.sides : [];
    const ids = sides.map(side => String(side?.id ?? '').toLowerCase());
    if (sides.length < 1 || sides.length > 2 || new Set(ids).size !== sides.length ||
        sides.some((side, index) => !side?.name?.trim?.() || !/^[0-9a-f]{12}$/.test(ids[index]))) {
      log.error('Configure one or two unique Beautyrest controller IDs and side names.');
      return;
    }

    const desired = new Set();
    for (const [index, side] of sides.entries()) {
      const id = ids[index];
      for (const [command, description] of Object.entries(COMMANDS)) {
        const name = side.name.trim() + ' ' + description.name;
        const key = uuid.generate(PLUGIN + ':' + id + ':' + command);
        desired.add(key);

        const cached = this.cached.get(key);
        const accessory = cached ?? new api.platformAccessory(name, key);
        accessory.getService(Service.AccessoryInformation)
          .setCharacteristic(Characteristic.Manufacturer, 'Beautyrest')
          .setCharacteristic(Characteristic.Model, 'Local Adjustable Base')
          .setCharacteristic(Characteristic.SerialNumber, id + '-' + command);

        const service = accessory.getService(Service.Switch) ?? accessory.addService(Service.Switch, name);
        if (cached && accessory.displayName !== name) {
          accessory.displayName = name;
          service.displayName = name;
          service.setCharacteristic(Characteristic.Name, name);
          api.updatePlatformAccessories([accessory]);
        }
        const on = service.getCharacteristic(Characteristic.On);
        on.onGet(() => false);
        on.updateValue(false);
        on.onSet(async value => {
          if (!value) return;
          if (this.active.has(id)) {
            throw new api.hap.HapStatusError(api.hap.HAPStatus.RESOURCE_BUSY);
          }
          this.active.add(id);
          try {
            await send(id, command);
            log.info(name + ' sent to the local bed controller.');
          } catch (error) {
            log.warn(name + ': controller communication failed. Check power, local networking and controller ID.');
            throw new api.hap.HapStatusError(api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
          } finally {
            setTimeout(() => {
              on.updateValue(false);
              this.active.delete(id);
            }, 450).unref();
          }
        });

        if (!cached) api.registerPlatformAccessories(PLUGIN, PLATFORM, [accessory]);
      }
    }

    const stale = [...this.cached.values()].filter(accessory => !desired.has(accessory.UUID));
    if (stale.length) api.unregisterPlatformAccessories(PLUGIN, PLATFORM, stale);
    log.info('Registered ' + desired.size + ' direct controls for ' + sides.length + ' bed sides.');
  }
}

module.exports = api => api.registerPlatform(PLUGIN, PLATFORM, BeautyrestLocal);
