# IOT project

This app is based on the [heart rate monitor app](https://github.com/Jaapp-/miband-5-heart-rate-monitor) and expands its capabilities by collecting additional miband parameters such as:

* heart rate
* steps
* distance
* calories
* battery charge

It also supports some actions on the miband:

* make it vibrate
* call on it
* send a sms to it
* send an email to it
* send a notification of a missed call

# Installation
1. You need to find out the auth key
* [Instruction](https://github.com/Freeyourgadget/Gadgetbridge/wiki/Huami-Server-Pairing)
* [The easiest way](https://codeberg.org/argrento/huami-token)

2. Clone project

3. Install dependencies

```console
foo@bar:~$ npm install
```
4. Run application

Run **serve:dist** script *in package.json* file

UPD. The app has been tested in Chrome, it may not work in other browsers

5. Make sure that the miband is not connected to any device via Bluetooth

6. Insert the auth key in the field and press **connect**

7. Wait for the app to see the miband and connect it

8. You are amazing!

