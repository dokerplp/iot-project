import {ADVERTISEMENT_SERVICE, CHAR_UUIDS, UUIDS} from "./constants.js";

function buf2hex(buffer) {
  return Array.prototype.map
    .call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2))
    .join("");
}

function hex2dec(hex) {
  return parseInt(hex, 16);
}

function buf2dec(buf) {
  return hex2dec(buf2hex(buf))
}

function bufReverse(buf) {
  return new Int8Array(buf).reverse();
}

function event(name, value) {
  window.dispatchEvent(
      new CustomEvent(name, {
        detail: value,
      })
  );
}

const concatBuffers = (buffer1, buffer2) => {
  const out = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  out.set(new Uint8Array(buffer1), 0);
  out.set(new Uint8Array(buffer2), buffer1.byteLength);
  return out.buffer;
};

export class MiBand5 {
  /**
   * @param {String} authKey
   *   Hex representation of the auth key (https://github.com/Freeyourgadget/Gadgetbridge/wiki/Huami-Server-Pairing)
   *   Example: '94359d5b8b092e1286a43cfb62ee7923'
   */
  constructor(authKey) {
    if (!authKey.match(/^[a-zA-Z0-9]{32}$/)) {
      throw new Error(
        "Invalid auth key, must be 32 hex characters such as '94359d5b8b092e1286a43cfb62ee7923'"
      );
    }
    this.authKey = authKey;
    this.services = {};
    this.chars = {};
  }

  async init() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          services: [ADVERTISEMENT_SERVICE],
        },
      ],
      optionalServices: [UUIDS.miband2, UUIDS.heartrate, UUIDS.miband1, UUIDS.alert, UUIDS.notifications],
    });

    window.dispatchEvent(new CustomEvent("connected"));
    await device.gatt.disconnect();
    const server = await device.gatt.connect();
    console.log("Connected through gatt");

    this.services.miband1 = await server.getPrimaryService(UUIDS.miband1);
    this.services.miband2 = await server.getPrimaryService(UUIDS.miband2);
    this.services.heartrate = await server.getPrimaryService(UUIDS.heartrate);
    this.services.vibration = await server.getPrimaryService(UUIDS.alert);
    this.services.notification = await server.getPrimaryService(UUIDS.notifications);

    console.log("Services initialized");

    this.chars.auth = await this.services.miband2.getCharacteristic(CHAR_UUIDS.auth);
    this.chars.hrControl = await this.services.heartrate.getCharacteristic(CHAR_UUIDS.heartrate_control);
    this.chars.hrMeasure = await this.services.heartrate.getCharacteristic(CHAR_UUIDS.heartrate_measure);
    this.chars.sensor = await this.services.miband1.getCharacteristic(CHAR_UUIDS.sensor);

    this.chars.battery = await this.services.miband1.getCharacteristic(CHAR_UUIDS.battery);
    this.chars.vibration = await this.services.vibration.getCharacteristic(CHAR_UUIDS.alert);
    this.chars.steps = await this.services.miband1.getCharacteristic(CHAR_UUIDS.steps);
    this.chars.notification = await this.services.notification.getCharacteristic(CHAR_UUIDS.notifications);

    console.log("Characteristics initialized");

    await this.authenticate();
  }

  async authenticate() {
    await this.startNotifications(this.chars.auth, async (e) => {
      const value = e.target.value.buffer;
      const cmd = buf2hex(value.slice(0, 3));
      if (cmd === "100101") {
        console.log("Set new key OK");
      } else if (cmd === "100201") {
        const number = value.slice(3);
        console.log("Received authentication challenge: ", buf2hex(value.slice(3)));
        const key = aesjs.utils.hex.toBytes(this.authKey);
        const aesCbc = new aesjs.ModeOfOperation.cbc(key);
        const out = aesCbc.encrypt(new Uint8Array(number));
        const cmd = concatBuffers(new Uint8Array([3, 0]), out);
        console.log("Sending authentication response");
        await this.chars.auth.writeValue(cmd);
      } else if (cmd === "100301") {
        await this.onAuthenticated();
      } else if (cmd === "100308") {
        console.log("Received authentication failure");
      } else {
        throw new Error(`Unknown callback, cmd='${cmd}'`);
      }
    });
    await this.chars.auth.writeValue(Uint8Array.from([2, 0]));
  }

  async onAuthenticated() {
    console.log("Authentication successful");
    window.dispatchEvent(new CustomEvent("authenticated"));

    await this.measureBattery();
    await this.measureHr();
    await this.measureActivity();
  }

  async measureHr() {
    console.log("Starting heart rate measurement")
    await this.chars.hrControl.writeValue(Uint8Array.from([21, 2, 1]));
    await this.startNotifications(this.chars.hrMeasure, (e) => {
      const heartrate = e.target.value.getInt16();
      console.log("Current heart rate: ", heartrate);
      event("heartrate", heartrate);
    });
  }

  async getBattery() {
    this.chars.battery.readValue()
        .then(data => {
          let power = new Int8Array((data).buffer)[1]
          console.log("Current power: ", power)
          event("power", power);
        })
  }

  async measureBattery() {
    setInterval( () => this.getBattery(), 1000);
  }

  async getActivity() {
    this.chars.steps.readValue()
        .then(data => {
          let buffer = data.buffer;
          let steps = buf2dec(bufReverse(buffer.slice(1, 5)))
          let distance = buf2dec(bufReverse(buffer.slice(5, 9)))
          let calories = buf2dec(bufReverse(buffer.slice(9, 13)))
          console.log("Current steps: ", steps, ", current distance: ", distance, " current calories: ", calories)
          event("steps", steps);
          event("distance", distance);
          event("calories", calories);
        })
  }

  async measureActivity() {
    setInterval(() => this.getActivity(), 1000);
  }

  async vibrate() {
    await this.chars.vibration.writeValue(Uint8Array.from([3]));
  }

  async notification(type, name) {
    let bytes = (new TextEncoder()).encode(name)
    let msg = concatBuffers(new Uint8Array(type), bytes)
    await window.miband.chars.notification.writeValue(msg)
  }

  async startNotifications(char, cb) {
    await char.startNotifications();
    char.addEventListener("characteristicvaluechanged", cb);
  }
}

window.MiBand5 = MiBand5;
