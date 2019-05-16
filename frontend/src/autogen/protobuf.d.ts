/* eslint-disable */

import * as $protobuf from "protobufjs";
/** Properties of an Audio. */
export interface IAudio {

    /** Audio data */
    data?: (string|null);

    /** Audio format */
    format?: (string|null);
}

/** Represents an Audio. */
export class Audio implements IAudio {

    /**
     * Constructs a new Audio.
     * @param [properties] Properties to set
     */
    constructor(properties?: IAudio);

    /** Audio data. */
    public data: string;

    /** Audio format. */
    public format: string;

    /**
     * Creates a new Audio instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Audio instance
     */
    public static create(properties?: IAudio): Audio;

    /**
     * Encodes the specified Audio message. Does not implicitly {@link Audio.verify|verify} messages.
     * @param message Audio message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IAudio, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Audio message, length delimited. Does not implicitly {@link Audio.verify|verify} messages.
     * @param message Audio message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IAudio, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Audio message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Audio
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Audio;

    /**
     * Decodes an Audio message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Audio
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Audio;

    /**
     * Verifies an Audio message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Audio message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Audio
     */
    public static fromObject(object: { [k: string]: any }): Audio;

    /**
     * Creates a plain object from an Audio message. Also converts values to other types if specified.
     * @param message Audio
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Audio, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Audio to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a BackMsg. */
export interface IBackMsg {

    /** BackMsg cloudUpload */
    cloudUpload?: (boolean|null);

    /** BackMsg rerunScript */
    rerunScript?: (string|null);

    /** BackMsg clearCache */
    clearCache?: (boolean|null);

    /** BackMsg setRunOnSave */
    setRunOnSave?: (boolean|null);

    /** BackMsg stopReport */
    stopReport?: (boolean|null);
}

/** Represents a BackMsg. */
export class BackMsg implements IBackMsg {

    /**
     * Constructs a new BackMsg.
     * @param [properties] Properties to set
     */
    constructor(properties?: IBackMsg);

    /** BackMsg cloudUpload. */
    public cloudUpload: boolean;

    /** BackMsg rerunScript. */
    public rerunScript: string;

    /** BackMsg clearCache. */
    public clearCache: boolean;

    /** BackMsg setRunOnSave. */
    public setRunOnSave: boolean;

    /** BackMsg stopReport. */
    public stopReport: boolean;

    /** BackMsg type. */
    public type?: ("cloudUpload"|"rerunScript"|"clearCache"|"setRunOnSave"|"stopReport");

    /**
     * Creates a new BackMsg instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BackMsg instance
     */
    public static create(properties?: IBackMsg): BackMsg;

    /**
     * Encodes the specified BackMsg message. Does not implicitly {@link BackMsg.verify|verify} messages.
     * @param message BackMsg message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IBackMsg, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified BackMsg message, length delimited. Does not implicitly {@link BackMsg.verify|verify} messages.
     * @param message BackMsg message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IBackMsg, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a BackMsg message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BackMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): BackMsg;

    /**
     * Decodes a BackMsg message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BackMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): BackMsg;

    /**
     * Verifies a BackMsg message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a BackMsg message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BackMsg
     */
    public static fromObject(object: { [k: string]: any }): BackMsg;

    /**
     * Creates a plain object from a BackMsg message. Also converts values to other types if specified.
     * @param message BackMsg
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: BackMsg, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this BackMsg to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a Balloons. */
export interface IBalloons {

    /** Balloons type */
    type?: (Balloons.Type|null);

    /** Balloons executionId */
    executionId?: (number|null);
}

/** Represents a Balloons. */
export class Balloons implements IBalloons {

    /**
     * Constructs a new Balloons.
     * @param [properties] Properties to set
     */
    constructor(properties?: IBalloons);

    /** Balloons type. */
    public type: Balloons.Type;

    /** Balloons executionId. */
    public executionId: number;

    /**
     * Creates a new Balloons instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Balloons instance
     */
    public static create(properties?: IBalloons): Balloons;

    /**
     * Encodes the specified Balloons message. Does not implicitly {@link Balloons.verify|verify} messages.
     * @param message Balloons message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IBalloons, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Balloons message, length delimited. Does not implicitly {@link Balloons.verify|verify} messages.
     * @param message Balloons message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IBalloons, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Balloons message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Balloons
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Balloons;

    /**
     * Decodes a Balloons message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Balloons
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Balloons;

    /**
     * Verifies a Balloons message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Balloons message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Balloons
     */
    public static fromObject(object: { [k: string]: any }): Balloons;

    /**
     * Creates a plain object from a Balloons message. Also converts values to other types if specified.
     * @param message Balloons
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Balloons, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Balloons to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

export namespace Balloons {

    /** Type enum. */
    enum Type {
        DEFAULT = 0,
        BALLOON = 1,
        HAPPY_FACE = 2,
        STAR_FACE = 3,
        COOL_FACE = 4
    }
}

/** Properties of a BokehChart. */
export interface IBokehChart {

    /** BokehChart figure */
    figure?: (string|null);
}

/** Represents a BokehChart. */
export class BokehChart implements IBokehChart {

    /**
     * Constructs a new BokehChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IBokehChart);

    /** BokehChart figure. */
    public figure: string;

    /**
     * Creates a new BokehChart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns BokehChart instance
     */
    public static create(properties?: IBokehChart): BokehChart;

    /**
     * Encodes the specified BokehChart message. Does not implicitly {@link BokehChart.verify|verify} messages.
     * @param message BokehChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IBokehChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified BokehChart message, length delimited. Does not implicitly {@link BokehChart.verify|verify} messages.
     * @param message BokehChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IBokehChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a BokehChart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns BokehChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): BokehChart;

    /**
     * Decodes a BokehChart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns BokehChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): BokehChart;

    /**
     * Verifies a BokehChart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a BokehChart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns BokehChart
     */
    public static fromObject(object: { [k: string]: any }): BokehChart;

    /**
     * Creates a plain object from a BokehChart message. Also converts values to other types if specified.
     * @param message BokehChart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: BokehChart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this BokehChart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a DataFrame. */
export interface IDataFrame {

    /** DataFrame data */
    data?: (ITable|null);

    /** DataFrame index */
    index?: (IIndex|null);

    /** DataFrame columns */
    columns?: (IIndex|null);

    /** DataFrame style */
    style?: (ITableStyle|null);
}

/** Represents a DataFrame. */
export class DataFrame implements IDataFrame {

    /**
     * Constructs a new DataFrame.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDataFrame);

    /** DataFrame data. */
    public data?: (ITable|null);

    /** DataFrame index. */
    public index?: (IIndex|null);

    /** DataFrame columns. */
    public columns?: (IIndex|null);

    /** DataFrame style. */
    public style?: (ITableStyle|null);

    /**
     * Creates a new DataFrame instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DataFrame instance
     */
    public static create(properties?: IDataFrame): DataFrame;

    /**
     * Encodes the specified DataFrame message. Does not implicitly {@link DataFrame.verify|verify} messages.
     * @param message DataFrame message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDataFrame, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DataFrame message, length delimited. Does not implicitly {@link DataFrame.verify|verify} messages.
     * @param message DataFrame message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDataFrame, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DataFrame message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DataFrame
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DataFrame;

    /**
     * Decodes a DataFrame message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DataFrame
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DataFrame;

    /**
     * Verifies a DataFrame message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DataFrame message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DataFrame
     */
    public static fromObject(object: { [k: string]: any }): DataFrame;

    /**
     * Creates a plain object from a DataFrame message. Also converts values to other types if specified.
     * @param message DataFrame
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DataFrame, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DataFrame to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of an Index. */
export interface IIndex {

    /** Index plainIndex */
    plainIndex?: (IPlainIndex|null);

    /** Index rangeIndex */
    rangeIndex?: (IRangeIndex|null);

    /** Index multiIndex */
    multiIndex?: (IMultiIndex|null);

    /** Index datetimeIndex */
    datetimeIndex?: (IDatetimeIndex|null);

    /** Index timedeltaIndex */
    timedeltaIndex?: (ITimedeltaIndex|null);

    /** Index int_64Index */
    int_64Index?: (IInt64Index|null);

    /** Index float_64Index */
    float_64Index?: (IFloat64Index|null);
}

/** Represents an Index. */
export class Index implements IIndex {

    /**
     * Constructs a new Index.
     * @param [properties] Properties to set
     */
    constructor(properties?: IIndex);

    /** Index plainIndex. */
    public plainIndex?: (IPlainIndex|null);

    /** Index rangeIndex. */
    public rangeIndex?: (IRangeIndex|null);

    /** Index multiIndex. */
    public multiIndex?: (IMultiIndex|null);

    /** Index datetimeIndex. */
    public datetimeIndex?: (IDatetimeIndex|null);

    /** Index timedeltaIndex. */
    public timedeltaIndex?: (ITimedeltaIndex|null);

    /** Index int_64Index. */
    public int_64Index?: (IInt64Index|null);

    /** Index float_64Index. */
    public float_64Index?: (IFloat64Index|null);

    /** Index type. */
    public type?: ("plainIndex"|"rangeIndex"|"multiIndex"|"datetimeIndex"|"timedeltaIndex"|"int_64Index"|"float_64Index");

    /**
     * Creates a new Index instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Index instance
     */
    public static create(properties?: IIndex): Index;

    /**
     * Encodes the specified Index message. Does not implicitly {@link Index.verify|verify} messages.
     * @param message Index message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Index message, length delimited. Does not implicitly {@link Index.verify|verify} messages.
     * @param message Index message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Index message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Index;

    /**
     * Decodes an Index message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Index;

    /**
     * Verifies an Index message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Index message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Index
     */
    public static fromObject(object: { [k: string]: any }): Index;

    /**
     * Creates a plain object from an Index message. Also converts values to other types if specified.
     * @param message Index
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Index, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Index to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a PlainIndex. */
export interface IPlainIndex {

    /** PlainIndex data */
    data?: (IAnyArray|null);
}

/** Represents a PlainIndex. */
export class PlainIndex implements IPlainIndex {

    /**
     * Constructs a new PlainIndex.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPlainIndex);

    /** PlainIndex data. */
    public data?: (IAnyArray|null);

    /**
     * Creates a new PlainIndex instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PlainIndex instance
     */
    public static create(properties?: IPlainIndex): PlainIndex;

    /**
     * Encodes the specified PlainIndex message. Does not implicitly {@link PlainIndex.verify|verify} messages.
     * @param message PlainIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPlainIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PlainIndex message, length delimited. Does not implicitly {@link PlainIndex.verify|verify} messages.
     * @param message PlainIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPlainIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PlainIndex message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PlainIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PlainIndex;

    /**
     * Decodes a PlainIndex message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PlainIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PlainIndex;

    /**
     * Verifies a PlainIndex message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PlainIndex message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PlainIndex
     */
    public static fromObject(object: { [k: string]: any }): PlainIndex;

    /**
     * Creates a plain object from a PlainIndex message. Also converts values to other types if specified.
     * @param message PlainIndex
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PlainIndex, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PlainIndex to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a RangeIndex. */
export interface IRangeIndex {

    /** RangeIndex start */
    start?: (number|Long|null);

    /** RangeIndex stop */
    stop?: (number|Long|null);
}

/** Represents a RangeIndex. */
export class RangeIndex implements IRangeIndex {

    /**
     * Constructs a new RangeIndex.
     * @param [properties] Properties to set
     */
    constructor(properties?: IRangeIndex);

    /** RangeIndex start. */
    public start: (number|Long);

    /** RangeIndex stop. */
    public stop: (number|Long);

    /**
     * Creates a new RangeIndex instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RangeIndex instance
     */
    public static create(properties?: IRangeIndex): RangeIndex;

    /**
     * Encodes the specified RangeIndex message. Does not implicitly {@link RangeIndex.verify|verify} messages.
     * @param message RangeIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IRangeIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified RangeIndex message, length delimited. Does not implicitly {@link RangeIndex.verify|verify} messages.
     * @param message RangeIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IRangeIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a RangeIndex message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RangeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): RangeIndex;

    /**
     * Decodes a RangeIndex message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RangeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): RangeIndex;

    /**
     * Verifies a RangeIndex message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a RangeIndex message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RangeIndex
     */
    public static fromObject(object: { [k: string]: any }): RangeIndex;

    /**
     * Creates a plain object from a RangeIndex message. Also converts values to other types if specified.
     * @param message RangeIndex
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: RangeIndex, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this RangeIndex to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a MultiIndex. */
export interface IMultiIndex {

    /** MultiIndex levels */
    levels?: (IIndex[]|null);

    /** MultiIndex labels */
    labels?: (IInt32Array[]|null);
}

/** Represents a MultiIndex. */
export class MultiIndex implements IMultiIndex {

    /**
     * Constructs a new MultiIndex.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMultiIndex);

    /** MultiIndex levels. */
    public levels: IIndex[];

    /** MultiIndex labels. */
    public labels: IInt32Array[];

    /**
     * Creates a new MultiIndex instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MultiIndex instance
     */
    public static create(properties?: IMultiIndex): MultiIndex;

    /**
     * Encodes the specified MultiIndex message. Does not implicitly {@link MultiIndex.verify|verify} messages.
     * @param message MultiIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMultiIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified MultiIndex message, length delimited. Does not implicitly {@link MultiIndex.verify|verify} messages.
     * @param message MultiIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMultiIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a MultiIndex message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MultiIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MultiIndex;

    /**
     * Decodes a MultiIndex message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MultiIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MultiIndex;

    /**
     * Verifies a MultiIndex message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a MultiIndex message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MultiIndex
     */
    public static fromObject(object: { [k: string]: any }): MultiIndex;

    /**
     * Creates a plain object from a MultiIndex message. Also converts values to other types if specified.
     * @param message MultiIndex
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: MultiIndex, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this MultiIndex to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a DatetimeIndex. */
export interface IDatetimeIndex {

    /** DatetimeIndex data */
    data?: (IInt64Array|null);
}

/** Represents a DatetimeIndex. */
export class DatetimeIndex implements IDatetimeIndex {

    /**
     * Constructs a new DatetimeIndex.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDatetimeIndex);

    /** DatetimeIndex data. */
    public data?: (IInt64Array|null);

    /**
     * Creates a new DatetimeIndex instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DatetimeIndex instance
     */
    public static create(properties?: IDatetimeIndex): DatetimeIndex;

    /**
     * Encodes the specified DatetimeIndex message. Does not implicitly {@link DatetimeIndex.verify|verify} messages.
     * @param message DatetimeIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDatetimeIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DatetimeIndex message, length delimited. Does not implicitly {@link DatetimeIndex.verify|verify} messages.
     * @param message DatetimeIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDatetimeIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DatetimeIndex message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DatetimeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DatetimeIndex;

    /**
     * Decodes a DatetimeIndex message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DatetimeIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DatetimeIndex;

    /**
     * Verifies a DatetimeIndex message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DatetimeIndex message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DatetimeIndex
     */
    public static fromObject(object: { [k: string]: any }): DatetimeIndex;

    /**
     * Creates a plain object from a DatetimeIndex message. Also converts values to other types if specified.
     * @param message DatetimeIndex
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DatetimeIndex, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DatetimeIndex to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a TimedeltaIndex. */
export interface ITimedeltaIndex {

    /** TimedeltaIndex data */
    data?: (IInt64Array|null);
}

/** Represents a TimedeltaIndex. */
export class TimedeltaIndex implements ITimedeltaIndex {

    /**
     * Constructs a new TimedeltaIndex.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITimedeltaIndex);

    /** TimedeltaIndex data. */
    public data?: (IInt64Array|null);

    /**
     * Creates a new TimedeltaIndex instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TimedeltaIndex instance
     */
    public static create(properties?: ITimedeltaIndex): TimedeltaIndex;

    /**
     * Encodes the specified TimedeltaIndex message. Does not implicitly {@link TimedeltaIndex.verify|verify} messages.
     * @param message TimedeltaIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITimedeltaIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TimedeltaIndex message, length delimited. Does not implicitly {@link TimedeltaIndex.verify|verify} messages.
     * @param message TimedeltaIndex message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITimedeltaIndex, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a TimedeltaIndex message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TimedeltaIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): TimedeltaIndex;

    /**
     * Decodes a TimedeltaIndex message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TimedeltaIndex
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): TimedeltaIndex;

    /**
     * Verifies a TimedeltaIndex message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a TimedeltaIndex message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TimedeltaIndex
     */
    public static fromObject(object: { [k: string]: any }): TimedeltaIndex;

    /**
     * Creates a plain object from a TimedeltaIndex message. Also converts values to other types if specified.
     * @param message TimedeltaIndex
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: TimedeltaIndex, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this TimedeltaIndex to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of an Int64Index. */
export interface IInt64Index {

    /** Int64Index data */
    data?: (IInt64Array|null);
}

/** Represents an Int64Index. */
export class Int64Index implements IInt64Index {

    /**
     * Constructs a new Int64Index.
     * @param [properties] Properties to set
     */
    constructor(properties?: IInt64Index);

    /** Int64Index data. */
    public data?: (IInt64Array|null);

    /**
     * Creates a new Int64Index instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Int64Index instance
     */
    public static create(properties?: IInt64Index): Int64Index;

    /**
     * Encodes the specified Int64Index message. Does not implicitly {@link Int64Index.verify|verify} messages.
     * @param message Int64Index message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IInt64Index, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Int64Index message, length delimited. Does not implicitly {@link Int64Index.verify|verify} messages.
     * @param message Int64Index message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IInt64Index, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Int64Index message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Int64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Int64Index;

    /**
     * Decodes an Int64Index message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Int64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Int64Index;

    /**
     * Verifies an Int64Index message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Int64Index message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Int64Index
     */
    public static fromObject(object: { [k: string]: any }): Int64Index;

    /**
     * Creates a plain object from an Int64Index message. Also converts values to other types if specified.
     * @param message Int64Index
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Int64Index, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Int64Index to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a Float64Index. */
export interface IFloat64Index {

    /** Float64Index data */
    data?: (IDoubleArray|null);
}

/** Represents a Float64Index. */
export class Float64Index implements IFloat64Index {

    /**
     * Constructs a new Float64Index.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFloat64Index);

    /** Float64Index data. */
    public data?: (IDoubleArray|null);

    /**
     * Creates a new Float64Index instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Float64Index instance
     */
    public static create(properties?: IFloat64Index): Float64Index;

    /**
     * Encodes the specified Float64Index message. Does not implicitly {@link Float64Index.verify|verify} messages.
     * @param message Float64Index message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFloat64Index, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Float64Index message, length delimited. Does not implicitly {@link Float64Index.verify|verify} messages.
     * @param message Float64Index message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFloat64Index, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Float64Index message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Float64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Float64Index;

    /**
     * Decodes a Float64Index message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Float64Index
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Float64Index;

    /**
     * Verifies a Float64Index message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Float64Index message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Float64Index
     */
    public static fromObject(object: { [k: string]: any }): Float64Index;

    /**
     * Creates a plain object from a Float64Index message. Also converts values to other types if specified.
     * @param message Float64Index
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Float64Index, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Float64Index to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a StringArray. */
export interface IStringArray {

    /** StringArray data */
    data?: (string[]|null);
}

/** Represents a StringArray. */
export class StringArray implements IStringArray {

    /**
     * Constructs a new StringArray.
     * @param [properties] Properties to set
     */
    constructor(properties?: IStringArray);

    /** StringArray data. */
    public data: string[];

    /**
     * Creates a new StringArray instance using the specified properties.
     * @param [properties] Properties to set
     * @returns StringArray instance
     */
    public static create(properties?: IStringArray): StringArray;

    /**
     * Encodes the specified StringArray message. Does not implicitly {@link StringArray.verify|verify} messages.
     * @param message StringArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IStringArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified StringArray message, length delimited. Does not implicitly {@link StringArray.verify|verify} messages.
     * @param message StringArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IStringArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a StringArray message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns StringArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): StringArray;

    /**
     * Decodes a StringArray message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns StringArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): StringArray;

    /**
     * Verifies a StringArray message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a StringArray message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns StringArray
     */
    public static fromObject(object: { [k: string]: any }): StringArray;

    /**
     * Creates a plain object from a StringArray message. Also converts values to other types if specified.
     * @param message StringArray
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: StringArray, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this StringArray to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a DoubleArray. */
export interface IDoubleArray {

    /** DoubleArray data */
    data?: (number[]|null);
}

/** Represents a DoubleArray. */
export class DoubleArray implements IDoubleArray {

    /**
     * Constructs a new DoubleArray.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDoubleArray);

    /** DoubleArray data. */
    public data: number[];

    /**
     * Creates a new DoubleArray instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DoubleArray instance
     */
    public static create(properties?: IDoubleArray): DoubleArray;

    /**
     * Encodes the specified DoubleArray message. Does not implicitly {@link DoubleArray.verify|verify} messages.
     * @param message DoubleArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDoubleArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DoubleArray message, length delimited. Does not implicitly {@link DoubleArray.verify|verify} messages.
     * @param message DoubleArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDoubleArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DoubleArray message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DoubleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DoubleArray;

    /**
     * Decodes a DoubleArray message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DoubleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DoubleArray;

    /**
     * Verifies a DoubleArray message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DoubleArray message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DoubleArray
     */
    public static fromObject(object: { [k: string]: any }): DoubleArray;

    /**
     * Creates a plain object from a DoubleArray message. Also converts values to other types if specified.
     * @param message DoubleArray
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DoubleArray, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DoubleArray to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of an Int32Array. */
export interface IInt32Array {

    /** Int32Array data */
    data?: (number[]|null);
}

/** Represents an Int32Array. */
export class Int32Array implements IInt32Array {

    /**
     * Constructs a new Int32Array.
     * @param [properties] Properties to set
     */
    constructor(properties?: IInt32Array);

    /** Int32Array data. */
    public data: number[];

    /**
     * Creates a new Int32Array instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Int32Array instance
     */
    public static create(properties?: IInt32Array): Int32Array;

    /**
     * Encodes the specified Int32Array message. Does not implicitly {@link Int32Array.verify|verify} messages.
     * @param message Int32Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IInt32Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Int32Array message, length delimited. Does not implicitly {@link Int32Array.verify|verify} messages.
     * @param message Int32Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IInt32Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Int32Array message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Int32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Int32Array;

    /**
     * Decodes an Int32Array message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Int32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Int32Array;

    /**
     * Verifies an Int32Array message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Int32Array message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Int32Array
     */
    public static fromObject(object: { [k: string]: any }): Int32Array;

    /**
     * Creates a plain object from an Int32Array message. Also converts values to other types if specified.
     * @param message Int32Array
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Int32Array, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Int32Array to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of an Int64Array. */
export interface IInt64Array {

    /** Int64Array data */
    data?: ((number|Long)[]|null);
}

/** Represents an Int64Array. */
export class Int64Array implements IInt64Array {

    /**
     * Constructs a new Int64Array.
     * @param [properties] Properties to set
     */
    constructor(properties?: IInt64Array);

    /** Int64Array data. */
    public data: (number|Long)[];

    /**
     * Creates a new Int64Array instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Int64Array instance
     */
    public static create(properties?: IInt64Array): Int64Array;

    /**
     * Encodes the specified Int64Array message. Does not implicitly {@link Int64Array.verify|verify} messages.
     * @param message Int64Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IInt64Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Int64Array message, length delimited. Does not implicitly {@link Int64Array.verify|verify} messages.
     * @param message Int64Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IInt64Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Int64Array message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Int64Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Int64Array;

    /**
     * Decodes an Int64Array message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Int64Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Int64Array;

    /**
     * Verifies an Int64Array message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Int64Array message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Int64Array
     */
    public static fromObject(object: { [k: string]: any }): Int64Array;

    /**
     * Creates a plain object from an Int64Array message. Also converts values to other types if specified.
     * @param message Int64Array
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Int64Array, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Int64Array to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a UInt32Array. */
export interface IUInt32Array {

    /** UInt32Array data */
    data?: (number[]|null);
}

/** Represents a UInt32Array. */
export class UInt32Array implements IUInt32Array {

    /**
     * Constructs a new UInt32Array.
     * @param [properties] Properties to set
     */
    constructor(properties?: IUInt32Array);

    /** UInt32Array data. */
    public data: number[];

    /**
     * Creates a new UInt32Array instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UInt32Array instance
     */
    public static create(properties?: IUInt32Array): UInt32Array;

    /**
     * Encodes the specified UInt32Array message. Does not implicitly {@link UInt32Array.verify|verify} messages.
     * @param message UInt32Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IUInt32Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified UInt32Array message, length delimited. Does not implicitly {@link UInt32Array.verify|verify} messages.
     * @param message UInt32Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IUInt32Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a UInt32Array message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UInt32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): UInt32Array;

    /**
     * Decodes a UInt32Array message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UInt32Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): UInt32Array;

    /**
     * Verifies a UInt32Array message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a UInt32Array message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UInt32Array
     */
    public static fromObject(object: { [k: string]: any }): UInt32Array;

    /**
     * Creates a plain object from a UInt32Array message. Also converts values to other types if specified.
     * @param message UInt32Array
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: UInt32Array, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this UInt32Array to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a CSSStyle. */
export interface ICSSStyle {

    /** CSSStyle property */
    property?: (string|null);

    /** CSSStyle value */
    value?: (string|null);
}

/** Represents a CSSStyle. */
export class CSSStyle implements ICSSStyle {

    /**
     * Constructs a new CSSStyle.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICSSStyle);

    /** CSSStyle property. */
    public property: string;

    /** CSSStyle value. */
    public value: string;

    /**
     * Creates a new CSSStyle instance using the specified properties.
     * @param [properties] Properties to set
     * @returns CSSStyle instance
     */
    public static create(properties?: ICSSStyle): CSSStyle;

    /**
     * Encodes the specified CSSStyle message. Does not implicitly {@link CSSStyle.verify|verify} messages.
     * @param message CSSStyle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICSSStyle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified CSSStyle message, length delimited. Does not implicitly {@link CSSStyle.verify|verify} messages.
     * @param message CSSStyle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICSSStyle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a CSSStyle message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns CSSStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): CSSStyle;

    /**
     * Decodes a CSSStyle message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns CSSStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): CSSStyle;

    /**
     * Verifies a CSSStyle message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a CSSStyle message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns CSSStyle
     */
    public static fromObject(object: { [k: string]: any }): CSSStyle;

    /**
     * Creates a plain object from a CSSStyle message. Also converts values to other types if specified.
     * @param message CSSStyle
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: CSSStyle, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this CSSStyle to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a CellStyle. */
export interface ICellStyle {

    /** CellStyle css */
    css?: (ICSSStyle[]|null);

    /** CellStyle displayValue */
    displayValue?: (string|null);

    /** CellStyle hasDisplayValue */
    hasDisplayValue?: (boolean|null);
}

/** Represents a CellStyle. */
export class CellStyle implements ICellStyle {

    /**
     * Constructs a new CellStyle.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICellStyle);

    /** CellStyle css. */
    public css: ICSSStyle[];

    /** CellStyle displayValue. */
    public displayValue: string;

    /** CellStyle hasDisplayValue. */
    public hasDisplayValue: boolean;

    /**
     * Creates a new CellStyle instance using the specified properties.
     * @param [properties] Properties to set
     * @returns CellStyle instance
     */
    public static create(properties?: ICellStyle): CellStyle;

    /**
     * Encodes the specified CellStyle message. Does not implicitly {@link CellStyle.verify|verify} messages.
     * @param message CellStyle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICellStyle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified CellStyle message, length delimited. Does not implicitly {@link CellStyle.verify|verify} messages.
     * @param message CellStyle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICellStyle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a CellStyle message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns CellStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): CellStyle;

    /**
     * Decodes a CellStyle message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns CellStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): CellStyle;

    /**
     * Verifies a CellStyle message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a CellStyle message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns CellStyle
     */
    public static fromObject(object: { [k: string]: any }): CellStyle;

    /**
     * Creates a plain object from a CellStyle message. Also converts values to other types if specified.
     * @param message CellStyle
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: CellStyle, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this CellStyle to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a CellStyleArray. */
export interface ICellStyleArray {

    /** CellStyleArray styles */
    styles?: (ICellStyle[]|null);
}

/** Represents a CellStyleArray. */
export class CellStyleArray implements ICellStyleArray {

    /**
     * Constructs a new CellStyleArray.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICellStyleArray);

    /** CellStyleArray styles. */
    public styles: ICellStyle[];

    /**
     * Creates a new CellStyleArray instance using the specified properties.
     * @param [properties] Properties to set
     * @returns CellStyleArray instance
     */
    public static create(properties?: ICellStyleArray): CellStyleArray;

    /**
     * Encodes the specified CellStyleArray message. Does not implicitly {@link CellStyleArray.verify|verify} messages.
     * @param message CellStyleArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICellStyleArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified CellStyleArray message, length delimited. Does not implicitly {@link CellStyleArray.verify|verify} messages.
     * @param message CellStyleArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICellStyleArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a CellStyleArray message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns CellStyleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): CellStyleArray;

    /**
     * Decodes a CellStyleArray message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns CellStyleArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): CellStyleArray;

    /**
     * Verifies a CellStyleArray message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a CellStyleArray message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns CellStyleArray
     */
    public static fromObject(object: { [k: string]: any }): CellStyleArray;

    /**
     * Creates a plain object from a CellStyleArray message. Also converts values to other types if specified.
     * @param message CellStyleArray
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: CellStyleArray, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this CellStyleArray to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of an AnyArray. */
export interface IAnyArray {

    /** AnyArray strings */
    strings?: (IStringArray|null);

    /** AnyArray doubles */
    doubles?: (IDoubleArray|null);

    /** AnyArray int64s */
    int64s?: (IInt64Array|null);

    /** AnyArray datetimes */
    datetimes?: (IInt64Array|null);

    /** AnyArray timedeltas */
    timedeltas?: (IInt64Array|null);
}

/** Represents an AnyArray. */
export class AnyArray implements IAnyArray {

    /**
     * Constructs a new AnyArray.
     * @param [properties] Properties to set
     */
    constructor(properties?: IAnyArray);

    /** AnyArray strings. */
    public strings?: (IStringArray|null);

    /** AnyArray doubles. */
    public doubles?: (IDoubleArray|null);

    /** AnyArray int64s. */
    public int64s?: (IInt64Array|null);

    /** AnyArray datetimes. */
    public datetimes?: (IInt64Array|null);

    /** AnyArray timedeltas. */
    public timedeltas?: (IInt64Array|null);

    /** AnyArray type. */
    public type?: ("strings"|"doubles"|"int64s"|"datetimes"|"timedeltas");

    /**
     * Creates a new AnyArray instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AnyArray instance
     */
    public static create(properties?: IAnyArray): AnyArray;

    /**
     * Encodes the specified AnyArray message. Does not implicitly {@link AnyArray.verify|verify} messages.
     * @param message AnyArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IAnyArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified AnyArray message, length delimited. Does not implicitly {@link AnyArray.verify|verify} messages.
     * @param message AnyArray message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IAnyArray, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an AnyArray message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AnyArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): AnyArray;

    /**
     * Decodes an AnyArray message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AnyArray
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): AnyArray;

    /**
     * Verifies an AnyArray message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an AnyArray message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AnyArray
     */
    public static fromObject(object: { [k: string]: any }): AnyArray;

    /**
     * Creates a plain object from an AnyArray message. Also converts values to other types if specified.
     * @param message AnyArray
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: AnyArray, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this AnyArray to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a Table. */
export interface ITable {

    /** Table cols */
    cols?: (IAnyArray[]|null);
}

/** Represents a Table. */
export class Table implements ITable {

    /**
     * Constructs a new Table.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITable);

    /** Table cols. */
    public cols: IAnyArray[];

    /**
     * Creates a new Table instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Table instance
     */
    public static create(properties?: ITable): Table;

    /**
     * Encodes the specified Table message. Does not implicitly {@link Table.verify|verify} messages.
     * @param message Table message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITable, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Table message, length delimited. Does not implicitly {@link Table.verify|verify} messages.
     * @param message Table message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITable, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Table message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Table
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Table;

    /**
     * Decodes a Table message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Table
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Table;

    /**
     * Verifies a Table message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Table message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Table
     */
    public static fromObject(object: { [k: string]: any }): Table;

    /**
     * Creates a plain object from a Table message. Also converts values to other types if specified.
     * @param message Table
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Table, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Table to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a TableStyle. */
export interface ITableStyle {

    /** TableStyle cols */
    cols?: (ICellStyleArray[]|null);
}

/** Represents a TableStyle. */
export class TableStyle implements ITableStyle {

    /**
     * Constructs a new TableStyle.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITableStyle);

    /** TableStyle cols. */
    public cols: ICellStyleArray[];

    /**
     * Creates a new TableStyle instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TableStyle instance
     */
    public static create(properties?: ITableStyle): TableStyle;

    /**
     * Encodes the specified TableStyle message. Does not implicitly {@link TableStyle.verify|verify} messages.
     * @param message TableStyle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITableStyle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TableStyle message, length delimited. Does not implicitly {@link TableStyle.verify|verify} messages.
     * @param message TableStyle message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITableStyle, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a TableStyle message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TableStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): TableStyle;

    /**
     * Decodes a TableStyle message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TableStyle
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): TableStyle;

    /**
     * Verifies a TableStyle message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a TableStyle message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TableStyle
     */
    public static fromObject(object: { [k: string]: any }): TableStyle;

    /**
     * Creates a plain object from a TableStyle message. Also converts values to other types if specified.
     * @param message TableStyle
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: TableStyle, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this TableStyle to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a Chart. */
export interface IChart {

    /** Chart type */
    type?: (string|null);

    /** Chart data */
    data?: (IDataFrame|null);

    /** Chart width */
    width?: (number|null);

    /** Chart height */
    height?: (number|null);

    /** Chart components */
    components?: (IChartComponent[]|null);

    /** Chart props */
    props?: (IChartProperty[]|null);
}

/** Represents a Chart. */
export class Chart implements IChart {

    /**
     * Constructs a new Chart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IChart);

    /** Chart type. */
    public type: string;

    /** Chart data. */
    public data?: (IDataFrame|null);

    /** Chart width. */
    public width: number;

    /** Chart height. */
    public height: number;

    /** Chart components. */
    public components: IChartComponent[];

    /** Chart props. */
    public props: IChartProperty[];

    /**
     * Creates a new Chart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Chart instance
     */
    public static create(properties?: IChart): Chart;

    /**
     * Encodes the specified Chart message. Does not implicitly {@link Chart.verify|verify} messages.
     * @param message Chart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Chart message, length delimited. Does not implicitly {@link Chart.verify|verify} messages.
     * @param message Chart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Chart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Chart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Chart;

    /**
     * Decodes a Chart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Chart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Chart;

    /**
     * Verifies a Chart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Chart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Chart
     */
    public static fromObject(object: { [k: string]: any }): Chart;

    /**
     * Creates a plain object from a Chart message. Also converts values to other types if specified.
     * @param message Chart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Chart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Chart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a ChartComponent. */
export interface IChartComponent {

    /** ChartComponent type */
    type?: (string|null);

    /** ChartComponent props */
    props?: (IChartProperty[]|null);
}

/** Represents a ChartComponent. */
export class ChartComponent implements IChartComponent {

    /**
     * Constructs a new ChartComponent.
     * @param [properties] Properties to set
     */
    constructor(properties?: IChartComponent);

    /** ChartComponent type. */
    public type: string;

    /** ChartComponent props. */
    public props: IChartProperty[];

    /**
     * Creates a new ChartComponent instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ChartComponent instance
     */
    public static create(properties?: IChartComponent): ChartComponent;

    /**
     * Encodes the specified ChartComponent message. Does not implicitly {@link ChartComponent.verify|verify} messages.
     * @param message ChartComponent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IChartComponent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ChartComponent message, length delimited. Does not implicitly {@link ChartComponent.verify|verify} messages.
     * @param message ChartComponent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IChartComponent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ChartComponent message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ChartComponent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ChartComponent;

    /**
     * Decodes a ChartComponent message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ChartComponent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ChartComponent;

    /**
     * Verifies a ChartComponent message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ChartComponent message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ChartComponent
     */
    public static fromObject(object: { [k: string]: any }): ChartComponent;

    /**
     * Creates a plain object from a ChartComponent message. Also converts values to other types if specified.
     * @param message ChartComponent
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ChartComponent, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ChartComponent to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a ChartProperty. */
export interface IChartProperty {

    /** ChartProperty key */
    key?: (string|null);

    /** ChartProperty value */
    value?: (string|null);
}

/** Represents a ChartProperty. */
export class ChartProperty implements IChartProperty {

    /**
     * Constructs a new ChartProperty.
     * @param [properties] Properties to set
     */
    constructor(properties?: IChartProperty);

    /** ChartProperty key. */
    public key: string;

    /** ChartProperty value. */
    public value: string;

    /**
     * Creates a new ChartProperty instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ChartProperty instance
     */
    public static create(properties?: IChartProperty): ChartProperty;

    /**
     * Encodes the specified ChartProperty message. Does not implicitly {@link ChartProperty.verify|verify} messages.
     * @param message ChartProperty message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IChartProperty, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ChartProperty message, length delimited. Does not implicitly {@link ChartProperty.verify|verify} messages.
     * @param message ChartProperty message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IChartProperty, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ChartProperty message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ChartProperty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ChartProperty;

    /**
     * Decodes a ChartProperty message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ChartProperty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ChartProperty;

    /**
     * Verifies a ChartProperty message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ChartProperty message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ChartProperty
     */
    public static fromObject(object: { [k: string]: any }): ChartProperty;

    /**
     * Creates a plain object from a ChartProperty message. Also converts values to other types if specified.
     * @param message ChartProperty
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ChartProperty, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ChartProperty to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** DataTransform enum. */
namespace DataTransform {

    /** UNKNOWN value */
    let UNKNOWN: number;

    /** NONE value */
    let NONE: number;

    /** STACK value */
    let STACK: number;
}

/** Represents a DeckGlChart. */
export class DeckGlChart implements IDeckGlChart {

    /**
     * Constructs a new DeckGlChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDeckGlChart);

    /** DeckGlChart data. */
    public data?: (IDataFrame|null);

    /** DeckGlChart spec. */
    public spec: string;

    /** DeckGlChart layers. */
    public layers: IDeckGLLayer[];

    /**
     * Creates a new DeckGlChart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeckGlChart instance
     */
    public static create(properties?: IDeckGlChart): DeckGlChart;

    /**
     * Encodes the specified DeckGlChart message. Does not implicitly {@link DeckGlChart.verify|verify} messages.
     * @param message DeckGlChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDeckGlChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DeckGlChart message, length delimited. Does not implicitly {@link DeckGlChart.verify|verify} messages.
     * @param message DeckGlChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDeckGlChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DeckGlChart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeckGlChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DeckGlChart;

    /**
     * Decodes a DeckGlChart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeckGlChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DeckGlChart;

    /**
     * Verifies a DeckGlChart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DeckGlChart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeckGlChart
     */
    public static fromObject(object: { [k: string]: any }): DeckGlChart;

    /**
     * Creates a plain object from a DeckGlChart message. Also converts values to other types if specified.
     * @param message DeckGlChart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DeckGlChart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DeckGlChart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a DeckGLLayer. */
export class DeckGLLayer implements IDeckGLLayer {

    /**
     * Constructs a new DeckGLLayer.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDeckGLLayer);

    /** DeckGLLayer data. */
    public data?: (IDataFrame|null);

    /** DeckGLLayer spec. */
    public spec: string;

    /**
     * Creates a new DeckGLLayer instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeckGLLayer instance
     */
    public static create(properties?: IDeckGLLayer): DeckGLLayer;

    /**
     * Encodes the specified DeckGLLayer message. Does not implicitly {@link DeckGLLayer.verify|verify} messages.
     * @param message DeckGLLayer message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDeckGLLayer, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DeckGLLayer message, length delimited. Does not implicitly {@link DeckGLLayer.verify|verify} messages.
     * @param message DeckGLLayer message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDeckGLLayer, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DeckGLLayer message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeckGLLayer
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DeckGLLayer;

    /**
     * Decodes a DeckGLLayer message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeckGLLayer
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DeckGLLayer;

    /**
     * Verifies a DeckGLLayer message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DeckGLLayer message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeckGLLayer
     */
    public static fromObject(object: { [k: string]: any }): DeckGLLayer;

    /**
     * Creates a plain object from a DeckGLLayer message. Also converts values to other types if specified.
     * @param message DeckGLLayer
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DeckGLLayer, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DeckGLLayer to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a Delta. */
export class Delta implements IDelta {

    /**
     * Constructs a new Delta.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDelta);

    /** Delta id. */
    public id: number;

    /** Delta newElement. */
    public newElement?: (IElement|null);

    /** Delta addRows. */
    public addRows?: (INamedDataSet|null);

    /** Delta type. */
    public type?: ("newElement"|"addRows");

    /**
     * Creates a new Delta instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Delta instance
     */
    public static create(properties?: IDelta): Delta;

    /**
     * Encodes the specified Delta message. Does not implicitly {@link Delta.verify|verify} messages.
     * @param message Delta message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDelta, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Delta message, length delimited. Does not implicitly {@link Delta.verify|verify} messages.
     * @param message Delta message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDelta, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Delta message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Delta
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Delta;

    /**
     * Decodes a Delta message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Delta
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Delta;

    /**
     * Verifies a Delta message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Delta message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Delta
     */
    public static fromObject(object: { [k: string]: any }): Delta;

    /**
     * Creates a plain object from a Delta message. Also converts values to other types if specified.
     * @param message Delta
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Delta, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Delta to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents an Element. */
export class Element implements IElement {

    /**
     * Constructs a new Element.
     * @param [properties] Properties to set
     */
    constructor(properties?: IElement);

    /** Element audio. */
    public audio?: (IAudio|null);

    /** Element balloons. */
    public balloons?: (IBalloons|null);

    /** Element bokehChart. */
    public bokehChart?: (IBokehChart|null);

    /** Element chart. */
    public chart?: (IChart|null);

    /** Element dataFrame. */
    public dataFrame?: (IDataFrame|null);

    /** Element table. */
    public table?: (IDataFrame|null);

    /** Element deckGlChart. */
    public deckGlChart?: (IDeckGlChart|null);

    /** Element docString. */
    public docString?: (IDocString|null);

    /** Element empty. */
    public empty?: (IEmpty|null);

    /** Element exception. */
    public exception?: (IException|null);

    /** Element graphvizChart. */
    public graphvizChart?: (IGraphVizChart|null);

    /** Element imgs. */
    public imgs?: (IImageList|null);

    /** Element map. */
    public map?: (IMap|null);

    /** Element plotlyChart. */
    public plotlyChart?: (IPlotlyChart|null);

    /** Element progress. */
    public progress?: (IProgress|null);

    /** Element text. */
    public text?: (IText|null);

    /** Element vegaLiteChart. */
    public vegaLiteChart?: (IVegaLiteChart|null);

    /** Element video. */
    public video?: (IVideo|null);

    /** Element type. */
    public type?: ("audio"|"balloons"|"bokehChart"|"chart"|"dataFrame"|"table"|"deckGlChart"|"docString"|"empty"|"exception"|"graphvizChart"|"imgs"|"map"|"plotlyChart"|"progress"|"text"|"vegaLiteChart"|"video");

    /**
     * Creates a new Element instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Element instance
     */
    public static create(properties?: IElement): Element;

    /**
     * Encodes the specified Element message. Does not implicitly {@link Element.verify|verify} messages.
     * @param message Element message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IElement, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Element message, length delimited. Does not implicitly {@link Element.verify|verify} messages.
     * @param message Element message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IElement, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Element message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Element
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Element;

    /**
     * Decodes an Element message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Element
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Element;

    /**
     * Verifies an Element message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Element message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Element
     */
    public static fromObject(object: { [k: string]: any }): Element;

    /**
     * Creates a plain object from an Element message. Also converts values to other types if specified.
     * @param message Element
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Element, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Element to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a DocString. */
export class DocString implements IDocString {

    /**
     * Constructs a new DocString.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDocString);

    /** DocString name. */
    public name: string;

    /** DocString module. */
    public module: string;

    /** DocString docString. */
    public docString: string;

    /** DocString type. */
    public type: string;

    /** DocString signature. */
    public signature: string;

    /**
     * Creates a new DocString instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DocString instance
     */
    public static create(properties?: IDocString): DocString;

    /**
     * Encodes the specified DocString message. Does not implicitly {@link DocString.verify|verify} messages.
     * @param message DocString message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDocString, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DocString message, length delimited. Does not implicitly {@link DocString.verify|verify} messages.
     * @param message DocString message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDocString, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DocString message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DocString
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DocString;

    /**
     * Decodes a DocString message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DocString
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DocString;

    /**
     * Verifies a DocString message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DocString message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DocString
     */
    public static fromObject(object: { [k: string]: any }): DocString;

    /**
     * Creates a plain object from a DocString message. Also converts values to other types if specified.
     * @param message DocString
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DocString, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DocString to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents an Empty. */
export class Empty implements IEmpty {

    /**
     * Constructs a new Empty.
     * @param [properties] Properties to set
     */
    constructor(properties?: IEmpty);

    /** Empty unused. */
    public unused: boolean;

    /**
     * Creates a new Empty instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Empty instance
     */
    public static create(properties?: IEmpty): Empty;

    /**
     * Encodes the specified Empty message. Does not implicitly {@link Empty.verify|verify} messages.
     * @param message Empty message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IEmpty, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Empty message, length delimited. Does not implicitly {@link Empty.verify|verify} messages.
     * @param message Empty message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IEmpty, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Empty message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Empty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Empty;

    /**
     * Decodes an Empty message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Empty
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Empty;

    /**
     * Verifies an Empty message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Empty message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Empty
     */
    public static fromObject(object: { [k: string]: any }): Empty;

    /**
     * Creates a plain object from an Empty message. Also converts values to other types if specified.
     * @param message Empty
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Empty, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Empty to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents an Exception. */
export class Exception implements IException {

    /**
     * Constructs a new Exception.
     * @param [properties] Properties to set
     */
    constructor(properties?: IException);

    /** Exception type. */
    public type: string;

    /** Exception message. */
    public message: string;

    /** Exception stackTrace. */
    public stackTrace: string[];

    /**
     * Creates a new Exception instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Exception instance
     */
    public static create(properties?: IException): Exception;

    /**
     * Encodes the specified Exception message. Does not implicitly {@link Exception.verify|verify} messages.
     * @param message Exception message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IException, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Exception message, length delimited. Does not implicitly {@link Exception.verify|verify} messages.
     * @param message Exception message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IException, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Exception message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Exception
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Exception;

    /**
     * Decodes an Exception message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Exception
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Exception;

    /**
     * Verifies an Exception message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Exception message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Exception
     */
    public static fromObject(object: { [k: string]: any }): Exception;

    /**
     * Creates a plain object from an Exception message. Also converts values to other types if specified.
     * @param message Exception
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Exception, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Exception to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a GraphVizChart. */
export class GraphVizChart implements IGraphVizChart {

    /**
     * Constructs a new GraphVizChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IGraphVizChart);

    /** GraphVizChart spec. */
    public spec: string;

    /** GraphVizChart width. */
    public width: number;

    /** GraphVizChart height. */
    public height: number;

    /**
     * Creates a new GraphVizChart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GraphVizChart instance
     */
    public static create(properties?: IGraphVizChart): GraphVizChart;

    /**
     * Encodes the specified GraphVizChart message. Does not implicitly {@link GraphVizChart.verify|verify} messages.
     * @param message GraphVizChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IGraphVizChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified GraphVizChart message, length delimited. Does not implicitly {@link GraphVizChart.verify|verify} messages.
     * @param message GraphVizChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IGraphVizChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a GraphVizChart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GraphVizChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): GraphVizChart;

    /**
     * Decodes a GraphVizChart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GraphVizChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): GraphVizChart;

    /**
     * Verifies a GraphVizChart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a GraphVizChart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GraphVizChart
     */
    public static fromObject(object: { [k: string]: any }): GraphVizChart;

    /**
     * Creates a plain object from a GraphVizChart message. Also converts values to other types if specified.
     * @param message GraphVizChart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: GraphVizChart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this GraphVizChart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents an Image. */
export class Image implements IImage {

    /**
     * Constructs a new Image.
     * @param [properties] Properties to set
     */
    constructor(properties?: IImage);

    /** Image base_64Png. */
    public base_64Png: string;

    /** Image url. */
    public url: string;

    /** Image caption. */
    public caption: string;

    /** Image type. */
    public type?: ("base_64Png"|"url");

    /**
     * Creates a new Image instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Image instance
     */
    public static create(properties?: IImage): Image;

    /**
     * Encodes the specified Image message. Does not implicitly {@link Image.verify|verify} messages.
     * @param message Image message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IImage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Image message, length delimited. Does not implicitly {@link Image.verify|verify} messages.
     * @param message Image message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IImage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Image message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Image
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Image;

    /**
     * Decodes an Image message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Image
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Image;

    /**
     * Verifies an Image message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Image message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Image
     */
    public static fromObject(object: { [k: string]: any }): Image;

    /**
     * Creates a plain object from an Image message. Also converts values to other types if specified.
     * @param message Image
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Image, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Image to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents an ImageList. */
export class ImageList implements IImageList {

    /**
     * Constructs a new ImageList.
     * @param [properties] Properties to set
     */
    constructor(properties?: IImageList);

    /** ImageList imgs. */
    public imgs: IImage[];

    /** ImageList width. */
    public width: number;

    /**
     * Creates a new ImageList instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ImageList instance
     */
    public static create(properties?: IImageList): ImageList;

    /**
     * Encodes the specified ImageList message. Does not implicitly {@link ImageList.verify|verify} messages.
     * @param message ImageList message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IImageList, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ImageList message, length delimited. Does not implicitly {@link ImageList.verify|verify} messages.
     * @param message ImageList message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IImageList, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an ImageList message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ImageList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ImageList;

    /**
     * Decodes an ImageList message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ImageList
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ImageList;

    /**
     * Verifies an ImageList message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an ImageList message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ImageList
     */
    public static fromObject(object: { [k: string]: any }): ImageList;

    /**
     * Creates a plain object from an ImageList message. Also converts values to other types if specified.
     * @param message ImageList
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ImageList, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ImageList to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a Map. */
export class Map implements IMap {

    /**
     * Constructs a new Map.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMap);

    /** Map points. */
    public points?: (IDataFrame|null);

    /**
     * Creates a new Map instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Map instance
     */
    public static create(properties?: IMap): Map;

    /**
     * Encodes the specified Map message. Does not implicitly {@link Map.verify|verify} messages.
     * @param message Map message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMap, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Map message, length delimited. Does not implicitly {@link Map.verify|verify} messages.
     * @param message Map message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMap, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Map message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Map
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Map;

    /**
     * Decodes a Map message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Map
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Map;

    /**
     * Verifies a Map message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Map message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Map
     */
    public static fromObject(object: { [k: string]: any }): Map;

    /**
     * Creates a plain object from a Map message. Also converts values to other types if specified.
     * @param message Map
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Map, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Map to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a PlotlyChart. */
export class PlotlyChart implements IPlotlyChart {

    /**
     * Constructs a new PlotlyChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPlotlyChart);

    /** PlotlyChart url. */
    public url: string;

    /** PlotlyChart figure. */
    public figure?: (IFigure|null);

    /** PlotlyChart width. */
    public width: number;

    /** PlotlyChart height. */
    public height: number;

    /** PlotlyChart chart. */
    public chart?: ("url"|"figure");

    /**
     * Creates a new PlotlyChart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PlotlyChart instance
     */
    public static create(properties?: IPlotlyChart): PlotlyChart;

    /**
     * Encodes the specified PlotlyChart message. Does not implicitly {@link PlotlyChart.verify|verify} messages.
     * @param message PlotlyChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPlotlyChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PlotlyChart message, length delimited. Does not implicitly {@link PlotlyChart.verify|verify} messages.
     * @param message PlotlyChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPlotlyChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PlotlyChart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PlotlyChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PlotlyChart;

    /**
     * Decodes a PlotlyChart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PlotlyChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PlotlyChart;

    /**
     * Verifies a PlotlyChart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PlotlyChart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PlotlyChart
     */
    public static fromObject(object: { [k: string]: any }): PlotlyChart;

    /**
     * Creates a plain object from a PlotlyChart message. Also converts values to other types if specified.
     * @param message PlotlyChart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PlotlyChart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PlotlyChart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a Figure. */
export class Figure implements IFigure {

    /**
     * Constructs a new Figure.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFigure);

    /** Figure spec. */
    public spec: string;

    /** Figure config. */
    public config: string;

    /**
     * Creates a new Figure instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Figure instance
     */
    public static create(properties?: IFigure): Figure;

    /**
     * Encodes the specified Figure message. Does not implicitly {@link Figure.verify|verify} messages.
     * @param message Figure message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFigure, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Figure message, length delimited. Does not implicitly {@link Figure.verify|verify} messages.
     * @param message Figure message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFigure, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Figure message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Figure
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Figure;

    /**
     * Decodes a Figure message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Figure
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Figure;

    /**
     * Verifies a Figure message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Figure message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Figure
     */
    public static fromObject(object: { [k: string]: any }): Figure;

    /**
     * Creates a plain object from a Figure message. Also converts values to other types if specified.
     * @param message Figure
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Figure, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Figure to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a Progress. */
export class Progress implements IProgress {

    /**
     * Constructs a new Progress.
     * @param [properties] Properties to set
     */
    constructor(properties?: IProgress);

    /** Progress value. */
    public value: number;

    /**
     * Creates a new Progress instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Progress instance
     */
    public static create(properties?: IProgress): Progress;

    /**
     * Encodes the specified Progress message. Does not implicitly {@link Progress.verify|verify} messages.
     * @param message Progress message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IProgress, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Progress message, length delimited. Does not implicitly {@link Progress.verify|verify} messages.
     * @param message Progress message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IProgress, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Progress message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Progress
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Progress;

    /**
     * Decodes a Progress message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Progress
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Progress;

    /**
     * Verifies a Progress message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Progress message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Progress
     */
    public static fromObject(object: { [k: string]: any }): Progress;

    /**
     * Creates a plain object from a Progress message. Also converts values to other types if specified.
     * @param message Progress
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Progress, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Progress to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a Text. */
export class Text implements IText {

    /**
     * Constructs a new Text.
     * @param [properties] Properties to set
     */
    constructor(properties?: IText);

    /** Text body. */
    public body: string;

    /** Text format. */
    public format: Text.Format;

    /**
     * Creates a new Text instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Text instance
     */
    public static create(properties?: IText): Text;

    /**
     * Encodes the specified Text message. Does not implicitly {@link Text.verify|verify} messages.
     * @param message Text message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IText, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Text message, length delimited. Does not implicitly {@link Text.verify|verify} messages.
     * @param message Text message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IText, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Text message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Text
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Text;

    /**
     * Decodes a Text message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Text
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Text;

    /**
     * Verifies a Text message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Text message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Text
     */
    public static fromObject(object: { [k: string]: any }): Text;

    /**
     * Creates a plain object from a Text message. Also converts values to other types if specified.
     * @param message Text
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Text, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Text to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

export namespace Text {

    /** Format enum. */
    enum Format {
        PLAIN = 0,
        MARKDOWN = 1,
        JSON = 2,
        ERROR = 6,
        WARNING = 7,
        INFO = 8,
        SUCCESS = 9
    }
}

/** Represents a VegaLiteChart. */
export class VegaLiteChart implements IVegaLiteChart {

    /**
     * Constructs a new VegaLiteChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IVegaLiteChart);

    /** VegaLiteChart spec. */
    public spec: string;

    /** VegaLiteChart data. */
    public data?: (IDataFrame|null);

    /** VegaLiteChart datasets. */
    public datasets: INamedDataSet[];

    /**
     * Creates a new VegaLiteChart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns VegaLiteChart instance
     */
    public static create(properties?: IVegaLiteChart): VegaLiteChart;

    /**
     * Encodes the specified VegaLiteChart message. Does not implicitly {@link VegaLiteChart.verify|verify} messages.
     * @param message VegaLiteChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IVegaLiteChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified VegaLiteChart message, length delimited. Does not implicitly {@link VegaLiteChart.verify|verify} messages.
     * @param message VegaLiteChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IVegaLiteChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a VegaLiteChart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns VegaLiteChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): VegaLiteChart;

    /**
     * Decodes a VegaLiteChart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns VegaLiteChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): VegaLiteChart;

    /**
     * Verifies a VegaLiteChart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a VegaLiteChart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns VegaLiteChart
     */
    public static fromObject(object: { [k: string]: any }): VegaLiteChart;

    /**
     * Creates a plain object from a VegaLiteChart message. Also converts values to other types if specified.
     * @param message VegaLiteChart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: VegaLiteChart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this VegaLiteChart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a NamedDataSet. */
export class NamedDataSet implements INamedDataSet {

    /**
     * Constructs a new NamedDataSet.
     * @param [properties] Properties to set
     */
    constructor(properties?: INamedDataSet);

    /** NamedDataSet name. */
    public name: string;

    /** NamedDataSet hasName. */
    public hasName: boolean;

    /** NamedDataSet data. */
    public data?: (IDataFrame|null);

    /**
     * Creates a new NamedDataSet instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NamedDataSet instance
     */
    public static create(properties?: INamedDataSet): NamedDataSet;

    /**
     * Encodes the specified NamedDataSet message. Does not implicitly {@link NamedDataSet.verify|verify} messages.
     * @param message NamedDataSet message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: INamedDataSet, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified NamedDataSet message, length delimited. Does not implicitly {@link NamedDataSet.verify|verify} messages.
     * @param message NamedDataSet message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: INamedDataSet, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a NamedDataSet message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NamedDataSet
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): NamedDataSet;

    /**
     * Decodes a NamedDataSet message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NamedDataSet
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): NamedDataSet;

    /**
     * Verifies a NamedDataSet message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a NamedDataSet message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NamedDataSet
     */
    public static fromObject(object: { [k: string]: any }): NamedDataSet;

    /**
     * Creates a plain object from a NamedDataSet message. Also converts values to other types if specified.
     * @param message NamedDataSet
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: NamedDataSet, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this NamedDataSet to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a Video. */
export class Video implements IVideo {

    /**
     * Constructs a new Video.
     * @param [properties] Properties to set
     */
    constructor(properties?: IVideo);

    /** Video data. */
    public data: string;

    /** Video format. */
    public format: string;

    /**
     * Creates a new Video instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Video instance
     */
    public static create(properties?: IVideo): Video;

    /**
     * Encodes the specified Video message. Does not implicitly {@link Video.verify|verify} messages.
     * @param message Video message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IVideo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Video message, length delimited. Does not implicitly {@link Video.verify|verify} messages.
     * @param message Video message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IVideo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Video message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Video
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Video;

    /**
     * Decodes a Video message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Video
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Video;

    /**
     * Verifies a Video message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Video message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Video
     */
    public static fromObject(object: { [k: string]: any }): Video;

    /**
     * Creates a plain object from a Video message. Also converts values to other types if specified.
     * @param message Video
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Video, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Video to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a ForwardMsg. */
export class ForwardMsg implements IForwardMsg {

    /**
     * Constructs a new ForwardMsg.
     * @param [properties] Properties to set
     */
    constructor(properties?: IForwardMsg);

    /** ForwardMsg initialize. */
    public initialize?: (IInitialize|null);

    /** ForwardMsg newReport. */
    public newReport?: (INewReport|null);

    /** ForwardMsg delta. */
    public delta?: (IDelta|null);

    /** ForwardMsg reportFinished. */
    public reportFinished: boolean;

    /** ForwardMsg uploadReportProgress. */
    public uploadReportProgress: number;

    /** ForwardMsg reportUploaded. */
    public reportUploaded: string;

    /** ForwardMsg sessionStateChanged. */
    public sessionStateChanged?: (ISessionState|null);

    /** ForwardMsg sessionEvent. */
    public sessionEvent?: (ISessionEvent|null);

    /** ForwardMsg type. */
    public type?: ("initialize"|"newReport"|"delta"|"reportFinished"|"uploadReportProgress"|"reportUploaded"|"sessionStateChanged"|"sessionEvent");

    /**
     * Creates a new ForwardMsg instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ForwardMsg instance
     */
    public static create(properties?: IForwardMsg): ForwardMsg;

    /**
     * Encodes the specified ForwardMsg message. Does not implicitly {@link ForwardMsg.verify|verify} messages.
     * @param message ForwardMsg message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IForwardMsg, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ForwardMsg message, length delimited. Does not implicitly {@link ForwardMsg.verify|verify} messages.
     * @param message ForwardMsg message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IForwardMsg, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ForwardMsg message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ForwardMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ForwardMsg;

    /**
     * Decodes a ForwardMsg message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ForwardMsg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ForwardMsg;

    /**
     * Verifies a ForwardMsg message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ForwardMsg message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ForwardMsg
     */
    public static fromObject(object: { [k: string]: any }): ForwardMsg;

    /**
     * Creates a plain object from a ForwardMsg message. Also converts values to other types if specified.
     * @param message ForwardMsg
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ForwardMsg, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ForwardMsg to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents an Initialize. */
export class Initialize implements IInitialize {

    /**
     * Constructs a new Initialize.
     * @param [properties] Properties to set
     */
    constructor(properties?: IInitialize);

    /** Initialize sharingEnabled. */
    public sharingEnabled: boolean;

    /** Initialize gatherUsageStats. */
    public gatherUsageStats: boolean;

    /** Initialize streamlitVersion. */
    public streamlitVersion: string;

    /** Initialize sessionState. */
    public sessionState?: (ISessionState|null);

    /** Initialize userInfo. */
    public userInfo?: (IUserInfo|null);

    /**
     * Creates a new Initialize instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Initialize instance
     */
    public static create(properties?: IInitialize): Initialize;

    /**
     * Encodes the specified Initialize message. Does not implicitly {@link Initialize.verify|verify} messages.
     * @param message Initialize message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IInitialize, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Initialize message, length delimited. Does not implicitly {@link Initialize.verify|verify} messages.
     * @param message Initialize message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IInitialize, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Initialize message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Initialize
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Initialize;

    /**
     * Decodes an Initialize message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Initialize
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Initialize;

    /**
     * Verifies an Initialize message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Initialize message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Initialize
     */
    public static fromObject(object: { [k: string]: any }): Initialize;

    /**
     * Creates a plain object from an Initialize message. Also converts values to other types if specified.
     * @param message Initialize
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Initialize, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Initialize to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a NewReport. */
export class NewReport implements INewReport {

    /**
     * Constructs a new NewReport.
     * @param [properties] Properties to set
     */
    constructor(properties?: INewReport);

    /** NewReport id. */
    public id: string;

    /** NewReport commandLine. */
    public commandLine: string[];

    /** NewReport name. */
    public name: string;

    /**
     * Creates a new NewReport instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NewReport instance
     */
    public static create(properties?: INewReport): NewReport;

    /**
     * Encodes the specified NewReport message. Does not implicitly {@link NewReport.verify|verify} messages.
     * @param message NewReport message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: INewReport, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified NewReport message, length delimited. Does not implicitly {@link NewReport.verify|verify} messages.
     * @param message NewReport message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: INewReport, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a NewReport message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NewReport
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): NewReport;

    /**
     * Decodes a NewReport message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NewReport
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): NewReport;

    /**
     * Verifies a NewReport message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a NewReport message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NewReport
     */
    public static fromObject(object: { [k: string]: any }): NewReport;

    /**
     * Creates a plain object from a NewReport message. Also converts values to other types if specified.
     * @param message NewReport
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: NewReport, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this NewReport to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a SessionState. */
export class SessionState implements ISessionState {

    /**
     * Constructs a new SessionState.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISessionState);

    /** SessionState runOnSave. */
    public runOnSave: boolean;

    /** SessionState reportIsRunning. */
    public reportIsRunning: boolean;

    /**
     * Creates a new SessionState instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SessionState instance
     */
    public static create(properties?: ISessionState): SessionState;

    /**
     * Encodes the specified SessionState message. Does not implicitly {@link SessionState.verify|verify} messages.
     * @param message SessionState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISessionState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SessionState message, length delimited. Does not implicitly {@link SessionState.verify|verify} messages.
     * @param message SessionState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISessionState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SessionState message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SessionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SessionState;

    /**
     * Decodes a SessionState message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SessionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SessionState;

    /**
     * Verifies a SessionState message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SessionState message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SessionState
     */
    public static fromObject(object: { [k: string]: any }): SessionState;

    /**
     * Creates a plain object from a SessionState message. Also converts values to other types if specified.
     * @param message SessionState
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SessionState, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SessionState to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a SessionEvent. */
export class SessionEvent implements ISessionEvent {

    /**
     * Constructs a new SessionEvent.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISessionEvent);

    /** SessionEvent reportChangedOnDisk. */
    public reportChangedOnDisk: boolean;

    /** SessionEvent reportWasManuallyStopped. */
    public reportWasManuallyStopped: boolean;

    /** SessionEvent type. */
    public type?: ("reportChangedOnDisk"|"reportWasManuallyStopped");

    /**
     * Creates a new SessionEvent instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SessionEvent instance
     */
    public static create(properties?: ISessionEvent): SessionEvent;

    /**
     * Encodes the specified SessionEvent message. Does not implicitly {@link SessionEvent.verify|verify} messages.
     * @param message SessionEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISessionEvent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SessionEvent message, length delimited. Does not implicitly {@link SessionEvent.verify|verify} messages.
     * @param message SessionEvent message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISessionEvent, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SessionEvent message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SessionEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SessionEvent;

    /**
     * Decodes a SessionEvent message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SessionEvent
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SessionEvent;

    /**
     * Verifies a SessionEvent message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SessionEvent message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SessionEvent
     */
    public static fromObject(object: { [k: string]: any }): SessionEvent;

    /**
     * Creates a plain object from a SessionEvent message. Also converts values to other types if specified.
     * @param message SessionEvent
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SessionEvent, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SessionEvent to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Represents a UserInfo. */
export class UserInfo implements IUserInfo {

    /**
     * Constructs a new UserInfo.
     * @param [properties] Properties to set
     */
    constructor(properties?: IUserInfo);

    /** UserInfo installationId. */
    public installationId: string;

    /**
     * Creates a new UserInfo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserInfo instance
     */
    public static create(properties?: IUserInfo): UserInfo;

    /**
     * Encodes the specified UserInfo message. Does not implicitly {@link UserInfo.verify|verify} messages.
     * @param message UserInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IUserInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified UserInfo message, length delimited. Does not implicitly {@link UserInfo.verify|verify} messages.
     * @param message UserInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IUserInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a UserInfo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): UserInfo;

    /**
     * Decodes a UserInfo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): UserInfo;

    /**
     * Verifies a UserInfo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a UserInfo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserInfo
     */
    public static fromObject(object: { [k: string]: any }): UserInfo;

    /**
     * Creates a plain object from a UserInfo message. Also converts values to other types if specified.
     * @param message UserInfo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: UserInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this UserInfo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}
