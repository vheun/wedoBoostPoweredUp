# Wedo 2.0, Boost & Power Up

This is a node.js module for the Lego WeDo 2.0 and Lego Boost set.

+ Version 2.1.7 Finally got the Boost connection right
+ Version 2.1.5 Updates to noble and issues with Boost discovery
+ Version 2.1.2 You can now set motor degrees for Boost via ```setMotorDegrees```, absolut degrees via ```setAbsolutMotorDegrees``` and set acceleration profiles.
+ Version 2.0.2 Renamed library. If you used ```wedo2``` before, just change the require from ````wedo2```` to  ```wedoboostpoweredup```.
+ Version 2.0.0 Supports the Lego Boost and other Lego connected Hub devices additionally to the wedo2.
+ Version 1.6.x For compatibility, this version switched dependencies from noble to abandonware/noble.
+ Version 1.5.6 has a new initialization method, to support the name search.
+ Version 1.5.5 has new sensor ranges.
The tilt sensor output is in degree, and the distance sensor is in cm.
+ Version 1.5 has significant changes to 1.1


#### Install

~~~~shell
npm install wedoboostpoweredup
~~~~

#### How to initialize Wedo / Boost / Power Up

Once the wedo2 module is loaded, the module starts searching for devices (Wedo2 and Boost)

~~~~js
var Hub = require('wedoboostpoweredup');
var hub = new Hub();
~~~~

If you want to search for a specific range of devices, you can add parts of their names as argument.
The following example will search for devices that all have "lego" as part of their name.

~~~~js
var Hub = require('wedoboostpoweredup');
var hub = new Hub("lego");
~~~~

#### Additional initialization parameter for Boost only
Boost allows setting the interval time between each sensor reading. It defines how often the Boost hub sends out messages. The default is 5.

~~~~js
var interval = 5;
var Hub = require('wedoboostpoweredup');
var hub = new Hub("lego", interval);
~~~~

#### Events

All events emit the uuid from the device they have been placed from.
The uuid is always the last argument.

If a new device is connected, it emits the "connected" event.

~~~~js
hub.on('connected', function (uuid) {
    console.log('I found a device with uuid: '+uuid);
    // Place getters and setters in here, to make sure that they are called,
    // when the object is connectged
});
~~~~

If a new device is disconnected, it emits the "connected" event.

~~~~js
hub.on('disconnected', function (uuid) {
    console.log('I removed a device with uuid: '+uuid);
});
~~~~

Battery status in %. uuid tells on which device the status was emitted.

~~~~js
hub.on('battery', function (status, uuid) {
    console.log('Battery: ' + status + '% @ '+uuid);
});
~~~~

If a distance sensor is connected, it will send its
distance in the range of 0 and 10 (matching cm-scale) as well the port.

~~~~js
hub.on('distanceSensor', function (distance, port, uuid) {
    console.log('distanceSensor: '+distance+' at port '+port + ' @ '+uuid);
});
~~~~

If a tilt sensor is connected, it will send its
tilt x and y in the range of -45 and 45 as well the port.

~~~~js
hub.on('tiltSensor', function (x,y, port, uuid) {
    console.log('tilt sensor: '+x+'   '+y+' at port '+port +' @ '+uuid);
});
~~~~

If the device button on the controller is clicked, the following event is fired.

~~~~js
hub.on('button', function (button, uuid) {
    console.log('button state: '+button + ' @ '+ uuid );
});
~~~~

Every time a sensor or motor is connected and disconnected, the port event is fired.

~~~~js
hub.on('port', function (port, connected, type, uuid) {
    if(connected){
        console.log('Found '+type+' on port '+port+ ' @ '+ uuid );
    } else {
        console.log('Disconnected '+type+' on port '+port+ ' @ '+ uuid );
    }
});
~~~~

#### Events for Boost & Power Up Only

If the color vision sensor is connected, it will send RGB values representing the color luminance as well as the port.

~~~~js
hub.on('visionSensor', function (colorLuminance, port, uuid) {
    console.log('Red: '+ colorLuminance.r+', Green: '+ colorLuminance.g+', Blue: '+ colorLuminance.b+' at port '+port + ' @ '+uuid);
});
~~~~


If a tacho Motor is connected, it will emit exact rotation angles and rotation counts. The Boost set has two internal ports with two internal tacho Motors.

~~~~js
hub.on('motor', function (motorRotation, port, uuid) {
    console.log('rotation angle: '+ motorRotation.rotationAngle +', rotation count: '+ motorRotation.rotationCount+', absolute degree: '+motorRotation.absoluteDeg+' at port '+port + ' @ '+uuid);
});
~~~~

#### Setters

Without a uuid argument, all setters will set values for the first device found.
If you use more then one device, you can reach the specific device via the uuid argument with the following methods.

<b>uuid</b>: You can hand over the exact uuid of an object.<br>
<b>name</b>: Add the exact name of your device instead of the uuid. If two objects have the same name, the first match will count.<br>
<b>number</b>: Add a number (0,1,2,...) instead of the uuid to set different devices.

Set the name of your device within the device. This name will be saved in your device until you rename it again. In case you use more than one device, this a good place to define names to differentiate specific devices.

~~~~js
hub.setDeviceName(yourName, (optional) uuid);
~~~~

Set the Led color of the device controller to an RGB value.
Each value is on the scale from 0-255.
For example Red, Green Blue all set to 255 is white:

~~~~js
hub.setLedColor(r,g,b, (optional) uuid);
~~~~

Set the motor speed, if a motor is connected.<br>
(Optional) If you want to operate a motor on a specific port,
you can add the port number (1 or 2) after the speed.
Set the port to ```null``` to leave it blank in case you want to set the device.

~~~~js
hub.setMotor(speed, (optionl) port, (optional) uuid);
~~~~

**[boost only]** Set the motor position in degrees with a set speed. If the motor is connected, it will execute the amount of degrees.

~~~~js
wedoBoostPoweredUp.setMotorDegrees(degree, speed, port, uuid, callback);
~~~~

**[boost only]** Set the motor position in degrees with a set speed. If the motor is connected, it will run to the exact position in degrees.

~~~~js
wedoBoostPoweredUp.setAbsolutMotorDegrees(absolutDegree, speed, port, uuid, callback);
~~~~



**[boost only]** Set acceleration (in ms) and deceleration speed (-100 ~ 100). This profile will persist in the boost until changed again.

~~~~js
wedoBoostPoweredUp.setMotorAccelelerationProfile(accelerationTime, decelerationTime, port, uuid);
~~~~


**[wedo only]** Play a sound on the build-in piezo speaker.
The frequency of the sound is in kHz, and the length is in ms.


~~~~js
hub.setSound(frequency, length, (optional) uuid)
~~~~


#### Getters

If you work with more then one device, you have the same uuid choices (nothing, uuid, name, number) as with the setters.        

To get the name of your device.

~~~~js
hub.getDeviceName(function(name, uuid){
    console.log("the device name is "+name+" @ "+uuid);
}, uuid);
~~~~

Get the Signal strength of the device Bluetooth LE.

~~~~js
hub.getSignalStrength(function (err, signal, uuid) {
    console.log('Signal: ' + signal + 'dBm'+ " @ "+uuid);
}, uuid);
~~~~

Get and list all ports that have devices connected.

~~~~js
hub.getPortList(function (portlist, uuid) {
    console.log(JSON.stringify(portlist));
}, uuid);
~~~~

#### Other interesting things

Each device is saved in an object reachable via:

~~~~js
hub.wedoBoostPoweredUp
~~~~

In this object, new devices are saved with their uuid as key for the time that they are connected.
If you know the uuid of your device, you can test its connection like so:

~~~~js
if(hub.wedoBoostPoweredUp[uuid])
~~~~

If you only know the name of the device or just a number in which order it was discovered (the first device will always have the number 0),
then you can obtain the uuid with the following function. If no device uuid has been found, the response will be ```null``

~~~~js
var uuid = hub.getUuidFromInput(input)
~~~~

Once you know that it is connected, you can read all kinds of stuff:

Name

~~~~js
hub.wedoBoostPoweredUp[uuid].name
~~~~

Type of connected items on ports

~~~~js
hub.wedoBoostPoweredUp[uuid].port[1].type
~~~~

And so on.
