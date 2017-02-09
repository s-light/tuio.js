// TUIO Protocoll support for javascript
// tries to interpret incomming osc messages as tuio messages.
// http://www.tuio.org/?specification
//
// requires a loaded osc.js
// https://github.com/colinbdclark/osc.js
//
// inspired by
// https://github.com/colinbdclark/osc.js-examples/blob/master/browser/web/socket-synth.js
//
// MIT License
// written by Stefan Krüger (github@s-light.eu)
//

// http://exploringjs.com/es6/ch_modules.html#_named-exports-several-per-module
// currently not supported by browsers?!
// import osc from '../bower_components/osc.js/dist/osc-browser.js';
// export class TUIOReceiver {


//     tuio.aTest.prototype.handleProfile2D = function (objecttype, tuioMessage) {
//         // obj: set s i x y a X Y A m r
//         // cur: set s x y X Y m
//         // blb: set s x y a w h f X Y A m r
//         // TODO
//     };
//
//     tuio.aTest.prototype.handleProfile25D = function (objecttype, tuioMessage) {
//         // obj: set s i x y z a X Y Z A m r
//         // cur: set s x y z X Y Z m
//         // blb: set s x y z a w h f X Y Z A m r
//         // TODO
//     };
//
//     tuio.aTest.prototype.handleProfile3D = function (objecttype, tuioMessage) {
//         // obj: set s i x y z a b c X Y Z A B C m r
//         // cur: set s x y z X Y Z m
//         // blb: set s x y z a b c w h d v X Y Z A B C m r
//         // TODO
//     };
//



class TUIOReceiver {
    constructor(prop) {
        this.prop = prop;

        this.oscPort = new osc.WebSocketPort({
            url: "ws://localhost:3334"
        });

        this.listen();
        this.oscPort.open();

        // this.oscPort.socket.onmessage = function (e) {
        //     console.log("message", e);
        // };

        this.inputBuffer = this.createInputBuffer();



        this.tuioProfiles = {
            // 2D Interactive Surface
            '2Dobj': new Map(),
            '2Dcur': new Map(),
            '2Dblb': new Map(),
            // 2.5D Interactive Surface
            '25Dobj': new Map(),
            '25Dcur': new Map(),
            '25Dblb': new Map(),
            // 3D Interactive Surface
            '3Dobj': new Map(),
            '3Dcur': new Map(),
            '3Dblb': new Map(),
        };
    }

    static staticMethod() {
        return 'classy';
    }

    prototypeMethod() {
        return 'prototypical';
    }


    listen() {
        // this.oscPort.on("open", this.play.bind(this));
        // this.oscPort.on("open", function (msg) {
        //     console.log("open", msg);
        // });
        this.oscPort.on("message", this.handleMessage.bind(this));
        // this.oscPort.on("message", function (msg) {
        //     console.log("message", msg);
        // });
        // this.oscPort.on("close", function (msg) {
        //     console.log("close", msg);
        // });
        // this.oscPort.on("close", this.pause.bind(this));
    }

    handleMessage(oscMessage) {
        /*
            2D Interactive Surface

                /tuio/2Dobj set s i x y a X Y A m r
                /tuio/2Dcur set s x y X Y m
                /tuio/2Dblb set s x y a w h f X Y A m r

            2.5D Interactive Surface

                /tuio/25Dobj set s i x y z a X Y Z A m r
                /tuio/25Dcur set s x y z X Y Z m
                /tuio/25Dblb set s x y z a w h f X Y Z A m r

            3D Interactive Surface

                /tuio/3Dobj set s i x y z a b c X Y Z A B C m r
                /tuio/3Dcur set s x y z X Y Z m
                /tuio/3Dblb set s x y z a b c w h d v X Y Z A B C m r

            custom profile

                /tuio/_[formatString]

            semantic types of set messages
                s          Session ID (temporary object ID)                         int32
                i          Class ID (e.g. marker ID)                                int32
                x, y, z    Position                                                 float32, range 0...1
                a, b, c    Angle                                                    float32, range 0..2PI
                w, h, d    Dimension                                                float32, range 0..1
                f, v       Area, Volume                                             float32, range 0..1
                X, Y ,Z    Velocity vector (motion speed & direction)               float32
                A, B, C    Rotation velocity vector (rotation speed & direction)    float32
                m          Motion acceleration                                      float32
                r          Rotation acceleration                                    float32
                P          Free parameter                                           type defined by OSC message header
        */


        // implement statemaschine:
        // states:
        //  source  (optional)
        //  alive
        //  set (optional)
        //  ...
        //  set - set messages comming in for every sessionID that is mentioned in 'alive'
        //  fseq (global for sorce)
        // message type is found in first tuioMessage parameter. (tuioMessage[0])
        // if we get the fseq message we know the Bundle is finished.
        // so we can clear process it and clear the 'incomming buffer'
        // than we can process the content.

        // if we have an incomming buffer for every profile and objecttype its ok
        // if we get mixed up out of order packages..
        // eventually this is contra productive..
        // if we only have one input we can handle all incomming bundles with this.
        // this makes more sens because we only now that all messages belong together
        // if the they come in order and are finalized with a fseq message.
        // --> only one input!

        const address = oscMessage.address;
        // check for tuio message
        if (address.startsWith("/tuio/")) {
        // if (false) {
            // its a tuio message.
            const tuioMessage = oscMessage.args;

            // console.log("address", address, "tuioMessage", tuioMessage);
            const profile = address.slice(
                address.indexOf('/tuio/') + '/tuio/'.length
            );

            // if inputBuffer is clean set profile
            if (this.inputBuffer.profile === null) {
                this.inputBuffer.profile = profile;
            }

            // check if profile is correct
            // (that means we are still in the same bundle)
            if (this.inputBuffer.profile == profile) {
                // get message type
                const [messageType, ...messageParams] = tuioMessage;
                // console.log("messageType", messageType, "messageParams", messageParams);

                switch (messageType) {
                    case 'source': {
                        this.inputBuffer.source = messageParams[0];
                    } break;
                    case 'alive': {
                        this.inputBuffer.alive = messageParams;
                    } break;
                    case 'set': {
                        const [sessionID, ...values] = messageParams;
                        this.inputBuffer.sets.set(sessionID, values);
                    } break;
                    case 'fseq': {
                        this.inputBuffer.fseq = messageParams[0];

                        // full bundle received
                        this.inputBufferLast = this.inputBuffer;

                        // please process it!
                        this.processBundle(this.inputBufferLast);

                        // clean inputBuffer
                        this.inputBuffer = this.createInputBuffer();
                    } break;
                    default:
                        console.log(`unknown messageType ${messageType}.`);
                }
            } else {
                // someting went wrong!
                // order of received messages (bundle) not correct!!!
                // resetting inputBuffer
                console.log("received message bundle corrupt!!", this.inputBuffer);
                // clean inputBuffer
                this.inputBuffer = this.createInputBuffer();
                // console.log(
                //     "?? ",
                //     "this.inputBuffer.profile", this.inputBuffer.profile,
                //     "profile", profile,
                //     "this.inputBuffer.profile == profile", this.inputBuffer.profile == profile
                // );
                // console.log(
                //     "?? ",
                //     "address", address,
                //     "tuioMessage", tuioMessage,
                //     "inputBuffer",  this.inputBuffer
                // );
            }

        } // end check for tuio message
    }

    processBundle(bundle) {
        // console.log("bundle", bundle);
        const profile = bundle.profile;
        // find profile and object type
        // check for custom profile
        if (!profile.startsWith("_")) {
            // we have a normal profile
            // console.log("profile", profile);

            // // split profile in dimmension and type
            // const re = /(\d+D)(\D{3})/i;
            // // console.log("address.match(re)", address.match(re));
            // // http://exploringjs.com/es6/ch_destructuring.html#_destructuring-returned-arrays
            // const [, profileDimensions, objectType] = profile.match(re) || [];
            // switch (profile) {
            //     case '2D':
            //         this.handleProfile2D(objecttype, tuioMessage);
            //         break;
            //     case '25D':
            //         this.handleProfile25D(objecttype, tuioMessage);
            //         break;
            //     case '3D':
            //         this.handleProfile3D(objecttype, tuioMessage);
            //         break;
            //     case 'custom':
            //
            //         break;
            //     default:
            //         console.log(`profile ${profile} not in TUIO 1.1 spec. For Custom Profiles use _[formatString]`);
            // }

            if (profile in this.tuioProfiles) {
                const profileTuioObjects = this.tuioProfiles[profile];
                // profileTuioObjects holds a Map with key==sessionID and value==object values
                // console.log("profileTuioObjects", profileTuioObjects);
                // console.log("bundle.alive", bundle.alive);

                // now we can check if we have 'new', 'known', 'removed' sessionIDs.
                // if new sessionID add it
                // if known sessionID update information
                // if removed sessionID delete from list

                // find new ones
                let newSessionIDs = [];
                for (const sessionID of bundle.alive) {
                    if (profileTuioObjects.get(sessionID) === undefined) {
                        newSessionIDs.push(sessionID);
                        profileTuioObjects.set(sessionID, null);
                    }
                }
                if (newSessionIDs.length > 0) {
                    console.log("newSessionIDs", newSessionIDs);
                }

                // find removed ones
                let removedSessionIDs = [];
                for (const [sessionID] of profileTuioObjects) {
                    if (!bundle.alive.includes(sessionID)) {
                        removedSessionIDs.push(sessionID);
                        profileTuioObjects.delete(sessionID);
                        // deletetion should be done if all things are handled..
                    }
                }
                if (removedSessionIDs.length > 0) {
                    console.log("removedSessionIDs", removedSessionIDs);
                }

                // set new values
                for (const [sessionID, values] of bundle.sets) {
                    // console.log("sessionID", sessionID, "values", values);
                    // if (profileTuioObjects.get(sessionID)) {
                        profileTuioObjects.set(sessionID, values);
                    // }
                }

                // now we have a updated set and all information to generate the events.
                // ....

            } else {
                console.log(`profile ${profile} not in TUIO 1.1 spec. For Custom Profiles use _[formatString]`);
            }
        } else {
            // handle custom profiles
            const profileString = profile.slice(profile.indexOf('_'));
            this.handleProfileCustom(profileString, bundle);
        }
    }

    // ******************************************
    // Internal Helper

    createInputBuffer() {
        return {
            profile: null,
            source: null,
            alive: [],
            sets: new Map(),
            fseq: null
        };
    }

    handleProfileCustom(profileString, bundle) {
        // TODO
        console.log("handleProfileCustom", profileString, "!!! NOT IMPLEMENTED !!!");
    }


}
