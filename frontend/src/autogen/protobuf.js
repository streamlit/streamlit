/* eslint-disable */

/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const Audio = $root.Audio = (() => {

    /**
     * Properties of an Audio.
     * @exports IAudio
     * @interface IAudio
     * @property {string|null} [data] Audio data
     * @property {string|null} [format] Audio format
     */

    /**
     * Constructs a new Audio.
     * @exports Audio
     * @classdesc Represents an Audio.
     * @implements IAudio
     * @constructor
     * @param {IAudio=} [properties] Properties to set
     */
    function Audio(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Audio data.
     * @member {string} data
     * @memberof Audio
     * @instance
     */
    Audio.prototype.data = "";

    /**
     * Audio format.
     * @member {string} format
     * @memberof Audio
     * @instance
     */
    Audio.prototype.format = "";

    /**
     * Creates a new Audio instance using the specified properties.
     * @function create
     * @memberof Audio
     * @static
     * @param {IAudio=} [properties] Properties to set
     * @returns {Audio} Audio instance
     */
    Audio.create = function create(properties) {
        return new Audio(properties);
    };

    /**
     * Encodes the specified Audio message. Does not implicitly {@link Audio.verify|verify} messages.
     * @function encode
     * @memberof Audio
     * @static
     * @param {IAudio} message Audio message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Audio.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.data);
        if (message.format != null && message.hasOwnProperty("format"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.format);
        return writer;
    };

    /**
     * Encodes the specified Audio message, length delimited. Does not implicitly {@link Audio.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Audio
     * @static
     * @param {IAudio} message Audio message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Audio.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Audio message from the specified reader or buffer.
     * @function decode
     * @memberof Audio
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Audio} Audio
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Audio.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Audio();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = reader.string();
                break;
            case 2:
                message.format = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Audio message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Audio
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Audio} Audio
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Audio.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Audio message.
     * @function verify
     * @memberof Audio
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Audio.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data"))
            if (!$util.isString(message.data))
                return "data: string expected";
        if (message.format != null && message.hasOwnProperty("format"))
            if (!$util.isString(message.format))
                return "format: string expected";
        return null;
    };

    /**
     * Creates an Audio message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Audio
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Audio} Audio
     */
    Audio.fromObject = function fromObject(object) {
        if (object instanceof $root.Audio)
            return object;
        let message = new $root.Audio();
        if (object.data != null)
            message.data = String(object.data);
        if (object.format != null)
            message.format = String(object.format);
        return message;
    };

    /**
     * Creates a plain object from an Audio message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Audio
     * @static
     * @param {Audio} message Audio
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Audio.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.data = "";
            object.format = "";
        }
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = message.data;
        if (message.format != null && message.hasOwnProperty("format"))
            object.format = message.format;
        return object;
    };

    /**
     * Converts this Audio to JSON.
     * @function toJSON
     * @memberof Audio
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Audio.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Audio;
})();

export const BackMsg = $root.BackMsg = (() => {

    /**
     * Properties of a BackMsg.
     * @exports IBackMsg
     * @interface IBackMsg
     * @property {boolean|null} [cloudUpload] BackMsg cloudUpload
     * @property {string|null} [rerunScript] BackMsg rerunScript
     * @property {boolean|null} [clearCache] BackMsg clearCache
     * @property {boolean|null} [setRunOnSave] BackMsg setRunOnSave
     * @property {boolean|null} [stopReport] BackMsg stopReport
     */

    /**
     * Constructs a new BackMsg.
     * @exports BackMsg
     * @classdesc Represents a BackMsg.
     * @implements IBackMsg
     * @constructor
     * @param {IBackMsg=} [properties] Properties to set
     */
    function BackMsg(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * BackMsg cloudUpload.
     * @member {boolean} cloudUpload
     * @memberof BackMsg
     * @instance
     */
    BackMsg.prototype.cloudUpload = false;

    /**
     * BackMsg rerunScript.
     * @member {string} rerunScript
     * @memberof BackMsg
     * @instance
     */
    BackMsg.prototype.rerunScript = "";

    /**
     * BackMsg clearCache.
     * @member {boolean} clearCache
     * @memberof BackMsg
     * @instance
     */
    BackMsg.prototype.clearCache = false;

    /**
     * BackMsg setRunOnSave.
     * @member {boolean} setRunOnSave
     * @memberof BackMsg
     * @instance
     */
    BackMsg.prototype.setRunOnSave = false;

    /**
     * BackMsg stopReport.
     * @member {boolean} stopReport
     * @memberof BackMsg
     * @instance
     */
    BackMsg.prototype.stopReport = false;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * BackMsg type.
     * @member {"cloudUpload"|"rerunScript"|"clearCache"|"setRunOnSave"|"stopReport"|undefined} type
     * @memberof BackMsg
     * @instance
     */
    Object.defineProperty(BackMsg.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["cloudUpload", "rerunScript", "clearCache", "setRunOnSave", "stopReport"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new BackMsg instance using the specified properties.
     * @function create
     * @memberof BackMsg
     * @static
     * @param {IBackMsg=} [properties] Properties to set
     * @returns {BackMsg} BackMsg instance
     */
    BackMsg.create = function create(properties) {
        return new BackMsg(properties);
    };

    /**
     * Encodes the specified BackMsg message. Does not implicitly {@link BackMsg.verify|verify} messages.
     * @function encode
     * @memberof BackMsg
     * @static
     * @param {IBackMsg} message BackMsg message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BackMsg.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.cloudUpload != null && message.hasOwnProperty("cloudUpload"))
            writer.uint32(/* id 2, wireType 0 =*/16).bool(message.cloudUpload);
        if (message.rerunScript != null && message.hasOwnProperty("rerunScript"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.rerunScript);
        if (message.clearCache != null && message.hasOwnProperty("clearCache"))
            writer.uint32(/* id 5, wireType 0 =*/40).bool(message.clearCache);
        if (message.setRunOnSave != null && message.hasOwnProperty("setRunOnSave"))
            writer.uint32(/* id 6, wireType 0 =*/48).bool(message.setRunOnSave);
        if (message.stopReport != null && message.hasOwnProperty("stopReport"))
            writer.uint32(/* id 7, wireType 0 =*/56).bool(message.stopReport);
        return writer;
    };

    /**
     * Encodes the specified BackMsg message, length delimited. Does not implicitly {@link BackMsg.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BackMsg
     * @static
     * @param {IBackMsg} message BackMsg message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BackMsg.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BackMsg message from the specified reader or buffer.
     * @function decode
     * @memberof BackMsg
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BackMsg} BackMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BackMsg.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.BackMsg();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 2:
                message.cloudUpload = reader.bool();
                break;
            case 3:
                message.rerunScript = reader.string();
                break;
            case 5:
                message.clearCache = reader.bool();
                break;
            case 6:
                message.setRunOnSave = reader.bool();
                break;
            case 7:
                message.stopReport = reader.bool();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a BackMsg message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BackMsg
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BackMsg} BackMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BackMsg.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BackMsg message.
     * @function verify
     * @memberof BackMsg
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BackMsg.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.cloudUpload != null && message.hasOwnProperty("cloudUpload")) {
            properties.type = 1;
            if (typeof message.cloudUpload !== "boolean")
                return "cloudUpload: boolean expected";
        }
        if (message.rerunScript != null && message.hasOwnProperty("rerunScript")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (!$util.isString(message.rerunScript))
                return "rerunScript: string expected";
        }
        if (message.clearCache != null && message.hasOwnProperty("clearCache")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (typeof message.clearCache !== "boolean")
                return "clearCache: boolean expected";
        }
        if (message.setRunOnSave != null && message.hasOwnProperty("setRunOnSave")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (typeof message.setRunOnSave !== "boolean")
                return "setRunOnSave: boolean expected";
        }
        if (message.stopReport != null && message.hasOwnProperty("stopReport")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (typeof message.stopReport !== "boolean")
                return "stopReport: boolean expected";
        }
        return null;
    };

    /**
     * Creates a BackMsg message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BackMsg
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BackMsg} BackMsg
     */
    BackMsg.fromObject = function fromObject(object) {
        if (object instanceof $root.BackMsg)
            return object;
        let message = new $root.BackMsg();
        if (object.cloudUpload != null)
            message.cloudUpload = Boolean(object.cloudUpload);
        if (object.rerunScript != null)
            message.rerunScript = String(object.rerunScript);
        if (object.clearCache != null)
            message.clearCache = Boolean(object.clearCache);
        if (object.setRunOnSave != null)
            message.setRunOnSave = Boolean(object.setRunOnSave);
        if (object.stopReport != null)
            message.stopReport = Boolean(object.stopReport);
        return message;
    };

    /**
     * Creates a plain object from a BackMsg message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BackMsg
     * @static
     * @param {BackMsg} message BackMsg
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BackMsg.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (message.cloudUpload != null && message.hasOwnProperty("cloudUpload")) {
            object.cloudUpload = message.cloudUpload;
            if (options.oneofs)
                object.type = "cloudUpload";
        }
        if (message.rerunScript != null && message.hasOwnProperty("rerunScript")) {
            object.rerunScript = message.rerunScript;
            if (options.oneofs)
                object.type = "rerunScript";
        }
        if (message.clearCache != null && message.hasOwnProperty("clearCache")) {
            object.clearCache = message.clearCache;
            if (options.oneofs)
                object.type = "clearCache";
        }
        if (message.setRunOnSave != null && message.hasOwnProperty("setRunOnSave")) {
            object.setRunOnSave = message.setRunOnSave;
            if (options.oneofs)
                object.type = "setRunOnSave";
        }
        if (message.stopReport != null && message.hasOwnProperty("stopReport")) {
            object.stopReport = message.stopReport;
            if (options.oneofs)
                object.type = "stopReport";
        }
        return object;
    };

    /**
     * Converts this BackMsg to JSON.
     * @function toJSON
     * @memberof BackMsg
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BackMsg.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return BackMsg;
})();

export const Balloons = $root.Balloons = (() => {

    /**
     * Properties of a Balloons.
     * @exports IBalloons
     * @interface IBalloons
     * @property {Balloons.Type|null} [type] Balloons type
     * @property {number|null} [executionId] Balloons executionId
     */

    /**
     * Constructs a new Balloons.
     * @exports Balloons
     * @classdesc Represents a Balloons.
     * @implements IBalloons
     * @constructor
     * @param {IBalloons=} [properties] Properties to set
     */
    function Balloons(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Balloons type.
     * @member {Balloons.Type} type
     * @memberof Balloons
     * @instance
     */
    Balloons.prototype.type = 0;

    /**
     * Balloons executionId.
     * @member {number} executionId
     * @memberof Balloons
     * @instance
     */
    Balloons.prototype.executionId = 0;

    /**
     * Creates a new Balloons instance using the specified properties.
     * @function create
     * @memberof Balloons
     * @static
     * @param {IBalloons=} [properties] Properties to set
     * @returns {Balloons} Balloons instance
     */
    Balloons.create = function create(properties) {
        return new Balloons(properties);
    };

    /**
     * Encodes the specified Balloons message. Does not implicitly {@link Balloons.verify|verify} messages.
     * @function encode
     * @memberof Balloons
     * @static
     * @param {IBalloons} message Balloons message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Balloons.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.type != null && message.hasOwnProperty("type"))
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
        if (message.executionId != null && message.hasOwnProperty("executionId"))
            writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.executionId);
        return writer;
    };

    /**
     * Encodes the specified Balloons message, length delimited. Does not implicitly {@link Balloons.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Balloons
     * @static
     * @param {IBalloons} message Balloons message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Balloons.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Balloons message from the specified reader or buffer.
     * @function decode
     * @memberof Balloons
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Balloons} Balloons
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Balloons.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Balloons();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.type = reader.int32();
                break;
            case 2:
                message.executionId = reader.uint32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Balloons message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Balloons
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Balloons} Balloons
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Balloons.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Balloons message.
     * @function verify
     * @memberof Balloons
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Balloons.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.type != null && message.hasOwnProperty("type"))
            switch (message.type) {
            default:
                return "type: enum value expected";
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
                break;
            }
        if (message.executionId != null && message.hasOwnProperty("executionId"))
            if (!$util.isInteger(message.executionId))
                return "executionId: integer expected";
        return null;
    };

    /**
     * Creates a Balloons message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Balloons
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Balloons} Balloons
     */
    Balloons.fromObject = function fromObject(object) {
        if (object instanceof $root.Balloons)
            return object;
        let message = new $root.Balloons();
        switch (object.type) {
        case "DEFAULT":
        case 0:
            message.type = 0;
            break;
        case "BALLOON":
        case 1:
            message.type = 1;
            break;
        case "HAPPY_FACE":
        case 2:
            message.type = 2;
            break;
        case "STAR_FACE":
        case 3:
            message.type = 3;
            break;
        case "COOL_FACE":
        case 4:
            message.type = 4;
            break;
        }
        if (object.executionId != null)
            message.executionId = object.executionId >>> 0;
        return message;
    };

    /**
     * Creates a plain object from a Balloons message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Balloons
     * @static
     * @param {Balloons} message Balloons
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Balloons.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.type = options.enums === String ? "DEFAULT" : 0;
            object.executionId = 0;
        }
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = options.enums === String ? $root.Balloons.Type[message.type] : message.type;
        if (message.executionId != null && message.hasOwnProperty("executionId"))
            object.executionId = message.executionId;
        return object;
    };

    /**
     * Converts this Balloons to JSON.
     * @function toJSON
     * @memberof Balloons
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Balloons.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Type enum.
     * @name Balloons.Type
     * @enum {string}
     * @property {number} DEFAULT=0 DEFAULT value
     * @property {number} BALLOON=1 BALLOON value
     * @property {number} HAPPY_FACE=2 HAPPY_FACE value
     * @property {number} STAR_FACE=3 STAR_FACE value
     * @property {number} COOL_FACE=4 COOL_FACE value
     */
    Balloons.Type = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "DEFAULT"] = 0;
        values[valuesById[1] = "BALLOON"] = 1;
        values[valuesById[2] = "HAPPY_FACE"] = 2;
        values[valuesById[3] = "STAR_FACE"] = 3;
        values[valuesById[4] = "COOL_FACE"] = 4;
        return values;
    })();

    return Balloons;
})();

export const BokehChart = $root.BokehChart = (() => {

    /**
     * Properties of a BokehChart.
     * @exports IBokehChart
     * @interface IBokehChart
     * @property {string|null} [figure] BokehChart figure
     */

    /**
     * Constructs a new BokehChart.
     * @exports BokehChart
     * @classdesc Represents a BokehChart.
     * @implements IBokehChart
     * @constructor
     * @param {IBokehChart=} [properties] Properties to set
     */
    function BokehChart(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * BokehChart figure.
     * @member {string} figure
     * @memberof BokehChart
     * @instance
     */
    BokehChart.prototype.figure = "";

    /**
     * Creates a new BokehChart instance using the specified properties.
     * @function create
     * @memberof BokehChart
     * @static
     * @param {IBokehChart=} [properties] Properties to set
     * @returns {BokehChart} BokehChart instance
     */
    BokehChart.create = function create(properties) {
        return new BokehChart(properties);
    };

    /**
     * Encodes the specified BokehChart message. Does not implicitly {@link BokehChart.verify|verify} messages.
     * @function encode
     * @memberof BokehChart
     * @static
     * @param {IBokehChart} message BokehChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BokehChart.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.figure != null && message.hasOwnProperty("figure"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.figure);
        return writer;
    };

    /**
     * Encodes the specified BokehChart message, length delimited. Does not implicitly {@link BokehChart.verify|verify} messages.
     * @function encodeDelimited
     * @memberof BokehChart
     * @static
     * @param {IBokehChart} message BokehChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    BokehChart.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a BokehChart message from the specified reader or buffer.
     * @function decode
     * @memberof BokehChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {BokehChart} BokehChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BokehChart.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.BokehChart();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.figure = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a BokehChart message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof BokehChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {BokehChart} BokehChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    BokehChart.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a BokehChart message.
     * @function verify
     * @memberof BokehChart
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    BokehChart.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.figure != null && message.hasOwnProperty("figure"))
            if (!$util.isString(message.figure))
                return "figure: string expected";
        return null;
    };

    /**
     * Creates a BokehChart message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof BokehChart
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {BokehChart} BokehChart
     */
    BokehChart.fromObject = function fromObject(object) {
        if (object instanceof $root.BokehChart)
            return object;
        let message = new $root.BokehChart();
        if (object.figure != null)
            message.figure = String(object.figure);
        return message;
    };

    /**
     * Creates a plain object from a BokehChart message. Also converts values to other types if specified.
     * @function toObject
     * @memberof BokehChart
     * @static
     * @param {BokehChart} message BokehChart
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    BokehChart.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.figure = "";
        if (message.figure != null && message.hasOwnProperty("figure"))
            object.figure = message.figure;
        return object;
    };

    /**
     * Converts this BokehChart to JSON.
     * @function toJSON
     * @memberof BokehChart
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    BokehChart.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return BokehChart;
})();

export const DataFrame = $root.DataFrame = (() => {

    /**
     * Properties of a DataFrame.
     * @exports IDataFrame
     * @interface IDataFrame
     * @property {ITable|null} [data] DataFrame data
     * @property {IIndex|null} [index] DataFrame index
     * @property {IIndex|null} [columns] DataFrame columns
     * @property {ITableStyle|null} [style] DataFrame style
     */

    /**
     * Constructs a new DataFrame.
     * @exports DataFrame
     * @classdesc Represents a DataFrame.
     * @implements IDataFrame
     * @constructor
     * @param {IDataFrame=} [properties] Properties to set
     */
    function DataFrame(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DataFrame data.
     * @member {ITable|null|undefined} data
     * @memberof DataFrame
     * @instance
     */
    DataFrame.prototype.data = null;

    /**
     * DataFrame index.
     * @member {IIndex|null|undefined} index
     * @memberof DataFrame
     * @instance
     */
    DataFrame.prototype.index = null;

    /**
     * DataFrame columns.
     * @member {IIndex|null|undefined} columns
     * @memberof DataFrame
     * @instance
     */
    DataFrame.prototype.columns = null;

    /**
     * DataFrame style.
     * @member {ITableStyle|null|undefined} style
     * @memberof DataFrame
     * @instance
     */
    DataFrame.prototype.style = null;

    /**
     * Creates a new DataFrame instance using the specified properties.
     * @function create
     * @memberof DataFrame
     * @static
     * @param {IDataFrame=} [properties] Properties to set
     * @returns {DataFrame} DataFrame instance
     */
    DataFrame.create = function create(properties) {
        return new DataFrame(properties);
    };

    /**
     * Encodes the specified DataFrame message. Does not implicitly {@link DataFrame.verify|verify} messages.
     * @function encode
     * @memberof DataFrame
     * @static
     * @param {IDataFrame} message DataFrame message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DataFrame.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.Table.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.index != null && message.hasOwnProperty("index"))
            $root.Index.encode(message.index, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.columns != null && message.hasOwnProperty("columns"))
            $root.Index.encode(message.columns, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.style != null && message.hasOwnProperty("style"))
            $root.TableStyle.encode(message.style, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified DataFrame message, length delimited. Does not implicitly {@link DataFrame.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DataFrame
     * @static
     * @param {IDataFrame} message DataFrame message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DataFrame.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DataFrame message from the specified reader or buffer.
     * @function decode
     * @memberof DataFrame
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DataFrame} DataFrame
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DataFrame.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.DataFrame();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.Table.decode(reader, reader.uint32());
                break;
            case 2:
                message.index = $root.Index.decode(reader, reader.uint32());
                break;
            case 3:
                message.columns = $root.Index.decode(reader, reader.uint32());
                break;
            case 4:
                message.style = $root.TableStyle.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DataFrame message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DataFrame
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DataFrame} DataFrame
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DataFrame.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DataFrame message.
     * @function verify
     * @memberof DataFrame
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DataFrame.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.Table.verify(message.data);
            if (error)
                return "data." + error;
        }
        if (message.index != null && message.hasOwnProperty("index")) {
            let error = $root.Index.verify(message.index);
            if (error)
                return "index." + error;
        }
        if (message.columns != null && message.hasOwnProperty("columns")) {
            let error = $root.Index.verify(message.columns);
            if (error)
                return "columns." + error;
        }
        if (message.style != null && message.hasOwnProperty("style")) {
            let error = $root.TableStyle.verify(message.style);
            if (error)
                return "style." + error;
        }
        return null;
    };

    /**
     * Creates a DataFrame message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DataFrame
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DataFrame} DataFrame
     */
    DataFrame.fromObject = function fromObject(object) {
        if (object instanceof $root.DataFrame)
            return object;
        let message = new $root.DataFrame();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".DataFrame.data: object expected");
            message.data = $root.Table.fromObject(object.data);
        }
        if (object.index != null) {
            if (typeof object.index !== "object")
                throw TypeError(".DataFrame.index: object expected");
            message.index = $root.Index.fromObject(object.index);
        }
        if (object.columns != null) {
            if (typeof object.columns !== "object")
                throw TypeError(".DataFrame.columns: object expected");
            message.columns = $root.Index.fromObject(object.columns);
        }
        if (object.style != null) {
            if (typeof object.style !== "object")
                throw TypeError(".DataFrame.style: object expected");
            message.style = $root.TableStyle.fromObject(object.style);
        }
        return message;
    };

    /**
     * Creates a plain object from a DataFrame message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DataFrame
     * @static
     * @param {DataFrame} message DataFrame
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DataFrame.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.data = null;
            object.index = null;
            object.columns = null;
            object.style = null;
        }
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.Table.toObject(message.data, options);
        if (message.index != null && message.hasOwnProperty("index"))
            object.index = $root.Index.toObject(message.index, options);
        if (message.columns != null && message.hasOwnProperty("columns"))
            object.columns = $root.Index.toObject(message.columns, options);
        if (message.style != null && message.hasOwnProperty("style"))
            object.style = $root.TableStyle.toObject(message.style, options);
        return object;
    };

    /**
     * Converts this DataFrame to JSON.
     * @function toJSON
     * @memberof DataFrame
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DataFrame.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DataFrame;
})();

export const Index = $root.Index = (() => {

    /**
     * Properties of an Index.
     * @exports IIndex
     * @interface IIndex
     * @property {IPlainIndex|null} [plainIndex] Index plainIndex
     * @property {IRangeIndex|null} [rangeIndex] Index rangeIndex
     * @property {IMultiIndex|null} [multiIndex] Index multiIndex
     * @property {IDatetimeIndex|null} [datetimeIndex] Index datetimeIndex
     * @property {ITimedeltaIndex|null} [timedeltaIndex] Index timedeltaIndex
     * @property {IInt64Index|null} [int_64Index] Index int_64Index
     * @property {IFloat64Index|null} [float_64Index] Index float_64Index
     */

    /**
     * Constructs a new Index.
     * @exports Index
     * @classdesc Represents an Index.
     * @implements IIndex
     * @constructor
     * @param {IIndex=} [properties] Properties to set
     */
    function Index(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Index plainIndex.
     * @member {IPlainIndex|null|undefined} plainIndex
     * @memberof Index
     * @instance
     */
    Index.prototype.plainIndex = null;

    /**
     * Index rangeIndex.
     * @member {IRangeIndex|null|undefined} rangeIndex
     * @memberof Index
     * @instance
     */
    Index.prototype.rangeIndex = null;

    /**
     * Index multiIndex.
     * @member {IMultiIndex|null|undefined} multiIndex
     * @memberof Index
     * @instance
     */
    Index.prototype.multiIndex = null;

    /**
     * Index datetimeIndex.
     * @member {IDatetimeIndex|null|undefined} datetimeIndex
     * @memberof Index
     * @instance
     */
    Index.prototype.datetimeIndex = null;

    /**
     * Index timedeltaIndex.
     * @member {ITimedeltaIndex|null|undefined} timedeltaIndex
     * @memberof Index
     * @instance
     */
    Index.prototype.timedeltaIndex = null;

    /**
     * Index int_64Index.
     * @member {IInt64Index|null|undefined} int_64Index
     * @memberof Index
     * @instance
     */
    Index.prototype.int_64Index = null;

    /**
     * Index float_64Index.
     * @member {IFloat64Index|null|undefined} float_64Index
     * @memberof Index
     * @instance
     */
    Index.prototype.float_64Index = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * Index type.
     * @member {"plainIndex"|"rangeIndex"|"multiIndex"|"datetimeIndex"|"timedeltaIndex"|"int_64Index"|"float_64Index"|undefined} type
     * @memberof Index
     * @instance
     */
    Object.defineProperty(Index.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["plainIndex", "rangeIndex", "multiIndex", "datetimeIndex", "timedeltaIndex", "int_64Index", "float_64Index"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Index instance using the specified properties.
     * @function create
     * @memberof Index
     * @static
     * @param {IIndex=} [properties] Properties to set
     * @returns {Index} Index instance
     */
    Index.create = function create(properties) {
        return new Index(properties);
    };

    /**
     * Encodes the specified Index message. Does not implicitly {@link Index.verify|verify} messages.
     * @function encode
     * @memberof Index
     * @static
     * @param {IIndex} message Index message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Index.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.plainIndex != null && message.hasOwnProperty("plainIndex"))
            $root.PlainIndex.encode(message.plainIndex, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.rangeIndex != null && message.hasOwnProperty("rangeIndex"))
            $root.RangeIndex.encode(message.rangeIndex, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.multiIndex != null && message.hasOwnProperty("multiIndex"))
            $root.MultiIndex.encode(message.multiIndex, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.datetimeIndex != null && message.hasOwnProperty("datetimeIndex"))
            $root.DatetimeIndex.encode(message.datetimeIndex, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        if (message.timedeltaIndex != null && message.hasOwnProperty("timedeltaIndex"))
            $root.TimedeltaIndex.encode(message.timedeltaIndex, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
        if (message.int_64Index != null && message.hasOwnProperty("int_64Index"))
            $root.Int64Index.encode(message.int_64Index, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
        if (message.float_64Index != null && message.hasOwnProperty("float_64Index"))
            $root.Float64Index.encode(message.float_64Index, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Index message, length delimited. Does not implicitly {@link Index.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Index
     * @static
     * @param {IIndex} message Index message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Index.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Index message from the specified reader or buffer.
     * @function decode
     * @memberof Index
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Index} Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Index.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Index();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.plainIndex = $root.PlainIndex.decode(reader, reader.uint32());
                break;
            case 2:
                message.rangeIndex = $root.RangeIndex.decode(reader, reader.uint32());
                break;
            case 4:
                message.multiIndex = $root.MultiIndex.decode(reader, reader.uint32());
                break;
            case 6:
                message.datetimeIndex = $root.DatetimeIndex.decode(reader, reader.uint32());
                break;
            case 7:
                message.timedeltaIndex = $root.TimedeltaIndex.decode(reader, reader.uint32());
                break;
            case 9:
                message.int_64Index = $root.Int64Index.decode(reader, reader.uint32());
                break;
            case 11:
                message.float_64Index = $root.Float64Index.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Index message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Index
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Index} Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Index.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Index message.
     * @function verify
     * @memberof Index
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Index.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.plainIndex != null && message.hasOwnProperty("plainIndex")) {
            properties.type = 1;
            {
                let error = $root.PlainIndex.verify(message.plainIndex);
                if (error)
                    return "plainIndex." + error;
            }
        }
        if (message.rangeIndex != null && message.hasOwnProperty("rangeIndex")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.RangeIndex.verify(message.rangeIndex);
                if (error)
                    return "rangeIndex." + error;
            }
        }
        if (message.multiIndex != null && message.hasOwnProperty("multiIndex")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.MultiIndex.verify(message.multiIndex);
                if (error)
                    return "multiIndex." + error;
            }
        }
        if (message.datetimeIndex != null && message.hasOwnProperty("datetimeIndex")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.DatetimeIndex.verify(message.datetimeIndex);
                if (error)
                    return "datetimeIndex." + error;
            }
        }
        if (message.timedeltaIndex != null && message.hasOwnProperty("timedeltaIndex")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.TimedeltaIndex.verify(message.timedeltaIndex);
                if (error)
                    return "timedeltaIndex." + error;
            }
        }
        if (message.int_64Index != null && message.hasOwnProperty("int_64Index")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Int64Index.verify(message.int_64Index);
                if (error)
                    return "int_64Index." + error;
            }
        }
        if (message.float_64Index != null && message.hasOwnProperty("float_64Index")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Float64Index.verify(message.float_64Index);
                if (error)
                    return "float_64Index." + error;
            }
        }
        return null;
    };

    /**
     * Creates an Index message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Index
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Index} Index
     */
    Index.fromObject = function fromObject(object) {
        if (object instanceof $root.Index)
            return object;
        let message = new $root.Index();
        if (object.plainIndex != null) {
            if (typeof object.plainIndex !== "object")
                throw TypeError(".Index.plainIndex: object expected");
            message.plainIndex = $root.PlainIndex.fromObject(object.plainIndex);
        }
        if (object.rangeIndex != null) {
            if (typeof object.rangeIndex !== "object")
                throw TypeError(".Index.rangeIndex: object expected");
            message.rangeIndex = $root.RangeIndex.fromObject(object.rangeIndex);
        }
        if (object.multiIndex != null) {
            if (typeof object.multiIndex !== "object")
                throw TypeError(".Index.multiIndex: object expected");
            message.multiIndex = $root.MultiIndex.fromObject(object.multiIndex);
        }
        if (object.datetimeIndex != null) {
            if (typeof object.datetimeIndex !== "object")
                throw TypeError(".Index.datetimeIndex: object expected");
            message.datetimeIndex = $root.DatetimeIndex.fromObject(object.datetimeIndex);
        }
        if (object.timedeltaIndex != null) {
            if (typeof object.timedeltaIndex !== "object")
                throw TypeError(".Index.timedeltaIndex: object expected");
            message.timedeltaIndex = $root.TimedeltaIndex.fromObject(object.timedeltaIndex);
        }
        if (object.int_64Index != null) {
            if (typeof object.int_64Index !== "object")
                throw TypeError(".Index.int_64Index: object expected");
            message.int_64Index = $root.Int64Index.fromObject(object.int_64Index);
        }
        if (object.float_64Index != null) {
            if (typeof object.float_64Index !== "object")
                throw TypeError(".Index.float_64Index: object expected");
            message.float_64Index = $root.Float64Index.fromObject(object.float_64Index);
        }
        return message;
    };

    /**
     * Creates a plain object from an Index message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Index
     * @static
     * @param {Index} message Index
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Index.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (message.plainIndex != null && message.hasOwnProperty("plainIndex")) {
            object.plainIndex = $root.PlainIndex.toObject(message.plainIndex, options);
            if (options.oneofs)
                object.type = "plainIndex";
        }
        if (message.rangeIndex != null && message.hasOwnProperty("rangeIndex")) {
            object.rangeIndex = $root.RangeIndex.toObject(message.rangeIndex, options);
            if (options.oneofs)
                object.type = "rangeIndex";
        }
        if (message.multiIndex != null && message.hasOwnProperty("multiIndex")) {
            object.multiIndex = $root.MultiIndex.toObject(message.multiIndex, options);
            if (options.oneofs)
                object.type = "multiIndex";
        }
        if (message.datetimeIndex != null && message.hasOwnProperty("datetimeIndex")) {
            object.datetimeIndex = $root.DatetimeIndex.toObject(message.datetimeIndex, options);
            if (options.oneofs)
                object.type = "datetimeIndex";
        }
        if (message.timedeltaIndex != null && message.hasOwnProperty("timedeltaIndex")) {
            object.timedeltaIndex = $root.TimedeltaIndex.toObject(message.timedeltaIndex, options);
            if (options.oneofs)
                object.type = "timedeltaIndex";
        }
        if (message.int_64Index != null && message.hasOwnProperty("int_64Index")) {
            object.int_64Index = $root.Int64Index.toObject(message.int_64Index, options);
            if (options.oneofs)
                object.type = "int_64Index";
        }
        if (message.float_64Index != null && message.hasOwnProperty("float_64Index")) {
            object.float_64Index = $root.Float64Index.toObject(message.float_64Index, options);
            if (options.oneofs)
                object.type = "float_64Index";
        }
        return object;
    };

    /**
     * Converts this Index to JSON.
     * @function toJSON
     * @memberof Index
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Index.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Index;
})();

export const PlainIndex = $root.PlainIndex = (() => {

    /**
     * Properties of a PlainIndex.
     * @exports IPlainIndex
     * @interface IPlainIndex
     * @property {IAnyArray|null} [data] PlainIndex data
     */

    /**
     * Constructs a new PlainIndex.
     * @exports PlainIndex
     * @classdesc Represents a PlainIndex.
     * @implements IPlainIndex
     * @constructor
     * @param {IPlainIndex=} [properties] Properties to set
     */
    function PlainIndex(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * PlainIndex data.
     * @member {IAnyArray|null|undefined} data
     * @memberof PlainIndex
     * @instance
     */
    PlainIndex.prototype.data = null;

    /**
     * Creates a new PlainIndex instance using the specified properties.
     * @function create
     * @memberof PlainIndex
     * @static
     * @param {IPlainIndex=} [properties] Properties to set
     * @returns {PlainIndex} PlainIndex instance
     */
    PlainIndex.create = function create(properties) {
        return new PlainIndex(properties);
    };

    /**
     * Encodes the specified PlainIndex message. Does not implicitly {@link PlainIndex.verify|verify} messages.
     * @function encode
     * @memberof PlainIndex
     * @static
     * @param {IPlainIndex} message PlainIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PlainIndex.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.AnyArray.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified PlainIndex message, length delimited. Does not implicitly {@link PlainIndex.verify|verify} messages.
     * @function encodeDelimited
     * @memberof PlainIndex
     * @static
     * @param {IPlainIndex} message PlainIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PlainIndex.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a PlainIndex message from the specified reader or buffer.
     * @function decode
     * @memberof PlainIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {PlainIndex} PlainIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PlainIndex.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.PlainIndex();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.AnyArray.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a PlainIndex message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof PlainIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {PlainIndex} PlainIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PlainIndex.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a PlainIndex message.
     * @function verify
     * @memberof PlainIndex
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    PlainIndex.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.AnyArray.verify(message.data);
            if (error)
                return "data." + error;
        }
        return null;
    };

    /**
     * Creates a PlainIndex message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof PlainIndex
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {PlainIndex} PlainIndex
     */
    PlainIndex.fromObject = function fromObject(object) {
        if (object instanceof $root.PlainIndex)
            return object;
        let message = new $root.PlainIndex();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".PlainIndex.data: object expected");
            message.data = $root.AnyArray.fromObject(object.data);
        }
        return message;
    };

    /**
     * Creates a plain object from a PlainIndex message. Also converts values to other types if specified.
     * @function toObject
     * @memberof PlainIndex
     * @static
     * @param {PlainIndex} message PlainIndex
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    PlainIndex.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.data = null;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.AnyArray.toObject(message.data, options);
        return object;
    };

    /**
     * Converts this PlainIndex to JSON.
     * @function toJSON
     * @memberof PlainIndex
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    PlainIndex.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return PlainIndex;
})();

export const RangeIndex = $root.RangeIndex = (() => {

    /**
     * Properties of a RangeIndex.
     * @exports IRangeIndex
     * @interface IRangeIndex
     * @property {number|Long|null} [start] RangeIndex start
     * @property {number|Long|null} [stop] RangeIndex stop
     */

    /**
     * Constructs a new RangeIndex.
     * @exports RangeIndex
     * @classdesc Represents a RangeIndex.
     * @implements IRangeIndex
     * @constructor
     * @param {IRangeIndex=} [properties] Properties to set
     */
    function RangeIndex(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * RangeIndex start.
     * @member {number|Long} start
     * @memberof RangeIndex
     * @instance
     */
    RangeIndex.prototype.start = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

    /**
     * RangeIndex stop.
     * @member {number|Long} stop
     * @memberof RangeIndex
     * @instance
     */
    RangeIndex.prototype.stop = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

    /**
     * Creates a new RangeIndex instance using the specified properties.
     * @function create
     * @memberof RangeIndex
     * @static
     * @param {IRangeIndex=} [properties] Properties to set
     * @returns {RangeIndex} RangeIndex instance
     */
    RangeIndex.create = function create(properties) {
        return new RangeIndex(properties);
    };

    /**
     * Encodes the specified RangeIndex message. Does not implicitly {@link RangeIndex.verify|verify} messages.
     * @function encode
     * @memberof RangeIndex
     * @static
     * @param {IRangeIndex} message RangeIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RangeIndex.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.start != null && message.hasOwnProperty("start"))
            writer.uint32(/* id 1, wireType 0 =*/8).int64(message.start);
        if (message.stop != null && message.hasOwnProperty("stop"))
            writer.uint32(/* id 2, wireType 0 =*/16).int64(message.stop);
        return writer;
    };

    /**
     * Encodes the specified RangeIndex message, length delimited. Does not implicitly {@link RangeIndex.verify|verify} messages.
     * @function encodeDelimited
     * @memberof RangeIndex
     * @static
     * @param {IRangeIndex} message RangeIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RangeIndex.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RangeIndex message from the specified reader or buffer.
     * @function decode
     * @memberof RangeIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {RangeIndex} RangeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RangeIndex.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.RangeIndex();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.start = reader.int64();
                break;
            case 2:
                message.stop = reader.int64();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a RangeIndex message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof RangeIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {RangeIndex} RangeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RangeIndex.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RangeIndex message.
     * @function verify
     * @memberof RangeIndex
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RangeIndex.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.start != null && message.hasOwnProperty("start"))
            if (!$util.isInteger(message.start) && !(message.start && $util.isInteger(message.start.low) && $util.isInteger(message.start.high)))
                return "start: integer|Long expected";
        if (message.stop != null && message.hasOwnProperty("stop"))
            if (!$util.isInteger(message.stop) && !(message.stop && $util.isInteger(message.stop.low) && $util.isInteger(message.stop.high)))
                return "stop: integer|Long expected";
        return null;
    };

    /**
     * Creates a RangeIndex message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof RangeIndex
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {RangeIndex} RangeIndex
     */
    RangeIndex.fromObject = function fromObject(object) {
        if (object instanceof $root.RangeIndex)
            return object;
        let message = new $root.RangeIndex();
        if (object.start != null)
            if ($util.Long)
                (message.start = $util.Long.fromValue(object.start)).unsigned = false;
            else if (typeof object.start === "string")
                message.start = parseInt(object.start, 10);
            else if (typeof object.start === "number")
                message.start = object.start;
            else if (typeof object.start === "object")
                message.start = new $util.LongBits(object.start.low >>> 0, object.start.high >>> 0).toNumber();
        if (object.stop != null)
            if ($util.Long)
                (message.stop = $util.Long.fromValue(object.stop)).unsigned = false;
            else if (typeof object.stop === "string")
                message.stop = parseInt(object.stop, 10);
            else if (typeof object.stop === "number")
                message.stop = object.stop;
            else if (typeof object.stop === "object")
                message.stop = new $util.LongBits(object.stop.low >>> 0, object.stop.high >>> 0).toNumber();
        return message;
    };

    /**
     * Creates a plain object from a RangeIndex message. Also converts values to other types if specified.
     * @function toObject
     * @memberof RangeIndex
     * @static
     * @param {RangeIndex} message RangeIndex
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RangeIndex.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            if ($util.Long) {
                let long = new $util.Long(0, 0, false);
                object.start = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
            } else
                object.start = options.longs === String ? "0" : 0;
            if ($util.Long) {
                let long = new $util.Long(0, 0, false);
                object.stop = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
            } else
                object.stop = options.longs === String ? "0" : 0;
        }
        if (message.start != null && message.hasOwnProperty("start"))
            if (typeof message.start === "number")
                object.start = options.longs === String ? String(message.start) : message.start;
            else
                object.start = options.longs === String ? $util.Long.prototype.toString.call(message.start) : options.longs === Number ? new $util.LongBits(message.start.low >>> 0, message.start.high >>> 0).toNumber() : message.start;
        if (message.stop != null && message.hasOwnProperty("stop"))
            if (typeof message.stop === "number")
                object.stop = options.longs === String ? String(message.stop) : message.stop;
            else
                object.stop = options.longs === String ? $util.Long.prototype.toString.call(message.stop) : options.longs === Number ? new $util.LongBits(message.stop.low >>> 0, message.stop.high >>> 0).toNumber() : message.stop;
        return object;
    };

    /**
     * Converts this RangeIndex to JSON.
     * @function toJSON
     * @memberof RangeIndex
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RangeIndex.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return RangeIndex;
})();

export const MultiIndex = $root.MultiIndex = (() => {

    /**
     * Properties of a MultiIndex.
     * @exports IMultiIndex
     * @interface IMultiIndex
     * @property {Array.<IIndex>|null} [levels] MultiIndex levels
     * @property {Array.<IInt32Array>|null} [labels] MultiIndex labels
     */

    /**
     * Constructs a new MultiIndex.
     * @exports MultiIndex
     * @classdesc Represents a MultiIndex.
     * @implements IMultiIndex
     * @constructor
     * @param {IMultiIndex=} [properties] Properties to set
     */
    function MultiIndex(properties) {
        this.levels = [];
        this.labels = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * MultiIndex levels.
     * @member {Array.<IIndex>} levels
     * @memberof MultiIndex
     * @instance
     */
    MultiIndex.prototype.levels = $util.emptyArray;

    /**
     * MultiIndex labels.
     * @member {Array.<IInt32Array>} labels
     * @memberof MultiIndex
     * @instance
     */
    MultiIndex.prototype.labels = $util.emptyArray;

    /**
     * Creates a new MultiIndex instance using the specified properties.
     * @function create
     * @memberof MultiIndex
     * @static
     * @param {IMultiIndex=} [properties] Properties to set
     * @returns {MultiIndex} MultiIndex instance
     */
    MultiIndex.create = function create(properties) {
        return new MultiIndex(properties);
    };

    /**
     * Encodes the specified MultiIndex message. Does not implicitly {@link MultiIndex.verify|verify} messages.
     * @function encode
     * @memberof MultiIndex
     * @static
     * @param {IMultiIndex} message MultiIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MultiIndex.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.levels != null && message.levels.length)
            for (let i = 0; i < message.levels.length; ++i)
                $root.Index.encode(message.levels[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.labels != null && message.labels.length)
            for (let i = 0; i < message.labels.length; ++i)
                $root.Int32Array.encode(message.labels[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified MultiIndex message, length delimited. Does not implicitly {@link MultiIndex.verify|verify} messages.
     * @function encodeDelimited
     * @memberof MultiIndex
     * @static
     * @param {IMultiIndex} message MultiIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MultiIndex.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a MultiIndex message from the specified reader or buffer.
     * @function decode
     * @memberof MultiIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {MultiIndex} MultiIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MultiIndex.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.MultiIndex();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.levels && message.levels.length))
                    message.levels = [];
                message.levels.push($root.Index.decode(reader, reader.uint32()));
                break;
            case 2:
                if (!(message.labels && message.labels.length))
                    message.labels = [];
                message.labels.push($root.Int32Array.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a MultiIndex message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof MultiIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {MultiIndex} MultiIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MultiIndex.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a MultiIndex message.
     * @function verify
     * @memberof MultiIndex
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    MultiIndex.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.levels != null && message.hasOwnProperty("levels")) {
            if (!Array.isArray(message.levels))
                return "levels: array expected";
            for (let i = 0; i < message.levels.length; ++i) {
                let error = $root.Index.verify(message.levels[i]);
                if (error)
                    return "levels." + error;
            }
        }
        if (message.labels != null && message.hasOwnProperty("labels")) {
            if (!Array.isArray(message.labels))
                return "labels: array expected";
            for (let i = 0; i < message.labels.length; ++i) {
                let error = $root.Int32Array.verify(message.labels[i]);
                if (error)
                    return "labels." + error;
            }
        }
        return null;
    };

    /**
     * Creates a MultiIndex message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof MultiIndex
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {MultiIndex} MultiIndex
     */
    MultiIndex.fromObject = function fromObject(object) {
        if (object instanceof $root.MultiIndex)
            return object;
        let message = new $root.MultiIndex();
        if (object.levels) {
            if (!Array.isArray(object.levels))
                throw TypeError(".MultiIndex.levels: array expected");
            message.levels = [];
            for (let i = 0; i < object.levels.length; ++i) {
                if (typeof object.levels[i] !== "object")
                    throw TypeError(".MultiIndex.levels: object expected");
                message.levels[i] = $root.Index.fromObject(object.levels[i]);
            }
        }
        if (object.labels) {
            if (!Array.isArray(object.labels))
                throw TypeError(".MultiIndex.labels: array expected");
            message.labels = [];
            for (let i = 0; i < object.labels.length; ++i) {
                if (typeof object.labels[i] !== "object")
                    throw TypeError(".MultiIndex.labels: object expected");
                message.labels[i] = $root.Int32Array.fromObject(object.labels[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a MultiIndex message. Also converts values to other types if specified.
     * @function toObject
     * @memberof MultiIndex
     * @static
     * @param {MultiIndex} message MultiIndex
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    MultiIndex.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults) {
            object.levels = [];
            object.labels = [];
        }
        if (message.levels && message.levels.length) {
            object.levels = [];
            for (let j = 0; j < message.levels.length; ++j)
                object.levels[j] = $root.Index.toObject(message.levels[j], options);
        }
        if (message.labels && message.labels.length) {
            object.labels = [];
            for (let j = 0; j < message.labels.length; ++j)
                object.labels[j] = $root.Int32Array.toObject(message.labels[j], options);
        }
        return object;
    };

    /**
     * Converts this MultiIndex to JSON.
     * @function toJSON
     * @memberof MultiIndex
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    MultiIndex.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return MultiIndex;
})();

export const DatetimeIndex = $root.DatetimeIndex = (() => {

    /**
     * Properties of a DatetimeIndex.
     * @exports IDatetimeIndex
     * @interface IDatetimeIndex
     * @property {IInt64Array|null} [data] DatetimeIndex data
     */

    /**
     * Constructs a new DatetimeIndex.
     * @exports DatetimeIndex
     * @classdesc Represents a DatetimeIndex.
     * @implements IDatetimeIndex
     * @constructor
     * @param {IDatetimeIndex=} [properties] Properties to set
     */
    function DatetimeIndex(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DatetimeIndex data.
     * @member {IInt64Array|null|undefined} data
     * @memberof DatetimeIndex
     * @instance
     */
    DatetimeIndex.prototype.data = null;

    /**
     * Creates a new DatetimeIndex instance using the specified properties.
     * @function create
     * @memberof DatetimeIndex
     * @static
     * @param {IDatetimeIndex=} [properties] Properties to set
     * @returns {DatetimeIndex} DatetimeIndex instance
     */
    DatetimeIndex.create = function create(properties) {
        return new DatetimeIndex(properties);
    };

    /**
     * Encodes the specified DatetimeIndex message. Does not implicitly {@link DatetimeIndex.verify|verify} messages.
     * @function encode
     * @memberof DatetimeIndex
     * @static
     * @param {IDatetimeIndex} message DatetimeIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DatetimeIndex.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.Int64Array.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified DatetimeIndex message, length delimited. Does not implicitly {@link DatetimeIndex.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DatetimeIndex
     * @static
     * @param {IDatetimeIndex} message DatetimeIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DatetimeIndex.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DatetimeIndex message from the specified reader or buffer.
     * @function decode
     * @memberof DatetimeIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DatetimeIndex} DatetimeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DatetimeIndex.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.DatetimeIndex();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.Int64Array.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DatetimeIndex message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DatetimeIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DatetimeIndex} DatetimeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DatetimeIndex.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DatetimeIndex message.
     * @function verify
     * @memberof DatetimeIndex
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DatetimeIndex.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.Int64Array.verify(message.data);
            if (error)
                return "data." + error;
        }
        return null;
    };

    /**
     * Creates a DatetimeIndex message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DatetimeIndex
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DatetimeIndex} DatetimeIndex
     */
    DatetimeIndex.fromObject = function fromObject(object) {
        if (object instanceof $root.DatetimeIndex)
            return object;
        let message = new $root.DatetimeIndex();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".DatetimeIndex.data: object expected");
            message.data = $root.Int64Array.fromObject(object.data);
        }
        return message;
    };

    /**
     * Creates a plain object from a DatetimeIndex message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DatetimeIndex
     * @static
     * @param {DatetimeIndex} message DatetimeIndex
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DatetimeIndex.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.data = null;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.Int64Array.toObject(message.data, options);
        return object;
    };

    /**
     * Converts this DatetimeIndex to JSON.
     * @function toJSON
     * @memberof DatetimeIndex
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DatetimeIndex.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DatetimeIndex;
})();

export const TimedeltaIndex = $root.TimedeltaIndex = (() => {

    /**
     * Properties of a TimedeltaIndex.
     * @exports ITimedeltaIndex
     * @interface ITimedeltaIndex
     * @property {IInt64Array|null} [data] TimedeltaIndex data
     */

    /**
     * Constructs a new TimedeltaIndex.
     * @exports TimedeltaIndex
     * @classdesc Represents a TimedeltaIndex.
     * @implements ITimedeltaIndex
     * @constructor
     * @param {ITimedeltaIndex=} [properties] Properties to set
     */
    function TimedeltaIndex(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * TimedeltaIndex data.
     * @member {IInt64Array|null|undefined} data
     * @memberof TimedeltaIndex
     * @instance
     */
    TimedeltaIndex.prototype.data = null;

    /**
     * Creates a new TimedeltaIndex instance using the specified properties.
     * @function create
     * @memberof TimedeltaIndex
     * @static
     * @param {ITimedeltaIndex=} [properties] Properties to set
     * @returns {TimedeltaIndex} TimedeltaIndex instance
     */
    TimedeltaIndex.create = function create(properties) {
        return new TimedeltaIndex(properties);
    };

    /**
     * Encodes the specified TimedeltaIndex message. Does not implicitly {@link TimedeltaIndex.verify|verify} messages.
     * @function encode
     * @memberof TimedeltaIndex
     * @static
     * @param {ITimedeltaIndex} message TimedeltaIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimedeltaIndex.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.Int64Array.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified TimedeltaIndex message, length delimited. Does not implicitly {@link TimedeltaIndex.verify|verify} messages.
     * @function encodeDelimited
     * @memberof TimedeltaIndex
     * @static
     * @param {ITimedeltaIndex} message TimedeltaIndex message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TimedeltaIndex.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TimedeltaIndex message from the specified reader or buffer.
     * @function decode
     * @memberof TimedeltaIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {TimedeltaIndex} TimedeltaIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimedeltaIndex.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.TimedeltaIndex();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.Int64Array.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a TimedeltaIndex message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof TimedeltaIndex
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {TimedeltaIndex} TimedeltaIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TimedeltaIndex.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TimedeltaIndex message.
     * @function verify
     * @memberof TimedeltaIndex
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TimedeltaIndex.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.Int64Array.verify(message.data);
            if (error)
                return "data." + error;
        }
        return null;
    };

    /**
     * Creates a TimedeltaIndex message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof TimedeltaIndex
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {TimedeltaIndex} TimedeltaIndex
     */
    TimedeltaIndex.fromObject = function fromObject(object) {
        if (object instanceof $root.TimedeltaIndex)
            return object;
        let message = new $root.TimedeltaIndex();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".TimedeltaIndex.data: object expected");
            message.data = $root.Int64Array.fromObject(object.data);
        }
        return message;
    };

    /**
     * Creates a plain object from a TimedeltaIndex message. Also converts values to other types if specified.
     * @function toObject
     * @memberof TimedeltaIndex
     * @static
     * @param {TimedeltaIndex} message TimedeltaIndex
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TimedeltaIndex.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.data = null;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.Int64Array.toObject(message.data, options);
        return object;
    };

    /**
     * Converts this TimedeltaIndex to JSON.
     * @function toJSON
     * @memberof TimedeltaIndex
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TimedeltaIndex.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return TimedeltaIndex;
})();

export const Int64Index = $root.Int64Index = (() => {

    /**
     * Properties of an Int64Index.
     * @exports IInt64Index
     * @interface IInt64Index
     * @property {IInt64Array|null} [data] Int64Index data
     */

    /**
     * Constructs a new Int64Index.
     * @exports Int64Index
     * @classdesc Represents an Int64Index.
     * @implements IInt64Index
     * @constructor
     * @param {IInt64Index=} [properties] Properties to set
     */
    function Int64Index(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Int64Index data.
     * @member {IInt64Array|null|undefined} data
     * @memberof Int64Index
     * @instance
     */
    Int64Index.prototype.data = null;

    /**
     * Creates a new Int64Index instance using the specified properties.
     * @function create
     * @memberof Int64Index
     * @static
     * @param {IInt64Index=} [properties] Properties to set
     * @returns {Int64Index} Int64Index instance
     */
    Int64Index.create = function create(properties) {
        return new Int64Index(properties);
    };

    /**
     * Encodes the specified Int64Index message. Does not implicitly {@link Int64Index.verify|verify} messages.
     * @function encode
     * @memberof Int64Index
     * @static
     * @param {IInt64Index} message Int64Index message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Int64Index.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.Int64Array.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Int64Index message, length delimited. Does not implicitly {@link Int64Index.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Int64Index
     * @static
     * @param {IInt64Index} message Int64Index message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Int64Index.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Int64Index message from the specified reader or buffer.
     * @function decode
     * @memberof Int64Index
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Int64Index} Int64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Int64Index.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Int64Index();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.Int64Array.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Int64Index message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Int64Index
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Int64Index} Int64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Int64Index.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Int64Index message.
     * @function verify
     * @memberof Int64Index
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Int64Index.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.Int64Array.verify(message.data);
            if (error)
                return "data." + error;
        }
        return null;
    };

    /**
     * Creates an Int64Index message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Int64Index
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Int64Index} Int64Index
     */
    Int64Index.fromObject = function fromObject(object) {
        if (object instanceof $root.Int64Index)
            return object;
        let message = new $root.Int64Index();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".Int64Index.data: object expected");
            message.data = $root.Int64Array.fromObject(object.data);
        }
        return message;
    };

    /**
     * Creates a plain object from an Int64Index message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Int64Index
     * @static
     * @param {Int64Index} message Int64Index
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Int64Index.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.data = null;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.Int64Array.toObject(message.data, options);
        return object;
    };

    /**
     * Converts this Int64Index to JSON.
     * @function toJSON
     * @memberof Int64Index
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Int64Index.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Int64Index;
})();

export const Float64Index = $root.Float64Index = (() => {

    /**
     * Properties of a Float64Index.
     * @exports IFloat64Index
     * @interface IFloat64Index
     * @property {IDoubleArray|null} [data] Float64Index data
     */

    /**
     * Constructs a new Float64Index.
     * @exports Float64Index
     * @classdesc Represents a Float64Index.
     * @implements IFloat64Index
     * @constructor
     * @param {IFloat64Index=} [properties] Properties to set
     */
    function Float64Index(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Float64Index data.
     * @member {IDoubleArray|null|undefined} data
     * @memberof Float64Index
     * @instance
     */
    Float64Index.prototype.data = null;

    /**
     * Creates a new Float64Index instance using the specified properties.
     * @function create
     * @memberof Float64Index
     * @static
     * @param {IFloat64Index=} [properties] Properties to set
     * @returns {Float64Index} Float64Index instance
     */
    Float64Index.create = function create(properties) {
        return new Float64Index(properties);
    };

    /**
     * Encodes the specified Float64Index message. Does not implicitly {@link Float64Index.verify|verify} messages.
     * @function encode
     * @memberof Float64Index
     * @static
     * @param {IFloat64Index} message Float64Index message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Float64Index.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.DoubleArray.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Float64Index message, length delimited. Does not implicitly {@link Float64Index.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Float64Index
     * @static
     * @param {IFloat64Index} message Float64Index message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Float64Index.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Float64Index message from the specified reader or buffer.
     * @function decode
     * @memberof Float64Index
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Float64Index} Float64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Float64Index.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Float64Index();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.DoubleArray.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Float64Index message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Float64Index
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Float64Index} Float64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Float64Index.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Float64Index message.
     * @function verify
     * @memberof Float64Index
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Float64Index.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.DoubleArray.verify(message.data);
            if (error)
                return "data." + error;
        }
        return null;
    };

    /**
     * Creates a Float64Index message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Float64Index
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Float64Index} Float64Index
     */
    Float64Index.fromObject = function fromObject(object) {
        if (object instanceof $root.Float64Index)
            return object;
        let message = new $root.Float64Index();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".Float64Index.data: object expected");
            message.data = $root.DoubleArray.fromObject(object.data);
        }
        return message;
    };

    /**
     * Creates a plain object from a Float64Index message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Float64Index
     * @static
     * @param {Float64Index} message Float64Index
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Float64Index.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.data = null;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.DoubleArray.toObject(message.data, options);
        return object;
    };

    /**
     * Converts this Float64Index to JSON.
     * @function toJSON
     * @memberof Float64Index
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Float64Index.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Float64Index;
})();

export const StringArray = $root.StringArray = (() => {

    /**
     * Properties of a StringArray.
     * @exports IStringArray
     * @interface IStringArray
     * @property {Array.<string>|null} [data] StringArray data
     */

    /**
     * Constructs a new StringArray.
     * @exports StringArray
     * @classdesc Represents a StringArray.
     * @implements IStringArray
     * @constructor
     * @param {IStringArray=} [properties] Properties to set
     */
    function StringArray(properties) {
        this.data = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * StringArray data.
     * @member {Array.<string>} data
     * @memberof StringArray
     * @instance
     */
    StringArray.prototype.data = $util.emptyArray;

    /**
     * Creates a new StringArray instance using the specified properties.
     * @function create
     * @memberof StringArray
     * @static
     * @param {IStringArray=} [properties] Properties to set
     * @returns {StringArray} StringArray instance
     */
    StringArray.create = function create(properties) {
        return new StringArray(properties);
    };

    /**
     * Encodes the specified StringArray message. Does not implicitly {@link StringArray.verify|verify} messages.
     * @function encode
     * @memberof StringArray
     * @static
     * @param {IStringArray} message StringArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    StringArray.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.data.length)
            for (let i = 0; i < message.data.length; ++i)
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.data[i]);
        return writer;
    };

    /**
     * Encodes the specified StringArray message, length delimited. Does not implicitly {@link StringArray.verify|verify} messages.
     * @function encodeDelimited
     * @memberof StringArray
     * @static
     * @param {IStringArray} message StringArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    StringArray.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a StringArray message from the specified reader or buffer.
     * @function decode
     * @memberof StringArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {StringArray} StringArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    StringArray.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.StringArray();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.data && message.data.length))
                    message.data = [];
                message.data.push(reader.string());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a StringArray message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof StringArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {StringArray} StringArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    StringArray.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a StringArray message.
     * @function verify
     * @memberof StringArray
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    StringArray.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            if (!Array.isArray(message.data))
                return "data: array expected";
            for (let i = 0; i < message.data.length; ++i)
                if (!$util.isString(message.data[i]))
                    return "data: string[] expected";
        }
        return null;
    };

    /**
     * Creates a StringArray message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof StringArray
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {StringArray} StringArray
     */
    StringArray.fromObject = function fromObject(object) {
        if (object instanceof $root.StringArray)
            return object;
        let message = new $root.StringArray();
        if (object.data) {
            if (!Array.isArray(object.data))
                throw TypeError(".StringArray.data: array expected");
            message.data = [];
            for (let i = 0; i < object.data.length; ++i)
                message.data[i] = String(object.data[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from a StringArray message. Also converts values to other types if specified.
     * @function toObject
     * @memberof StringArray
     * @static
     * @param {StringArray} message StringArray
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    StringArray.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.data = [];
        if (message.data && message.data.length) {
            object.data = [];
            for (let j = 0; j < message.data.length; ++j)
                object.data[j] = message.data[j];
        }
        return object;
    };

    /**
     * Converts this StringArray to JSON.
     * @function toJSON
     * @memberof StringArray
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    StringArray.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return StringArray;
})();

export const DoubleArray = $root.DoubleArray = (() => {

    /**
     * Properties of a DoubleArray.
     * @exports IDoubleArray
     * @interface IDoubleArray
     * @property {Array.<number>|null} [data] DoubleArray data
     */

    /**
     * Constructs a new DoubleArray.
     * @exports DoubleArray
     * @classdesc Represents a DoubleArray.
     * @implements IDoubleArray
     * @constructor
     * @param {IDoubleArray=} [properties] Properties to set
     */
    function DoubleArray(properties) {
        this.data = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DoubleArray data.
     * @member {Array.<number>} data
     * @memberof DoubleArray
     * @instance
     */
    DoubleArray.prototype.data = $util.emptyArray;

    /**
     * Creates a new DoubleArray instance using the specified properties.
     * @function create
     * @memberof DoubleArray
     * @static
     * @param {IDoubleArray=} [properties] Properties to set
     * @returns {DoubleArray} DoubleArray instance
     */
    DoubleArray.create = function create(properties) {
        return new DoubleArray(properties);
    };

    /**
     * Encodes the specified DoubleArray message. Does not implicitly {@link DoubleArray.verify|verify} messages.
     * @function encode
     * @memberof DoubleArray
     * @static
     * @param {IDoubleArray} message DoubleArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DoubleArray.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.data.length) {
            writer.uint32(/* id 1, wireType 2 =*/10).fork();
            for (let i = 0; i < message.data.length; ++i)
                writer.double(message.data[i]);
            writer.ldelim();
        }
        return writer;
    };

    /**
     * Encodes the specified DoubleArray message, length delimited. Does not implicitly {@link DoubleArray.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DoubleArray
     * @static
     * @param {IDoubleArray} message DoubleArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DoubleArray.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DoubleArray message from the specified reader or buffer.
     * @function decode
     * @memberof DoubleArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DoubleArray} DoubleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DoubleArray.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.DoubleArray();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.data && message.data.length))
                    message.data = [];
                if ((tag & 7) === 2) {
                    let end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.data.push(reader.double());
                } else
                    message.data.push(reader.double());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DoubleArray message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DoubleArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DoubleArray} DoubleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DoubleArray.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DoubleArray message.
     * @function verify
     * @memberof DoubleArray
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DoubleArray.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            if (!Array.isArray(message.data))
                return "data: array expected";
            for (let i = 0; i < message.data.length; ++i)
                if (typeof message.data[i] !== "number")
                    return "data: number[] expected";
        }
        return null;
    };

    /**
     * Creates a DoubleArray message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DoubleArray
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DoubleArray} DoubleArray
     */
    DoubleArray.fromObject = function fromObject(object) {
        if (object instanceof $root.DoubleArray)
            return object;
        let message = new $root.DoubleArray();
        if (object.data) {
            if (!Array.isArray(object.data))
                throw TypeError(".DoubleArray.data: array expected");
            message.data = [];
            for (let i = 0; i < object.data.length; ++i)
                message.data[i] = Number(object.data[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from a DoubleArray message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DoubleArray
     * @static
     * @param {DoubleArray} message DoubleArray
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DoubleArray.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.data = [];
        if (message.data && message.data.length) {
            object.data = [];
            for (let j = 0; j < message.data.length; ++j)
                object.data[j] = options.json && !isFinite(message.data[j]) ? String(message.data[j]) : message.data[j];
        }
        return object;
    };

    /**
     * Converts this DoubleArray to JSON.
     * @function toJSON
     * @memberof DoubleArray
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DoubleArray.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DoubleArray;
})();

export const Int32Array = $root.Int32Array = (() => {

    /**
     * Properties of an Int32Array.
     * @exports IInt32Array
     * @interface IInt32Array
     * @property {Array.<number>|null} [data] Int32Array data
     */

    /**
     * Constructs a new Int32Array.
     * @exports Int32Array
     * @classdesc Represents an Int32Array.
     * @implements IInt32Array
     * @constructor
     * @param {IInt32Array=} [properties] Properties to set
     */
    function Int32Array(properties) {
        this.data = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Int32Array data.
     * @member {Array.<number>} data
     * @memberof Int32Array
     * @instance
     */
    Int32Array.prototype.data = $util.emptyArray;

    /**
     * Creates a new Int32Array instance using the specified properties.
     * @function create
     * @memberof Int32Array
     * @static
     * @param {IInt32Array=} [properties] Properties to set
     * @returns {Int32Array} Int32Array instance
     */
    Int32Array.create = function create(properties) {
        return new Int32Array(properties);
    };

    /**
     * Encodes the specified Int32Array message. Does not implicitly {@link Int32Array.verify|verify} messages.
     * @function encode
     * @memberof Int32Array
     * @static
     * @param {IInt32Array} message Int32Array message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Int32Array.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.data.length) {
            writer.uint32(/* id 1, wireType 2 =*/10).fork();
            for (let i = 0; i < message.data.length; ++i)
                writer.int32(message.data[i]);
            writer.ldelim();
        }
        return writer;
    };

    /**
     * Encodes the specified Int32Array message, length delimited. Does not implicitly {@link Int32Array.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Int32Array
     * @static
     * @param {IInt32Array} message Int32Array message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Int32Array.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Int32Array message from the specified reader or buffer.
     * @function decode
     * @memberof Int32Array
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Int32Array} Int32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Int32Array.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Int32Array();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.data && message.data.length))
                    message.data = [];
                if ((tag & 7) === 2) {
                    let end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.data.push(reader.int32());
                } else
                    message.data.push(reader.int32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Int32Array message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Int32Array
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Int32Array} Int32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Int32Array.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Int32Array message.
     * @function verify
     * @memberof Int32Array
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Int32Array.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            if (!Array.isArray(message.data))
                return "data: array expected";
            for (let i = 0; i < message.data.length; ++i)
                if (!$util.isInteger(message.data[i]))
                    return "data: integer[] expected";
        }
        return null;
    };

    /**
     * Creates an Int32Array message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Int32Array
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Int32Array} Int32Array
     */
    Int32Array.fromObject = function fromObject(object) {
        if (object instanceof $root.Int32Array)
            return object;
        let message = new $root.Int32Array();
        if (object.data) {
            if (!Array.isArray(object.data))
                throw TypeError(".Int32Array.data: array expected");
            message.data = [];
            for (let i = 0; i < object.data.length; ++i)
                message.data[i] = object.data[i] | 0;
        }
        return message;
    };

    /**
     * Creates a plain object from an Int32Array message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Int32Array
     * @static
     * @param {Int32Array} message Int32Array
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Int32Array.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.data = [];
        if (message.data && message.data.length) {
            object.data = [];
            for (let j = 0; j < message.data.length; ++j)
                object.data[j] = message.data[j];
        }
        return object;
    };

    /**
     * Converts this Int32Array to JSON.
     * @function toJSON
     * @memberof Int32Array
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Int32Array.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Int32Array;
})();

export const Int64Array = $root.Int64Array = (() => {

    /**
     * Properties of an Int64Array.
     * @exports IInt64Array
     * @interface IInt64Array
     * @property {Array.<number|Long>|null} [data] Int64Array data
     */

    /**
     * Constructs a new Int64Array.
     * @exports Int64Array
     * @classdesc Represents an Int64Array.
     * @implements IInt64Array
     * @constructor
     * @param {IInt64Array=} [properties] Properties to set
     */
    function Int64Array(properties) {
        this.data = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Int64Array data.
     * @member {Array.<number|Long>} data
     * @memberof Int64Array
     * @instance
     */
    Int64Array.prototype.data = $util.emptyArray;

    /**
     * Creates a new Int64Array instance using the specified properties.
     * @function create
     * @memberof Int64Array
     * @static
     * @param {IInt64Array=} [properties] Properties to set
     * @returns {Int64Array} Int64Array instance
     */
    Int64Array.create = function create(properties) {
        return new Int64Array(properties);
    };

    /**
     * Encodes the specified Int64Array message. Does not implicitly {@link Int64Array.verify|verify} messages.
     * @function encode
     * @memberof Int64Array
     * @static
     * @param {IInt64Array} message Int64Array message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Int64Array.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.data.length) {
            writer.uint32(/* id 1, wireType 2 =*/10).fork();
            for (let i = 0; i < message.data.length; ++i)
                writer.int64(message.data[i]);
            writer.ldelim();
        }
        return writer;
    };

    /**
     * Encodes the specified Int64Array message, length delimited. Does not implicitly {@link Int64Array.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Int64Array
     * @static
     * @param {IInt64Array} message Int64Array message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Int64Array.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Int64Array message from the specified reader or buffer.
     * @function decode
     * @memberof Int64Array
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Int64Array} Int64Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Int64Array.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Int64Array();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.data && message.data.length))
                    message.data = [];
                if ((tag & 7) === 2) {
                    let end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.data.push(reader.int64());
                } else
                    message.data.push(reader.int64());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Int64Array message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Int64Array
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Int64Array} Int64Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Int64Array.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Int64Array message.
     * @function verify
     * @memberof Int64Array
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Int64Array.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            if (!Array.isArray(message.data))
                return "data: array expected";
            for (let i = 0; i < message.data.length; ++i)
                if (!$util.isInteger(message.data[i]) && !(message.data[i] && $util.isInteger(message.data[i].low) && $util.isInteger(message.data[i].high)))
                    return "data: integer|Long[] expected";
        }
        return null;
    };

    /**
     * Creates an Int64Array message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Int64Array
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Int64Array} Int64Array
     */
    Int64Array.fromObject = function fromObject(object) {
        if (object instanceof $root.Int64Array)
            return object;
        let message = new $root.Int64Array();
        if (object.data) {
            if (!Array.isArray(object.data))
                throw TypeError(".Int64Array.data: array expected");
            message.data = [];
            for (let i = 0; i < object.data.length; ++i)
                if ($util.Long)
                    (message.data[i] = $util.Long.fromValue(object.data[i])).unsigned = false;
                else if (typeof object.data[i] === "string")
                    message.data[i] = parseInt(object.data[i], 10);
                else if (typeof object.data[i] === "number")
                    message.data[i] = object.data[i];
                else if (typeof object.data[i] === "object")
                    message.data[i] = new $util.LongBits(object.data[i].low >>> 0, object.data[i].high >>> 0).toNumber();
        }
        return message;
    };

    /**
     * Creates a plain object from an Int64Array message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Int64Array
     * @static
     * @param {Int64Array} message Int64Array
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Int64Array.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.data = [];
        if (message.data && message.data.length) {
            object.data = [];
            for (let j = 0; j < message.data.length; ++j)
                if (typeof message.data[j] === "number")
                    object.data[j] = options.longs === String ? String(message.data[j]) : message.data[j];
                else
                    object.data[j] = options.longs === String ? $util.Long.prototype.toString.call(message.data[j]) : options.longs === Number ? new $util.LongBits(message.data[j].low >>> 0, message.data[j].high >>> 0).toNumber() : message.data[j];
        }
        return object;
    };

    /**
     * Converts this Int64Array to JSON.
     * @function toJSON
     * @memberof Int64Array
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Int64Array.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Int64Array;
})();

export const UInt32Array = $root.UInt32Array = (() => {

    /**
     * Properties of a UInt32Array.
     * @exports IUInt32Array
     * @interface IUInt32Array
     * @property {Array.<number>|null} [data] UInt32Array data
     */

    /**
     * Constructs a new UInt32Array.
     * @exports UInt32Array
     * @classdesc Represents a UInt32Array.
     * @implements IUInt32Array
     * @constructor
     * @param {IUInt32Array=} [properties] Properties to set
     */
    function UInt32Array(properties) {
        this.data = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * UInt32Array data.
     * @member {Array.<number>} data
     * @memberof UInt32Array
     * @instance
     */
    UInt32Array.prototype.data = $util.emptyArray;

    /**
     * Creates a new UInt32Array instance using the specified properties.
     * @function create
     * @memberof UInt32Array
     * @static
     * @param {IUInt32Array=} [properties] Properties to set
     * @returns {UInt32Array} UInt32Array instance
     */
    UInt32Array.create = function create(properties) {
        return new UInt32Array(properties);
    };

    /**
     * Encodes the specified UInt32Array message. Does not implicitly {@link UInt32Array.verify|verify} messages.
     * @function encode
     * @memberof UInt32Array
     * @static
     * @param {IUInt32Array} message UInt32Array message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UInt32Array.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.data.length) {
            writer.uint32(/* id 1, wireType 2 =*/10).fork();
            for (let i = 0; i < message.data.length; ++i)
                writer.uint32(message.data[i]);
            writer.ldelim();
        }
        return writer;
    };

    /**
     * Encodes the specified UInt32Array message, length delimited. Does not implicitly {@link UInt32Array.verify|verify} messages.
     * @function encodeDelimited
     * @memberof UInt32Array
     * @static
     * @param {IUInt32Array} message UInt32Array message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UInt32Array.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UInt32Array message from the specified reader or buffer.
     * @function decode
     * @memberof UInt32Array
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {UInt32Array} UInt32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UInt32Array.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.UInt32Array();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.data && message.data.length))
                    message.data = [];
                if ((tag & 7) === 2) {
                    let end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.data.push(reader.uint32());
                } else
                    message.data.push(reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a UInt32Array message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof UInt32Array
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {UInt32Array} UInt32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UInt32Array.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UInt32Array message.
     * @function verify
     * @memberof UInt32Array
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UInt32Array.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            if (!Array.isArray(message.data))
                return "data: array expected";
            for (let i = 0; i < message.data.length; ++i)
                if (!$util.isInteger(message.data[i]))
                    return "data: integer[] expected";
        }
        return null;
    };

    /**
     * Creates a UInt32Array message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof UInt32Array
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {UInt32Array} UInt32Array
     */
    UInt32Array.fromObject = function fromObject(object) {
        if (object instanceof $root.UInt32Array)
            return object;
        let message = new $root.UInt32Array();
        if (object.data) {
            if (!Array.isArray(object.data))
                throw TypeError(".UInt32Array.data: array expected");
            message.data = [];
            for (let i = 0; i < object.data.length; ++i)
                message.data[i] = object.data[i] >>> 0;
        }
        return message;
    };

    /**
     * Creates a plain object from a UInt32Array message. Also converts values to other types if specified.
     * @function toObject
     * @memberof UInt32Array
     * @static
     * @param {UInt32Array} message UInt32Array
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UInt32Array.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.data = [];
        if (message.data && message.data.length) {
            object.data = [];
            for (let j = 0; j < message.data.length; ++j)
                object.data[j] = message.data[j];
        }
        return object;
    };

    /**
     * Converts this UInt32Array to JSON.
     * @function toJSON
     * @memberof UInt32Array
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UInt32Array.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return UInt32Array;
})();

export const CSSStyle = $root.CSSStyle = (() => {

    /**
     * Properties of a CSSStyle.
     * @exports ICSSStyle
     * @interface ICSSStyle
     * @property {string|null} [property] CSSStyle property
     * @property {string|null} [value] CSSStyle value
     */

    /**
     * Constructs a new CSSStyle.
     * @exports CSSStyle
     * @classdesc Represents a CSSStyle.
     * @implements ICSSStyle
     * @constructor
     * @param {ICSSStyle=} [properties] Properties to set
     */
    function CSSStyle(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * CSSStyle property.
     * @member {string} property
     * @memberof CSSStyle
     * @instance
     */
    CSSStyle.prototype.property = "";

    /**
     * CSSStyle value.
     * @member {string} value
     * @memberof CSSStyle
     * @instance
     */
    CSSStyle.prototype.value = "";

    /**
     * Creates a new CSSStyle instance using the specified properties.
     * @function create
     * @memberof CSSStyle
     * @static
     * @param {ICSSStyle=} [properties] Properties to set
     * @returns {CSSStyle} CSSStyle instance
     */
    CSSStyle.create = function create(properties) {
        return new CSSStyle(properties);
    };

    /**
     * Encodes the specified CSSStyle message. Does not implicitly {@link CSSStyle.verify|verify} messages.
     * @function encode
     * @memberof CSSStyle
     * @static
     * @param {ICSSStyle} message CSSStyle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CSSStyle.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.property != null && message.hasOwnProperty("property"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.property);
        if (message.value != null && message.hasOwnProperty("value"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.value);
        return writer;
    };

    /**
     * Encodes the specified CSSStyle message, length delimited. Does not implicitly {@link CSSStyle.verify|verify} messages.
     * @function encodeDelimited
     * @memberof CSSStyle
     * @static
     * @param {ICSSStyle} message CSSStyle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CSSStyle.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a CSSStyle message from the specified reader or buffer.
     * @function decode
     * @memberof CSSStyle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {CSSStyle} CSSStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CSSStyle.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.CSSStyle();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.property = reader.string();
                break;
            case 2:
                message.value = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a CSSStyle message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof CSSStyle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {CSSStyle} CSSStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CSSStyle.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a CSSStyle message.
     * @function verify
     * @memberof CSSStyle
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    CSSStyle.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.property != null && message.hasOwnProperty("property"))
            if (!$util.isString(message.property))
                return "property: string expected";
        if (message.value != null && message.hasOwnProperty("value"))
            if (!$util.isString(message.value))
                return "value: string expected";
        return null;
    };

    /**
     * Creates a CSSStyle message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof CSSStyle
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {CSSStyle} CSSStyle
     */
    CSSStyle.fromObject = function fromObject(object) {
        if (object instanceof $root.CSSStyle)
            return object;
        let message = new $root.CSSStyle();
        if (object.property != null)
            message.property = String(object.property);
        if (object.value != null)
            message.value = String(object.value);
        return message;
    };

    /**
     * Creates a plain object from a CSSStyle message. Also converts values to other types if specified.
     * @function toObject
     * @memberof CSSStyle
     * @static
     * @param {CSSStyle} message CSSStyle
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    CSSStyle.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.property = "";
            object.value = "";
        }
        if (message.property != null && message.hasOwnProperty("property"))
            object.property = message.property;
        if (message.value != null && message.hasOwnProperty("value"))
            object.value = message.value;
        return object;
    };

    /**
     * Converts this CSSStyle to JSON.
     * @function toJSON
     * @memberof CSSStyle
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    CSSStyle.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return CSSStyle;
})();

export const CellStyle = $root.CellStyle = (() => {

    /**
     * Properties of a CellStyle.
     * @exports ICellStyle
     * @interface ICellStyle
     * @property {Array.<ICSSStyle>|null} [css] CellStyle css
     * @property {string|null} [displayValue] CellStyle displayValue
     * @property {boolean|null} [hasDisplayValue] CellStyle hasDisplayValue
     */

    /**
     * Constructs a new CellStyle.
     * @exports CellStyle
     * @classdesc Represents a CellStyle.
     * @implements ICellStyle
     * @constructor
     * @param {ICellStyle=} [properties] Properties to set
     */
    function CellStyle(properties) {
        this.css = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * CellStyle css.
     * @member {Array.<ICSSStyle>} css
     * @memberof CellStyle
     * @instance
     */
    CellStyle.prototype.css = $util.emptyArray;

    /**
     * CellStyle displayValue.
     * @member {string} displayValue
     * @memberof CellStyle
     * @instance
     */
    CellStyle.prototype.displayValue = "";

    /**
     * CellStyle hasDisplayValue.
     * @member {boolean} hasDisplayValue
     * @memberof CellStyle
     * @instance
     */
    CellStyle.prototype.hasDisplayValue = false;

    /**
     * Creates a new CellStyle instance using the specified properties.
     * @function create
     * @memberof CellStyle
     * @static
     * @param {ICellStyle=} [properties] Properties to set
     * @returns {CellStyle} CellStyle instance
     */
    CellStyle.create = function create(properties) {
        return new CellStyle(properties);
    };

    /**
     * Encodes the specified CellStyle message. Does not implicitly {@link CellStyle.verify|verify} messages.
     * @function encode
     * @memberof CellStyle
     * @static
     * @param {ICellStyle} message CellStyle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CellStyle.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.css != null && message.css.length)
            for (let i = 0; i < message.css.length; ++i)
                $root.CSSStyle.encode(message.css[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.displayValue != null && message.hasOwnProperty("displayValue"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.displayValue);
        if (message.hasDisplayValue != null && message.hasOwnProperty("hasDisplayValue"))
            writer.uint32(/* id 3, wireType 0 =*/24).bool(message.hasDisplayValue);
        return writer;
    };

    /**
     * Encodes the specified CellStyle message, length delimited. Does not implicitly {@link CellStyle.verify|verify} messages.
     * @function encodeDelimited
     * @memberof CellStyle
     * @static
     * @param {ICellStyle} message CellStyle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CellStyle.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a CellStyle message from the specified reader or buffer.
     * @function decode
     * @memberof CellStyle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {CellStyle} CellStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CellStyle.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.CellStyle();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.css && message.css.length))
                    message.css = [];
                message.css.push($root.CSSStyle.decode(reader, reader.uint32()));
                break;
            case 2:
                message.displayValue = reader.string();
                break;
            case 3:
                message.hasDisplayValue = reader.bool();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a CellStyle message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof CellStyle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {CellStyle} CellStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CellStyle.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a CellStyle message.
     * @function verify
     * @memberof CellStyle
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    CellStyle.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.css != null && message.hasOwnProperty("css")) {
            if (!Array.isArray(message.css))
                return "css: array expected";
            for (let i = 0; i < message.css.length; ++i) {
                let error = $root.CSSStyle.verify(message.css[i]);
                if (error)
                    return "css." + error;
            }
        }
        if (message.displayValue != null && message.hasOwnProperty("displayValue"))
            if (!$util.isString(message.displayValue))
                return "displayValue: string expected";
        if (message.hasDisplayValue != null && message.hasOwnProperty("hasDisplayValue"))
            if (typeof message.hasDisplayValue !== "boolean")
                return "hasDisplayValue: boolean expected";
        return null;
    };

    /**
     * Creates a CellStyle message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof CellStyle
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {CellStyle} CellStyle
     */
    CellStyle.fromObject = function fromObject(object) {
        if (object instanceof $root.CellStyle)
            return object;
        let message = new $root.CellStyle();
        if (object.css) {
            if (!Array.isArray(object.css))
                throw TypeError(".CellStyle.css: array expected");
            message.css = [];
            for (let i = 0; i < object.css.length; ++i) {
                if (typeof object.css[i] !== "object")
                    throw TypeError(".CellStyle.css: object expected");
                message.css[i] = $root.CSSStyle.fromObject(object.css[i]);
            }
        }
        if (object.displayValue != null)
            message.displayValue = String(object.displayValue);
        if (object.hasDisplayValue != null)
            message.hasDisplayValue = Boolean(object.hasDisplayValue);
        return message;
    };

    /**
     * Creates a plain object from a CellStyle message. Also converts values to other types if specified.
     * @function toObject
     * @memberof CellStyle
     * @static
     * @param {CellStyle} message CellStyle
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    CellStyle.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.css = [];
        if (options.defaults) {
            object.displayValue = "";
            object.hasDisplayValue = false;
        }
        if (message.css && message.css.length) {
            object.css = [];
            for (let j = 0; j < message.css.length; ++j)
                object.css[j] = $root.CSSStyle.toObject(message.css[j], options);
        }
        if (message.displayValue != null && message.hasOwnProperty("displayValue"))
            object.displayValue = message.displayValue;
        if (message.hasDisplayValue != null && message.hasOwnProperty("hasDisplayValue"))
            object.hasDisplayValue = message.hasDisplayValue;
        return object;
    };

    /**
     * Converts this CellStyle to JSON.
     * @function toJSON
     * @memberof CellStyle
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    CellStyle.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return CellStyle;
})();

export const CellStyleArray = $root.CellStyleArray = (() => {

    /**
     * Properties of a CellStyleArray.
     * @exports ICellStyleArray
     * @interface ICellStyleArray
     * @property {Array.<ICellStyle>|null} [styles] CellStyleArray styles
     */

    /**
     * Constructs a new CellStyleArray.
     * @exports CellStyleArray
     * @classdesc Represents a CellStyleArray.
     * @implements ICellStyleArray
     * @constructor
     * @param {ICellStyleArray=} [properties] Properties to set
     */
    function CellStyleArray(properties) {
        this.styles = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * CellStyleArray styles.
     * @member {Array.<ICellStyle>} styles
     * @memberof CellStyleArray
     * @instance
     */
    CellStyleArray.prototype.styles = $util.emptyArray;

    /**
     * Creates a new CellStyleArray instance using the specified properties.
     * @function create
     * @memberof CellStyleArray
     * @static
     * @param {ICellStyleArray=} [properties] Properties to set
     * @returns {CellStyleArray} CellStyleArray instance
     */
    CellStyleArray.create = function create(properties) {
        return new CellStyleArray(properties);
    };

    /**
     * Encodes the specified CellStyleArray message. Does not implicitly {@link CellStyleArray.verify|verify} messages.
     * @function encode
     * @memberof CellStyleArray
     * @static
     * @param {ICellStyleArray} message CellStyleArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CellStyleArray.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.styles != null && message.styles.length)
            for (let i = 0; i < message.styles.length; ++i)
                $root.CellStyle.encode(message.styles[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified CellStyleArray message, length delimited. Does not implicitly {@link CellStyleArray.verify|verify} messages.
     * @function encodeDelimited
     * @memberof CellStyleArray
     * @static
     * @param {ICellStyleArray} message CellStyleArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CellStyleArray.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a CellStyleArray message from the specified reader or buffer.
     * @function decode
     * @memberof CellStyleArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {CellStyleArray} CellStyleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CellStyleArray.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.CellStyleArray();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.styles && message.styles.length))
                    message.styles = [];
                message.styles.push($root.CellStyle.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a CellStyleArray message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof CellStyleArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {CellStyleArray} CellStyleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CellStyleArray.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a CellStyleArray message.
     * @function verify
     * @memberof CellStyleArray
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    CellStyleArray.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.styles != null && message.hasOwnProperty("styles")) {
            if (!Array.isArray(message.styles))
                return "styles: array expected";
            for (let i = 0; i < message.styles.length; ++i) {
                let error = $root.CellStyle.verify(message.styles[i]);
                if (error)
                    return "styles." + error;
            }
        }
        return null;
    };

    /**
     * Creates a CellStyleArray message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof CellStyleArray
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {CellStyleArray} CellStyleArray
     */
    CellStyleArray.fromObject = function fromObject(object) {
        if (object instanceof $root.CellStyleArray)
            return object;
        let message = new $root.CellStyleArray();
        if (object.styles) {
            if (!Array.isArray(object.styles))
                throw TypeError(".CellStyleArray.styles: array expected");
            message.styles = [];
            for (let i = 0; i < object.styles.length; ++i) {
                if (typeof object.styles[i] !== "object")
                    throw TypeError(".CellStyleArray.styles: object expected");
                message.styles[i] = $root.CellStyle.fromObject(object.styles[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a CellStyleArray message. Also converts values to other types if specified.
     * @function toObject
     * @memberof CellStyleArray
     * @static
     * @param {CellStyleArray} message CellStyleArray
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    CellStyleArray.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.styles = [];
        if (message.styles && message.styles.length) {
            object.styles = [];
            for (let j = 0; j < message.styles.length; ++j)
                object.styles[j] = $root.CellStyle.toObject(message.styles[j], options);
        }
        return object;
    };

    /**
     * Converts this CellStyleArray to JSON.
     * @function toJSON
     * @memberof CellStyleArray
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    CellStyleArray.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return CellStyleArray;
})();

export const AnyArray = $root.AnyArray = (() => {

    /**
     * Properties of an AnyArray.
     * @exports IAnyArray
     * @interface IAnyArray
     * @property {IStringArray|null} [strings] AnyArray strings
     * @property {IDoubleArray|null} [doubles] AnyArray doubles
     * @property {IInt64Array|null} [int64s] AnyArray int64s
     * @property {IInt64Array|null} [datetimes] AnyArray datetimes
     * @property {IInt64Array|null} [timedeltas] AnyArray timedeltas
     */

    /**
     * Constructs a new AnyArray.
     * @exports AnyArray
     * @classdesc Represents an AnyArray.
     * @implements IAnyArray
     * @constructor
     * @param {IAnyArray=} [properties] Properties to set
     */
    function AnyArray(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * AnyArray strings.
     * @member {IStringArray|null|undefined} strings
     * @memberof AnyArray
     * @instance
     */
    AnyArray.prototype.strings = null;

    /**
     * AnyArray doubles.
     * @member {IDoubleArray|null|undefined} doubles
     * @memberof AnyArray
     * @instance
     */
    AnyArray.prototype.doubles = null;

    /**
     * AnyArray int64s.
     * @member {IInt64Array|null|undefined} int64s
     * @memberof AnyArray
     * @instance
     */
    AnyArray.prototype.int64s = null;

    /**
     * AnyArray datetimes.
     * @member {IInt64Array|null|undefined} datetimes
     * @memberof AnyArray
     * @instance
     */
    AnyArray.prototype.datetimes = null;

    /**
     * AnyArray timedeltas.
     * @member {IInt64Array|null|undefined} timedeltas
     * @memberof AnyArray
     * @instance
     */
    AnyArray.prototype.timedeltas = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * AnyArray type.
     * @member {"strings"|"doubles"|"int64s"|"datetimes"|"timedeltas"|undefined} type
     * @memberof AnyArray
     * @instance
     */
    Object.defineProperty(AnyArray.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["strings", "doubles", "int64s", "datetimes", "timedeltas"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new AnyArray instance using the specified properties.
     * @function create
     * @memberof AnyArray
     * @static
     * @param {IAnyArray=} [properties] Properties to set
     * @returns {AnyArray} AnyArray instance
     */
    AnyArray.create = function create(properties) {
        return new AnyArray(properties);
    };

    /**
     * Encodes the specified AnyArray message. Does not implicitly {@link AnyArray.verify|verify} messages.
     * @function encode
     * @memberof AnyArray
     * @static
     * @param {IAnyArray} message AnyArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AnyArray.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.strings != null && message.hasOwnProperty("strings"))
            $root.StringArray.encode(message.strings, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.doubles != null && message.hasOwnProperty("doubles"))
            $root.DoubleArray.encode(message.doubles, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.int64s != null && message.hasOwnProperty("int64s"))
            $root.Int64Array.encode(message.int64s, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.datetimes != null && message.hasOwnProperty("datetimes"))
            $root.Int64Array.encode(message.datetimes, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.timedeltas != null && message.hasOwnProperty("timedeltas"))
            $root.Int64Array.encode(message.timedeltas, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified AnyArray message, length delimited. Does not implicitly {@link AnyArray.verify|verify} messages.
     * @function encodeDelimited
     * @memberof AnyArray
     * @static
     * @param {IAnyArray} message AnyArray message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AnyArray.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AnyArray message from the specified reader or buffer.
     * @function decode
     * @memberof AnyArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {AnyArray} AnyArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AnyArray.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.AnyArray();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.strings = $root.StringArray.decode(reader, reader.uint32());
                break;
            case 2:
                message.doubles = $root.DoubleArray.decode(reader, reader.uint32());
                break;
            case 3:
                message.int64s = $root.Int64Array.decode(reader, reader.uint32());
                break;
            case 4:
                message.datetimes = $root.Int64Array.decode(reader, reader.uint32());
                break;
            case 5:
                message.timedeltas = $root.Int64Array.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an AnyArray message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof AnyArray
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {AnyArray} AnyArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AnyArray.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AnyArray message.
     * @function verify
     * @memberof AnyArray
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AnyArray.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.strings != null && message.hasOwnProperty("strings")) {
            properties.type = 1;
            {
                let error = $root.StringArray.verify(message.strings);
                if (error)
                    return "strings." + error;
            }
        }
        if (message.doubles != null && message.hasOwnProperty("doubles")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.DoubleArray.verify(message.doubles);
                if (error)
                    return "doubles." + error;
            }
        }
        if (message.int64s != null && message.hasOwnProperty("int64s")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Int64Array.verify(message.int64s);
                if (error)
                    return "int64s." + error;
            }
        }
        if (message.datetimes != null && message.hasOwnProperty("datetimes")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Int64Array.verify(message.datetimes);
                if (error)
                    return "datetimes." + error;
            }
        }
        if (message.timedeltas != null && message.hasOwnProperty("timedeltas")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Int64Array.verify(message.timedeltas);
                if (error)
                    return "timedeltas." + error;
            }
        }
        return null;
    };

    /**
     * Creates an AnyArray message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof AnyArray
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {AnyArray} AnyArray
     */
    AnyArray.fromObject = function fromObject(object) {
        if (object instanceof $root.AnyArray)
            return object;
        let message = new $root.AnyArray();
        if (object.strings != null) {
            if (typeof object.strings !== "object")
                throw TypeError(".AnyArray.strings: object expected");
            message.strings = $root.StringArray.fromObject(object.strings);
        }
        if (object.doubles != null) {
            if (typeof object.doubles !== "object")
                throw TypeError(".AnyArray.doubles: object expected");
            message.doubles = $root.DoubleArray.fromObject(object.doubles);
        }
        if (object.int64s != null) {
            if (typeof object.int64s !== "object")
                throw TypeError(".AnyArray.int64s: object expected");
            message.int64s = $root.Int64Array.fromObject(object.int64s);
        }
        if (object.datetimes != null) {
            if (typeof object.datetimes !== "object")
                throw TypeError(".AnyArray.datetimes: object expected");
            message.datetimes = $root.Int64Array.fromObject(object.datetimes);
        }
        if (object.timedeltas != null) {
            if (typeof object.timedeltas !== "object")
                throw TypeError(".AnyArray.timedeltas: object expected");
            message.timedeltas = $root.Int64Array.fromObject(object.timedeltas);
        }
        return message;
    };

    /**
     * Creates a plain object from an AnyArray message. Also converts values to other types if specified.
     * @function toObject
     * @memberof AnyArray
     * @static
     * @param {AnyArray} message AnyArray
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AnyArray.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (message.strings != null && message.hasOwnProperty("strings")) {
            object.strings = $root.StringArray.toObject(message.strings, options);
            if (options.oneofs)
                object.type = "strings";
        }
        if (message.doubles != null && message.hasOwnProperty("doubles")) {
            object.doubles = $root.DoubleArray.toObject(message.doubles, options);
            if (options.oneofs)
                object.type = "doubles";
        }
        if (message.int64s != null && message.hasOwnProperty("int64s")) {
            object.int64s = $root.Int64Array.toObject(message.int64s, options);
            if (options.oneofs)
                object.type = "int64s";
        }
        if (message.datetimes != null && message.hasOwnProperty("datetimes")) {
            object.datetimes = $root.Int64Array.toObject(message.datetimes, options);
            if (options.oneofs)
                object.type = "datetimes";
        }
        if (message.timedeltas != null && message.hasOwnProperty("timedeltas")) {
            object.timedeltas = $root.Int64Array.toObject(message.timedeltas, options);
            if (options.oneofs)
                object.type = "timedeltas";
        }
        return object;
    };

    /**
     * Converts this AnyArray to JSON.
     * @function toJSON
     * @memberof AnyArray
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AnyArray.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return AnyArray;
})();

export const Table = $root.Table = (() => {

    /**
     * Properties of a Table.
     * @exports ITable
     * @interface ITable
     * @property {Array.<IAnyArray>|null} [cols] Table cols
     */

    /**
     * Constructs a new Table.
     * @exports Table
     * @classdesc Represents a Table.
     * @implements ITable
     * @constructor
     * @param {ITable=} [properties] Properties to set
     */
    function Table(properties) {
        this.cols = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Table cols.
     * @member {Array.<IAnyArray>} cols
     * @memberof Table
     * @instance
     */
    Table.prototype.cols = $util.emptyArray;

    /**
     * Creates a new Table instance using the specified properties.
     * @function create
     * @memberof Table
     * @static
     * @param {ITable=} [properties] Properties to set
     * @returns {Table} Table instance
     */
    Table.create = function create(properties) {
        return new Table(properties);
    };

    /**
     * Encodes the specified Table message. Does not implicitly {@link Table.verify|verify} messages.
     * @function encode
     * @memberof Table
     * @static
     * @param {ITable} message Table message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Table.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.cols != null && message.cols.length)
            for (let i = 0; i < message.cols.length; ++i)
                $root.AnyArray.encode(message.cols[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Table message, length delimited. Does not implicitly {@link Table.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Table
     * @static
     * @param {ITable} message Table message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Table.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Table message from the specified reader or buffer.
     * @function decode
     * @memberof Table
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Table} Table
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Table.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Table();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.cols && message.cols.length))
                    message.cols = [];
                message.cols.push($root.AnyArray.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Table message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Table
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Table} Table
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Table.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Table message.
     * @function verify
     * @memberof Table
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Table.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.cols != null && message.hasOwnProperty("cols")) {
            if (!Array.isArray(message.cols))
                return "cols: array expected";
            for (let i = 0; i < message.cols.length; ++i) {
                let error = $root.AnyArray.verify(message.cols[i]);
                if (error)
                    return "cols." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Table message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Table
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Table} Table
     */
    Table.fromObject = function fromObject(object) {
        if (object instanceof $root.Table)
            return object;
        let message = new $root.Table();
        if (object.cols) {
            if (!Array.isArray(object.cols))
                throw TypeError(".Table.cols: array expected");
            message.cols = [];
            for (let i = 0; i < object.cols.length; ++i) {
                if (typeof object.cols[i] !== "object")
                    throw TypeError(".Table.cols: object expected");
                message.cols[i] = $root.AnyArray.fromObject(object.cols[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a Table message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Table
     * @static
     * @param {Table} message Table
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Table.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.cols = [];
        if (message.cols && message.cols.length) {
            object.cols = [];
            for (let j = 0; j < message.cols.length; ++j)
                object.cols[j] = $root.AnyArray.toObject(message.cols[j], options);
        }
        return object;
    };

    /**
     * Converts this Table to JSON.
     * @function toJSON
     * @memberof Table
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Table.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Table;
})();

export const TableStyle = $root.TableStyle = (() => {

    /**
     * Properties of a TableStyle.
     * @exports ITableStyle
     * @interface ITableStyle
     * @property {Array.<ICellStyleArray>|null} [cols] TableStyle cols
     */

    /**
     * Constructs a new TableStyle.
     * @exports TableStyle
     * @classdesc Represents a TableStyle.
     * @implements ITableStyle
     * @constructor
     * @param {ITableStyle=} [properties] Properties to set
     */
    function TableStyle(properties) {
        this.cols = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * TableStyle cols.
     * @member {Array.<ICellStyleArray>} cols
     * @memberof TableStyle
     * @instance
     */
    TableStyle.prototype.cols = $util.emptyArray;

    /**
     * Creates a new TableStyle instance using the specified properties.
     * @function create
     * @memberof TableStyle
     * @static
     * @param {ITableStyle=} [properties] Properties to set
     * @returns {TableStyle} TableStyle instance
     */
    TableStyle.create = function create(properties) {
        return new TableStyle(properties);
    };

    /**
     * Encodes the specified TableStyle message. Does not implicitly {@link TableStyle.verify|verify} messages.
     * @function encode
     * @memberof TableStyle
     * @static
     * @param {ITableStyle} message TableStyle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TableStyle.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.cols != null && message.cols.length)
            for (let i = 0; i < message.cols.length; ++i)
                $root.CellStyleArray.encode(message.cols[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified TableStyle message, length delimited. Does not implicitly {@link TableStyle.verify|verify} messages.
     * @function encodeDelimited
     * @memberof TableStyle
     * @static
     * @param {ITableStyle} message TableStyle message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TableStyle.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TableStyle message from the specified reader or buffer.
     * @function decode
     * @memberof TableStyle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {TableStyle} TableStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TableStyle.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.TableStyle();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.cols && message.cols.length))
                    message.cols = [];
                message.cols.push($root.CellStyleArray.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a TableStyle message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof TableStyle
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {TableStyle} TableStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TableStyle.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TableStyle message.
     * @function verify
     * @memberof TableStyle
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TableStyle.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.cols != null && message.hasOwnProperty("cols")) {
            if (!Array.isArray(message.cols))
                return "cols: array expected";
            for (let i = 0; i < message.cols.length; ++i) {
                let error = $root.CellStyleArray.verify(message.cols[i]);
                if (error)
                    return "cols." + error;
            }
        }
        return null;
    };

    /**
     * Creates a TableStyle message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof TableStyle
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {TableStyle} TableStyle
     */
    TableStyle.fromObject = function fromObject(object) {
        if (object instanceof $root.TableStyle)
            return object;
        let message = new $root.TableStyle();
        if (object.cols) {
            if (!Array.isArray(object.cols))
                throw TypeError(".TableStyle.cols: array expected");
            message.cols = [];
            for (let i = 0; i < object.cols.length; ++i) {
                if (typeof object.cols[i] !== "object")
                    throw TypeError(".TableStyle.cols: object expected");
                message.cols[i] = $root.CellStyleArray.fromObject(object.cols[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a TableStyle message. Also converts values to other types if specified.
     * @function toObject
     * @memberof TableStyle
     * @static
     * @param {TableStyle} message TableStyle
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TableStyle.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.cols = [];
        if (message.cols && message.cols.length) {
            object.cols = [];
            for (let j = 0; j < message.cols.length; ++j)
                object.cols[j] = $root.CellStyleArray.toObject(message.cols[j], options);
        }
        return object;
    };

    /**
     * Converts this TableStyle to JSON.
     * @function toJSON
     * @memberof TableStyle
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TableStyle.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return TableStyle;
})();

export const Chart = $root.Chart = (() => {

    /**
     * Properties of a Chart.
     * @exports IChart
     * @interface IChart
     * @property {string|null} [type] Chart type
     * @property {IDataFrame|null} [data] Chart data
     * @property {number|null} [width] Chart width
     * @property {number|null} [height] Chart height
     * @property {Array.<IChartComponent>|null} [components] Chart components
     * @property {Array.<IChartProperty>|null} [props] Chart props
     */

    /**
     * Constructs a new Chart.
     * @exports Chart
     * @classdesc Represents a Chart.
     * @implements IChart
     * @constructor
     * @param {IChart=} [properties] Properties to set
     */
    function Chart(properties) {
        this.components = [];
        this.props = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Chart type.
     * @member {string} type
     * @memberof Chart
     * @instance
     */
    Chart.prototype.type = "";

    /**
     * Chart data.
     * @member {IDataFrame|null|undefined} data
     * @memberof Chart
     * @instance
     */
    Chart.prototype.data = null;

    /**
     * Chart width.
     * @member {number} width
     * @memberof Chart
     * @instance
     */
    Chart.prototype.width = 0;

    /**
     * Chart height.
     * @member {number} height
     * @memberof Chart
     * @instance
     */
    Chart.prototype.height = 0;

    /**
     * Chart components.
     * @member {Array.<IChartComponent>} components
     * @memberof Chart
     * @instance
     */
    Chart.prototype.components = $util.emptyArray;

    /**
     * Chart props.
     * @member {Array.<IChartProperty>} props
     * @memberof Chart
     * @instance
     */
    Chart.prototype.props = $util.emptyArray;

    /**
     * Creates a new Chart instance using the specified properties.
     * @function create
     * @memberof Chart
     * @static
     * @param {IChart=} [properties] Properties to set
     * @returns {Chart} Chart instance
     */
    Chart.create = function create(properties) {
        return new Chart(properties);
    };

    /**
     * Encodes the specified Chart message. Does not implicitly {@link Chart.verify|verify} messages.
     * @function encode
     * @memberof Chart
     * @static
     * @param {IChart} message Chart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Chart.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.type != null && message.hasOwnProperty("type"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.type);
        if (message.data != null && message.hasOwnProperty("data"))
            $root.DataFrame.encode(message.data, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.width != null && message.hasOwnProperty("width"))
            writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.width);
        if (message.height != null && message.hasOwnProperty("height"))
            writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.height);
        if (message.components != null && message.components.length)
            for (let i = 0; i < message.components.length; ++i)
                $root.ChartComponent.encode(message.components[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.props != null && message.props.length)
            for (let i = 0; i < message.props.length; ++i)
                $root.ChartProperty.encode(message.props[i], writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Chart message, length delimited. Does not implicitly {@link Chart.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Chart
     * @static
     * @param {IChart} message Chart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Chart.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Chart message from the specified reader or buffer.
     * @function decode
     * @memberof Chart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Chart} Chart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Chart.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Chart();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.type = reader.string();
                break;
            case 2:
                message.data = $root.DataFrame.decode(reader, reader.uint32());
                break;
            case 3:
                message.width = reader.uint32();
                break;
            case 4:
                message.height = reader.uint32();
                break;
            case 5:
                if (!(message.components && message.components.length))
                    message.components = [];
                message.components.push($root.ChartComponent.decode(reader, reader.uint32()));
                break;
            case 6:
                if (!(message.props && message.props.length))
                    message.props = [];
                message.props.push($root.ChartProperty.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Chart message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Chart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Chart} Chart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Chart.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Chart message.
     * @function verify
     * @memberof Chart
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Chart.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.type != null && message.hasOwnProperty("type"))
            if (!$util.isString(message.type))
                return "type: string expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.DataFrame.verify(message.data);
            if (error)
                return "data." + error;
        }
        if (message.width != null && message.hasOwnProperty("width"))
            if (!$util.isInteger(message.width))
                return "width: integer expected";
        if (message.height != null && message.hasOwnProperty("height"))
            if (!$util.isInteger(message.height))
                return "height: integer expected";
        if (message.components != null && message.hasOwnProperty("components")) {
            if (!Array.isArray(message.components))
                return "components: array expected";
            for (let i = 0; i < message.components.length; ++i) {
                let error = $root.ChartComponent.verify(message.components[i]);
                if (error)
                    return "components." + error;
            }
        }
        if (message.props != null && message.hasOwnProperty("props")) {
            if (!Array.isArray(message.props))
                return "props: array expected";
            for (let i = 0; i < message.props.length; ++i) {
                let error = $root.ChartProperty.verify(message.props[i]);
                if (error)
                    return "props." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Chart message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Chart
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Chart} Chart
     */
    Chart.fromObject = function fromObject(object) {
        if (object instanceof $root.Chart)
            return object;
        let message = new $root.Chart();
        if (object.type != null)
            message.type = String(object.type);
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".Chart.data: object expected");
            message.data = $root.DataFrame.fromObject(object.data);
        }
        if (object.width != null)
            message.width = object.width >>> 0;
        if (object.height != null)
            message.height = object.height >>> 0;
        if (object.components) {
            if (!Array.isArray(object.components))
                throw TypeError(".Chart.components: array expected");
            message.components = [];
            for (let i = 0; i < object.components.length; ++i) {
                if (typeof object.components[i] !== "object")
                    throw TypeError(".Chart.components: object expected");
                message.components[i] = $root.ChartComponent.fromObject(object.components[i]);
            }
        }
        if (object.props) {
            if (!Array.isArray(object.props))
                throw TypeError(".Chart.props: array expected");
            message.props = [];
            for (let i = 0; i < object.props.length; ++i) {
                if (typeof object.props[i] !== "object")
                    throw TypeError(".Chart.props: object expected");
                message.props[i] = $root.ChartProperty.fromObject(object.props[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a Chart message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Chart
     * @static
     * @param {Chart} message Chart
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Chart.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults) {
            object.components = [];
            object.props = [];
        }
        if (options.defaults) {
            object.type = "";
            object.data = null;
            object.width = 0;
            object.height = 0;
        }
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = message.type;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.DataFrame.toObject(message.data, options);
        if (message.width != null && message.hasOwnProperty("width"))
            object.width = message.width;
        if (message.height != null && message.hasOwnProperty("height"))
            object.height = message.height;
        if (message.components && message.components.length) {
            object.components = [];
            for (let j = 0; j < message.components.length; ++j)
                object.components[j] = $root.ChartComponent.toObject(message.components[j], options);
        }
        if (message.props && message.props.length) {
            object.props = [];
            for (let j = 0; j < message.props.length; ++j)
                object.props[j] = $root.ChartProperty.toObject(message.props[j], options);
        }
        return object;
    };

    /**
     * Converts this Chart to JSON.
     * @function toJSON
     * @memberof Chart
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Chart.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Chart;
})();

export const ChartComponent = $root.ChartComponent = (() => {

    /**
     * Properties of a ChartComponent.
     * @exports IChartComponent
     * @interface IChartComponent
     * @property {string|null} [type] ChartComponent type
     * @property {Array.<IChartProperty>|null} [props] ChartComponent props
     */

    /**
     * Constructs a new ChartComponent.
     * @exports ChartComponent
     * @classdesc Represents a ChartComponent.
     * @implements IChartComponent
     * @constructor
     * @param {IChartComponent=} [properties] Properties to set
     */
    function ChartComponent(properties) {
        this.props = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ChartComponent type.
     * @member {string} type
     * @memberof ChartComponent
     * @instance
     */
    ChartComponent.prototype.type = "";

    /**
     * ChartComponent props.
     * @member {Array.<IChartProperty>} props
     * @memberof ChartComponent
     * @instance
     */
    ChartComponent.prototype.props = $util.emptyArray;

    /**
     * Creates a new ChartComponent instance using the specified properties.
     * @function create
     * @memberof ChartComponent
     * @static
     * @param {IChartComponent=} [properties] Properties to set
     * @returns {ChartComponent} ChartComponent instance
     */
    ChartComponent.create = function create(properties) {
        return new ChartComponent(properties);
    };

    /**
     * Encodes the specified ChartComponent message. Does not implicitly {@link ChartComponent.verify|verify} messages.
     * @function encode
     * @memberof ChartComponent
     * @static
     * @param {IChartComponent} message ChartComponent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ChartComponent.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.type != null && message.hasOwnProperty("type"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.type);
        if (message.props != null && message.props.length)
            for (let i = 0; i < message.props.length; ++i)
                $root.ChartProperty.encode(message.props[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified ChartComponent message, length delimited. Does not implicitly {@link ChartComponent.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ChartComponent
     * @static
     * @param {IChartComponent} message ChartComponent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ChartComponent.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ChartComponent message from the specified reader or buffer.
     * @function decode
     * @memberof ChartComponent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ChartComponent} ChartComponent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ChartComponent.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ChartComponent();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.type = reader.string();
                break;
            case 2:
                if (!(message.props && message.props.length))
                    message.props = [];
                message.props.push($root.ChartProperty.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a ChartComponent message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ChartComponent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ChartComponent} ChartComponent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ChartComponent.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ChartComponent message.
     * @function verify
     * @memberof ChartComponent
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ChartComponent.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.type != null && message.hasOwnProperty("type"))
            if (!$util.isString(message.type))
                return "type: string expected";
        if (message.props != null && message.hasOwnProperty("props")) {
            if (!Array.isArray(message.props))
                return "props: array expected";
            for (let i = 0; i < message.props.length; ++i) {
                let error = $root.ChartProperty.verify(message.props[i]);
                if (error)
                    return "props." + error;
            }
        }
        return null;
    };

    /**
     * Creates a ChartComponent message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ChartComponent
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ChartComponent} ChartComponent
     */
    ChartComponent.fromObject = function fromObject(object) {
        if (object instanceof $root.ChartComponent)
            return object;
        let message = new $root.ChartComponent();
        if (object.type != null)
            message.type = String(object.type);
        if (object.props) {
            if (!Array.isArray(object.props))
                throw TypeError(".ChartComponent.props: array expected");
            message.props = [];
            for (let i = 0; i < object.props.length; ++i) {
                if (typeof object.props[i] !== "object")
                    throw TypeError(".ChartComponent.props: object expected");
                message.props[i] = $root.ChartProperty.fromObject(object.props[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a ChartComponent message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ChartComponent
     * @static
     * @param {ChartComponent} message ChartComponent
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ChartComponent.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.props = [];
        if (options.defaults)
            object.type = "";
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = message.type;
        if (message.props && message.props.length) {
            object.props = [];
            for (let j = 0; j < message.props.length; ++j)
                object.props[j] = $root.ChartProperty.toObject(message.props[j], options);
        }
        return object;
    };

    /**
     * Converts this ChartComponent to JSON.
     * @function toJSON
     * @memberof ChartComponent
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ChartComponent.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return ChartComponent;
})();

export const ChartProperty = $root.ChartProperty = (() => {

    /**
     * Properties of a ChartProperty.
     * @exports IChartProperty
     * @interface IChartProperty
     * @property {string|null} [key] ChartProperty key
     * @property {string|null} [value] ChartProperty value
     */

    /**
     * Constructs a new ChartProperty.
     * @exports ChartProperty
     * @classdesc Represents a ChartProperty.
     * @implements IChartProperty
     * @constructor
     * @param {IChartProperty=} [properties] Properties to set
     */
    function ChartProperty(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ChartProperty key.
     * @member {string} key
     * @memberof ChartProperty
     * @instance
     */
    ChartProperty.prototype.key = "";

    /**
     * ChartProperty value.
     * @member {string} value
     * @memberof ChartProperty
     * @instance
     */
    ChartProperty.prototype.value = "";

    /**
     * Creates a new ChartProperty instance using the specified properties.
     * @function create
     * @memberof ChartProperty
     * @static
     * @param {IChartProperty=} [properties] Properties to set
     * @returns {ChartProperty} ChartProperty instance
     */
    ChartProperty.create = function create(properties) {
        return new ChartProperty(properties);
    };

    /**
     * Encodes the specified ChartProperty message. Does not implicitly {@link ChartProperty.verify|verify} messages.
     * @function encode
     * @memberof ChartProperty
     * @static
     * @param {IChartProperty} message ChartProperty message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ChartProperty.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.key != null && message.hasOwnProperty("key"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.key);
        if (message.value != null && message.hasOwnProperty("value"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.value);
        return writer;
    };

    /**
     * Encodes the specified ChartProperty message, length delimited. Does not implicitly {@link ChartProperty.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ChartProperty
     * @static
     * @param {IChartProperty} message ChartProperty message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ChartProperty.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ChartProperty message from the specified reader or buffer.
     * @function decode
     * @memberof ChartProperty
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ChartProperty} ChartProperty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ChartProperty.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ChartProperty();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.key = reader.string();
                break;
            case 2:
                message.value = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a ChartProperty message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ChartProperty
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ChartProperty} ChartProperty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ChartProperty.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ChartProperty message.
     * @function verify
     * @memberof ChartProperty
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ChartProperty.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.key != null && message.hasOwnProperty("key"))
            if (!$util.isString(message.key))
                return "key: string expected";
        if (message.value != null && message.hasOwnProperty("value"))
            if (!$util.isString(message.value))
                return "value: string expected";
        return null;
    };

    /**
     * Creates a ChartProperty message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ChartProperty
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ChartProperty} ChartProperty
     */
    ChartProperty.fromObject = function fromObject(object) {
        if (object instanceof $root.ChartProperty)
            return object;
        let message = new $root.ChartProperty();
        if (object.key != null)
            message.key = String(object.key);
        if (object.value != null)
            message.value = String(object.value);
        return message;
    };

    /**
     * Creates a plain object from a ChartProperty message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ChartProperty
     * @static
     * @param {ChartProperty} message ChartProperty
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ChartProperty.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.key = "";
            object.value = "";
        }
        if (message.key != null && message.hasOwnProperty("key"))
            object.key = message.key;
        if (message.value != null && message.hasOwnProperty("value"))
            object.value = message.value;
        return object;
    };

    /**
     * Converts this ChartProperty to JSON.
     * @function toJSON
     * @memberof ChartProperty
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ChartProperty.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return ChartProperty;
})();

/**
 * DataTransform enum.
 * @exports DataTransform
 * @enum {string}
 * @property {number} UNKNOWN=0 UNKNOWN value
 * @property {number} NONE=1 NONE value
 * @property {number} STACK=2 STACK value
 */
$root.DataTransform = (function() {
    const valuesById = {}, values = Object.create(valuesById);
    values[valuesById[0] = "UNKNOWN"] = 0;
    values[valuesById[1] = "NONE"] = 1;
    values[valuesById[2] = "STACK"] = 2;
    return values;
})();

export const DeckGlChart = $root.DeckGlChart = (() => {

    /**
     * Properties of a DeckGlChart.
     * @exports IDeckGlChart
     * @interface IDeckGlChart
     * @property {IDataFrame|null} [data] DeckGlChart data
     * @property {string|null} [spec] DeckGlChart spec
     * @property {Array.<IDeckGLLayer>|null} [layers] DeckGlChart layers
     */

    /**
     * Constructs a new DeckGlChart.
     * @exports DeckGlChart
     * @classdesc Represents a DeckGlChart.
     * @implements IDeckGlChart
     * @constructor
     * @param {IDeckGlChart=} [properties] Properties to set
     */
    function DeckGlChart(properties) {
        this.layers = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DeckGlChart data.
     * @member {IDataFrame|null|undefined} data
     * @memberof DeckGlChart
     * @instance
     */
    DeckGlChart.prototype.data = null;

    /**
     * DeckGlChart spec.
     * @member {string} spec
     * @memberof DeckGlChart
     * @instance
     */
    DeckGlChart.prototype.spec = "";

    /**
     * DeckGlChart layers.
     * @member {Array.<IDeckGLLayer>} layers
     * @memberof DeckGlChart
     * @instance
     */
    DeckGlChart.prototype.layers = $util.emptyArray;

    /**
     * Creates a new DeckGlChart instance using the specified properties.
     * @function create
     * @memberof DeckGlChart
     * @static
     * @param {IDeckGlChart=} [properties] Properties to set
     * @returns {DeckGlChart} DeckGlChart instance
     */
    DeckGlChart.create = function create(properties) {
        return new DeckGlChart(properties);
    };

    /**
     * Encodes the specified DeckGlChart message. Does not implicitly {@link DeckGlChart.verify|verify} messages.
     * @function encode
     * @memberof DeckGlChart
     * @static
     * @param {IDeckGlChart} message DeckGlChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DeckGlChart.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.DataFrame.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.spec != null && message.hasOwnProperty("spec"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.spec);
        if (message.layers != null && message.layers.length)
            for (let i = 0; i < message.layers.length; ++i)
                $root.DeckGLLayer.encode(message.layers[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified DeckGlChart message, length delimited. Does not implicitly {@link DeckGlChart.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DeckGlChart
     * @static
     * @param {IDeckGlChart} message DeckGlChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DeckGlChart.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DeckGlChart message from the specified reader or buffer.
     * @function decode
     * @memberof DeckGlChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DeckGlChart} DeckGlChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DeckGlChart.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.DeckGlChart();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.DataFrame.decode(reader, reader.uint32());
                break;
            case 2:
                message.spec = reader.string();
                break;
            case 3:
                if (!(message.layers && message.layers.length))
                    message.layers = [];
                message.layers.push($root.DeckGLLayer.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DeckGlChart message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DeckGlChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DeckGlChart} DeckGlChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DeckGlChart.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DeckGlChart message.
     * @function verify
     * @memberof DeckGlChart
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DeckGlChart.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.DataFrame.verify(message.data);
            if (error)
                return "data." + error;
        }
        if (message.spec != null && message.hasOwnProperty("spec"))
            if (!$util.isString(message.spec))
                return "spec: string expected";
        if (message.layers != null && message.hasOwnProperty("layers")) {
            if (!Array.isArray(message.layers))
                return "layers: array expected";
            for (let i = 0; i < message.layers.length; ++i) {
                let error = $root.DeckGLLayer.verify(message.layers[i]);
                if (error)
                    return "layers." + error;
            }
        }
        return null;
    };

    /**
     * Creates a DeckGlChart message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DeckGlChart
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DeckGlChart} DeckGlChart
     */
    DeckGlChart.fromObject = function fromObject(object) {
        if (object instanceof $root.DeckGlChart)
            return object;
        let message = new $root.DeckGlChart();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".DeckGlChart.data: object expected");
            message.data = $root.DataFrame.fromObject(object.data);
        }
        if (object.spec != null)
            message.spec = String(object.spec);
        if (object.layers) {
            if (!Array.isArray(object.layers))
                throw TypeError(".DeckGlChart.layers: array expected");
            message.layers = [];
            for (let i = 0; i < object.layers.length; ++i) {
                if (typeof object.layers[i] !== "object")
                    throw TypeError(".DeckGlChart.layers: object expected");
                message.layers[i] = $root.DeckGLLayer.fromObject(object.layers[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a DeckGlChart message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DeckGlChart
     * @static
     * @param {DeckGlChart} message DeckGlChart
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DeckGlChart.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.layers = [];
        if (options.defaults) {
            object.data = null;
            object.spec = "";
        }
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.DataFrame.toObject(message.data, options);
        if (message.spec != null && message.hasOwnProperty("spec"))
            object.spec = message.spec;
        if (message.layers && message.layers.length) {
            object.layers = [];
            for (let j = 0; j < message.layers.length; ++j)
                object.layers[j] = $root.DeckGLLayer.toObject(message.layers[j], options);
        }
        return object;
    };

    /**
     * Converts this DeckGlChart to JSON.
     * @function toJSON
     * @memberof DeckGlChart
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DeckGlChart.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DeckGlChart;
})();

export const DeckGLLayer = $root.DeckGLLayer = (() => {

    /**
     * Properties of a DeckGLLayer.
     * @exports IDeckGLLayer
     * @interface IDeckGLLayer
     * @property {IDataFrame|null} [data] DeckGLLayer data
     * @property {string|null} [spec] DeckGLLayer spec
     */

    /**
     * Constructs a new DeckGLLayer.
     * @exports DeckGLLayer
     * @classdesc Represents a DeckGLLayer.
     * @implements IDeckGLLayer
     * @constructor
     * @param {IDeckGLLayer=} [properties] Properties to set
     */
    function DeckGLLayer(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DeckGLLayer data.
     * @member {IDataFrame|null|undefined} data
     * @memberof DeckGLLayer
     * @instance
     */
    DeckGLLayer.prototype.data = null;

    /**
     * DeckGLLayer spec.
     * @member {string} spec
     * @memberof DeckGLLayer
     * @instance
     */
    DeckGLLayer.prototype.spec = "";

    /**
     * Creates a new DeckGLLayer instance using the specified properties.
     * @function create
     * @memberof DeckGLLayer
     * @static
     * @param {IDeckGLLayer=} [properties] Properties to set
     * @returns {DeckGLLayer} DeckGLLayer instance
     */
    DeckGLLayer.create = function create(properties) {
        return new DeckGLLayer(properties);
    };

    /**
     * Encodes the specified DeckGLLayer message. Does not implicitly {@link DeckGLLayer.verify|verify} messages.
     * @function encode
     * @memberof DeckGLLayer
     * @static
     * @param {IDeckGLLayer} message DeckGLLayer message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DeckGLLayer.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            $root.DataFrame.encode(message.data, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.spec != null && message.hasOwnProperty("spec"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.spec);
        return writer;
    };

    /**
     * Encodes the specified DeckGLLayer message, length delimited. Does not implicitly {@link DeckGLLayer.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DeckGLLayer
     * @static
     * @param {IDeckGLLayer} message DeckGLLayer message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DeckGLLayer.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DeckGLLayer message from the specified reader or buffer.
     * @function decode
     * @memberof DeckGLLayer
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DeckGLLayer} DeckGLLayer
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DeckGLLayer.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.DeckGLLayer();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = $root.DataFrame.decode(reader, reader.uint32());
                break;
            case 2:
                message.spec = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DeckGLLayer message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DeckGLLayer
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DeckGLLayer} DeckGLLayer
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DeckGLLayer.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DeckGLLayer message.
     * @function verify
     * @memberof DeckGLLayer
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DeckGLLayer.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.DataFrame.verify(message.data);
            if (error)
                return "data." + error;
        }
        if (message.spec != null && message.hasOwnProperty("spec"))
            if (!$util.isString(message.spec))
                return "spec: string expected";
        return null;
    };

    /**
     * Creates a DeckGLLayer message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DeckGLLayer
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DeckGLLayer} DeckGLLayer
     */
    DeckGLLayer.fromObject = function fromObject(object) {
        if (object instanceof $root.DeckGLLayer)
            return object;
        let message = new $root.DeckGLLayer();
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".DeckGLLayer.data: object expected");
            message.data = $root.DataFrame.fromObject(object.data);
        }
        if (object.spec != null)
            message.spec = String(object.spec);
        return message;
    };

    /**
     * Creates a plain object from a DeckGLLayer message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DeckGLLayer
     * @static
     * @param {DeckGLLayer} message DeckGLLayer
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DeckGLLayer.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.data = null;
            object.spec = "";
        }
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.DataFrame.toObject(message.data, options);
        if (message.spec != null && message.hasOwnProperty("spec"))
            object.spec = message.spec;
        return object;
    };

    /**
     * Converts this DeckGLLayer to JSON.
     * @function toJSON
     * @memberof DeckGLLayer
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DeckGLLayer.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DeckGLLayer;
})();

export const Delta = $root.Delta = (() => {

    /**
     * Properties of a Delta.
     * @exports IDelta
     * @interface IDelta
     * @property {number|null} [id] Delta id
     * @property {IElement|null} [newElement] Delta newElement
     * @property {INamedDataSet|null} [addRows] Delta addRows
     */

    /**
     * Constructs a new Delta.
     * @exports Delta
     * @classdesc Represents a Delta.
     * @implements IDelta
     * @constructor
     * @param {IDelta=} [properties] Properties to set
     */
    function Delta(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Delta id.
     * @member {number} id
     * @memberof Delta
     * @instance
     */
    Delta.prototype.id = 0;

    /**
     * Delta newElement.
     * @member {IElement|null|undefined} newElement
     * @memberof Delta
     * @instance
     */
    Delta.prototype.newElement = null;

    /**
     * Delta addRows.
     * @member {INamedDataSet|null|undefined} addRows
     * @memberof Delta
     * @instance
     */
    Delta.prototype.addRows = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * Delta type.
     * @member {"newElement"|"addRows"|undefined} type
     * @memberof Delta
     * @instance
     */
    Object.defineProperty(Delta.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["newElement", "addRows"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Delta instance using the specified properties.
     * @function create
     * @memberof Delta
     * @static
     * @param {IDelta=} [properties] Properties to set
     * @returns {Delta} Delta instance
     */
    Delta.create = function create(properties) {
        return new Delta(properties);
    };

    /**
     * Encodes the specified Delta message. Does not implicitly {@link Delta.verify|verify} messages.
     * @function encode
     * @memberof Delta
     * @static
     * @param {IDelta} message Delta message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Delta.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.id != null && message.hasOwnProperty("id"))
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.id);
        if (message.newElement != null && message.hasOwnProperty("newElement"))
            $root.Element.encode(message.newElement, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.addRows != null && message.hasOwnProperty("addRows"))
            $root.NamedDataSet.encode(message.addRows, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Delta message, length delimited. Does not implicitly {@link Delta.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Delta
     * @static
     * @param {IDelta} message Delta message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Delta.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Delta message from the specified reader or buffer.
     * @function decode
     * @memberof Delta
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Delta} Delta
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Delta.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Delta();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.id = reader.uint32();
                break;
            case 2:
                message.newElement = $root.Element.decode(reader, reader.uint32());
                break;
            case 3:
                message.addRows = $root.NamedDataSet.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Delta message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Delta
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Delta} Delta
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Delta.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Delta message.
     * @function verify
     * @memberof Delta
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Delta.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.id != null && message.hasOwnProperty("id"))
            if (!$util.isInteger(message.id))
                return "id: integer expected";
        if (message.newElement != null && message.hasOwnProperty("newElement")) {
            properties.type = 1;
            {
                let error = $root.Element.verify(message.newElement);
                if (error)
                    return "newElement." + error;
            }
        }
        if (message.addRows != null && message.hasOwnProperty("addRows")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.NamedDataSet.verify(message.addRows);
                if (error)
                    return "addRows." + error;
            }
        }
        return null;
    };

    /**
     * Creates a Delta message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Delta
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Delta} Delta
     */
    Delta.fromObject = function fromObject(object) {
        if (object instanceof $root.Delta)
            return object;
        let message = new $root.Delta();
        if (object.id != null)
            message.id = object.id >>> 0;
        if (object.newElement != null) {
            if (typeof object.newElement !== "object")
                throw TypeError(".Delta.newElement: object expected");
            message.newElement = $root.Element.fromObject(object.newElement);
        }
        if (object.addRows != null) {
            if (typeof object.addRows !== "object")
                throw TypeError(".Delta.addRows: object expected");
            message.addRows = $root.NamedDataSet.fromObject(object.addRows);
        }
        return message;
    };

    /**
     * Creates a plain object from a Delta message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Delta
     * @static
     * @param {Delta} message Delta
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Delta.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.id = 0;
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        if (message.newElement != null && message.hasOwnProperty("newElement")) {
            object.newElement = $root.Element.toObject(message.newElement, options);
            if (options.oneofs)
                object.type = "newElement";
        }
        if (message.addRows != null && message.hasOwnProperty("addRows")) {
            object.addRows = $root.NamedDataSet.toObject(message.addRows, options);
            if (options.oneofs)
                object.type = "addRows";
        }
        return object;
    };

    /**
     * Converts this Delta to JSON.
     * @function toJSON
     * @memberof Delta
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Delta.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Delta;
})();

export const Element = $root.Element = (() => {

    /**
     * Properties of an Element.
     * @exports IElement
     * @interface IElement
     * @property {IAudio|null} [audio] Element audio
     * @property {IBalloons|null} [balloons] Element balloons
     * @property {IBokehChart|null} [bokehChart] Element bokehChart
     * @property {IChart|null} [chart] Element chart
     * @property {IDataFrame|null} [dataFrame] Element dataFrame
     * @property {IDataFrame|null} [table] Element table
     * @property {IDeckGlChart|null} [deckGlChart] Element deckGlChart
     * @property {IDocString|null} [docString] Element docString
     * @property {IEmpty|null} [empty] Element empty
     * @property {IException|null} [exception] Element exception
     * @property {IGraphVizChart|null} [graphvizChart] Element graphvizChart
     * @property {IImageList|null} [imgs] Element imgs
     * @property {IMap|null} [map] Element map
     * @property {IPlotlyChart|null} [plotlyChart] Element plotlyChart
     * @property {IProgress|null} [progress] Element progress
     * @property {IText|null} [text] Element text
     * @property {IVegaLiteChart|null} [vegaLiteChart] Element vegaLiteChart
     * @property {IVideo|null} [video] Element video
     */

    /**
     * Constructs a new Element.
     * @exports Element
     * @classdesc Represents an Element.
     * @implements IElement
     * @constructor
     * @param {IElement=} [properties] Properties to set
     */
    function Element(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Element audio.
     * @member {IAudio|null|undefined} audio
     * @memberof Element
     * @instance
     */
    Element.prototype.audio = null;

    /**
     * Element balloons.
     * @member {IBalloons|null|undefined} balloons
     * @memberof Element
     * @instance
     */
    Element.prototype.balloons = null;

    /**
     * Element bokehChart.
     * @member {IBokehChart|null|undefined} bokehChart
     * @memberof Element
     * @instance
     */
    Element.prototype.bokehChart = null;

    /**
     * Element chart.
     * @member {IChart|null|undefined} chart
     * @memberof Element
     * @instance
     */
    Element.prototype.chart = null;

    /**
     * Element dataFrame.
     * @member {IDataFrame|null|undefined} dataFrame
     * @memberof Element
     * @instance
     */
    Element.prototype.dataFrame = null;

    /**
     * Element table.
     * @member {IDataFrame|null|undefined} table
     * @memberof Element
     * @instance
     */
    Element.prototype.table = null;

    /**
     * Element deckGlChart.
     * @member {IDeckGlChart|null|undefined} deckGlChart
     * @memberof Element
     * @instance
     */
    Element.prototype.deckGlChart = null;

    /**
     * Element docString.
     * @member {IDocString|null|undefined} docString
     * @memberof Element
     * @instance
     */
    Element.prototype.docString = null;

    /**
     * Element empty.
     * @member {IEmpty|null|undefined} empty
     * @memberof Element
     * @instance
     */
    Element.prototype.empty = null;

    /**
     * Element exception.
     * @member {IException|null|undefined} exception
     * @memberof Element
     * @instance
     */
    Element.prototype.exception = null;

    /**
     * Element graphvizChart.
     * @member {IGraphVizChart|null|undefined} graphvizChart
     * @memberof Element
     * @instance
     */
    Element.prototype.graphvizChart = null;

    /**
     * Element imgs.
     * @member {IImageList|null|undefined} imgs
     * @memberof Element
     * @instance
     */
    Element.prototype.imgs = null;

    /**
     * Element map.
     * @member {IMap|null|undefined} map
     * @memberof Element
     * @instance
     */
    Element.prototype.map = null;

    /**
     * Element plotlyChart.
     * @member {IPlotlyChart|null|undefined} plotlyChart
     * @memberof Element
     * @instance
     */
    Element.prototype.plotlyChart = null;

    /**
     * Element progress.
     * @member {IProgress|null|undefined} progress
     * @memberof Element
     * @instance
     */
    Element.prototype.progress = null;

    /**
     * Element text.
     * @member {IText|null|undefined} text
     * @memberof Element
     * @instance
     */
    Element.prototype.text = null;

    /**
     * Element vegaLiteChart.
     * @member {IVegaLiteChart|null|undefined} vegaLiteChart
     * @memberof Element
     * @instance
     */
    Element.prototype.vegaLiteChart = null;

    /**
     * Element video.
     * @member {IVideo|null|undefined} video
     * @memberof Element
     * @instance
     */
    Element.prototype.video = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * Element type.
     * @member {"audio"|"balloons"|"bokehChart"|"chart"|"dataFrame"|"table"|"deckGlChart"|"docString"|"empty"|"exception"|"graphvizChart"|"imgs"|"map"|"plotlyChart"|"progress"|"text"|"vegaLiteChart"|"video"|undefined} type
     * @memberof Element
     * @instance
     */
    Object.defineProperty(Element.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["audio", "balloons", "bokehChart", "chart", "dataFrame", "table", "deckGlChart", "docString", "empty", "exception", "graphvizChart", "imgs", "map", "plotlyChart", "progress", "text", "vegaLiteChart", "video"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Element instance using the specified properties.
     * @function create
     * @memberof Element
     * @static
     * @param {IElement=} [properties] Properties to set
     * @returns {Element} Element instance
     */
    Element.create = function create(properties) {
        return new Element(properties);
    };

    /**
     * Encodes the specified Element message. Does not implicitly {@link Element.verify|verify} messages.
     * @function encode
     * @memberof Element
     * @static
     * @param {IElement} message Element message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Element.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.text != null && message.hasOwnProperty("text"))
            $root.Text.encode(message.text, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.empty != null && message.hasOwnProperty("empty"))
            $root.Empty.encode(message.empty, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.dataFrame != null && message.hasOwnProperty("dataFrame"))
            $root.DataFrame.encode(message.dataFrame, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.chart != null && message.hasOwnProperty("chart"))
            $root.Chart.encode(message.chart, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        if (message.progress != null && message.hasOwnProperty("progress"))
            $root.Progress.encode(message.progress, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.imgs != null && message.hasOwnProperty("imgs"))
            $root.ImageList.encode(message.imgs, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        if (message.docString != null && message.hasOwnProperty("docString"))
            $root.DocString.encode(message.docString, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
        if (message.exception != null && message.hasOwnProperty("exception"))
            $root.Exception.encode(message.exception, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
        if (message.map != null && message.hasOwnProperty("map"))
            $root.Map.encode(message.map, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
        if (message.vegaLiteChart != null && message.hasOwnProperty("vegaLiteChart"))
            $root.VegaLiteChart.encode(message.vegaLiteChart, writer.uint32(/* id 10, wireType 2 =*/82).fork()).ldelim();
        if (message.table != null && message.hasOwnProperty("table"))
            $root.DataFrame.encode(message.table, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
        if (message.balloons != null && message.hasOwnProperty("balloons"))
            $root.Balloons.encode(message.balloons, writer.uint32(/* id 12, wireType 2 =*/98).fork()).ldelim();
        if (message.audio != null && message.hasOwnProperty("audio"))
            $root.Audio.encode(message.audio, writer.uint32(/* id 13, wireType 2 =*/106).fork()).ldelim();
        if (message.video != null && message.hasOwnProperty("video"))
            $root.Video.encode(message.video, writer.uint32(/* id 14, wireType 2 =*/114).fork()).ldelim();
        if (message.deckGlChart != null && message.hasOwnProperty("deckGlChart"))
            $root.DeckGlChart.encode(message.deckGlChart, writer.uint32(/* id 15, wireType 2 =*/122).fork()).ldelim();
        if (message.plotlyChart != null && message.hasOwnProperty("plotlyChart"))
            $root.PlotlyChart.encode(message.plotlyChart, writer.uint32(/* id 16, wireType 2 =*/130).fork()).ldelim();
        if (message.bokehChart != null && message.hasOwnProperty("bokehChart"))
            $root.BokehChart.encode(message.bokehChart, writer.uint32(/* id 17, wireType 2 =*/138).fork()).ldelim();
        if (message.graphvizChart != null && message.hasOwnProperty("graphvizChart"))
            $root.GraphVizChart.encode(message.graphvizChart, writer.uint32(/* id 18, wireType 2 =*/146).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Element message, length delimited. Does not implicitly {@link Element.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Element
     * @static
     * @param {IElement} message Element message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Element.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Element message from the specified reader or buffer.
     * @function decode
     * @memberof Element
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Element} Element
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Element.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Element();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 13:
                message.audio = $root.Audio.decode(reader, reader.uint32());
                break;
            case 12:
                message.balloons = $root.Balloons.decode(reader, reader.uint32());
                break;
            case 17:
                message.bokehChart = $root.BokehChart.decode(reader, reader.uint32());
                break;
            case 4:
                message.chart = $root.Chart.decode(reader, reader.uint32());
                break;
            case 3:
                message.dataFrame = $root.DataFrame.decode(reader, reader.uint32());
                break;
            case 11:
                message.table = $root.DataFrame.decode(reader, reader.uint32());
                break;
            case 15:
                message.deckGlChart = $root.DeckGlChart.decode(reader, reader.uint32());
                break;
            case 7:
                message.docString = $root.DocString.decode(reader, reader.uint32());
                break;
            case 2:
                message.empty = $root.Empty.decode(reader, reader.uint32());
                break;
            case 8:
                message.exception = $root.Exception.decode(reader, reader.uint32());
                break;
            case 18:
                message.graphvizChart = $root.GraphVizChart.decode(reader, reader.uint32());
                break;
            case 6:
                message.imgs = $root.ImageList.decode(reader, reader.uint32());
                break;
            case 9:
                message.map = $root.Map.decode(reader, reader.uint32());
                break;
            case 16:
                message.plotlyChart = $root.PlotlyChart.decode(reader, reader.uint32());
                break;
            case 5:
                message.progress = $root.Progress.decode(reader, reader.uint32());
                break;
            case 1:
                message.text = $root.Text.decode(reader, reader.uint32());
                break;
            case 10:
                message.vegaLiteChart = $root.VegaLiteChart.decode(reader, reader.uint32());
                break;
            case 14:
                message.video = $root.Video.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Element message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Element
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Element} Element
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Element.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Element message.
     * @function verify
     * @memberof Element
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Element.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.audio != null && message.hasOwnProperty("audio")) {
            properties.type = 1;
            {
                let error = $root.Audio.verify(message.audio);
                if (error)
                    return "audio." + error;
            }
        }
        if (message.balloons != null && message.hasOwnProperty("balloons")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Balloons.verify(message.balloons);
                if (error)
                    return "balloons." + error;
            }
        }
        if (message.bokehChart != null && message.hasOwnProperty("bokehChart")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.BokehChart.verify(message.bokehChart);
                if (error)
                    return "bokehChart." + error;
            }
        }
        if (message.chart != null && message.hasOwnProperty("chart")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Chart.verify(message.chart);
                if (error)
                    return "chart." + error;
            }
        }
        if (message.dataFrame != null && message.hasOwnProperty("dataFrame")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.DataFrame.verify(message.dataFrame);
                if (error)
                    return "dataFrame." + error;
            }
        }
        if (message.table != null && message.hasOwnProperty("table")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.DataFrame.verify(message.table);
                if (error)
                    return "table." + error;
            }
        }
        if (message.deckGlChart != null && message.hasOwnProperty("deckGlChart")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.DeckGlChart.verify(message.deckGlChart);
                if (error)
                    return "deckGlChart." + error;
            }
        }
        if (message.docString != null && message.hasOwnProperty("docString")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.DocString.verify(message.docString);
                if (error)
                    return "docString." + error;
            }
        }
        if (message.empty != null && message.hasOwnProperty("empty")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Empty.verify(message.empty);
                if (error)
                    return "empty." + error;
            }
        }
        if (message.exception != null && message.hasOwnProperty("exception")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Exception.verify(message.exception);
                if (error)
                    return "exception." + error;
            }
        }
        if (message.graphvizChart != null && message.hasOwnProperty("graphvizChart")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.GraphVizChart.verify(message.graphvizChart);
                if (error)
                    return "graphvizChart." + error;
            }
        }
        if (message.imgs != null && message.hasOwnProperty("imgs")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.ImageList.verify(message.imgs);
                if (error)
                    return "imgs." + error;
            }
        }
        if (message.map != null && message.hasOwnProperty("map")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Map.verify(message.map);
                if (error)
                    return "map." + error;
            }
        }
        if (message.plotlyChart != null && message.hasOwnProperty("plotlyChart")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.PlotlyChart.verify(message.plotlyChart);
                if (error)
                    return "plotlyChart." + error;
            }
        }
        if (message.progress != null && message.hasOwnProperty("progress")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Progress.verify(message.progress);
                if (error)
                    return "progress." + error;
            }
        }
        if (message.text != null && message.hasOwnProperty("text")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Text.verify(message.text);
                if (error)
                    return "text." + error;
            }
        }
        if (message.vegaLiteChart != null && message.hasOwnProperty("vegaLiteChart")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.VegaLiteChart.verify(message.vegaLiteChart);
                if (error)
                    return "vegaLiteChart." + error;
            }
        }
        if (message.video != null && message.hasOwnProperty("video")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Video.verify(message.video);
                if (error)
                    return "video." + error;
            }
        }
        return null;
    };

    /**
     * Creates an Element message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Element
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Element} Element
     */
    Element.fromObject = function fromObject(object) {
        if (object instanceof $root.Element)
            return object;
        let message = new $root.Element();
        if (object.audio != null) {
            if (typeof object.audio !== "object")
                throw TypeError(".Element.audio: object expected");
            message.audio = $root.Audio.fromObject(object.audio);
        }
        if (object.balloons != null) {
            if (typeof object.balloons !== "object")
                throw TypeError(".Element.balloons: object expected");
            message.balloons = $root.Balloons.fromObject(object.balloons);
        }
        if (object.bokehChart != null) {
            if (typeof object.bokehChart !== "object")
                throw TypeError(".Element.bokehChart: object expected");
            message.bokehChart = $root.BokehChart.fromObject(object.bokehChart);
        }
        if (object.chart != null) {
            if (typeof object.chart !== "object")
                throw TypeError(".Element.chart: object expected");
            message.chart = $root.Chart.fromObject(object.chart);
        }
        if (object.dataFrame != null) {
            if (typeof object.dataFrame !== "object")
                throw TypeError(".Element.dataFrame: object expected");
            message.dataFrame = $root.DataFrame.fromObject(object.dataFrame);
        }
        if (object.table != null) {
            if (typeof object.table !== "object")
                throw TypeError(".Element.table: object expected");
            message.table = $root.DataFrame.fromObject(object.table);
        }
        if (object.deckGlChart != null) {
            if (typeof object.deckGlChart !== "object")
                throw TypeError(".Element.deckGlChart: object expected");
            message.deckGlChart = $root.DeckGlChart.fromObject(object.deckGlChart);
        }
        if (object.docString != null) {
            if (typeof object.docString !== "object")
                throw TypeError(".Element.docString: object expected");
            message.docString = $root.DocString.fromObject(object.docString);
        }
        if (object.empty != null) {
            if (typeof object.empty !== "object")
                throw TypeError(".Element.empty: object expected");
            message.empty = $root.Empty.fromObject(object.empty);
        }
        if (object.exception != null) {
            if (typeof object.exception !== "object")
                throw TypeError(".Element.exception: object expected");
            message.exception = $root.Exception.fromObject(object.exception);
        }
        if (object.graphvizChart != null) {
            if (typeof object.graphvizChart !== "object")
                throw TypeError(".Element.graphvizChart: object expected");
            message.graphvizChart = $root.GraphVizChart.fromObject(object.graphvizChart);
        }
        if (object.imgs != null) {
            if (typeof object.imgs !== "object")
                throw TypeError(".Element.imgs: object expected");
            message.imgs = $root.ImageList.fromObject(object.imgs);
        }
        if (object.map != null) {
            if (typeof object.map !== "object")
                throw TypeError(".Element.map: object expected");
            message.map = $root.Map.fromObject(object.map);
        }
        if (object.plotlyChart != null) {
            if (typeof object.plotlyChart !== "object")
                throw TypeError(".Element.plotlyChart: object expected");
            message.plotlyChart = $root.PlotlyChart.fromObject(object.plotlyChart);
        }
        if (object.progress != null) {
            if (typeof object.progress !== "object")
                throw TypeError(".Element.progress: object expected");
            message.progress = $root.Progress.fromObject(object.progress);
        }
        if (object.text != null) {
            if (typeof object.text !== "object")
                throw TypeError(".Element.text: object expected");
            message.text = $root.Text.fromObject(object.text);
        }
        if (object.vegaLiteChart != null) {
            if (typeof object.vegaLiteChart !== "object")
                throw TypeError(".Element.vegaLiteChart: object expected");
            message.vegaLiteChart = $root.VegaLiteChart.fromObject(object.vegaLiteChart);
        }
        if (object.video != null) {
            if (typeof object.video !== "object")
                throw TypeError(".Element.video: object expected");
            message.video = $root.Video.fromObject(object.video);
        }
        return message;
    };

    /**
     * Creates a plain object from an Element message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Element
     * @static
     * @param {Element} message Element
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Element.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (message.text != null && message.hasOwnProperty("text")) {
            object.text = $root.Text.toObject(message.text, options);
            if (options.oneofs)
                object.type = "text";
        }
        if (message.empty != null && message.hasOwnProperty("empty")) {
            object.empty = $root.Empty.toObject(message.empty, options);
            if (options.oneofs)
                object.type = "empty";
        }
        if (message.dataFrame != null && message.hasOwnProperty("dataFrame")) {
            object.dataFrame = $root.DataFrame.toObject(message.dataFrame, options);
            if (options.oneofs)
                object.type = "dataFrame";
        }
        if (message.chart != null && message.hasOwnProperty("chart")) {
            object.chart = $root.Chart.toObject(message.chart, options);
            if (options.oneofs)
                object.type = "chart";
        }
        if (message.progress != null && message.hasOwnProperty("progress")) {
            object.progress = $root.Progress.toObject(message.progress, options);
            if (options.oneofs)
                object.type = "progress";
        }
        if (message.imgs != null && message.hasOwnProperty("imgs")) {
            object.imgs = $root.ImageList.toObject(message.imgs, options);
            if (options.oneofs)
                object.type = "imgs";
        }
        if (message.docString != null && message.hasOwnProperty("docString")) {
            object.docString = $root.DocString.toObject(message.docString, options);
            if (options.oneofs)
                object.type = "docString";
        }
        if (message.exception != null && message.hasOwnProperty("exception")) {
            object.exception = $root.Exception.toObject(message.exception, options);
            if (options.oneofs)
                object.type = "exception";
        }
        if (message.map != null && message.hasOwnProperty("map")) {
            object.map = $root.Map.toObject(message.map, options);
            if (options.oneofs)
                object.type = "map";
        }
        if (message.vegaLiteChart != null && message.hasOwnProperty("vegaLiteChart")) {
            object.vegaLiteChart = $root.VegaLiteChart.toObject(message.vegaLiteChart, options);
            if (options.oneofs)
                object.type = "vegaLiteChart";
        }
        if (message.table != null && message.hasOwnProperty("table")) {
            object.table = $root.DataFrame.toObject(message.table, options);
            if (options.oneofs)
                object.type = "table";
        }
        if (message.balloons != null && message.hasOwnProperty("balloons")) {
            object.balloons = $root.Balloons.toObject(message.balloons, options);
            if (options.oneofs)
                object.type = "balloons";
        }
        if (message.audio != null && message.hasOwnProperty("audio")) {
            object.audio = $root.Audio.toObject(message.audio, options);
            if (options.oneofs)
                object.type = "audio";
        }
        if (message.video != null && message.hasOwnProperty("video")) {
            object.video = $root.Video.toObject(message.video, options);
            if (options.oneofs)
                object.type = "video";
        }
        if (message.deckGlChart != null && message.hasOwnProperty("deckGlChart")) {
            object.deckGlChart = $root.DeckGlChart.toObject(message.deckGlChart, options);
            if (options.oneofs)
                object.type = "deckGlChart";
        }
        if (message.plotlyChart != null && message.hasOwnProperty("plotlyChart")) {
            object.plotlyChart = $root.PlotlyChart.toObject(message.plotlyChart, options);
            if (options.oneofs)
                object.type = "plotlyChart";
        }
        if (message.bokehChart != null && message.hasOwnProperty("bokehChart")) {
            object.bokehChart = $root.BokehChart.toObject(message.bokehChart, options);
            if (options.oneofs)
                object.type = "bokehChart";
        }
        if (message.graphvizChart != null && message.hasOwnProperty("graphvizChart")) {
            object.graphvizChart = $root.GraphVizChart.toObject(message.graphvizChart, options);
            if (options.oneofs)
                object.type = "graphvizChart";
        }
        return object;
    };

    /**
     * Converts this Element to JSON.
     * @function toJSON
     * @memberof Element
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Element.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Element;
})();

export const DocString = $root.DocString = (() => {

    /**
     * Properties of a DocString.
     * @exports IDocString
     * @interface IDocString
     * @property {string|null} [name] DocString name
     * @property {string|null} [module] DocString module
     * @property {string|null} [docString] DocString docString
     * @property {string|null} [type] DocString type
     * @property {string|null} [signature] DocString signature
     */

    /**
     * Constructs a new DocString.
     * @exports DocString
     * @classdesc Represents a DocString.
     * @implements IDocString
     * @constructor
     * @param {IDocString=} [properties] Properties to set
     */
    function DocString(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DocString name.
     * @member {string} name
     * @memberof DocString
     * @instance
     */
    DocString.prototype.name = "";

    /**
     * DocString module.
     * @member {string} module
     * @memberof DocString
     * @instance
     */
    DocString.prototype.module = "";

    /**
     * DocString docString.
     * @member {string} docString
     * @memberof DocString
     * @instance
     */
    DocString.prototype.docString = "";

    /**
     * DocString type.
     * @member {string} type
     * @memberof DocString
     * @instance
     */
    DocString.prototype.type = "";

    /**
     * DocString signature.
     * @member {string} signature
     * @memberof DocString
     * @instance
     */
    DocString.prototype.signature = "";

    /**
     * Creates a new DocString instance using the specified properties.
     * @function create
     * @memberof DocString
     * @static
     * @param {IDocString=} [properties] Properties to set
     * @returns {DocString} DocString instance
     */
    DocString.create = function create(properties) {
        return new DocString(properties);
    };

    /**
     * Encodes the specified DocString message. Does not implicitly {@link DocString.verify|verify} messages.
     * @function encode
     * @memberof DocString
     * @static
     * @param {IDocString} message DocString message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DocString.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.name != null && message.hasOwnProperty("name"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
        if (message.module != null && message.hasOwnProperty("module"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.module);
        if (message.docString != null && message.hasOwnProperty("docString"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.docString);
        if (message.type != null && message.hasOwnProperty("type"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.type);
        if (message.signature != null && message.hasOwnProperty("signature"))
            writer.uint32(/* id 5, wireType 2 =*/42).string(message.signature);
        return writer;
    };

    /**
     * Encodes the specified DocString message, length delimited. Does not implicitly {@link DocString.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DocString
     * @static
     * @param {IDocString} message DocString message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DocString.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DocString message from the specified reader or buffer.
     * @function decode
     * @memberof DocString
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DocString} DocString
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DocString.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.DocString();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.name = reader.string();
                break;
            case 2:
                message.module = reader.string();
                break;
            case 3:
                message.docString = reader.string();
                break;
            case 4:
                message.type = reader.string();
                break;
            case 5:
                message.signature = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DocString message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DocString
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DocString} DocString
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DocString.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DocString message.
     * @function verify
     * @memberof DocString
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DocString.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.name != null && message.hasOwnProperty("name"))
            if (!$util.isString(message.name))
                return "name: string expected";
        if (message.module != null && message.hasOwnProperty("module"))
            if (!$util.isString(message.module))
                return "module: string expected";
        if (message.docString != null && message.hasOwnProperty("docString"))
            if (!$util.isString(message.docString))
                return "docString: string expected";
        if (message.type != null && message.hasOwnProperty("type"))
            if (!$util.isString(message.type))
                return "type: string expected";
        if (message.signature != null && message.hasOwnProperty("signature"))
            if (!$util.isString(message.signature))
                return "signature: string expected";
        return null;
    };

    /**
     * Creates a DocString message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DocString
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DocString} DocString
     */
    DocString.fromObject = function fromObject(object) {
        if (object instanceof $root.DocString)
            return object;
        let message = new $root.DocString();
        if (object.name != null)
            message.name = String(object.name);
        if (object.module != null)
            message.module = String(object.module);
        if (object.docString != null)
            message.docString = String(object.docString);
        if (object.type != null)
            message.type = String(object.type);
        if (object.signature != null)
            message.signature = String(object.signature);
        return message;
    };

    /**
     * Creates a plain object from a DocString message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DocString
     * @static
     * @param {DocString} message DocString
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DocString.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.name = "";
            object.module = "";
            object.docString = "";
            object.type = "";
            object.signature = "";
        }
        if (message.name != null && message.hasOwnProperty("name"))
            object.name = message.name;
        if (message.module != null && message.hasOwnProperty("module"))
            object.module = message.module;
        if (message.docString != null && message.hasOwnProperty("docString"))
            object.docString = message.docString;
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = message.type;
        if (message.signature != null && message.hasOwnProperty("signature"))
            object.signature = message.signature;
        return object;
    };

    /**
     * Converts this DocString to JSON.
     * @function toJSON
     * @memberof DocString
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DocString.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DocString;
})();

export const Empty = $root.Empty = (() => {

    /**
     * Properties of an Empty.
     * @exports IEmpty
     * @interface IEmpty
     * @property {boolean|null} [unused] Empty unused
     */

    /**
     * Constructs a new Empty.
     * @exports Empty
     * @classdesc Represents an Empty.
     * @implements IEmpty
     * @constructor
     * @param {IEmpty=} [properties] Properties to set
     */
    function Empty(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Empty unused.
     * @member {boolean} unused
     * @memberof Empty
     * @instance
     */
    Empty.prototype.unused = false;

    /**
     * Creates a new Empty instance using the specified properties.
     * @function create
     * @memberof Empty
     * @static
     * @param {IEmpty=} [properties] Properties to set
     * @returns {Empty} Empty instance
     */
    Empty.create = function create(properties) {
        return new Empty(properties);
    };

    /**
     * Encodes the specified Empty message. Does not implicitly {@link Empty.verify|verify} messages.
     * @function encode
     * @memberof Empty
     * @static
     * @param {IEmpty} message Empty message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Empty.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.unused != null && message.hasOwnProperty("unused"))
            writer.uint32(/* id 1, wireType 0 =*/8).bool(message.unused);
        return writer;
    };

    /**
     * Encodes the specified Empty message, length delimited. Does not implicitly {@link Empty.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Empty
     * @static
     * @param {IEmpty} message Empty message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Empty.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Empty message from the specified reader or buffer.
     * @function decode
     * @memberof Empty
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Empty} Empty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Empty.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Empty();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.unused = reader.bool();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Empty message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Empty
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Empty} Empty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Empty.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Empty message.
     * @function verify
     * @memberof Empty
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Empty.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.unused != null && message.hasOwnProperty("unused"))
            if (typeof message.unused !== "boolean")
                return "unused: boolean expected";
        return null;
    };

    /**
     * Creates an Empty message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Empty
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Empty} Empty
     */
    Empty.fromObject = function fromObject(object) {
        if (object instanceof $root.Empty)
            return object;
        let message = new $root.Empty();
        if (object.unused != null)
            message.unused = Boolean(object.unused);
        return message;
    };

    /**
     * Creates a plain object from an Empty message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Empty
     * @static
     * @param {Empty} message Empty
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Empty.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.unused = false;
        if (message.unused != null && message.hasOwnProperty("unused"))
            object.unused = message.unused;
        return object;
    };

    /**
     * Converts this Empty to JSON.
     * @function toJSON
     * @memberof Empty
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Empty.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Empty;
})();

export const Exception = $root.Exception = (() => {

    /**
     * Properties of an Exception.
     * @exports IException
     * @interface IException
     * @property {string|null} [type] Exception type
     * @property {string|null} [message] Exception message
     * @property {Array.<string>|null} [stackTrace] Exception stackTrace
     */

    /**
     * Constructs a new Exception.
     * @exports Exception
     * @classdesc Represents an Exception.
     * @implements IException
     * @constructor
     * @param {IException=} [properties] Properties to set
     */
    function Exception(properties) {
        this.stackTrace = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Exception type.
     * @member {string} type
     * @memberof Exception
     * @instance
     */
    Exception.prototype.type = "";

    /**
     * Exception message.
     * @member {string} message
     * @memberof Exception
     * @instance
     */
    Exception.prototype.message = "";

    /**
     * Exception stackTrace.
     * @member {Array.<string>} stackTrace
     * @memberof Exception
     * @instance
     */
    Exception.prototype.stackTrace = $util.emptyArray;

    /**
     * Creates a new Exception instance using the specified properties.
     * @function create
     * @memberof Exception
     * @static
     * @param {IException=} [properties] Properties to set
     * @returns {Exception} Exception instance
     */
    Exception.create = function create(properties) {
        return new Exception(properties);
    };

    /**
     * Encodes the specified Exception message. Does not implicitly {@link Exception.verify|verify} messages.
     * @function encode
     * @memberof Exception
     * @static
     * @param {IException} message Exception message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Exception.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.type != null && message.hasOwnProperty("type"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.type);
        if (message.message != null && message.hasOwnProperty("message"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.message);
        if (message.stackTrace != null && message.stackTrace.length)
            for (let i = 0; i < message.stackTrace.length; ++i)
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.stackTrace[i]);
        return writer;
    };

    /**
     * Encodes the specified Exception message, length delimited. Does not implicitly {@link Exception.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Exception
     * @static
     * @param {IException} message Exception message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Exception.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Exception message from the specified reader or buffer.
     * @function decode
     * @memberof Exception
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Exception} Exception
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Exception.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Exception();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.type = reader.string();
                break;
            case 2:
                message.message = reader.string();
                break;
            case 3:
                if (!(message.stackTrace && message.stackTrace.length))
                    message.stackTrace = [];
                message.stackTrace.push(reader.string());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Exception message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Exception
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Exception} Exception
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Exception.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Exception message.
     * @function verify
     * @memberof Exception
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Exception.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.type != null && message.hasOwnProperty("type"))
            if (!$util.isString(message.type))
                return "type: string expected";
        if (message.message != null && message.hasOwnProperty("message"))
            if (!$util.isString(message.message))
                return "message: string expected";
        if (message.stackTrace != null && message.hasOwnProperty("stackTrace")) {
            if (!Array.isArray(message.stackTrace))
                return "stackTrace: array expected";
            for (let i = 0; i < message.stackTrace.length; ++i)
                if (!$util.isString(message.stackTrace[i]))
                    return "stackTrace: string[] expected";
        }
        return null;
    };

    /**
     * Creates an Exception message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Exception
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Exception} Exception
     */
    Exception.fromObject = function fromObject(object) {
        if (object instanceof $root.Exception)
            return object;
        let message = new $root.Exception();
        if (object.type != null)
            message.type = String(object.type);
        if (object.message != null)
            message.message = String(object.message);
        if (object.stackTrace) {
            if (!Array.isArray(object.stackTrace))
                throw TypeError(".Exception.stackTrace: array expected");
            message.stackTrace = [];
            for (let i = 0; i < object.stackTrace.length; ++i)
                message.stackTrace[i] = String(object.stackTrace[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from an Exception message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Exception
     * @static
     * @param {Exception} message Exception
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Exception.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.stackTrace = [];
        if (options.defaults) {
            object.type = "";
            object.message = "";
        }
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = message.type;
        if (message.message != null && message.hasOwnProperty("message"))
            object.message = message.message;
        if (message.stackTrace && message.stackTrace.length) {
            object.stackTrace = [];
            for (let j = 0; j < message.stackTrace.length; ++j)
                object.stackTrace[j] = message.stackTrace[j];
        }
        return object;
    };

    /**
     * Converts this Exception to JSON.
     * @function toJSON
     * @memberof Exception
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Exception.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Exception;
})();

export const GraphVizChart = $root.GraphVizChart = (() => {

    /**
     * Properties of a GraphVizChart.
     * @exports IGraphVizChart
     * @interface IGraphVizChart
     * @property {string|null} [spec] GraphVizChart spec
     * @property {number|null} [width] GraphVizChart width
     * @property {number|null} [height] GraphVizChart height
     */

    /**
     * Constructs a new GraphVizChart.
     * @exports GraphVizChart
     * @classdesc Represents a GraphVizChart.
     * @implements IGraphVizChart
     * @constructor
     * @param {IGraphVizChart=} [properties] Properties to set
     */
    function GraphVizChart(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * GraphVizChart spec.
     * @member {string} spec
     * @memberof GraphVizChart
     * @instance
     */
    GraphVizChart.prototype.spec = "";

    /**
     * GraphVizChart width.
     * @member {number} width
     * @memberof GraphVizChart
     * @instance
     */
    GraphVizChart.prototype.width = 0;

    /**
     * GraphVizChart height.
     * @member {number} height
     * @memberof GraphVizChart
     * @instance
     */
    GraphVizChart.prototype.height = 0;

    /**
     * Creates a new GraphVizChart instance using the specified properties.
     * @function create
     * @memberof GraphVizChart
     * @static
     * @param {IGraphVizChart=} [properties] Properties to set
     * @returns {GraphVizChart} GraphVizChart instance
     */
    GraphVizChart.create = function create(properties) {
        return new GraphVizChart(properties);
    };

    /**
     * Encodes the specified GraphVizChart message. Does not implicitly {@link GraphVizChart.verify|verify} messages.
     * @function encode
     * @memberof GraphVizChart
     * @static
     * @param {IGraphVizChart} message GraphVizChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphVizChart.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.spec != null && message.hasOwnProperty("spec"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.spec);
        if (message.width != null && message.hasOwnProperty("width"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.width);
        if (message.height != null && message.hasOwnProperty("height"))
            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.height);
        return writer;
    };

    /**
     * Encodes the specified GraphVizChart message, length delimited. Does not implicitly {@link GraphVizChart.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GraphVizChart
     * @static
     * @param {IGraphVizChart} message GraphVizChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GraphVizChart.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GraphVizChart message from the specified reader or buffer.
     * @function decode
     * @memberof GraphVizChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GraphVizChart} GraphVizChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphVizChart.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.GraphVizChart();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.spec = reader.string();
                break;
            case 2:
                message.width = reader.int32();
                break;
            case 3:
                message.height = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a GraphVizChart message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GraphVizChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GraphVizChart} GraphVizChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GraphVizChart.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GraphVizChart message.
     * @function verify
     * @memberof GraphVizChart
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GraphVizChart.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.spec != null && message.hasOwnProperty("spec"))
            if (!$util.isString(message.spec))
                return "spec: string expected";
        if (message.width != null && message.hasOwnProperty("width"))
            if (!$util.isInteger(message.width))
                return "width: integer expected";
        if (message.height != null && message.hasOwnProperty("height"))
            if (!$util.isInteger(message.height))
                return "height: integer expected";
        return null;
    };

    /**
     * Creates a GraphVizChart message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GraphVizChart
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GraphVizChart} GraphVizChart
     */
    GraphVizChart.fromObject = function fromObject(object) {
        if (object instanceof $root.GraphVizChart)
            return object;
        let message = new $root.GraphVizChart();
        if (object.spec != null)
            message.spec = String(object.spec);
        if (object.width != null)
            message.width = object.width | 0;
        if (object.height != null)
            message.height = object.height | 0;
        return message;
    };

    /**
     * Creates a plain object from a GraphVizChart message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GraphVizChart
     * @static
     * @param {GraphVizChart} message GraphVizChart
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GraphVizChart.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.spec = "";
            object.width = 0;
            object.height = 0;
        }
        if (message.spec != null && message.hasOwnProperty("spec"))
            object.spec = message.spec;
        if (message.width != null && message.hasOwnProperty("width"))
            object.width = message.width;
        if (message.height != null && message.hasOwnProperty("height"))
            object.height = message.height;
        return object;
    };

    /**
     * Converts this GraphVizChart to JSON.
     * @function toJSON
     * @memberof GraphVizChart
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GraphVizChart.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return GraphVizChart;
})();

export const Image = $root.Image = (() => {

    /**
     * Properties of an Image.
     * @exports IImage
     * @interface IImage
     * @property {string|null} [base_64Png] Image base_64Png
     * @property {string|null} [url] Image url
     * @property {string|null} [caption] Image caption
     */

    /**
     * Constructs a new Image.
     * @exports Image
     * @classdesc Represents an Image.
     * @implements IImage
     * @constructor
     * @param {IImage=} [properties] Properties to set
     */
    function Image(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Image base_64Png.
     * @member {string} base_64Png
     * @memberof Image
     * @instance
     */
    Image.prototype.base_64Png = "";

    /**
     * Image url.
     * @member {string} url
     * @memberof Image
     * @instance
     */
    Image.prototype.url = "";

    /**
     * Image caption.
     * @member {string} caption
     * @memberof Image
     * @instance
     */
    Image.prototype.caption = "";

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * Image type.
     * @member {"base_64Png"|"url"|undefined} type
     * @memberof Image
     * @instance
     */
    Object.defineProperty(Image.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["base_64Png", "url"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new Image instance using the specified properties.
     * @function create
     * @memberof Image
     * @static
     * @param {IImage=} [properties] Properties to set
     * @returns {Image} Image instance
     */
    Image.create = function create(properties) {
        return new Image(properties);
    };

    /**
     * Encodes the specified Image message. Does not implicitly {@link Image.verify|verify} messages.
     * @function encode
     * @memberof Image
     * @static
     * @param {IImage} message Image message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Image.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.base_64Png != null && message.hasOwnProperty("base_64Png"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.base_64Png);
        if (message.caption != null && message.hasOwnProperty("caption"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.caption);
        if (message.url != null && message.hasOwnProperty("url"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.url);
        return writer;
    };

    /**
     * Encodes the specified Image message, length delimited. Does not implicitly {@link Image.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Image
     * @static
     * @param {IImage} message Image message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Image.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Image message from the specified reader or buffer.
     * @function decode
     * @memberof Image
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Image} Image
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Image.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Image();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.base_64Png = reader.string();
                break;
            case 3:
                message.url = reader.string();
                break;
            case 2:
                message.caption = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Image message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Image
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Image} Image
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Image.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Image message.
     * @function verify
     * @memberof Image
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Image.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.base_64Png != null && message.hasOwnProperty("base_64Png")) {
            properties.type = 1;
            if (!$util.isString(message.base_64Png))
                return "base_64Png: string expected";
        }
        if (message.url != null && message.hasOwnProperty("url")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (!$util.isString(message.url))
                return "url: string expected";
        }
        if (message.caption != null && message.hasOwnProperty("caption"))
            if (!$util.isString(message.caption))
                return "caption: string expected";
        return null;
    };

    /**
     * Creates an Image message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Image
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Image} Image
     */
    Image.fromObject = function fromObject(object) {
        if (object instanceof $root.Image)
            return object;
        let message = new $root.Image();
        if (object.base_64Png != null)
            message.base_64Png = String(object.base_64Png);
        if (object.url != null)
            message.url = String(object.url);
        if (object.caption != null)
            message.caption = String(object.caption);
        return message;
    };

    /**
     * Creates a plain object from an Image message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Image
     * @static
     * @param {Image} message Image
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Image.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.caption = "";
        if (message.base_64Png != null && message.hasOwnProperty("base_64Png")) {
            object.base_64Png = message.base_64Png;
            if (options.oneofs)
                object.type = "base_64Png";
        }
        if (message.caption != null && message.hasOwnProperty("caption"))
            object.caption = message.caption;
        if (message.url != null && message.hasOwnProperty("url")) {
            object.url = message.url;
            if (options.oneofs)
                object.type = "url";
        }
        return object;
    };

    /**
     * Converts this Image to JSON.
     * @function toJSON
     * @memberof Image
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Image.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Image;
})();

export const ImageList = $root.ImageList = (() => {

    /**
     * Properties of an ImageList.
     * @exports IImageList
     * @interface IImageList
     * @property {Array.<IImage>|null} [imgs] ImageList imgs
     * @property {number|null} [width] ImageList width
     */

    /**
     * Constructs a new ImageList.
     * @exports ImageList
     * @classdesc Represents an ImageList.
     * @implements IImageList
     * @constructor
     * @param {IImageList=} [properties] Properties to set
     */
    function ImageList(properties) {
        this.imgs = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ImageList imgs.
     * @member {Array.<IImage>} imgs
     * @memberof ImageList
     * @instance
     */
    ImageList.prototype.imgs = $util.emptyArray;

    /**
     * ImageList width.
     * @member {number} width
     * @memberof ImageList
     * @instance
     */
    ImageList.prototype.width = 0;

    /**
     * Creates a new ImageList instance using the specified properties.
     * @function create
     * @memberof ImageList
     * @static
     * @param {IImageList=} [properties] Properties to set
     * @returns {ImageList} ImageList instance
     */
    ImageList.create = function create(properties) {
        return new ImageList(properties);
    };

    /**
     * Encodes the specified ImageList message. Does not implicitly {@link ImageList.verify|verify} messages.
     * @function encode
     * @memberof ImageList
     * @static
     * @param {IImageList} message ImageList message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ImageList.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.imgs != null && message.imgs.length)
            for (let i = 0; i < message.imgs.length; ++i)
                $root.Image.encode(message.imgs[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.width != null && message.hasOwnProperty("width"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.width);
        return writer;
    };

    /**
     * Encodes the specified ImageList message, length delimited. Does not implicitly {@link ImageList.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ImageList
     * @static
     * @param {IImageList} message ImageList message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ImageList.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an ImageList message from the specified reader or buffer.
     * @function decode
     * @memberof ImageList
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ImageList} ImageList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ImageList.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ImageList();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.imgs && message.imgs.length))
                    message.imgs = [];
                message.imgs.push($root.Image.decode(reader, reader.uint32()));
                break;
            case 2:
                message.width = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an ImageList message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ImageList
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ImageList} ImageList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ImageList.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an ImageList message.
     * @function verify
     * @memberof ImageList
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ImageList.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.imgs != null && message.hasOwnProperty("imgs")) {
            if (!Array.isArray(message.imgs))
                return "imgs: array expected";
            for (let i = 0; i < message.imgs.length; ++i) {
                let error = $root.Image.verify(message.imgs[i]);
                if (error)
                    return "imgs." + error;
            }
        }
        if (message.width != null && message.hasOwnProperty("width"))
            if (!$util.isInteger(message.width))
                return "width: integer expected";
        return null;
    };

    /**
     * Creates an ImageList message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ImageList
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ImageList} ImageList
     */
    ImageList.fromObject = function fromObject(object) {
        if (object instanceof $root.ImageList)
            return object;
        let message = new $root.ImageList();
        if (object.imgs) {
            if (!Array.isArray(object.imgs))
                throw TypeError(".ImageList.imgs: array expected");
            message.imgs = [];
            for (let i = 0; i < object.imgs.length; ++i) {
                if (typeof object.imgs[i] !== "object")
                    throw TypeError(".ImageList.imgs: object expected");
                message.imgs[i] = $root.Image.fromObject(object.imgs[i]);
            }
        }
        if (object.width != null)
            message.width = object.width | 0;
        return message;
    };

    /**
     * Creates a plain object from an ImageList message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ImageList
     * @static
     * @param {ImageList} message ImageList
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ImageList.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.imgs = [];
        if (options.defaults)
            object.width = 0;
        if (message.imgs && message.imgs.length) {
            object.imgs = [];
            for (let j = 0; j < message.imgs.length; ++j)
                object.imgs[j] = $root.Image.toObject(message.imgs[j], options);
        }
        if (message.width != null && message.hasOwnProperty("width"))
            object.width = message.width;
        return object;
    };

    /**
     * Converts this ImageList to JSON.
     * @function toJSON
     * @memberof ImageList
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ImageList.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return ImageList;
})();

export const Map = $root.Map = (() => {

    /**
     * Properties of a Map.
     * @exports IMap
     * @interface IMap
     * @property {IDataFrame|null} [points] Map points
     */

    /**
     * Constructs a new Map.
     * @exports Map
     * @classdesc Represents a Map.
     * @implements IMap
     * @constructor
     * @param {IMap=} [properties] Properties to set
     */
    function Map(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Map points.
     * @member {IDataFrame|null|undefined} points
     * @memberof Map
     * @instance
     */
    Map.prototype.points = null;

    /**
     * Creates a new Map instance using the specified properties.
     * @function create
     * @memberof Map
     * @static
     * @param {IMap=} [properties] Properties to set
     * @returns {Map} Map instance
     */
    Map.create = function create(properties) {
        return new Map(properties);
    };

    /**
     * Encodes the specified Map message. Does not implicitly {@link Map.verify|verify} messages.
     * @function encode
     * @memberof Map
     * @static
     * @param {IMap} message Map message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Map.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.points != null && message.hasOwnProperty("points"))
            $root.DataFrame.encode(message.points, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Map message, length delimited. Does not implicitly {@link Map.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Map
     * @static
     * @param {IMap} message Map message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Map.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Map message from the specified reader or buffer.
     * @function decode
     * @memberof Map
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Map} Map
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Map.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Map();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.points = $root.DataFrame.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Map message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Map
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Map} Map
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Map.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Map message.
     * @function verify
     * @memberof Map
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Map.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.points != null && message.hasOwnProperty("points")) {
            let error = $root.DataFrame.verify(message.points);
            if (error)
                return "points." + error;
        }
        return null;
    };

    /**
     * Creates a Map message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Map
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Map} Map
     */
    Map.fromObject = function fromObject(object) {
        if (object instanceof $root.Map)
            return object;
        let message = new $root.Map();
        if (object.points != null) {
            if (typeof object.points !== "object")
                throw TypeError(".Map.points: object expected");
            message.points = $root.DataFrame.fromObject(object.points);
        }
        return message;
    };

    /**
     * Creates a plain object from a Map message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Map
     * @static
     * @param {Map} message Map
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Map.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.points = null;
        if (message.points != null && message.hasOwnProperty("points"))
            object.points = $root.DataFrame.toObject(message.points, options);
        return object;
    };

    /**
     * Converts this Map to JSON.
     * @function toJSON
     * @memberof Map
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Map.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Map;
})();

export const PlotlyChart = $root.PlotlyChart = (() => {

    /**
     * Properties of a PlotlyChart.
     * @exports IPlotlyChart
     * @interface IPlotlyChart
     * @property {string|null} [url] PlotlyChart url
     * @property {IFigure|null} [figure] PlotlyChart figure
     * @property {number|null} [width] PlotlyChart width
     * @property {number|null} [height] PlotlyChart height
     */

    /**
     * Constructs a new PlotlyChart.
     * @exports PlotlyChart
     * @classdesc Represents a PlotlyChart.
     * @implements IPlotlyChart
     * @constructor
     * @param {IPlotlyChart=} [properties] Properties to set
     */
    function PlotlyChart(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * PlotlyChart url.
     * @member {string} url
     * @memberof PlotlyChart
     * @instance
     */
    PlotlyChart.prototype.url = "";

    /**
     * PlotlyChart figure.
     * @member {IFigure|null|undefined} figure
     * @memberof PlotlyChart
     * @instance
     */
    PlotlyChart.prototype.figure = null;

    /**
     * PlotlyChart width.
     * @member {number} width
     * @memberof PlotlyChart
     * @instance
     */
    PlotlyChart.prototype.width = 0;

    /**
     * PlotlyChart height.
     * @member {number} height
     * @memberof PlotlyChart
     * @instance
     */
    PlotlyChart.prototype.height = 0;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * PlotlyChart chart.
     * @member {"url"|"figure"|undefined} chart
     * @memberof PlotlyChart
     * @instance
     */
    Object.defineProperty(PlotlyChart.prototype, "chart", {
        get: $util.oneOfGetter($oneOfFields = ["url", "figure"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new PlotlyChart instance using the specified properties.
     * @function create
     * @memberof PlotlyChart
     * @static
     * @param {IPlotlyChart=} [properties] Properties to set
     * @returns {PlotlyChart} PlotlyChart instance
     */
    PlotlyChart.create = function create(properties) {
        return new PlotlyChart(properties);
    };

    /**
     * Encodes the specified PlotlyChart message. Does not implicitly {@link PlotlyChart.verify|verify} messages.
     * @function encode
     * @memberof PlotlyChart
     * @static
     * @param {IPlotlyChart} message PlotlyChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PlotlyChart.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.url != null && message.hasOwnProperty("url"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.url);
        if (message.figure != null && message.hasOwnProperty("figure"))
            $root.Figure.encode(message.figure, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.width != null && message.hasOwnProperty("width"))
            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.width);
        if (message.height != null && message.hasOwnProperty("height"))
            writer.uint32(/* id 4, wireType 0 =*/32).int32(message.height);
        return writer;
    };

    /**
     * Encodes the specified PlotlyChart message, length delimited. Does not implicitly {@link PlotlyChart.verify|verify} messages.
     * @function encodeDelimited
     * @memberof PlotlyChart
     * @static
     * @param {IPlotlyChart} message PlotlyChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    PlotlyChart.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a PlotlyChart message from the specified reader or buffer.
     * @function decode
     * @memberof PlotlyChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {PlotlyChart} PlotlyChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PlotlyChart.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.PlotlyChart();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.url = reader.string();
                break;
            case 2:
                message.figure = $root.Figure.decode(reader, reader.uint32());
                break;
            case 3:
                message.width = reader.int32();
                break;
            case 4:
                message.height = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a PlotlyChart message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof PlotlyChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {PlotlyChart} PlotlyChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    PlotlyChart.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a PlotlyChart message.
     * @function verify
     * @memberof PlotlyChart
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    PlotlyChart.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.url != null && message.hasOwnProperty("url")) {
            properties.chart = 1;
            if (!$util.isString(message.url))
                return "url: string expected";
        }
        if (message.figure != null && message.hasOwnProperty("figure")) {
            if (properties.chart === 1)
                return "chart: multiple values";
            properties.chart = 1;
            {
                let error = $root.Figure.verify(message.figure);
                if (error)
                    return "figure." + error;
            }
        }
        if (message.width != null && message.hasOwnProperty("width"))
            if (!$util.isInteger(message.width))
                return "width: integer expected";
        if (message.height != null && message.hasOwnProperty("height"))
            if (!$util.isInteger(message.height))
                return "height: integer expected";
        return null;
    };

    /**
     * Creates a PlotlyChart message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof PlotlyChart
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {PlotlyChart} PlotlyChart
     */
    PlotlyChart.fromObject = function fromObject(object) {
        if (object instanceof $root.PlotlyChart)
            return object;
        let message = new $root.PlotlyChart();
        if (object.url != null)
            message.url = String(object.url);
        if (object.figure != null) {
            if (typeof object.figure !== "object")
                throw TypeError(".PlotlyChart.figure: object expected");
            message.figure = $root.Figure.fromObject(object.figure);
        }
        if (object.width != null)
            message.width = object.width | 0;
        if (object.height != null)
            message.height = object.height | 0;
        return message;
    };

    /**
     * Creates a plain object from a PlotlyChart message. Also converts values to other types if specified.
     * @function toObject
     * @memberof PlotlyChart
     * @static
     * @param {PlotlyChart} message PlotlyChart
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    PlotlyChart.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.width = 0;
            object.height = 0;
        }
        if (message.url != null && message.hasOwnProperty("url")) {
            object.url = message.url;
            if (options.oneofs)
                object.chart = "url";
        }
        if (message.figure != null && message.hasOwnProperty("figure")) {
            object.figure = $root.Figure.toObject(message.figure, options);
            if (options.oneofs)
                object.chart = "figure";
        }
        if (message.width != null && message.hasOwnProperty("width"))
            object.width = message.width;
        if (message.height != null && message.hasOwnProperty("height"))
            object.height = message.height;
        return object;
    };

    /**
     * Converts this PlotlyChart to JSON.
     * @function toJSON
     * @memberof PlotlyChart
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    PlotlyChart.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return PlotlyChart;
})();

export const Figure = $root.Figure = (() => {

    /**
     * Properties of a Figure.
     * @exports IFigure
     * @interface IFigure
     * @property {string|null} [spec] Figure spec
     * @property {string|null} [config] Figure config
     */

    /**
     * Constructs a new Figure.
     * @exports Figure
     * @classdesc Represents a Figure.
     * @implements IFigure
     * @constructor
     * @param {IFigure=} [properties] Properties to set
     */
    function Figure(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Figure spec.
     * @member {string} spec
     * @memberof Figure
     * @instance
     */
    Figure.prototype.spec = "";

    /**
     * Figure config.
     * @member {string} config
     * @memberof Figure
     * @instance
     */
    Figure.prototype.config = "";

    /**
     * Creates a new Figure instance using the specified properties.
     * @function create
     * @memberof Figure
     * @static
     * @param {IFigure=} [properties] Properties to set
     * @returns {Figure} Figure instance
     */
    Figure.create = function create(properties) {
        return new Figure(properties);
    };

    /**
     * Encodes the specified Figure message. Does not implicitly {@link Figure.verify|verify} messages.
     * @function encode
     * @memberof Figure
     * @static
     * @param {IFigure} message Figure message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Figure.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.spec != null && message.hasOwnProperty("spec"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.spec);
        if (message.config != null && message.hasOwnProperty("config"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.config);
        return writer;
    };

    /**
     * Encodes the specified Figure message, length delimited. Does not implicitly {@link Figure.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Figure
     * @static
     * @param {IFigure} message Figure message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Figure.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Figure message from the specified reader or buffer.
     * @function decode
     * @memberof Figure
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Figure} Figure
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Figure.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Figure();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.spec = reader.string();
                break;
            case 2:
                message.config = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Figure message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Figure
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Figure} Figure
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Figure.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Figure message.
     * @function verify
     * @memberof Figure
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Figure.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.spec != null && message.hasOwnProperty("spec"))
            if (!$util.isString(message.spec))
                return "spec: string expected";
        if (message.config != null && message.hasOwnProperty("config"))
            if (!$util.isString(message.config))
                return "config: string expected";
        return null;
    };

    /**
     * Creates a Figure message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Figure
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Figure} Figure
     */
    Figure.fromObject = function fromObject(object) {
        if (object instanceof $root.Figure)
            return object;
        let message = new $root.Figure();
        if (object.spec != null)
            message.spec = String(object.spec);
        if (object.config != null)
            message.config = String(object.config);
        return message;
    };

    /**
     * Creates a plain object from a Figure message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Figure
     * @static
     * @param {Figure} message Figure
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Figure.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.spec = "";
            object.config = "";
        }
        if (message.spec != null && message.hasOwnProperty("spec"))
            object.spec = message.spec;
        if (message.config != null && message.hasOwnProperty("config"))
            object.config = message.config;
        return object;
    };

    /**
     * Converts this Figure to JSON.
     * @function toJSON
     * @memberof Figure
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Figure.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Figure;
})();

export const Progress = $root.Progress = (() => {

    /**
     * Properties of a Progress.
     * @exports IProgress
     * @interface IProgress
     * @property {number|null} [value] Progress value
     */

    /**
     * Constructs a new Progress.
     * @exports Progress
     * @classdesc Represents a Progress.
     * @implements IProgress
     * @constructor
     * @param {IProgress=} [properties] Properties to set
     */
    function Progress(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Progress value.
     * @member {number} value
     * @memberof Progress
     * @instance
     */
    Progress.prototype.value = 0;

    /**
     * Creates a new Progress instance using the specified properties.
     * @function create
     * @memberof Progress
     * @static
     * @param {IProgress=} [properties] Properties to set
     * @returns {Progress} Progress instance
     */
    Progress.create = function create(properties) {
        return new Progress(properties);
    };

    /**
     * Encodes the specified Progress message. Does not implicitly {@link Progress.verify|verify} messages.
     * @function encode
     * @memberof Progress
     * @static
     * @param {IProgress} message Progress message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Progress.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.value != null && message.hasOwnProperty("value"))
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.value);
        return writer;
    };

    /**
     * Encodes the specified Progress message, length delimited. Does not implicitly {@link Progress.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Progress
     * @static
     * @param {IProgress} message Progress message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Progress.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Progress message from the specified reader or buffer.
     * @function decode
     * @memberof Progress
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Progress} Progress
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Progress.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Progress();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.value = reader.uint32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Progress message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Progress
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Progress} Progress
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Progress.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Progress message.
     * @function verify
     * @memberof Progress
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Progress.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.value != null && message.hasOwnProperty("value"))
            if (!$util.isInteger(message.value))
                return "value: integer expected";
        return null;
    };

    /**
     * Creates a Progress message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Progress
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Progress} Progress
     */
    Progress.fromObject = function fromObject(object) {
        if (object instanceof $root.Progress)
            return object;
        let message = new $root.Progress();
        if (object.value != null)
            message.value = object.value >>> 0;
        return message;
    };

    /**
     * Creates a plain object from a Progress message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Progress
     * @static
     * @param {Progress} message Progress
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Progress.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.value = 0;
        if (message.value != null && message.hasOwnProperty("value"))
            object.value = message.value;
        return object;
    };

    /**
     * Converts this Progress to JSON.
     * @function toJSON
     * @memberof Progress
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Progress.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Progress;
})();

export const Text = $root.Text = (() => {

    /**
     * Properties of a Text.
     * @exports IText
     * @interface IText
     * @property {string|null} [body] Text body
     * @property {Text.Format|null} [format] Text format
     */

    /**
     * Constructs a new Text.
     * @exports Text
     * @classdesc Represents a Text.
     * @implements IText
     * @constructor
     * @param {IText=} [properties] Properties to set
     */
    function Text(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Text body.
     * @member {string} body
     * @memberof Text
     * @instance
     */
    Text.prototype.body = "";

    /**
     * Text format.
     * @member {Text.Format} format
     * @memberof Text
     * @instance
     */
    Text.prototype.format = 0;

    /**
     * Creates a new Text instance using the specified properties.
     * @function create
     * @memberof Text
     * @static
     * @param {IText=} [properties] Properties to set
     * @returns {Text} Text instance
     */
    Text.create = function create(properties) {
        return new Text(properties);
    };

    /**
     * Encodes the specified Text message. Does not implicitly {@link Text.verify|verify} messages.
     * @function encode
     * @memberof Text
     * @static
     * @param {IText} message Text message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Text.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.body != null && message.hasOwnProperty("body"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.body);
        if (message.format != null && message.hasOwnProperty("format"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.format);
        return writer;
    };

    /**
     * Encodes the specified Text message, length delimited. Does not implicitly {@link Text.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Text
     * @static
     * @param {IText} message Text message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Text.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Text message from the specified reader or buffer.
     * @function decode
     * @memberof Text
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Text} Text
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Text.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Text();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.body = reader.string();
                break;
            case 2:
                message.format = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Text message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Text
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Text} Text
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Text.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Text message.
     * @function verify
     * @memberof Text
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Text.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.body != null && message.hasOwnProperty("body"))
            if (!$util.isString(message.body))
                return "body: string expected";
        if (message.format != null && message.hasOwnProperty("format"))
            switch (message.format) {
            default:
                return "format: enum value expected";
            case 0:
            case 1:
            case 2:
            case 6:
            case 7:
            case 8:
            case 9:
                break;
            }
        return null;
    };

    /**
     * Creates a Text message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Text
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Text} Text
     */
    Text.fromObject = function fromObject(object) {
        if (object instanceof $root.Text)
            return object;
        let message = new $root.Text();
        if (object.body != null)
            message.body = String(object.body);
        switch (object.format) {
        case "PLAIN":
        case 0:
            message.format = 0;
            break;
        case "MARKDOWN":
        case 1:
            message.format = 1;
            break;
        case "JSON":
        case 2:
            message.format = 2;
            break;
        case "ERROR":
        case 6:
            message.format = 6;
            break;
        case "WARNING":
        case 7:
            message.format = 7;
            break;
        case "INFO":
        case 8:
            message.format = 8;
            break;
        case "SUCCESS":
        case 9:
            message.format = 9;
            break;
        }
        return message;
    };

    /**
     * Creates a plain object from a Text message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Text
     * @static
     * @param {Text} message Text
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Text.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.body = "";
            object.format = options.enums === String ? "PLAIN" : 0;
        }
        if (message.body != null && message.hasOwnProperty("body"))
            object.body = message.body;
        if (message.format != null && message.hasOwnProperty("format"))
            object.format = options.enums === String ? $root.Text.Format[message.format] : message.format;
        return object;
    };

    /**
     * Converts this Text to JSON.
     * @function toJSON
     * @memberof Text
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Text.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Format enum.
     * @name Text.Format
     * @enum {string}
     * @property {number} PLAIN=0 PLAIN value
     * @property {number} MARKDOWN=1 MARKDOWN value
     * @property {number} JSON=2 JSON value
     * @property {number} ERROR=6 ERROR value
     * @property {number} WARNING=7 WARNING value
     * @property {number} INFO=8 INFO value
     * @property {number} SUCCESS=9 SUCCESS value
     */
    Text.Format = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "PLAIN"] = 0;
        values[valuesById[1] = "MARKDOWN"] = 1;
        values[valuesById[2] = "JSON"] = 2;
        values[valuesById[6] = "ERROR"] = 6;
        values[valuesById[7] = "WARNING"] = 7;
        values[valuesById[8] = "INFO"] = 8;
        values[valuesById[9] = "SUCCESS"] = 9;
        return values;
    })();

    return Text;
})();

export const VegaLiteChart = $root.VegaLiteChart = (() => {

    /**
     * Properties of a VegaLiteChart.
     * @exports IVegaLiteChart
     * @interface IVegaLiteChart
     * @property {string|null} [spec] VegaLiteChart spec
     * @property {IDataFrame|null} [data] VegaLiteChart data
     * @property {Array.<INamedDataSet>|null} [datasets] VegaLiteChart datasets
     */

    /**
     * Constructs a new VegaLiteChart.
     * @exports VegaLiteChart
     * @classdesc Represents a VegaLiteChart.
     * @implements IVegaLiteChart
     * @constructor
     * @param {IVegaLiteChart=} [properties] Properties to set
     */
    function VegaLiteChart(properties) {
        this.datasets = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * VegaLiteChart spec.
     * @member {string} spec
     * @memberof VegaLiteChart
     * @instance
     */
    VegaLiteChart.prototype.spec = "";

    /**
     * VegaLiteChart data.
     * @member {IDataFrame|null|undefined} data
     * @memberof VegaLiteChart
     * @instance
     */
    VegaLiteChart.prototype.data = null;

    /**
     * VegaLiteChart datasets.
     * @member {Array.<INamedDataSet>} datasets
     * @memberof VegaLiteChart
     * @instance
     */
    VegaLiteChart.prototype.datasets = $util.emptyArray;

    /**
     * Creates a new VegaLiteChart instance using the specified properties.
     * @function create
     * @memberof VegaLiteChart
     * @static
     * @param {IVegaLiteChart=} [properties] Properties to set
     * @returns {VegaLiteChart} VegaLiteChart instance
     */
    VegaLiteChart.create = function create(properties) {
        return new VegaLiteChart(properties);
    };

    /**
     * Encodes the specified VegaLiteChart message. Does not implicitly {@link VegaLiteChart.verify|verify} messages.
     * @function encode
     * @memberof VegaLiteChart
     * @static
     * @param {IVegaLiteChart} message VegaLiteChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    VegaLiteChart.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.spec != null && message.hasOwnProperty("spec"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.spec);
        if (message.data != null && message.hasOwnProperty("data"))
            $root.DataFrame.encode(message.data, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.datasets != null && message.datasets.length)
            for (let i = 0; i < message.datasets.length; ++i)
                $root.NamedDataSet.encode(message.datasets[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified VegaLiteChart message, length delimited. Does not implicitly {@link VegaLiteChart.verify|verify} messages.
     * @function encodeDelimited
     * @memberof VegaLiteChart
     * @static
     * @param {IVegaLiteChart} message VegaLiteChart message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    VegaLiteChart.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a VegaLiteChart message from the specified reader or buffer.
     * @function decode
     * @memberof VegaLiteChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {VegaLiteChart} VegaLiteChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    VegaLiteChart.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.VegaLiteChart();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.spec = reader.string();
                break;
            case 2:
                message.data = $root.DataFrame.decode(reader, reader.uint32());
                break;
            case 4:
                if (!(message.datasets && message.datasets.length))
                    message.datasets = [];
                message.datasets.push($root.NamedDataSet.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a VegaLiteChart message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof VegaLiteChart
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {VegaLiteChart} VegaLiteChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    VegaLiteChart.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a VegaLiteChart message.
     * @function verify
     * @memberof VegaLiteChart
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    VegaLiteChart.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.spec != null && message.hasOwnProperty("spec"))
            if (!$util.isString(message.spec))
                return "spec: string expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.DataFrame.verify(message.data);
            if (error)
                return "data." + error;
        }
        if (message.datasets != null && message.hasOwnProperty("datasets")) {
            if (!Array.isArray(message.datasets))
                return "datasets: array expected";
            for (let i = 0; i < message.datasets.length; ++i) {
                let error = $root.NamedDataSet.verify(message.datasets[i]);
                if (error)
                    return "datasets." + error;
            }
        }
        return null;
    };

    /**
     * Creates a VegaLiteChart message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof VegaLiteChart
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {VegaLiteChart} VegaLiteChart
     */
    VegaLiteChart.fromObject = function fromObject(object) {
        if (object instanceof $root.VegaLiteChart)
            return object;
        let message = new $root.VegaLiteChart();
        if (object.spec != null)
            message.spec = String(object.spec);
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".VegaLiteChart.data: object expected");
            message.data = $root.DataFrame.fromObject(object.data);
        }
        if (object.datasets) {
            if (!Array.isArray(object.datasets))
                throw TypeError(".VegaLiteChart.datasets: array expected");
            message.datasets = [];
            for (let i = 0; i < object.datasets.length; ++i) {
                if (typeof object.datasets[i] !== "object")
                    throw TypeError(".VegaLiteChart.datasets: object expected");
                message.datasets[i] = $root.NamedDataSet.fromObject(object.datasets[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a VegaLiteChart message. Also converts values to other types if specified.
     * @function toObject
     * @memberof VegaLiteChart
     * @static
     * @param {VegaLiteChart} message VegaLiteChart
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    VegaLiteChart.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.datasets = [];
        if (options.defaults) {
            object.spec = "";
            object.data = null;
        }
        if (message.spec != null && message.hasOwnProperty("spec"))
            object.spec = message.spec;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.DataFrame.toObject(message.data, options);
        if (message.datasets && message.datasets.length) {
            object.datasets = [];
            for (let j = 0; j < message.datasets.length; ++j)
                object.datasets[j] = $root.NamedDataSet.toObject(message.datasets[j], options);
        }
        return object;
    };

    /**
     * Converts this VegaLiteChart to JSON.
     * @function toJSON
     * @memberof VegaLiteChart
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    VegaLiteChart.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return VegaLiteChart;
})();

export const NamedDataSet = $root.NamedDataSet = (() => {

    /**
     * Properties of a NamedDataSet.
     * @exports INamedDataSet
     * @interface INamedDataSet
     * @property {string|null} [name] NamedDataSet name
     * @property {boolean|null} [hasName] NamedDataSet hasName
     * @property {IDataFrame|null} [data] NamedDataSet data
     */

    /**
     * Constructs a new NamedDataSet.
     * @exports NamedDataSet
     * @classdesc Represents a NamedDataSet.
     * @implements INamedDataSet
     * @constructor
     * @param {INamedDataSet=} [properties] Properties to set
     */
    function NamedDataSet(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * NamedDataSet name.
     * @member {string} name
     * @memberof NamedDataSet
     * @instance
     */
    NamedDataSet.prototype.name = "";

    /**
     * NamedDataSet hasName.
     * @member {boolean} hasName
     * @memberof NamedDataSet
     * @instance
     */
    NamedDataSet.prototype.hasName = false;

    /**
     * NamedDataSet data.
     * @member {IDataFrame|null|undefined} data
     * @memberof NamedDataSet
     * @instance
     */
    NamedDataSet.prototype.data = null;

    /**
     * Creates a new NamedDataSet instance using the specified properties.
     * @function create
     * @memberof NamedDataSet
     * @static
     * @param {INamedDataSet=} [properties] Properties to set
     * @returns {NamedDataSet} NamedDataSet instance
     */
    NamedDataSet.create = function create(properties) {
        return new NamedDataSet(properties);
    };

    /**
     * Encodes the specified NamedDataSet message. Does not implicitly {@link NamedDataSet.verify|verify} messages.
     * @function encode
     * @memberof NamedDataSet
     * @static
     * @param {INamedDataSet} message NamedDataSet message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NamedDataSet.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.name != null && message.hasOwnProperty("name"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
        if (message.data != null && message.hasOwnProperty("data"))
            $root.DataFrame.encode(message.data, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.hasName != null && message.hasOwnProperty("hasName"))
            writer.uint32(/* id 3, wireType 0 =*/24).bool(message.hasName);
        return writer;
    };

    /**
     * Encodes the specified NamedDataSet message, length delimited. Does not implicitly {@link NamedDataSet.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NamedDataSet
     * @static
     * @param {INamedDataSet} message NamedDataSet message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NamedDataSet.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NamedDataSet message from the specified reader or buffer.
     * @function decode
     * @memberof NamedDataSet
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NamedDataSet} NamedDataSet
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NamedDataSet.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.NamedDataSet();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.name = reader.string();
                break;
            case 3:
                message.hasName = reader.bool();
                break;
            case 2:
                message.data = $root.DataFrame.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a NamedDataSet message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NamedDataSet
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NamedDataSet} NamedDataSet
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NamedDataSet.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NamedDataSet message.
     * @function verify
     * @memberof NamedDataSet
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NamedDataSet.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.name != null && message.hasOwnProperty("name"))
            if (!$util.isString(message.name))
                return "name: string expected";
        if (message.hasName != null && message.hasOwnProperty("hasName"))
            if (typeof message.hasName !== "boolean")
                return "hasName: boolean expected";
        if (message.data != null && message.hasOwnProperty("data")) {
            let error = $root.DataFrame.verify(message.data);
            if (error)
                return "data." + error;
        }
        return null;
    };

    /**
     * Creates a NamedDataSet message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NamedDataSet
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NamedDataSet} NamedDataSet
     */
    NamedDataSet.fromObject = function fromObject(object) {
        if (object instanceof $root.NamedDataSet)
            return object;
        let message = new $root.NamedDataSet();
        if (object.name != null)
            message.name = String(object.name);
        if (object.hasName != null)
            message.hasName = Boolean(object.hasName);
        if (object.data != null) {
            if (typeof object.data !== "object")
                throw TypeError(".NamedDataSet.data: object expected");
            message.data = $root.DataFrame.fromObject(object.data);
        }
        return message;
    };

    /**
     * Creates a plain object from a NamedDataSet message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NamedDataSet
     * @static
     * @param {NamedDataSet} message NamedDataSet
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NamedDataSet.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.name = "";
            object.data = null;
            object.hasName = false;
        }
        if (message.name != null && message.hasOwnProperty("name"))
            object.name = message.name;
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = $root.DataFrame.toObject(message.data, options);
        if (message.hasName != null && message.hasOwnProperty("hasName"))
            object.hasName = message.hasName;
        return object;
    };

    /**
     * Converts this NamedDataSet to JSON.
     * @function toJSON
     * @memberof NamedDataSet
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NamedDataSet.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return NamedDataSet;
})();

export const Video = $root.Video = (() => {

    /**
     * Properties of a Video.
     * @exports IVideo
     * @interface IVideo
     * @property {string|null} [data] Video data
     * @property {string|null} [format] Video format
     */

    /**
     * Constructs a new Video.
     * @exports Video
     * @classdesc Represents a Video.
     * @implements IVideo
     * @constructor
     * @param {IVideo=} [properties] Properties to set
     */
    function Video(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Video data.
     * @member {string} data
     * @memberof Video
     * @instance
     */
    Video.prototype.data = "";

    /**
     * Video format.
     * @member {string} format
     * @memberof Video
     * @instance
     */
    Video.prototype.format = "";

    /**
     * Creates a new Video instance using the specified properties.
     * @function create
     * @memberof Video
     * @static
     * @param {IVideo=} [properties] Properties to set
     * @returns {Video} Video instance
     */
    Video.create = function create(properties) {
        return new Video(properties);
    };

    /**
     * Encodes the specified Video message. Does not implicitly {@link Video.verify|verify} messages.
     * @function encode
     * @memberof Video
     * @static
     * @param {IVideo} message Video message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Video.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.data != null && message.hasOwnProperty("data"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.data);
        if (message.format != null && message.hasOwnProperty("format"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.format);
        return writer;
    };

    /**
     * Encodes the specified Video message, length delimited. Does not implicitly {@link Video.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Video
     * @static
     * @param {IVideo} message Video message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Video.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Video message from the specified reader or buffer.
     * @function decode
     * @memberof Video
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Video} Video
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Video.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Video();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.data = reader.string();
                break;
            case 2:
                message.format = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a Video message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Video
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Video} Video
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Video.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Video message.
     * @function verify
     * @memberof Video
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Video.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.data != null && message.hasOwnProperty("data"))
            if (!$util.isString(message.data))
                return "data: string expected";
        if (message.format != null && message.hasOwnProperty("format"))
            if (!$util.isString(message.format))
                return "format: string expected";
        return null;
    };

    /**
     * Creates a Video message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Video
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Video} Video
     */
    Video.fromObject = function fromObject(object) {
        if (object instanceof $root.Video)
            return object;
        let message = new $root.Video();
        if (object.data != null)
            message.data = String(object.data);
        if (object.format != null)
            message.format = String(object.format);
        return message;
    };

    /**
     * Creates a plain object from a Video message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Video
     * @static
     * @param {Video} message Video
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Video.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.data = "";
            object.format = "";
        }
        if (message.data != null && message.hasOwnProperty("data"))
            object.data = message.data;
        if (message.format != null && message.hasOwnProperty("format"))
            object.format = message.format;
        return object;
    };

    /**
     * Converts this Video to JSON.
     * @function toJSON
     * @memberof Video
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Video.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Video;
})();

export const ForwardMsg = $root.ForwardMsg = (() => {

    /**
     * Properties of a ForwardMsg.
     * @exports IForwardMsg
     * @interface IForwardMsg
     * @property {IInitialize|null} [initialize] ForwardMsg initialize
     * @property {INewReport|null} [newReport] ForwardMsg newReport
     * @property {IDelta|null} [delta] ForwardMsg delta
     * @property {boolean|null} [reportFinished] ForwardMsg reportFinished
     * @property {number|null} [uploadReportProgress] ForwardMsg uploadReportProgress
     * @property {string|null} [reportUploaded] ForwardMsg reportUploaded
     * @property {ISessionState|null} [sessionStateChanged] ForwardMsg sessionStateChanged
     * @property {ISessionEvent|null} [sessionEvent] ForwardMsg sessionEvent
     */

    /**
     * Constructs a new ForwardMsg.
     * @exports ForwardMsg
     * @classdesc Represents a ForwardMsg.
     * @implements IForwardMsg
     * @constructor
     * @param {IForwardMsg=} [properties] Properties to set
     */
    function ForwardMsg(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ForwardMsg initialize.
     * @member {IInitialize|null|undefined} initialize
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.initialize = null;

    /**
     * ForwardMsg newReport.
     * @member {INewReport|null|undefined} newReport
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.newReport = null;

    /**
     * ForwardMsg delta.
     * @member {IDelta|null|undefined} delta
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.delta = null;

    /**
     * ForwardMsg reportFinished.
     * @member {boolean} reportFinished
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.reportFinished = false;

    /**
     * ForwardMsg uploadReportProgress.
     * @member {number} uploadReportProgress
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.uploadReportProgress = 0;

    /**
     * ForwardMsg reportUploaded.
     * @member {string} reportUploaded
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.reportUploaded = "";

    /**
     * ForwardMsg sessionStateChanged.
     * @member {ISessionState|null|undefined} sessionStateChanged
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.sessionStateChanged = null;

    /**
     * ForwardMsg sessionEvent.
     * @member {ISessionEvent|null|undefined} sessionEvent
     * @memberof ForwardMsg
     * @instance
     */
    ForwardMsg.prototype.sessionEvent = null;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * ForwardMsg type.
     * @member {"initialize"|"newReport"|"delta"|"reportFinished"|"uploadReportProgress"|"reportUploaded"|"sessionStateChanged"|"sessionEvent"|undefined} type
     * @memberof ForwardMsg
     * @instance
     */
    Object.defineProperty(ForwardMsg.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["initialize", "newReport", "delta", "reportFinished", "uploadReportProgress", "reportUploaded", "sessionStateChanged", "sessionEvent"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new ForwardMsg instance using the specified properties.
     * @function create
     * @memberof ForwardMsg
     * @static
     * @param {IForwardMsg=} [properties] Properties to set
     * @returns {ForwardMsg} ForwardMsg instance
     */
    ForwardMsg.create = function create(properties) {
        return new ForwardMsg(properties);
    };

    /**
     * Encodes the specified ForwardMsg message. Does not implicitly {@link ForwardMsg.verify|verify} messages.
     * @function encode
     * @memberof ForwardMsg
     * @static
     * @param {IForwardMsg} message ForwardMsg message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ForwardMsg.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.initialize != null && message.hasOwnProperty("initialize"))
            $root.Initialize.encode(message.initialize, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.newReport != null && message.hasOwnProperty("newReport"))
            $root.NewReport.encode(message.newReport, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        if (message.delta != null && message.hasOwnProperty("delta"))
            $root.Delta.encode(message.delta, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        if (message.reportFinished != null && message.hasOwnProperty("reportFinished"))
            writer.uint32(/* id 4, wireType 0 =*/32).bool(message.reportFinished);
        if (message.uploadReportProgress != null && message.hasOwnProperty("uploadReportProgress"))
            writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.uploadReportProgress);
        if (message.reportUploaded != null && message.hasOwnProperty("reportUploaded"))
            writer.uint32(/* id 6, wireType 2 =*/50).string(message.reportUploaded);
        if (message.sessionStateChanged != null && message.hasOwnProperty("sessionStateChanged"))
            $root.SessionState.encode(message.sessionStateChanged, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
        if (message.sessionEvent != null && message.hasOwnProperty("sessionEvent"))
            $root.SessionEvent.encode(message.sessionEvent, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified ForwardMsg message, length delimited. Does not implicitly {@link ForwardMsg.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ForwardMsg
     * @static
     * @param {IForwardMsg} message ForwardMsg message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ForwardMsg.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ForwardMsg message from the specified reader or buffer.
     * @function decode
     * @memberof ForwardMsg
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ForwardMsg} ForwardMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ForwardMsg.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.ForwardMsg();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.initialize = $root.Initialize.decode(reader, reader.uint32());
                break;
            case 2:
                message.newReport = $root.NewReport.decode(reader, reader.uint32());
                break;
            case 3:
                message.delta = $root.Delta.decode(reader, reader.uint32());
                break;
            case 4:
                message.reportFinished = reader.bool();
                break;
            case 5:
                message.uploadReportProgress = reader.uint32();
                break;
            case 6:
                message.reportUploaded = reader.string();
                break;
            case 7:
                message.sessionStateChanged = $root.SessionState.decode(reader, reader.uint32());
                break;
            case 8:
                message.sessionEvent = $root.SessionEvent.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a ForwardMsg message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ForwardMsg
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ForwardMsg} ForwardMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ForwardMsg.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ForwardMsg message.
     * @function verify
     * @memberof ForwardMsg
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ForwardMsg.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.initialize != null && message.hasOwnProperty("initialize")) {
            properties.type = 1;
            {
                let error = $root.Initialize.verify(message.initialize);
                if (error)
                    return "initialize." + error;
            }
        }
        if (message.newReport != null && message.hasOwnProperty("newReport")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.NewReport.verify(message.newReport);
                if (error)
                    return "newReport." + error;
            }
        }
        if (message.delta != null && message.hasOwnProperty("delta")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.Delta.verify(message.delta);
                if (error)
                    return "delta." + error;
            }
        }
        if (message.reportFinished != null && message.hasOwnProperty("reportFinished")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (typeof message.reportFinished !== "boolean")
                return "reportFinished: boolean expected";
        }
        if (message.uploadReportProgress != null && message.hasOwnProperty("uploadReportProgress")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (!$util.isInteger(message.uploadReportProgress))
                return "uploadReportProgress: integer expected";
        }
        if (message.reportUploaded != null && message.hasOwnProperty("reportUploaded")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (!$util.isString(message.reportUploaded))
                return "reportUploaded: string expected";
        }
        if (message.sessionStateChanged != null && message.hasOwnProperty("sessionStateChanged")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.SessionState.verify(message.sessionStateChanged);
                if (error)
                    return "sessionStateChanged." + error;
            }
        }
        if (message.sessionEvent != null && message.hasOwnProperty("sessionEvent")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            {
                let error = $root.SessionEvent.verify(message.sessionEvent);
                if (error)
                    return "sessionEvent." + error;
            }
        }
        return null;
    };

    /**
     * Creates a ForwardMsg message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ForwardMsg
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ForwardMsg} ForwardMsg
     */
    ForwardMsg.fromObject = function fromObject(object) {
        if (object instanceof $root.ForwardMsg)
            return object;
        let message = new $root.ForwardMsg();
        if (object.initialize != null) {
            if (typeof object.initialize !== "object")
                throw TypeError(".ForwardMsg.initialize: object expected");
            message.initialize = $root.Initialize.fromObject(object.initialize);
        }
        if (object.newReport != null) {
            if (typeof object.newReport !== "object")
                throw TypeError(".ForwardMsg.newReport: object expected");
            message.newReport = $root.NewReport.fromObject(object.newReport);
        }
        if (object.delta != null) {
            if (typeof object.delta !== "object")
                throw TypeError(".ForwardMsg.delta: object expected");
            message.delta = $root.Delta.fromObject(object.delta);
        }
        if (object.reportFinished != null)
            message.reportFinished = Boolean(object.reportFinished);
        if (object.uploadReportProgress != null)
            message.uploadReportProgress = object.uploadReportProgress >>> 0;
        if (object.reportUploaded != null)
            message.reportUploaded = String(object.reportUploaded);
        if (object.sessionStateChanged != null) {
            if (typeof object.sessionStateChanged !== "object")
                throw TypeError(".ForwardMsg.sessionStateChanged: object expected");
            message.sessionStateChanged = $root.SessionState.fromObject(object.sessionStateChanged);
        }
        if (object.sessionEvent != null) {
            if (typeof object.sessionEvent !== "object")
                throw TypeError(".ForwardMsg.sessionEvent: object expected");
            message.sessionEvent = $root.SessionEvent.fromObject(object.sessionEvent);
        }
        return message;
    };

    /**
     * Creates a plain object from a ForwardMsg message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ForwardMsg
     * @static
     * @param {ForwardMsg} message ForwardMsg
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ForwardMsg.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (message.initialize != null && message.hasOwnProperty("initialize")) {
            object.initialize = $root.Initialize.toObject(message.initialize, options);
            if (options.oneofs)
                object.type = "initialize";
        }
        if (message.newReport != null && message.hasOwnProperty("newReport")) {
            object.newReport = $root.NewReport.toObject(message.newReport, options);
            if (options.oneofs)
                object.type = "newReport";
        }
        if (message.delta != null && message.hasOwnProperty("delta")) {
            object.delta = $root.Delta.toObject(message.delta, options);
            if (options.oneofs)
                object.type = "delta";
        }
        if (message.reportFinished != null && message.hasOwnProperty("reportFinished")) {
            object.reportFinished = message.reportFinished;
            if (options.oneofs)
                object.type = "reportFinished";
        }
        if (message.uploadReportProgress != null && message.hasOwnProperty("uploadReportProgress")) {
            object.uploadReportProgress = message.uploadReportProgress;
            if (options.oneofs)
                object.type = "uploadReportProgress";
        }
        if (message.reportUploaded != null && message.hasOwnProperty("reportUploaded")) {
            object.reportUploaded = message.reportUploaded;
            if (options.oneofs)
                object.type = "reportUploaded";
        }
        if (message.sessionStateChanged != null && message.hasOwnProperty("sessionStateChanged")) {
            object.sessionStateChanged = $root.SessionState.toObject(message.sessionStateChanged, options);
            if (options.oneofs)
                object.type = "sessionStateChanged";
        }
        if (message.sessionEvent != null && message.hasOwnProperty("sessionEvent")) {
            object.sessionEvent = $root.SessionEvent.toObject(message.sessionEvent, options);
            if (options.oneofs)
                object.type = "sessionEvent";
        }
        return object;
    };

    /**
     * Converts this ForwardMsg to JSON.
     * @function toJSON
     * @memberof ForwardMsg
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ForwardMsg.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return ForwardMsg;
})();

export const Initialize = $root.Initialize = (() => {

    /**
     * Properties of an Initialize.
     * @exports IInitialize
     * @interface IInitialize
     * @property {boolean|null} [sharingEnabled] Initialize sharingEnabled
     * @property {boolean|null} [gatherUsageStats] Initialize gatherUsageStats
     * @property {string|null} [streamlitVersion] Initialize streamlitVersion
     * @property {ISessionState|null} [sessionState] Initialize sessionState
     * @property {IUserInfo|null} [userInfo] Initialize userInfo
     */

    /**
     * Constructs a new Initialize.
     * @exports Initialize
     * @classdesc Represents an Initialize.
     * @implements IInitialize
     * @constructor
     * @param {IInitialize=} [properties] Properties to set
     */
    function Initialize(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Initialize sharingEnabled.
     * @member {boolean} sharingEnabled
     * @memberof Initialize
     * @instance
     */
    Initialize.prototype.sharingEnabled = false;

    /**
     * Initialize gatherUsageStats.
     * @member {boolean} gatherUsageStats
     * @memberof Initialize
     * @instance
     */
    Initialize.prototype.gatherUsageStats = false;

    /**
     * Initialize streamlitVersion.
     * @member {string} streamlitVersion
     * @memberof Initialize
     * @instance
     */
    Initialize.prototype.streamlitVersion = "";

    /**
     * Initialize sessionState.
     * @member {ISessionState|null|undefined} sessionState
     * @memberof Initialize
     * @instance
     */
    Initialize.prototype.sessionState = null;

    /**
     * Initialize userInfo.
     * @member {IUserInfo|null|undefined} userInfo
     * @memberof Initialize
     * @instance
     */
    Initialize.prototype.userInfo = null;

    /**
     * Creates a new Initialize instance using the specified properties.
     * @function create
     * @memberof Initialize
     * @static
     * @param {IInitialize=} [properties] Properties to set
     * @returns {Initialize} Initialize instance
     */
    Initialize.create = function create(properties) {
        return new Initialize(properties);
    };

    /**
     * Encodes the specified Initialize message. Does not implicitly {@link Initialize.verify|verify} messages.
     * @function encode
     * @memberof Initialize
     * @static
     * @param {IInitialize} message Initialize message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Initialize.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.sharingEnabled != null && message.hasOwnProperty("sharingEnabled"))
            writer.uint32(/* id 1, wireType 0 =*/8).bool(message.sharingEnabled);
        if (message.gatherUsageStats != null && message.hasOwnProperty("gatherUsageStats"))
            writer.uint32(/* id 2, wireType 0 =*/16).bool(message.gatherUsageStats);
        if (message.streamlitVersion != null && message.hasOwnProperty("streamlitVersion"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.streamlitVersion);
        if (message.sessionState != null && message.hasOwnProperty("sessionState"))
            $root.SessionState.encode(message.sessionState, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.userInfo != null && message.hasOwnProperty("userInfo"))
            $root.UserInfo.encode(message.userInfo, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified Initialize message, length delimited. Does not implicitly {@link Initialize.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Initialize
     * @static
     * @param {IInitialize} message Initialize message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Initialize.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Initialize message from the specified reader or buffer.
     * @function decode
     * @memberof Initialize
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Initialize} Initialize
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Initialize.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Initialize();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.sharingEnabled = reader.bool();
                break;
            case 2:
                message.gatherUsageStats = reader.bool();
                break;
            case 3:
                message.streamlitVersion = reader.string();
                break;
            case 5:
                message.sessionState = $root.SessionState.decode(reader, reader.uint32());
                break;
            case 6:
                message.userInfo = $root.UserInfo.decode(reader, reader.uint32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Initialize message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Initialize
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Initialize} Initialize
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Initialize.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Initialize message.
     * @function verify
     * @memberof Initialize
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Initialize.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.sharingEnabled != null && message.hasOwnProperty("sharingEnabled"))
            if (typeof message.sharingEnabled !== "boolean")
                return "sharingEnabled: boolean expected";
        if (message.gatherUsageStats != null && message.hasOwnProperty("gatherUsageStats"))
            if (typeof message.gatherUsageStats !== "boolean")
                return "gatherUsageStats: boolean expected";
        if (message.streamlitVersion != null && message.hasOwnProperty("streamlitVersion"))
            if (!$util.isString(message.streamlitVersion))
                return "streamlitVersion: string expected";
        if (message.sessionState != null && message.hasOwnProperty("sessionState")) {
            let error = $root.SessionState.verify(message.sessionState);
            if (error)
                return "sessionState." + error;
        }
        if (message.userInfo != null && message.hasOwnProperty("userInfo")) {
            let error = $root.UserInfo.verify(message.userInfo);
            if (error)
                return "userInfo." + error;
        }
        return null;
    };

    /**
     * Creates an Initialize message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Initialize
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Initialize} Initialize
     */
    Initialize.fromObject = function fromObject(object) {
        if (object instanceof $root.Initialize)
            return object;
        let message = new $root.Initialize();
        if (object.sharingEnabled != null)
            message.sharingEnabled = Boolean(object.sharingEnabled);
        if (object.gatherUsageStats != null)
            message.gatherUsageStats = Boolean(object.gatherUsageStats);
        if (object.streamlitVersion != null)
            message.streamlitVersion = String(object.streamlitVersion);
        if (object.sessionState != null) {
            if (typeof object.sessionState !== "object")
                throw TypeError(".Initialize.sessionState: object expected");
            message.sessionState = $root.SessionState.fromObject(object.sessionState);
        }
        if (object.userInfo != null) {
            if (typeof object.userInfo !== "object")
                throw TypeError(".Initialize.userInfo: object expected");
            message.userInfo = $root.UserInfo.fromObject(object.userInfo);
        }
        return message;
    };

    /**
     * Creates a plain object from an Initialize message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Initialize
     * @static
     * @param {Initialize} message Initialize
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Initialize.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.sharingEnabled = false;
            object.gatherUsageStats = false;
            object.streamlitVersion = "";
            object.sessionState = null;
            object.userInfo = null;
        }
        if (message.sharingEnabled != null && message.hasOwnProperty("sharingEnabled"))
            object.sharingEnabled = message.sharingEnabled;
        if (message.gatherUsageStats != null && message.hasOwnProperty("gatherUsageStats"))
            object.gatherUsageStats = message.gatherUsageStats;
        if (message.streamlitVersion != null && message.hasOwnProperty("streamlitVersion"))
            object.streamlitVersion = message.streamlitVersion;
        if (message.sessionState != null && message.hasOwnProperty("sessionState"))
            object.sessionState = $root.SessionState.toObject(message.sessionState, options);
        if (message.userInfo != null && message.hasOwnProperty("userInfo"))
            object.userInfo = $root.UserInfo.toObject(message.userInfo, options);
        return object;
    };

    /**
     * Converts this Initialize to JSON.
     * @function toJSON
     * @memberof Initialize
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Initialize.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return Initialize;
})();

export const NewReport = $root.NewReport = (() => {

    /**
     * Properties of a NewReport.
     * @exports INewReport
     * @interface INewReport
     * @property {string|null} [id] NewReport id
     * @property {Array.<string>|null} [commandLine] NewReport commandLine
     * @property {string|null} [name] NewReport name
     */

    /**
     * Constructs a new NewReport.
     * @exports NewReport
     * @classdesc Represents a NewReport.
     * @implements INewReport
     * @constructor
     * @param {INewReport=} [properties] Properties to set
     */
    function NewReport(properties) {
        this.commandLine = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * NewReport id.
     * @member {string} id
     * @memberof NewReport
     * @instance
     */
    NewReport.prototype.id = "";

    /**
     * NewReport commandLine.
     * @member {Array.<string>} commandLine
     * @memberof NewReport
     * @instance
     */
    NewReport.prototype.commandLine = $util.emptyArray;

    /**
     * NewReport name.
     * @member {string} name
     * @memberof NewReport
     * @instance
     */
    NewReport.prototype.name = "";

    /**
     * Creates a new NewReport instance using the specified properties.
     * @function create
     * @memberof NewReport
     * @static
     * @param {INewReport=} [properties] Properties to set
     * @returns {NewReport} NewReport instance
     */
    NewReport.create = function create(properties) {
        return new NewReport(properties);
    };

    /**
     * Encodes the specified NewReport message. Does not implicitly {@link NewReport.verify|verify} messages.
     * @function encode
     * @memberof NewReport
     * @static
     * @param {INewReport} message NewReport message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NewReport.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.id != null && message.hasOwnProperty("id"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
        if (message.commandLine != null && message.commandLine.length)
            for (let i = 0; i < message.commandLine.length; ++i)
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.commandLine[i]);
        if (message.name != null && message.hasOwnProperty("name"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.name);
        return writer;
    };

    /**
     * Encodes the specified NewReport message, length delimited. Does not implicitly {@link NewReport.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NewReport
     * @static
     * @param {INewReport} message NewReport message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NewReport.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NewReport message from the specified reader or buffer.
     * @function decode
     * @memberof NewReport
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NewReport} NewReport
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NewReport.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.NewReport();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.id = reader.string();
                break;
            case 2:
                if (!(message.commandLine && message.commandLine.length))
                    message.commandLine = [];
                message.commandLine.push(reader.string());
                break;
            case 3:
                message.name = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a NewReport message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NewReport
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NewReport} NewReport
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NewReport.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NewReport message.
     * @function verify
     * @memberof NewReport
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NewReport.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.id != null && message.hasOwnProperty("id"))
            if (!$util.isString(message.id))
                return "id: string expected";
        if (message.commandLine != null && message.hasOwnProperty("commandLine")) {
            if (!Array.isArray(message.commandLine))
                return "commandLine: array expected";
            for (let i = 0; i < message.commandLine.length; ++i)
                if (!$util.isString(message.commandLine[i]))
                    return "commandLine: string[] expected";
        }
        if (message.name != null && message.hasOwnProperty("name"))
            if (!$util.isString(message.name))
                return "name: string expected";
        return null;
    };

    /**
     * Creates a NewReport message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NewReport
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NewReport} NewReport
     */
    NewReport.fromObject = function fromObject(object) {
        if (object instanceof $root.NewReport)
            return object;
        let message = new $root.NewReport();
        if (object.id != null)
            message.id = String(object.id);
        if (object.commandLine) {
            if (!Array.isArray(object.commandLine))
                throw TypeError(".NewReport.commandLine: array expected");
            message.commandLine = [];
            for (let i = 0; i < object.commandLine.length; ++i)
                message.commandLine[i] = String(object.commandLine[i]);
        }
        if (object.name != null)
            message.name = String(object.name);
        return message;
    };

    /**
     * Creates a plain object from a NewReport message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NewReport
     * @static
     * @param {NewReport} message NewReport
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NewReport.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.commandLine = [];
        if (options.defaults) {
            object.id = "";
            object.name = "";
        }
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        if (message.commandLine && message.commandLine.length) {
            object.commandLine = [];
            for (let j = 0; j < message.commandLine.length; ++j)
                object.commandLine[j] = message.commandLine[j];
        }
        if (message.name != null && message.hasOwnProperty("name"))
            object.name = message.name;
        return object;
    };

    /**
     * Converts this NewReport to JSON.
     * @function toJSON
     * @memberof NewReport
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NewReport.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return NewReport;
})();

export const SessionState = $root.SessionState = (() => {

    /**
     * Properties of a SessionState.
     * @exports ISessionState
     * @interface ISessionState
     * @property {boolean|null} [runOnSave] SessionState runOnSave
     * @property {boolean|null} [reportIsRunning] SessionState reportIsRunning
     */

    /**
     * Constructs a new SessionState.
     * @exports SessionState
     * @classdesc Represents a SessionState.
     * @implements ISessionState
     * @constructor
     * @param {ISessionState=} [properties] Properties to set
     */
    function SessionState(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SessionState runOnSave.
     * @member {boolean} runOnSave
     * @memberof SessionState
     * @instance
     */
    SessionState.prototype.runOnSave = false;

    /**
     * SessionState reportIsRunning.
     * @member {boolean} reportIsRunning
     * @memberof SessionState
     * @instance
     */
    SessionState.prototype.reportIsRunning = false;

    /**
     * Creates a new SessionState instance using the specified properties.
     * @function create
     * @memberof SessionState
     * @static
     * @param {ISessionState=} [properties] Properties to set
     * @returns {SessionState} SessionState instance
     */
    SessionState.create = function create(properties) {
        return new SessionState(properties);
    };

    /**
     * Encodes the specified SessionState message. Does not implicitly {@link SessionState.verify|verify} messages.
     * @function encode
     * @memberof SessionState
     * @static
     * @param {ISessionState} message SessionState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SessionState.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.runOnSave != null && message.hasOwnProperty("runOnSave"))
            writer.uint32(/* id 1, wireType 0 =*/8).bool(message.runOnSave);
        if (message.reportIsRunning != null && message.hasOwnProperty("reportIsRunning"))
            writer.uint32(/* id 2, wireType 0 =*/16).bool(message.reportIsRunning);
        return writer;
    };

    /**
     * Encodes the specified SessionState message, length delimited. Does not implicitly {@link SessionState.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SessionState
     * @static
     * @param {ISessionState} message SessionState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SessionState.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SessionState message from the specified reader or buffer.
     * @function decode
     * @memberof SessionState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SessionState} SessionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SessionState.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.SessionState();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.runOnSave = reader.bool();
                break;
            case 2:
                message.reportIsRunning = reader.bool();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a SessionState message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SessionState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SessionState} SessionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SessionState.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SessionState message.
     * @function verify
     * @memberof SessionState
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SessionState.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.runOnSave != null && message.hasOwnProperty("runOnSave"))
            if (typeof message.runOnSave !== "boolean")
                return "runOnSave: boolean expected";
        if (message.reportIsRunning != null && message.hasOwnProperty("reportIsRunning"))
            if (typeof message.reportIsRunning !== "boolean")
                return "reportIsRunning: boolean expected";
        return null;
    };

    /**
     * Creates a SessionState message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SessionState
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SessionState} SessionState
     */
    SessionState.fromObject = function fromObject(object) {
        if (object instanceof $root.SessionState)
            return object;
        let message = new $root.SessionState();
        if (object.runOnSave != null)
            message.runOnSave = Boolean(object.runOnSave);
        if (object.reportIsRunning != null)
            message.reportIsRunning = Boolean(object.reportIsRunning);
        return message;
    };

    /**
     * Creates a plain object from a SessionState message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SessionState
     * @static
     * @param {SessionState} message SessionState
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SessionState.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.runOnSave = false;
            object.reportIsRunning = false;
        }
        if (message.runOnSave != null && message.hasOwnProperty("runOnSave"))
            object.runOnSave = message.runOnSave;
        if (message.reportIsRunning != null && message.hasOwnProperty("reportIsRunning"))
            object.reportIsRunning = message.reportIsRunning;
        return object;
    };

    /**
     * Converts this SessionState to JSON.
     * @function toJSON
     * @memberof SessionState
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SessionState.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return SessionState;
})();

export const SessionEvent = $root.SessionEvent = (() => {

    /**
     * Properties of a SessionEvent.
     * @exports ISessionEvent
     * @interface ISessionEvent
     * @property {boolean|null} [reportChangedOnDisk] SessionEvent reportChangedOnDisk
     * @property {boolean|null} [reportWasManuallyStopped] SessionEvent reportWasManuallyStopped
     */

    /**
     * Constructs a new SessionEvent.
     * @exports SessionEvent
     * @classdesc Represents a SessionEvent.
     * @implements ISessionEvent
     * @constructor
     * @param {ISessionEvent=} [properties] Properties to set
     */
    function SessionEvent(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * SessionEvent reportChangedOnDisk.
     * @member {boolean} reportChangedOnDisk
     * @memberof SessionEvent
     * @instance
     */
    SessionEvent.prototype.reportChangedOnDisk = false;

    /**
     * SessionEvent reportWasManuallyStopped.
     * @member {boolean} reportWasManuallyStopped
     * @memberof SessionEvent
     * @instance
     */
    SessionEvent.prototype.reportWasManuallyStopped = false;

    // OneOf field names bound to virtual getters and setters
    let $oneOfFields;

    /**
     * SessionEvent type.
     * @member {"reportChangedOnDisk"|"reportWasManuallyStopped"|undefined} type
     * @memberof SessionEvent
     * @instance
     */
    Object.defineProperty(SessionEvent.prototype, "type", {
        get: $util.oneOfGetter($oneOfFields = ["reportChangedOnDisk", "reportWasManuallyStopped"]),
        set: $util.oneOfSetter($oneOfFields)
    });

    /**
     * Creates a new SessionEvent instance using the specified properties.
     * @function create
     * @memberof SessionEvent
     * @static
     * @param {ISessionEvent=} [properties] Properties to set
     * @returns {SessionEvent} SessionEvent instance
     */
    SessionEvent.create = function create(properties) {
        return new SessionEvent(properties);
    };

    /**
     * Encodes the specified SessionEvent message. Does not implicitly {@link SessionEvent.verify|verify} messages.
     * @function encode
     * @memberof SessionEvent
     * @static
     * @param {ISessionEvent} message SessionEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SessionEvent.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.reportChangedOnDisk != null && message.hasOwnProperty("reportChangedOnDisk"))
            writer.uint32(/* id 1, wireType 0 =*/8).bool(message.reportChangedOnDisk);
        if (message.reportWasManuallyStopped != null && message.hasOwnProperty("reportWasManuallyStopped"))
            writer.uint32(/* id 2, wireType 0 =*/16).bool(message.reportWasManuallyStopped);
        return writer;
    };

    /**
     * Encodes the specified SessionEvent message, length delimited. Does not implicitly {@link SessionEvent.verify|verify} messages.
     * @function encodeDelimited
     * @memberof SessionEvent
     * @static
     * @param {ISessionEvent} message SessionEvent message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SessionEvent.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SessionEvent message from the specified reader or buffer.
     * @function decode
     * @memberof SessionEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {SessionEvent} SessionEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SessionEvent.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.SessionEvent();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.reportChangedOnDisk = reader.bool();
                break;
            case 2:
                message.reportWasManuallyStopped = reader.bool();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a SessionEvent message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof SessionEvent
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {SessionEvent} SessionEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SessionEvent.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SessionEvent message.
     * @function verify
     * @memberof SessionEvent
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SessionEvent.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        let properties = {};
        if (message.reportChangedOnDisk != null && message.hasOwnProperty("reportChangedOnDisk")) {
            properties.type = 1;
            if (typeof message.reportChangedOnDisk !== "boolean")
                return "reportChangedOnDisk: boolean expected";
        }
        if (message.reportWasManuallyStopped != null && message.hasOwnProperty("reportWasManuallyStopped")) {
            if (properties.type === 1)
                return "type: multiple values";
            properties.type = 1;
            if (typeof message.reportWasManuallyStopped !== "boolean")
                return "reportWasManuallyStopped: boolean expected";
        }
        return null;
    };

    /**
     * Creates a SessionEvent message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof SessionEvent
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {SessionEvent} SessionEvent
     */
    SessionEvent.fromObject = function fromObject(object) {
        if (object instanceof $root.SessionEvent)
            return object;
        let message = new $root.SessionEvent();
        if (object.reportChangedOnDisk != null)
            message.reportChangedOnDisk = Boolean(object.reportChangedOnDisk);
        if (object.reportWasManuallyStopped != null)
            message.reportWasManuallyStopped = Boolean(object.reportWasManuallyStopped);
        return message;
    };

    /**
     * Creates a plain object from a SessionEvent message. Also converts values to other types if specified.
     * @function toObject
     * @memberof SessionEvent
     * @static
     * @param {SessionEvent} message SessionEvent
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SessionEvent.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (message.reportChangedOnDisk != null && message.hasOwnProperty("reportChangedOnDisk")) {
            object.reportChangedOnDisk = message.reportChangedOnDisk;
            if (options.oneofs)
                object.type = "reportChangedOnDisk";
        }
        if (message.reportWasManuallyStopped != null && message.hasOwnProperty("reportWasManuallyStopped")) {
            object.reportWasManuallyStopped = message.reportWasManuallyStopped;
            if (options.oneofs)
                object.type = "reportWasManuallyStopped";
        }
        return object;
    };

    /**
     * Converts this SessionEvent to JSON.
     * @function toJSON
     * @memberof SessionEvent
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SessionEvent.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return SessionEvent;
})();

export const UserInfo = $root.UserInfo = (() => {

    /**
     * Properties of a UserInfo.
     * @exports IUserInfo
     * @interface IUserInfo
     * @property {string|null} [installationId] UserInfo installationId
     */

    /**
     * Constructs a new UserInfo.
     * @exports UserInfo
     * @classdesc Represents a UserInfo.
     * @implements IUserInfo
     * @constructor
     * @param {IUserInfo=} [properties] Properties to set
     */
    function UserInfo(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * UserInfo installationId.
     * @member {string} installationId
     * @memberof UserInfo
     * @instance
     */
    UserInfo.prototype.installationId = "";

    /**
     * Creates a new UserInfo instance using the specified properties.
     * @function create
     * @memberof UserInfo
     * @static
     * @param {IUserInfo=} [properties] Properties to set
     * @returns {UserInfo} UserInfo instance
     */
    UserInfo.create = function create(properties) {
        return new UserInfo(properties);
    };

    /**
     * Encodes the specified UserInfo message. Does not implicitly {@link UserInfo.verify|verify} messages.
     * @function encode
     * @memberof UserInfo
     * @static
     * @param {IUserInfo} message UserInfo message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserInfo.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.installationId != null && message.hasOwnProperty("installationId"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.installationId);
        return writer;
    };

    /**
     * Encodes the specified UserInfo message, length delimited. Does not implicitly {@link UserInfo.verify|verify} messages.
     * @function encodeDelimited
     * @memberof UserInfo
     * @static
     * @param {IUserInfo} message UserInfo message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserInfo.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UserInfo message from the specified reader or buffer.
     * @function decode
     * @memberof UserInfo
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {UserInfo} UserInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserInfo.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.UserInfo();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.installationId = reader.string();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a UserInfo message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof UserInfo
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {UserInfo} UserInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserInfo.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UserInfo message.
     * @function verify
     * @memberof UserInfo
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UserInfo.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.installationId != null && message.hasOwnProperty("installationId"))
            if (!$util.isString(message.installationId))
                return "installationId: string expected";
        return null;
    };

    /**
     * Creates a UserInfo message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof UserInfo
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {UserInfo} UserInfo
     */
    UserInfo.fromObject = function fromObject(object) {
        if (object instanceof $root.UserInfo)
            return object;
        let message = new $root.UserInfo();
        if (object.installationId != null)
            message.installationId = String(object.installationId);
        return message;
    };

    /**
     * Creates a plain object from a UserInfo message. Also converts values to other types if specified.
     * @function toObject
     * @memberof UserInfo
     * @static
     * @param {UserInfo} message UserInfo
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UserInfo.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults)
            object.installationId = "";
        if (message.installationId != null && message.hasOwnProperty("installationId"))
            object.installationId = message.installationId;
        return object;
    };

    /**
     * Converts this UserInfo to JSON.
     * @function toJSON
     * @memberof UserInfo
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UserInfo.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return UserInfo;
})();

export { $root as default };
