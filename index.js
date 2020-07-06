/**
 *
 * Created by Valentin Heun on 1/10/17.
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 Valentin Heun
 *
 * This Library is build with code fragments from rolling-spider (MIT License) by Jack Watson-Hamblin
 * https://github.com/voodootikigod/node-rolling-spider
 *
 * Thanks to https://lego.github.io for documenting the LEGO Wireless Protocol
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 *
 */

//  Motor Setter

var noble = require('@abandonware/noble');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var framerate = 5;

/**
 * Constructors for Objects
 */

function Device() {
    this.name = "";
    this.uuid = "";
    this.isConnected = false;
    this.port = {};
    this.deviceType = "";
}

function Port() {
    this.byte = null;
    this.connected = 0;
    this.type = "none";
    this.runMotor = null;
    this.motorResult = 127;
    this.newMotor = 127;
    this.oldMotor = 127;
    this.motorDegree = null;
    this.newMotorDegree = null;
    this.oldMotorDegree = null;
    this.absolutDegree = false;
    this.callback = null;

}

/**
 * Constructs a new Wedo 2.0, Boost or PoweredUp
 * @constructor
 */

var WedoBoostPoweredUp = function (nameSpace, interval) {
    framerate = (typeof interval !== 'undefined') ? interval : framerate

    this.battery = "180f";
    this.button = "1526";
    this.portType = "1527";
    this.lowVoltageAlert = "1528";
    this.highCurrentAlert = "1529";
    this.lowSignalAlert = "152a";
    this.sensorValue = "1560";
    this.valueformat = "1561";
    this.nameID = "1524";
    this.poweredUpHub = "1624"

    this.wedoBoostPoweredUp = {};

    // backward compatibility
    this.wedo = this.wedoBoostPoweredUp;

    this.ble = noble;

    this.connect(nameSpace);

    // handle disconnect gracefully
    this.ble.on('warning', function (message) {
        this.onDisconnect();
    }.bind(this));

    process.on('exit', function (e) {
        this.disconnect();
        console.log(e);
        process.exit();
    }.bind(this));

    process.on('uncaughtException', function (e) {
        this.disconnect();
        console.log("uncaughtException");
        console.log(e);
        process.exit();
    }.bind(this));

    process.on('SIGINT', function (e) {
        this.disconnect();
        console.log(e);
        process.exit();
    }.bind(this));

};


util.inherits(WedoBoostPoweredUp, EventEmitter);

/**
 * Connects to the WeDo 2.0, Boost or PoweredUp controller over BLE
 *
 * @param callback to be called once connected
 * @todo Make the callback be called with an error if encountered
 */
WedoBoostPoweredUp.prototype.connect = function (nameSpace, callback) {
    this.cout('Device Connect');
    this.ble.on('discover', function (nameSpace, peripheral) {
        let device = this.isWedoBoostPoweredUpPeripheral(nameSpace, peripheral);
        if ((device && peripheral.address && peripheral.address !== "00-00-00-00-00-00")) {
            if (!this.wedoBoostPoweredUp[peripheral.uuid]) {
                this.wedoBoostPoweredUp[peripheral.uuid] = new Device();
                this.wedoBoostPoweredUp[peripheral.uuid].deviceType = device;
                this.wedoBoostPoweredUp[peripheral.uuid].uuid = peripheral.uuid;
                this.wedoBoostPoweredUp[peripheral.uuid].peripheral = peripheral;
                this.connectPeripheral(peripheral.uuid, function (uuid) {
                    this.emit('connected', uuid);
                }.bind(this, peripheral.uuid));
            }
        }
    }.bind(this, nameSpace));

    if (this.ble.state === 'poweredOn') {
        this.cout('Device.forceConnect');
        this.ble.startScanning(null, true);
    } else {
        this.cout('Device.on(stateChange)');
        this.ble.on('stateChange', function (state) {
            if (state === 'poweredOn') {
                this.cout('device is poweredOn');
                this.ble.startScanning(null, true);
            } else {
                this.cout('stateChange == ' + state);
                this.ble.stopScanning();
                if (typeof callback === 'function') {
                    callback(new Error('Error with Bluetooth Adapter, please retry'));
                }
            }
        }.bind(this));
    }
};

/**
 * WedoBoostPoweredUp.isWedoBoostPoweredUpPeripheral
 *
 * Accepts a BLE peripheral object record and returns true|false
 * if that record represents a WeDo 2.0, Boost or PoweredUp Controller or not.
 *
 * @param  {Object}  peripheral A BLE peripheral record
 * @return {Boolean}
 */
WedoBoostPoweredUp.prototype.isWedoBoostPoweredUpPeripheral = function (nameSpace, peripheral) {
    if (!peripheral) {
        return false;
    }
    let deviceType = null;
    var localName = peripheral.advertisement.localName;
    var manufacturer = peripheral.advertisement.serviceUuids;

    var weDoServiceID = "000015231212efde1523785feabcd123";
    var poweredUpServiceID = "000016231212efde1623785feabcd123";
    var name = "LPF2 Hub I/O";

    var localNameMatch = localName && localName.indexOf(name) === 0;
    var manufacturerMatchWedo = manufacturer && manufacturer.indexOf(weDoServiceID) === 0;
    var manufacturerMatchBoost = manufacturer && manufacturer.indexOf(poweredUpServiceID) === 0;

    // look for a specific string in the name
    if (nameSpace) {
        manufacturerMatchWedo = false;
        manufacturerMatchBoost = false;
        localNameMatch = localName && localName.indexOf(nameSpace) !== -1;
    }

    if (manufacturerMatchWedo) {
        deviceType = "wedo"
    } else if (manufacturerMatchBoost) {
        deviceType = "poweredUp"
    }

    if (localNameMatch || deviceType) {
        return deviceType;
    } else {
        return null;
    }
};

/**
 * Sets up the connection to the WeDo 2.0, Boost or PoweredUp controller and enumerate all of the services and characteristics.
 *
 *
 * @param callback to be called once set up
 * @private
 */
WedoBoostPoweredUp.prototype.setup = function (uuid, callback) {
    this.cout('Connected to: ' + this.wedoBoostPoweredUp[uuid].peripheral.advertisement.localName);

    this.cout('Starting Setup for ' + uuid);
    this.wedoBoostPoweredUp[uuid].peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {
        if (error) {
            if (typeof callback === 'function') {
                console.log("error");
                callback(error);
            }
        } else {
            this.wedoBoostPoweredUp[uuid].services = services;
            this.wedoBoostPoweredUp[uuid].characteristics = characteristics;

            if (this.wedoBoostPoweredUp[uuid].deviceType === "poweredUp") {
                // activate Button
                this.writeTo(uuid, "1624", Buffer([0x05, 0x00, 0x01, 0x02, 0x02]), function () {
                });

                setTimeout(function () {
                    this.writeTo(uuid, "1624", Buffer([0x05, 0x00, 0x01, 0x06, 0x02]), function () {
                        console.log("activated Battery");
                    });

                    /*this.writeTo(uuid, "1624", Buffer([0x05,0x00,0x01,0x05,0x02]), function () {
                        console.log("activated Signal Strength");
                    });*/

                }.bind(this), 500);


            }
            this.handshake(uuid, callback, this.wedoBoostPoweredUp[uuid].deviceType);
        }
    }.bind(this));
};

WedoBoostPoweredUp.prototype.connectPeripheral = function (uuid, callback) {
    this.discovered = true;
    this.uuid = this.wedoBoostPoweredUp[uuid].peripheral.uuid;
    this.name = this.wedoBoostPoweredUp[uuid].peripheral.advertisement.localName;
    this.wedoBoostPoweredUp[uuid].peripheral.connect(
        function (uuid) {
            this.wedoBoostPoweredUp[uuid].name = this.wedoBoostPoweredUp[uuid].peripheral.advertisement.localName;
            if (this.wedoBoostPoweredUp[uuid].deviceType === "wedo")
                console.log('Found the following Lego Wedo 2.0: ' + this.wedoBoostPoweredUp[uuid].peripheral.advertisement.localName + ' with UUID ' + uuid);
            if (this.wedoBoostPoweredUp[uuid].deviceType === "poweredUp") {
                this.wedoBoostPoweredUp[uuid].name = this.wedoBoostPoweredUp[uuid].peripheral.advertisement.localName;
                this.cout('Found the following Lego Move Hub: ' + this.wedoBoostPoweredUp[uuid].name + ' with UUID ' + uuid);
            }
            this.setup(uuid, callback)
        }.bind(this, uuid));
    this.wedoBoostPoweredUp[uuid].peripheral.once('disconnect', function (uuid) {
        console.log("disconnect");
        this.onDisconnect(uuid);
    }.bind(this, uuid));
};

WedoBoostPoweredUp.prototype.onDisconnect = function (uuid) {

    if (this.wedoBoostPoweredUp[uuid]) {
        this.wedoBoostPoweredUp[uuid].peripheral.disconnect();
        this.wedoBoostPoweredUp[uuid].peripheral = {};
        this.cout('Disconnected from device: ' + this.wedoBoostPoweredUp[uuid].name);
        delete this.wedoBoostPoweredUp[uuid];

        this.emit('disconnected', uuid);
    }
};

/**
 * Performs necessary handshake to initiate communication with the device. Also configures all notification handlers.
 *
 *
 * @param callback to be called once set up
 * @private
 */
WedoBoostPoweredUp.prototype.handshake = function (uuid, callback, deviceType) {
    this.cout('device initialisation');

    var listOfNotificationCharacteristics = [];

    if (deviceType === "wedo") {
        listOfNotificationCharacteristics = [this.battery, this.button,
            this.portType, this.lowVoltageAlert,
            this.highCurrentAlert, this.lowSignalAlert,
            this.sensorValue, this.valueformat, this.poweredUpHub];
    } else if (deviceType === "poweredUp") {
        listOfNotificationCharacteristics = [this.poweredUpHub];
    }

    listOfNotificationCharacteristics.forEach(function (key) {
        var characteristic = this.getCharacteristic(uuid, key);
        if (characteristic) {
            characteristic.notify(true);
        }


    }.bind(this));


    let thisDeviceType = this.wedoBoostPoweredUp[uuid].deviceType;
    if (thisDeviceType === "wedo") {
        // set LED lights to rgb values
        this.writePortDefinition(uuid, 0x06, 0x17, 0x01, 0x02, function () {
            //console.log("have set RGB for LED");
        }.bind(this));
    } else if (thisDeviceType === "poweredUp") {
        // set LED lights to rgb values
        /*this.writePortDefinitionToBoost(uuid, 0x08,  0x01,framerate, function () {
                console.log("have set RGB for LED");
            }.bind(this));*/
    }
    ;


    if (thisDeviceType === "poweredUp") {
        this.getCharacteristic(uuid, this.poweredUpHub).on('data', function (uuid, data, isNotification) {
            let messageType = data[2];
            let portID = data[3];
            let isPortConnected = data[4];
            let connectedDevice = data[5];
            if (portID === 59 || portID === 60 || portID === 57 || portID === 6) return;

            if (!this.wedoBoostPoweredUp[uuid].port.hasOwnProperty("" + portID)) {
                this.wedoBoostPoweredUp[uuid].port["" + portID] = new Port();
            }
            this.wedoBoostPoweredUp[uuid].port[portID].byte = portID;
            let thisPort = this.wedoBoostPoweredUp[uuid].port["" + portID];

            /*if (connectedDevice === 0x25) {
                console.log(data);}*/

            //check for Ports signal
            if (messageType === 0x04) {
                if (thisPort.byte === 57) return;
                thisPort.connected = isPortConnected;
                if (isPortConnected) {

                    if (connectedDevice === 0x22 || connectedDevice === 0x28) {
                        thisPort.type = "tiltSensor";
                        this.writePortDefinitionToBoost(uuid, thisPort.byte, 0x00, framerate, function () {
                            console.log("activated tilt sensor on port " + thisPort.byte + " @ " + uuid);
                        });
                    } else if (connectedDevice === 0x23) {
                        thisPort.type = "distanceSensor";
                        this.writePortDefinitionToBoost(uuid, thisPort.byte, 0x02, framerate, function () {
                            console.log("activated distanceSensor on port " + thisPort.byte + " @ " + uuid);
                        });
                    } else if (connectedDevice === 0x25) {
                        thisPort.type = "visionSensor";
                        this.writePortDefinitionToBoost(uuid, thisPort.byte, 0x06, framerate, function () {
                            console.log("activated vision sensor on port " + thisPort.byte + " @ " + uuid);
                        });
                    } else if (connectedDevice === 0x01) {
                        thisPort.type = "motor";
                        //	0x02, 0x00
                        this.writePortDefinitionToBoost(uuid, thisPort.byte, 0x07, framerate, function () {
                            console.log("activated motor on port " + thisPort.byte + " @ " + uuid);
                        });
                    } else if (connectedDevice === 0x17) {
                        thisPort.type = "LEDLight";
                        //--------------!
                        this.writePortDefinitionToBoost(uuid, thisPort.byte, 0x01, framerate, function () {
                            console.log("activated LED Light on port " + thisPort.byte + " @ " + uuid);
                        });
                    } else if (connectedDevice === 0x05) {
                        thisPort.type = "Button";
                        console.log("--------------------------  found Button");

                        /*this.writePortDefinitionToBoost(uuid,thisPort.byte, 0x05, framerate, function () {
                            console.log("activated Button on port " + thisPort.byte + " @ " + uuid);
                        });*/
                    } else if (connectedDevice === 0x26 || connectedDevice === 0x27) {
                        thisPort.type = "motor";
                        this.writePortDefinitionToBoost(uuid, thisPort.byte, 0x02, framerate, function () {
                            //this.writeTo(uuid, this.poweredUpHub, Buffer([0x0A, 0x00, 0x81, 0x32, 0x11, 0x51, 0x01, R, G, B]), function () {
                            console.log("activated tacho Motor on port " + thisPort.byte + " @ " + uuid);
                        }.bind(this, uuid));
                    }


                    if (thisPort.type !== "none") {
                        this.emit('port', thisPort.byte, true, thisPort.type, uuid);
                    }
                } else {

                    if (thisPort.type !== "none") {

                        console.log("deactivated" + thisPort.type + " on port " + data[3] + " @ " + uuid);

                        thisPort.motorResult = 127;
                        thisPort.newMotor = 127;
                        thisPort.oldMotor = 127;
                        thisPort.type = "none";
                        this.emit('port', thisPort.byte, false, thisPort.type, uuid);
                    }

                }
            } else if (messageType === 0x45) {
                if (!this.wedoBoostPoweredUp[uuid].port[thisPort.byte]) return;

                if (thisPort.byte === 57) return;
                if (this.wedoBoostPoweredUp[uuid].port[thisPort.byte].type === "tiltSensor") {
                    this.wedoBoostPoweredUp[uuid].sensorReadingX = data[4];
                    if (this.wedoBoostPoweredUp[uuid].sensorReadingX > 100) {
                        this.wedoBoostPoweredUp[uuid].sensorReadingX = -(255 - this.wedoBoostPoweredUp[uuid].sensorReadingX);
                    }
                    this.wedoBoostPoweredUp[uuid].sensorReadingY = data[5];
                    if (this.wedoBoostPoweredUp[uuid].sensorReadingY > 100) {
                        this.wedoBoostPoweredUp[uuid].sensorReadingY = -(255 - this.wedoBoostPoweredUp[uuid].sensorReadingY);
                    }
                    this.emit('tiltSensor', this.wedoBoostPoweredUp[uuid].sensorReadingX, this.wedoBoostPoweredUp[uuid].sensorReadingY, thisPort.byte, uuid);
                } else if (this.wedoBoostPoweredUp[uuid].port[thisPort.byte].type === "distanceSensor") {
                    //console.log(data);
                    this.wedoBoostPoweredUp[uuid].distanceValue = data[6];

                    /*if (data[5] === 1) {
                        this.wedoBoostPoweredUp[uuid].distanceValue = 0;
                    }*/

                    this.emit('distanceSensor', this.wedoBoostPoweredUp[uuid].distanceValue, thisPort.byte, uuid);

                } else if (this.wedoBoostPoweredUp[uuid].port[thisPort.byte].type === "visionSensor") {
                    this.wedoBoostPoweredUp[uuid].colorLuminanceValue = {r: data[4], g: data[6], b: data[8]};
                    this.emit('visionSensor', this.wedoBoostPoweredUp[uuid].colorLuminanceValue, thisPort.byte, uuid);
                } else if (this.wedoBoostPoweredUp[uuid].port[thisPort.byte].type === "motor") {
                    //console.log(thisPort.byte, this.wedoBoostPoweredUp[uuid].port[thisPort.byte].type ,  data);

                    let absoluteDegree = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
                    let fullRotation = absoluteDegree % 360;
                    let rotationCount = ~~(absoluteDegree / 360);
                    this.wedoBoostPoweredUp[uuid].port[thisPort.byte].motorRotation = {
                        rotationAngle: fullRotation,
                        rotationCount: rotationCount,
                        absoluteDeg: absoluteDegree
                    }
                    this.emit('motor', this.wedoBoostPoweredUp[uuid].port[thisPort.byte].motorRotation, thisPort.byte, uuid);
                } else {

                }


            } else if (messageType === 0x82) {
                if (data[4] === 0x0a) {
                    if (this.wedoBoostPoweredUp[uuid].port[thisPort.byte].type === "motor") {
                        if (typeof (this.wedoBoostPoweredUp[uuid].port[thisPort.byte].callback) === "function") {
                            this.wedoBoostPoweredUp[uuid].port[thisPort.byte].callback();
                            this.wedoBoostPoweredUp[uuid].port[thisPort.byte].callback = null;
                        }
                    }
                }
            } else if (messageType === 0x01 && data [3] === 0x02 && data[4] === 0x06) {
                this.emit('button', data[data.length - 1], uuid);
            } else if (messageType === 0x01 && data [3] === 0x06 && data[4] === 0x06) {
                this.emit('battery', data[data.length - 1], uuid);
            }
            if (this.wedoBoostPoweredUp[uuid].port[thisPort.byte].type === "none") {
                delete this.wedoBoostPoweredUp[uuid].port[thisPort.byte];
            }

        }.bind(this, uuid));

        this.pingMotor(uuid);
        callback(uuid);

    } else if (thisDeviceType === "wedo") {

        this.getCharacteristic(uuid, this.portType).on('data', function (uuid, data, isNotification) {

            let portID = data[0];
            let isPortConnected = data[1];
            let connectedDevice = data[3];
            if (!(portID === 2 || portID === 1)) return;

            if (!this.wedoBoostPoweredUp[uuid].port.hasOwnProperty("" + portID)) {
                this.wedoBoostPoweredUp[uuid].port["" + portID] = new Port();
            }
            this.wedoBoostPoweredUp[uuid].port[portID].byte = portID;
            let thisPort = this.wedoBoostPoweredUp[uuid].port["" + portID];

            //console.log(uuid, arguments);
            //if (!isNotification) {return;}
            if (portID === 1 || portID === 2) {
                thisPort.connected = isPortConnected;

                if (isPortConnected) {
                    if (connectedDevice === 34) {
                        thisPort.type = "tiltSensor";
                        this.writePortDefinition(uuid, thisPort.byte, connectedDevice, 0x00, 0x00, function () {
                            console.log("activated tilt sensor on port " + thisPort.byte + " @ " + uuid);
                        });
                    } else if (connectedDevice === 35) {
                        thisPort.type = "distanceSensor";
                        this.writePortDefinition(uuid, thisPort.byte, connectedDevice, 0x00, 0x00, function () {
                            console.log("activated distanceSensor on port " + thisPort.byte + " @ " + uuid);
                        });
                    } else if (connectedDevice === 1) {
                        thisPort.type = "motor";
                        this.writePortDefinition(uuid, thisPort.byte, connectedDevice, 0x02, 0x00, function () {
                            console.log("activated motor on port " + thisPort.byte + " @ " + uuid);
                        });
                    }
                    if (connectedDevice === 37) {
                        thisPort.type = "distanceSensor";
                        this.writePortDefinition(uuid, thisPort.byte, connectedDevice, 0x01, 0x00, function () {
                            console.log("activated [boost] distance Sensor on port " + thisPort.byte + " @ " + uuid);
                        });
                    }

                    this.emit('port', thisPort.byte, true, thisPort.type, uuid);
                } else {
                    if (thisPort.type !== "none") {
                        console.log("deactivated " + thisPort.type + " on port " + thisPort.byte + " @ " + uuid);

                        thisPort.motorResult = 127;
                        thisPort.newMotor = 127;
                        thisPort.oldMotor = 127;
                        thisPort.type = "none";
                        delete this.wedoBoostPoweredUp[uuid].port["" + portID];
                        this.emit('port', thisPort.byte, false, thisPort.type, uuid);

                    }


                }
            }

        }.bind(this, uuid));


        this.getCharacteristic(uuid, this.sensorValue).on('data', function (uuid, data, isNotification) {

            let portID = data[1];
            if (!(portID === 2 || portID === 1)) return;
            if (!this.wedoBoostPoweredUp[uuid].port.hasOwnProperty("" + portID)) {
                this.wedoBoostPoweredUp[uuid].port["" + portID] = new Port();
            }
            this.wedoBoostPoweredUp[uuid].port[portID].byte = portID;
            let thisPort = this.wedoBoostPoweredUp[uuid].port["" + portID];


            if (portID) {
                if (this.wedoBoostPoweredUp[uuid].port["" + portID].type === "tiltSensor") {
                    this.wedoBoostPoweredUp[uuid].sensorReadingX = data[2];
                    if (this.wedoBoostPoweredUp[uuid].sensorReadingX > 100) {
                        this.wedoBoostPoweredUp[uuid].sensorReadingX = -(255 - this.wedoBoostPoweredUp[uuid].sensorReadingX);
                    }
                    this.wedoBoostPoweredUp[uuid].sensorReadingY = data[3];
                    if (this.wedoBoostPoweredUp[uuid].sensorReadingY > 100) {
                        this.wedoBoostPoweredUp[uuid].sensorReadingY = -(255 - this.wedoBoostPoweredUp[uuid].sensorReadingY);
                    }

                    this.emit('tiltSensor', this.wedoBoostPoweredUp[uuid].sensorReadingX, this.wedoBoostPoweredUp[uuid].sensorReadingY, thisPort.byte, uuid);
                } else if (this.wedoBoostPoweredUp[uuid].port["" + portID].type === "distanceSensor") {

                    this.wedoBoostPoweredUp[uuid].distanceValue = data[2];

                    if (data[3] === 1) {
                        this.wedoBoostPoweredUp[uuid].distanceValue = data[2] + 255;
                    }

                    this.emit('distanceSensor', this.wedoBoostPoweredUp[uuid].distanceValue, thisPort.byte, uuid);
                }
            }

        }.bind(this, uuid));

        this.getCharacteristic(uuid, this.valueformat).on('data', function (uuid, data, isNotification) {
            //if (!isNotification) {return;}
            //  console.log("valueformat");
        }.bind(this, uuid));

        // todo check which one is the battery
        // Register listener for battery notifications.
        this.getCharacteristic(uuid, this.battery).on('data', function (uuid, data, isNotification) {
            //if (!isNotification) {return;}

            this.emit('battery', data[data.length - 1], uuid);

        }.bind(this, uuid));

        this.getCharacteristic(uuid, this.button).on('data', function (uuid, data, isNotification) {
            //if (!isNotification) {return;}

            this.emit('button', data[data.length - 1], uuid);

        }.bind(this, uuid));

        this.pingMotor(uuid);
        callback(uuid);
    }
};

/**
 * Gets a Characteristic by it's unique_uuid_segment
 *
 * @param {String} unique_uuid_segment
 * @returns Characteristic
 */
WedoBoostPoweredUp.prototype.writePortDefinition = function (uuid, port, type, mode, format, callback) {
    this.writeTo(uuid, "1563", Buffer([0x01, 0x02, port, type, mode, 0x01, 0x00, 0x00, 0x00, format, 0x01]), function () {
        callback();
    });
};
WedoBoostPoweredUp.prototype.writePortDefinitionToBoost = function (uuid, port, mode, thisFrameRate, callback) {
    let frameRateArray = this.numberTo4ByteArray(thisFrameRate);
    this.writeTo(uuid, "1624", Buffer([0x0a, 0x00, 0x41, port, mode, frameRateArray[0], frameRateArray[1], frameRateArray[2], frameRateArray[3], 0x01]), function () {
        callback();
    });
};

WedoBoostPoweredUp.prototype.getCharacteristic = function (uuid, unique_uuid_segment) {
    if (!uuid) return null;
    //console.log("--1");
    if (!this.wedoBoostPoweredUp[uuid]) return null;
    //console.log("--2");
    if (!this.wedoBoostPoweredUp[uuid].characteristics) return null;
    //console.log("--3");
    var filtered = this.wedoBoostPoweredUp[uuid].characteristics.filter(function (c) {
        return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
    });
    //console.log("--4");
    if (!filtered[0]) {
        filtered = this.wedoBoostPoweredUp[uuid].characteristics.filter(function (c) {
            return c._serviceUuid.search(new RegExp(unique_uuid_segment)) !== -1;
        });
    }

    if (filtered[0])
        return filtered[0];
    else return null;

};

WedoBoostPoweredUp.prototype.numberTo4ByteArray = function (number) {
    let bytes = new Array(4)
    for (var i = 0; i < bytes.length; i++) {
        var byte = number & 0xff;
        bytes[i] = byte;
        number = (number - byte) / 256;
    }
    return bytes;
};

/**
 * Writes a Buffer to a Characteristic by it's unique_uuid_segment
 *
 * @param {String} unique_uuid_segment
 * @param {Buffer} buffer
 */
WedoBoostPoweredUp.prototype.writeTo = function (uuid, unique_uuid_segment, buffer, callback) {
    if (!this.wedoBoostPoweredUp[uuid].characteristics) {
        var e = new Error('You must have bluetooth enabled and be connected to a WeDo 2.0, Boost or PowerUp Device before executing a command. Please ensure Bluetooth is enabled on your machine and you are connected.');
        if (callback) {
            callback(e);
        } else {
            throw e;
        }
    } else {
        if (typeof callback === 'function') {
            this.getCharacteristic(uuid, unique_uuid_segment).write(buffer, true, callback);
        } else {
            this.getCharacteristic(uuid, unique_uuid_segment).write(buffer, true);
        }
    }
};

/**
 * 'Disconnects' from the WeDo 2.0, Boost or PoweredUp
 *
 * @param callback to be called once disconnected
 */
WedoBoostPoweredUp.prototype.disconnect = function () {
    this.cout('WeDo 2.0, Boost or PoweredUp controller is disconnected');

    for (var uuid in this.wedoBoostPoweredUp) {
        this.onDisconnect(uuid);
    }
};

/**
 * Obtains the signal strength of the connected WeDo 2.0, Boost or PoweredUp as a dBm metric.
 *
 * @param callback to be called once the signal strength has been identified
 */
WedoBoostPoweredUp.prototype.getSignalStrength = function (callback, uuid) {
    uuid = this.getUuidFromInput(uuid);
    if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
        this.wedoBoostPoweredUp[uuid].peripheral.updateRssi(function (err, db) {
            callback(err, db, uuid);
        });
    }
};


WedoBoostPoweredUp.prototype.getDeviceName = function (callback, uuid) {

    uuid = this.getUuidFromInput(uuid);
    if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
        if (this.wedoBoostPoweredUp[uuid].deviceType === "wedo") {
            this.getCharacteristic(uuid, this.nameID).read(function (e, b) {
                this(b.toString(), uuid);
            }.bind(callback), uuid);
        } else if (this.wedoBoostPoweredUp[uuid].deviceType === "poweredUp") {

            callback(this.wedoBoostPoweredUp[uuid].name, uuid);
        }
    } else {
        console.log("not found");
    }
};

WedoBoostPoweredUp.prototype.setDeviceName = function (name, uuid) {
    uuid = this.getUuidFromInput(uuid);
    let thisDeviceType = this.wedoBoostPoweredUp[uuid].deviceType;

    if (thisDeviceType === "wedo") {
        if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
            this.writeTo(uuid, this.nameID, Buffer(name), function () {
            });
        }
    } else if (thisDeviceType === "poweredUp") {
        setTimeout(function (name, uuid) {
            let size = Buffer(name).length + 5;
            let sendMessage = [this.numberTo4ByteArray(size)[0], 0x00, 0x01, 0x01, 0x01]
            let bufferFromName = Buffer.from(name);

            bufferFromName.forEach(function (item, index) {
                sendMessage.push(item);
            });

            this.writeTo(uuid, this.poweredUpHub, Buffer.from(sendMessage), function () {
                //	console.log(this.wedoBoostPoweredUp[uuid].peripheral.advertisement.localName);
            });
        }.bind(this, name, uuid), 500);
    }
    if (this.wedoBoostPoweredUp[uuid].name !== name) {
        this.wedoBoostPoweredUp[uuid].name = name;
    }
};

WedoBoostPoweredUp.prototype.setLedColor = function (R, G, B, uuid) {
    uuid = this.getUuidFromInput(uuid);
    let port = 0x32;

    let thisDeviceType = this.wedoBoostPoweredUp[uuid].deviceType;

    if (thisDeviceType === "wedo") {
        if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
            this.writeTo(uuid, "1565", Buffer([0x06, 0x04, 0x03, R, G, B]), function () {
            });
        }
    } else if (thisDeviceType === "poweredUp") {
        if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
            console.log("setRGB LED");
            // -------!
            this.writeTo(uuid, this.poweredUpHub, Buffer([0x0A, 0x00, 0x81, 0x32, 0x11, 0x51, 0x01, R, G, B]), function () {
            });
        }
    }


};

WedoBoostPoweredUp.prototype.setSound = function (frequency, length, uuid) {
    uuid = this.getUuidFromInput(uuid);
    if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
        if (this.wedoBoostPoweredUp[uuid].deviceType === "poweredUp") return;
        this.writeTo(uuid, "1565", Buffer([0x05, 0x02, 0x04,
            this.longToByteArray(frequency)[0], this.longToByteArray(frequency)[1],
            this.longToByteArray(length)[0], this.longToByteArray(length)[1]]), function () {
        });
    }
};


WedoBoostPoweredUp.prototype.longToByteArray = function (integer) {
    // we want to represent the input as a 8-bytes array
    var byteArray = [0, 0];

    for (var index = 0; index < byteArray.length; index++) {
        var byte = integer & 0xff;
        byteArray [index] = byte;
        integer = (integer - byte) / 256;
    }
    return byteArray;
};

WedoBoostPoweredUp.prototype.setMotor = function (speed, port, uuid) {
    uuid = this.getUuidFromInput(uuid);
    if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
        if (typeof port === "undefined") {
            port = null;
        }

        let thisMotor = this.wedoBoostPoweredUp[uuid].port[port];

        if (!thisMotor) return;
        thisMotor.runMotor = null;
        if (port !== null) {
            if (thisMotor.type === "motor") {
                //this.wedoBoostPoweredUp[uuid].runMotor = port;
                thisMotor.runMotor = port;
            }
        }

        if (thisMotor.motorDegree !== null) {
            // Set motor into the degree mode!
            if (port === null) return;
            if (this.wedoBoostPoweredUp[uuid].deviceType === "wedo") return;
            this.writePortDefinitionToBoost(uuid, port, 0x02, framerate, function () {
                //this.writeTo(uuid, this.poweredUpHub, Buffer([0x0A, 0x00, 0x81, 0x32, 0x11, 0x51, 0x01, R, G, B]), function () {
                console.log("activated tacho Motor in degree mode on port " + port.byte + " @ " + uuid);
            }.bind(this, uuid));

            // define that this motor is not angle
            thisMotor.motorDegree = null;
            thisMotor.newMotorDegree = null;
            thisMotor.oldMotorDegree = null;

        }


        if (thisMotor.runMotor !== null) {
            if (speed > 1 && speed <= 100) {
                thisMotor.motorResult = parseInt(this.map(speed, 1, 100, 15, 97));
            } else if (speed < -1 && speed >= -100) {
                thisMotor.motorResult = parseInt(this.map(speed, -100, -1, 160, 245));
            } else {
                thisMotor.motorResult = 0;
            }
        }
        //console.log(thisMotor);
    }
};


WedoBoostPoweredUp.prototype.setMotorDegrees = function (degree, speed, port, uuid, callback) {
    uuid = this.getUuidFromInput(uuid);
    if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
        if (typeof port === "undefined") {
            port = null;
        }
        if (!this.wedoBoostPoweredUp[uuid].port[port]) return;

        let thisMotor = this.wedoBoostPoweredUp[uuid].port[port];
        thisMotor.absolutDegree = false;
        if (!thisMotor) return;
        thisMotor.runMotor = null;
        if (port !== null) {
            if (thisMotor.type === "motor") {
                //this.wedoBoostPoweredUp[uuid].runMotor = port;
                thisMotor.runMotor = port;
            }
        }

        if (thisMotor.motorDegree === null) {
            // Set motor into the degree mode!
            if (port === null) return;
            if (this.wedoBoostPoweredUp[uuid].deviceType === "wedo") return;
            this.writePortDefinitionToBoost(uuid, port, 0x0B, framerate, function () {
                //this.writeTo(uuid, this.poweredUpHub, Buffer([0x0A, 0x00, 0x81, 0x32, 0x11, 0x51, 0x01, R, G, B]), function () {
                console.log("activated tacho Motor in degree mode on port " + port.byte + " @ " + uuid);
            }.bind(this, uuid));

        }

        if (thisMotor.runMotor !== null) {
            thisMotor.motorDegree = degree;
            thisMotor.motorResult = speed;
            if (typeof (callback) === "function") {
                thisMotor.callback = callback;
            }
        }
        //console.log(thisMotor);
    }
};

WedoBoostPoweredUp.prototype.setAbsolutMotorDegrees = function (absolutDegree, speed, port, uuid, callback) {
    uuid = this.getUuidFromInput(uuid);
    if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
        if (typeof port === "undefined") {
            port = null;
        }

        let thisMotor = this.wedoBoostPoweredUp[uuid].port[port];
        thisMotor.absolutDegree = true;
        if (!thisMotor) return;
        thisMotor.runMotor = null;
        if (port !== null) {
            if (thisMotor.type === "motor") {
                //this.wedoBoostPoweredUp[uuid].runMotor = port;
                thisMotor.runMotor = port;
            }
        }

        if (thisMotor.motorDegree === null) {
            // Set motor into the degree mode!
            if (port === null) return;
            if (this.wedoBoostPoweredUp[uuid].deviceType === "wedo") return;
            this.writePortDefinitionToBoost(uuid, port, 0x0D, framerate, function () {
                //this.writeTo(uuid, this.poweredUpHub, Buffer([0x0A, 0x00, 0x81, 0x32, 0x11, 0x51, 0x01, R, G, B]), function () {
                console.log("activated tacho Motor in degree mode on port " + port.byte + " @ " + uuid);
            }.bind(this, uuid));

        }

        if (thisMotor.runMotor !== null) {
            thisMotor.motorDegree = absolutDegree;
            thisMotor.motorResult = speed;
            if (typeof (callback) === "function") {
                thisMotor.callback = callback;
            }
        }
        //console.log(thisMotor);
    }
};


WedoBoostPoweredUp.prototype.setMotorAccelelerationProfile = function (acctime, dectime, port, uuid) {
    if (this.wedoBoostPoweredUp[uuid].deviceType === "wedo") return;
    let acctimeArray = this.numberTo4ByteArray(acctime);
    let dectimeArray = this.numberTo4ByteArray(dectime);
    console.log(acctimeArray)
    console.log(dectimeArray)
    this.writeTo(uuid, this.poweredUpHub, Buffer([0x08, 0x00, 0x81, port, 0x10, 0x05, acctimeArray[0], acctimeArray[1], 0x01]), function () {
    });
    this.writeTo(uuid, this.poweredUpHub, Buffer([0x08, 0x00, 0x81, port, 0x10, 0x06, dectimeArray[0], dectimeArray[1], 0x01]), function () {
    });


};

WedoBoostPoweredUp.prototype.pingMotor = function (uuid) {
    var self = this;

    setInterval(function (uuid) {
        if (this.wedoBoostPoweredUp[uuid]) {
            if (this.wedoBoostPoweredUp[uuid].runMotor !== null) {
                if (this.wedoBoostPoweredUp[uuid] && this.wedoBoostPoweredUp[uuid].characteristics) {

                    let motorCount = 0;
                    for (let key in this.wedoBoostPoweredUp[uuid].port) {
                        if (this.wedoBoostPoweredUp[uuid].port[key].type === "motor") {
                            let thisMotor = this.wedoBoostPoweredUp[uuid].port[key];
                            thisMotor.newMotor = thisMotor.motorResult;
                            thisMotor.newMotorDegree = thisMotor.motorDegree;
                            if ((thisMotor.newMotor !== thisMotor.oldMotor) || (thisMotor.newMotorDegree !== thisMotor.oldMotorDegree)) {
                                setTimeout(function () {

                                    if (this.wedoBoostPoweredUp[uuid].deviceType === "wedo") {

                                        //this.getCharacteristic(uuid, "1565").write(Buffer([key, 0x01, 0x02, parseInt(thisMotor.motorResult)], true));
                                        this.writeTo(uuid, "1565", Buffer([key, 0x01, 0x02, parseInt(thisMotor.motorResult)]), function () {
                                        });

                                    } else if (this.wedoBoostPoweredUp[uuid].deviceType === "poweredUp") {
                                        if (thisMotor.motorDegree === null) {
                                            this.writeTo(uuid, this.poweredUpHub, Buffer([0x07, 0x00, 0x81, key, 0x11, 0x07, parseInt(thisMotor.motorResult)]), function () {
                                            });
                                        } else {
                                            let motorbytes = this.numberTo4ByteArray(thisMotor.motorDegree);
                                            console.log(parseInt(thisMotor.motorResult));
                                            let thisBuffer = [];
                                            if (thisMotor.absolutDegree === false)
                                                thisBuffer = Buffer([0x0D, 0x00, 0x81, key, 0x11, 0x0B, motorbytes[0], motorbytes[1], motorbytes[2], motorbytes[3], parseInt(thisMotor.motorResult), 100, 127, 0x11]);
                                            else
                                                thisBuffer = Buffer([0x0D, 0x00, 0x81, key, 0x11, 0x0D, motorbytes[0], motorbytes[1], motorbytes[2], motorbytes[3], parseInt(thisMotor.motorResult), 100, 127, 0x11]);

                                            this.writeTo(uuid, this.poweredUpHub, thisBuffer, function () {
                                                thisMotor.motorCallback;
                                            });
                                        }
                                    }
                                }.bind(this, uuid), motorCount * 11);
                                thisMotor.oldMotor = thisMotor.newMotor;
                                thisMotor.oldMotorDegree = thisMotor.newMotorDegree;
                            }
                            motorCount++;
                        }
                    }
                }
            }
        }
    }.bind(this, uuid), 120);
};

WedoBoostPoweredUp.prototype.map = function (x, in_min, in_max, out_min, out_max) {
    if (x > in_max) x = in_max;
    if (x < in_min) x = in_min;
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};

WedoBoostPoweredUp.prototype.cout = function (text) {
    console.log(text);
};

WedoBoostPoweredUp.prototype.getPortList = function (callback, uuid) {
    uuid = this.getUuidFromInput(uuid);
    if (uuid != null && this.wedoBoostPoweredUp[uuid]) {
        let portLitst = {}
        for (let key in this.wedoBoostPoweredUp[uuid].port) {
            portLitst[key] = this.wedoBoostPoweredUp[uuid].port[key].type
            console.log("port: " + key + " Device Type: " + this.wedoBoostPoweredUp[uuid].port[key].type);
        }
        callback(portLitst, uuid);
    }

};


WedoBoostPoweredUp.prototype.getUuidFromInput = function (input) {
    if (typeof input === "string") {
        if (input in this.wedoBoostPoweredUp) {
            return input;
        } else {
            for (var uuid in this.wedoBoostPoweredUp) {
                if (this.wedoBoostPoweredUp[uuid].name === input) {
                    return uuid;
                }
            }
        }
        return null;
    } else if (typeof input === "number") {
        var index = 0;
        for (var uuid in this.wedoBoostPoweredUp) {
            if (index === input) {
                return uuid;
            }
            index++;
        }
        return null;
    } else {
        for (var uuid in this.wedoBoostPoweredUp) {
            return uuid;
        }
        return null;
    }
};

module.exports = WedoBoostPoweredUp;