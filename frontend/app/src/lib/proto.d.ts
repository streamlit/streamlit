/* eslint-disable */

import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of an Alert. */
export interface IAlert {

    /** Alert body */
    body?: (string|null);

    /** Alert format */
    format?: (Alert.Format|null);

    /** Alert icon */
    icon?: (string|null);
}

/** Represents an Alert. */
export class Alert implements IAlert {

    /**
     * Constructs a new Alert.
     * @param [properties] Properties to set
     */
    constructor(properties?: IAlert);

    /** Alert body. */
    public body: string;

    /** Alert format. */
    public format: Alert.Format;

    /** Alert icon. */
    public icon: string;

    /**
     * Creates a new Alert instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Alert instance
     */
    public static create(properties?: IAlert): Alert;

    /**
     * Encodes the specified Alert message. Does not implicitly {@link Alert.verify|verify} messages.
     * @param message Alert message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IAlert, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Alert message, length delimited. Does not implicitly {@link Alert.verify|verify} messages.
     * @param message Alert message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IAlert, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Alert message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Alert
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Alert;

    /**
     * Decodes an Alert message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Alert
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Alert;

    /**
     * Verifies an Alert message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Alert message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Alert
     */
    public static fromObject(object: { [k: string]: any }): Alert;

    /**
     * Creates a plain object from an Alert message. Also converts values to other types if specified.
     * @param message Alert
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Alert, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Alert to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Alert
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Alert {

    /** Format enum. */
    enum Format {
        UNUSED = 0,
        ERROR = 1,
        WARNING = 2,
        INFO = 3,
        SUCCESS = 4
    }
}

/** Properties of an AppPage. */
export interface IAppPage {

    /** AppPage pageScriptHash */
    pageScriptHash?: (string|null);

    /** AppPage pageName */
    pageName?: (string|null);

    /** AppPage icon */
    icon?: (string|null);
}

/** Represents an AppPage. */
export class AppPage implements IAppPage {

    /**
     * Constructs a new AppPage.
     * @param [properties] Properties to set
     */
    constructor(properties?: IAppPage);

    /** AppPage pageScriptHash. */
    public pageScriptHash: string;

    /** AppPage pageName. */
    public pageName: string;

    /** AppPage icon. */
    public icon: string;

    /**
     * Creates a new AppPage instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AppPage instance
     */
    public static create(properties?: IAppPage): AppPage;

    /**
     * Encodes the specified AppPage message. Does not implicitly {@link AppPage.verify|verify} messages.
     * @param message AppPage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IAppPage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified AppPage message, length delimited. Does not implicitly {@link AppPage.verify|verify} messages.
     * @param message AppPage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IAppPage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an AppPage message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AppPage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): AppPage;

    /**
     * Decodes an AppPage message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AppPage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): AppPage;

    /**
     * Verifies an AppPage message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an AppPage message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AppPage
     */
    public static fromObject(object: { [k: string]: any }): AppPage;

    /**
     * Creates a plain object from an AppPage message. Also converts values to other types if specified.
     * @param message AppPage
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: AppPage, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this AppPage to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AppPage
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Arrow. */
export interface IArrow {

    /** Arrow data */
    data?: (Uint8Array|null);

    /** Arrow styler */
    styler?: (IStyler|null);

    /** Arrow width */
    width?: (number|null);

    /** Arrow height */
    height?: (number|null);

    /** Arrow useContainerWidth */
    useContainerWidth?: (boolean|null);

    /** Arrow id */
    id?: (string|null);

    /** Arrow columns */
    columns?: (string|null);

    /** Arrow editingMode */
    editingMode?: (Arrow.EditingMode|null);

    /** Arrow disabled */
    disabled?: (boolean|null);

    /** Arrow formId */
    formId?: (string|null);
}

/** Represents an Arrow. */
export class Arrow implements IArrow {

    /**
     * Constructs a new Arrow.
     * @param [properties] Properties to set
     */
    constructor(properties?: IArrow);

    /** Arrow data. */
    public data: Uint8Array;

    /** Arrow styler. */
    public styler?: (IStyler|null);

    /** Arrow width. */
    public width: number;

    /** Arrow height. */
    public height: number;

    /** Arrow useContainerWidth. */
    public useContainerWidth: boolean;

    /** Arrow id. */
    public id: string;

    /** Arrow columns. */
    public columns: string;

    /** Arrow editingMode. */
    public editingMode: Arrow.EditingMode;

    /** Arrow disabled. */
    public disabled: boolean;

    /** Arrow formId. */
    public formId: string;

    /**
     * Creates a new Arrow instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Arrow instance
     */
    public static create(properties?: IArrow): Arrow;

    /**
     * Encodes the specified Arrow message. Does not implicitly {@link Arrow.verify|verify} messages.
     * @param message Arrow message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IArrow, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Arrow message, length delimited. Does not implicitly {@link Arrow.verify|verify} messages.
     * @param message Arrow message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IArrow, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Arrow message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Arrow
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Arrow;

    /**
     * Decodes an Arrow message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Arrow
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Arrow;

    /**
     * Verifies an Arrow message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Arrow message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Arrow
     */
    public static fromObject(object: { [k: string]: any }): Arrow;

    /**
     * Creates a plain object from an Arrow message. Also converts values to other types if specified.
     * @param message Arrow
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Arrow, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Arrow to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Arrow
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Arrow {

    /** EditingMode enum. */
    enum EditingMode {
        READ_ONLY = 0,
        FIXED = 1,
        DYNAMIC = 2
    }
}

/** Properties of a Styler. */
export interface IStyler {

    /** Styler uuid */
    uuid?: (string|null);

    /** Styler caption */
    caption?: (string|null);

    /** Styler styles */
    styles?: (string|null);

    /** Styler displayValues */
    displayValues?: (Uint8Array|null);
}

/** Represents a Styler. */
export class Styler implements IStyler {

    /**
     * Constructs a new Styler.
     * @param [properties] Properties to set
     */
    constructor(properties?: IStyler);

    /** Styler uuid. */
    public uuid: string;

    /** Styler caption. */
    public caption: string;

    /** Styler styles. */
    public styles: string;

    /** Styler displayValues. */
    public displayValues: Uint8Array;

    /**
     * Creates a new Styler instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Styler instance
     */
    public static create(properties?: IStyler): Styler;

    /**
     * Encodes the specified Styler message. Does not implicitly {@link Styler.verify|verify} messages.
     * @param message Styler message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IStyler, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Styler message, length delimited. Does not implicitly {@link Styler.verify|verify} messages.
     * @param message Styler message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IStyler, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Styler message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Styler
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Styler;

    /**
     * Decodes a Styler message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Styler
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Styler;

    /**
     * Verifies a Styler message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Styler message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Styler
     */
    public static fromObject(object: { [k: string]: any }): Styler;

    /**
     * Creates a plain object from a Styler message. Also converts values to other types if specified.
     * @param message Styler
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Styler, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Styler to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Styler
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an ArrowNamedDataSet. */
export interface IArrowNamedDataSet {

    /** ArrowNamedDataSet name */
    name?: (string|null);

    /** ArrowNamedDataSet hasName */
    hasName?: (boolean|null);

    /** ArrowNamedDataSet data */
    data?: (IArrow|null);
}

/** Represents an ArrowNamedDataSet. */
export class ArrowNamedDataSet implements IArrowNamedDataSet {

    /**
     * Constructs a new ArrowNamedDataSet.
     * @param [properties] Properties to set
     */
    constructor(properties?: IArrowNamedDataSet);

    /** ArrowNamedDataSet name. */
    public name: string;

    /** ArrowNamedDataSet hasName. */
    public hasName: boolean;

    /** ArrowNamedDataSet data. */
    public data?: (IArrow|null);

    /**
     * Creates a new ArrowNamedDataSet instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ArrowNamedDataSet instance
     */
    public static create(properties?: IArrowNamedDataSet): ArrowNamedDataSet;

    /**
     * Encodes the specified ArrowNamedDataSet message. Does not implicitly {@link ArrowNamedDataSet.verify|verify} messages.
     * @param message ArrowNamedDataSet message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IArrowNamedDataSet, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ArrowNamedDataSet message, length delimited. Does not implicitly {@link ArrowNamedDataSet.verify|verify} messages.
     * @param message ArrowNamedDataSet message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IArrowNamedDataSet, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an ArrowNamedDataSet message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ArrowNamedDataSet
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ArrowNamedDataSet;

    /**
     * Decodes an ArrowNamedDataSet message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ArrowNamedDataSet
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ArrowNamedDataSet;

    /**
     * Verifies an ArrowNamedDataSet message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an ArrowNamedDataSet message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ArrowNamedDataSet
     */
    public static fromObject(object: { [k: string]: any }): ArrowNamedDataSet;

    /**
     * Creates a plain object from an ArrowNamedDataSet message. Also converts values to other types if specified.
     * @param message ArrowNamedDataSet
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ArrowNamedDataSet, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ArrowNamedDataSet to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ArrowNamedDataSet
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an ArrowVegaLiteChart. */
export interface IArrowVegaLiteChart {

    /** ArrowVegaLiteChart spec */
    spec?: (string|null);

    /** ArrowVegaLiteChart data */
    data?: (IArrow|null);

    /** ArrowVegaLiteChart datasets */
    datasets?: (IArrowNamedDataSet[]|null);

    /** ArrowVegaLiteChart useContainerWidth */
    useContainerWidth?: (boolean|null);

    /** ArrowVegaLiteChart theme */
    theme?: (string|null);
}

/** Represents an ArrowVegaLiteChart. */
export class ArrowVegaLiteChart implements IArrowVegaLiteChart {

    /**
     * Constructs a new ArrowVegaLiteChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IArrowVegaLiteChart);

    /** ArrowVegaLiteChart spec. */
    public spec: string;

    /** ArrowVegaLiteChart data. */
    public data?: (IArrow|null);

    /** ArrowVegaLiteChart datasets. */
    public datasets: IArrowNamedDataSet[];

    /** ArrowVegaLiteChart useContainerWidth. */
    public useContainerWidth: boolean;

    /** ArrowVegaLiteChart theme. */
    public theme: string;

    /**
     * Creates a new ArrowVegaLiteChart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ArrowVegaLiteChart instance
     */
    public static create(properties?: IArrowVegaLiteChart): ArrowVegaLiteChart;

    /**
     * Encodes the specified ArrowVegaLiteChart message. Does not implicitly {@link ArrowVegaLiteChart.verify|verify} messages.
     * @param message ArrowVegaLiteChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IArrowVegaLiteChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ArrowVegaLiteChart message, length delimited. Does not implicitly {@link ArrowVegaLiteChart.verify|verify} messages.
     * @param message ArrowVegaLiteChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IArrowVegaLiteChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an ArrowVegaLiteChart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ArrowVegaLiteChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ArrowVegaLiteChart;

    /**
     * Decodes an ArrowVegaLiteChart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ArrowVegaLiteChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ArrowVegaLiteChart;

    /**
     * Verifies an ArrowVegaLiteChart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an ArrowVegaLiteChart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ArrowVegaLiteChart
     */
    public static fromObject(object: { [k: string]: any }): ArrowVegaLiteChart;

    /**
     * Creates a plain object from an ArrowVegaLiteChart message. Also converts values to other types if specified.
     * @param message ArrowVegaLiteChart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ArrowVegaLiteChart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ArrowVegaLiteChart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ArrowVegaLiteChart
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Audio. */
export interface IAudio {

    /** Audio url */
    url?: (string|null);

    /** Audio startTime */
    startTime?: (number|null);
}

/** Represents an Audio. */
export class Audio implements IAudio {

    /**
     * Constructs a new Audio.
     * @param [properties] Properties to set
     */
    constructor(properties?: IAudio);

    /** Audio url. */
    public url: string;

    /** Audio startTime. */
    public startTime: number;

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

    /**
     * Gets the default type url for Audio
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a BackMsg. */
export interface IBackMsg {

    /** BackMsg clearCache */
    clearCache?: (boolean|null);

    /** BackMsg setRunOnSave */
    setRunOnSave?: (boolean|null);

    /** BackMsg stopScript */
    stopScript?: (boolean|null);

    /** BackMsg rerunScript */
    rerunScript?: (IClientState|null);

    /** BackMsg loadGitInfo */
    loadGitInfo?: (boolean|null);

    /** BackMsg debugDisconnectWebsocket */
    debugDisconnectWebsocket?: (boolean|null);

    /** BackMsg debugShutdownRuntime */
    debugShutdownRuntime?: (boolean|null);

    /** BackMsg debugLastBackmsgId */
    debugLastBackmsgId?: (string|null);
}

/** Represents a BackMsg. */
export class BackMsg implements IBackMsg {

    /**
     * Constructs a new BackMsg.
     * @param [properties] Properties to set
     */
    constructor(properties?: IBackMsg);

    /** BackMsg clearCache. */
    public clearCache?: (boolean|null);

    /** BackMsg setRunOnSave. */
    public setRunOnSave?: (boolean|null);

    /** BackMsg stopScript. */
    public stopScript?: (boolean|null);

    /** BackMsg rerunScript. */
    public rerunScript?: (IClientState|null);

    /** BackMsg loadGitInfo. */
    public loadGitInfo?: (boolean|null);

    /** BackMsg debugDisconnectWebsocket. */
    public debugDisconnectWebsocket?: (boolean|null);

    /** BackMsg debugShutdownRuntime. */
    public debugShutdownRuntime?: (boolean|null);

    /** BackMsg debugLastBackmsgId. */
    public debugLastBackmsgId: string;

    /** BackMsg type. */
    public type?: ("clearCache"|"setRunOnSave"|"stopScript"|"rerunScript"|"loadGitInfo"|"debugDisconnectWebsocket"|"debugShutdownRuntime");

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

    /**
     * Gets the default type url for BackMsg
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Balloons. */
export interface IBalloons {

    /** Balloons show */
    show?: (boolean|null);
}

/** Represents a Balloons. */
export class Balloons implements IBalloons {

    /**
     * Constructs a new Balloons.
     * @param [properties] Properties to set
     */
    constructor(properties?: IBalloons);

    /** Balloons show. */
    public show: boolean;

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

    /**
     * Gets the default type url for Balloons
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Block. */
export interface IBlock {

    /** Block vertical */
    vertical?: (Block.IVertical|null);

    /** Block horizontal */
    horizontal?: (Block.IHorizontal|null);

    /** Block column */
    column?: (Block.IColumn|null);

    /** Block expandable */
    expandable?: (Block.IExpandable|null);

    /** Block form */
    form?: (Block.IForm|null);

    /** Block tabContainer */
    tabContainer?: (Block.ITabContainer|null);

    /** Block tab */
    tab?: (Block.ITab|null);

    /** Block allowEmpty */
    allowEmpty?: (boolean|null);
}

/** Represents a Block. */
export class Block implements IBlock {

    /**
     * Constructs a new Block.
     * @param [properties] Properties to set
     */
    constructor(properties?: IBlock);

    /** Block vertical. */
    public vertical?: (Block.IVertical|null);

    /** Block horizontal. */
    public horizontal?: (Block.IHorizontal|null);

    /** Block column. */
    public column?: (Block.IColumn|null);

    /** Block expandable. */
    public expandable?: (Block.IExpandable|null);

    /** Block form. */
    public form?: (Block.IForm|null);

    /** Block tabContainer. */
    public tabContainer?: (Block.ITabContainer|null);

    /** Block tab. */
    public tab?: (Block.ITab|null);

    /** Block allowEmpty. */
    public allowEmpty: boolean;

    /** Block type. */
    public type?: ("vertical"|"horizontal"|"column"|"expandable"|"form"|"tabContainer"|"tab");

    /**
     * Creates a new Block instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Block instance
     */
    public static create(properties?: IBlock): Block;

    /**
     * Encodes the specified Block message. Does not implicitly {@link Block.verify|verify} messages.
     * @param message Block message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IBlock, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Block message, length delimited. Does not implicitly {@link Block.verify|verify} messages.
     * @param message Block message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IBlock, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Block message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Block
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block;

    /**
     * Decodes a Block message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Block
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block;

    /**
     * Verifies a Block message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Block message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Block
     */
    public static fromObject(object: { [k: string]: any }): Block;

    /**
     * Creates a plain object from a Block message. Also converts values to other types if specified.
     * @param message Block
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Block, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Block to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Block
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Block {

    /** Properties of a Vertical. */
    interface IVertical {
    }

    /** Represents a Vertical. */
    class Vertical implements IVertical {

        /**
         * Constructs a new Vertical.
         * @param [properties] Properties to set
         */
        constructor(properties?: Block.IVertical);

        /**
         * Creates a new Vertical instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Vertical instance
         */
        public static create(properties?: Block.IVertical): Block.Vertical;

        /**
         * Encodes the specified Vertical message. Does not implicitly {@link Block.Vertical.verify|verify} messages.
         * @param message Vertical message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Block.IVertical, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Vertical message, length delimited. Does not implicitly {@link Block.Vertical.verify|verify} messages.
         * @param message Vertical message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Block.IVertical, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Vertical message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Vertical
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block.Vertical;

        /**
         * Decodes a Vertical message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Vertical
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block.Vertical;

        /**
         * Verifies a Vertical message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Vertical message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Vertical
         */
        public static fromObject(object: { [k: string]: any }): Block.Vertical;

        /**
         * Creates a plain object from a Vertical message. Also converts values to other types if specified.
         * @param message Vertical
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Block.Vertical, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Vertical to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Vertical
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Horizontal. */
    interface IHorizontal {

        /** Horizontal gap */
        gap?: (string|null);
    }

    /** Represents a Horizontal. */
    class Horizontal implements IHorizontal {

        /**
         * Constructs a new Horizontal.
         * @param [properties] Properties to set
         */
        constructor(properties?: Block.IHorizontal);

        /** Horizontal gap. */
        public gap: string;

        /**
         * Creates a new Horizontal instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Horizontal instance
         */
        public static create(properties?: Block.IHorizontal): Block.Horizontal;

        /**
         * Encodes the specified Horizontal message. Does not implicitly {@link Block.Horizontal.verify|verify} messages.
         * @param message Horizontal message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Block.IHorizontal, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Horizontal message, length delimited. Does not implicitly {@link Block.Horizontal.verify|verify} messages.
         * @param message Horizontal message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Block.IHorizontal, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Horizontal message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Horizontal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block.Horizontal;

        /**
         * Decodes a Horizontal message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Horizontal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block.Horizontal;

        /**
         * Verifies a Horizontal message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Horizontal message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Horizontal
         */
        public static fromObject(object: { [k: string]: any }): Block.Horizontal;

        /**
         * Creates a plain object from a Horizontal message. Also converts values to other types if specified.
         * @param message Horizontal
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Block.Horizontal, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Horizontal to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Horizontal
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Column. */
    interface IColumn {

        /** Column weight */
        weight?: (number|null);

        /** Column gap */
        gap?: (string|null);
    }

    /** Represents a Column. */
    class Column implements IColumn {

        /**
         * Constructs a new Column.
         * @param [properties] Properties to set
         */
        constructor(properties?: Block.IColumn);

        /** Column weight. */
        public weight: number;

        /** Column gap. */
        public gap: string;

        /**
         * Creates a new Column instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Column instance
         */
        public static create(properties?: Block.IColumn): Block.Column;

        /**
         * Encodes the specified Column message. Does not implicitly {@link Block.Column.verify|verify} messages.
         * @param message Column message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Block.IColumn, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Column message, length delimited. Does not implicitly {@link Block.Column.verify|verify} messages.
         * @param message Column message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Block.IColumn, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Column message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Column
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block.Column;

        /**
         * Decodes a Column message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Column
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block.Column;

        /**
         * Verifies a Column message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Column message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Column
         */
        public static fromObject(object: { [k: string]: any }): Block.Column;

        /**
         * Creates a plain object from a Column message. Also converts values to other types if specified.
         * @param message Column
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Block.Column, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Column to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Column
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Expandable. */
    interface IExpandable {

        /** Expandable label */
        label?: (string|null);

        /** Expandable expanded */
        expanded?: (boolean|null);
    }

    /** Represents an Expandable. */
    class Expandable implements IExpandable {

        /**
         * Constructs a new Expandable.
         * @param [properties] Properties to set
         */
        constructor(properties?: Block.IExpandable);

        /** Expandable label. */
        public label: string;

        /** Expandable expanded. */
        public expanded: boolean;

        /**
         * Creates a new Expandable instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Expandable instance
         */
        public static create(properties?: Block.IExpandable): Block.Expandable;

        /**
         * Encodes the specified Expandable message. Does not implicitly {@link Block.Expandable.verify|verify} messages.
         * @param message Expandable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Block.IExpandable, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Expandable message, length delimited. Does not implicitly {@link Block.Expandable.verify|verify} messages.
         * @param message Expandable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Block.IExpandable, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Expandable message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Expandable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block.Expandable;

        /**
         * Decodes an Expandable message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Expandable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block.Expandable;

        /**
         * Verifies an Expandable message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Expandable message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Expandable
         */
        public static fromObject(object: { [k: string]: any }): Block.Expandable;

        /**
         * Creates a plain object from an Expandable message. Also converts values to other types if specified.
         * @param message Expandable
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Block.Expandable, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Expandable to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Expandable
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Form. */
    interface IForm {

        /** Form formId */
        formId?: (string|null);

        /** Form clearOnSubmit */
        clearOnSubmit?: (boolean|null);
    }

    /** Represents a Form. */
    class Form implements IForm {

        /**
         * Constructs a new Form.
         * @param [properties] Properties to set
         */
        constructor(properties?: Block.IForm);

        /** Form formId. */
        public formId: string;

        /** Form clearOnSubmit. */
        public clearOnSubmit: boolean;

        /**
         * Creates a new Form instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Form instance
         */
        public static create(properties?: Block.IForm): Block.Form;

        /**
         * Encodes the specified Form message. Does not implicitly {@link Block.Form.verify|verify} messages.
         * @param message Form message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Block.IForm, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Form message, length delimited. Does not implicitly {@link Block.Form.verify|verify} messages.
         * @param message Form message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Block.IForm, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Form message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Form
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block.Form;

        /**
         * Decodes a Form message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Form
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block.Form;

        /**
         * Verifies a Form message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Form message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Form
         */
        public static fromObject(object: { [k: string]: any }): Block.Form;

        /**
         * Creates a plain object from a Form message. Also converts values to other types if specified.
         * @param message Form
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Block.Form, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Form to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Form
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a TabContainer. */
    interface ITabContainer {
    }

    /** Represents a TabContainer. */
    class TabContainer implements ITabContainer {

        /**
         * Constructs a new TabContainer.
         * @param [properties] Properties to set
         */
        constructor(properties?: Block.ITabContainer);

        /**
         * Creates a new TabContainer instance using the specified properties.
         * @param [properties] Properties to set
         * @returns TabContainer instance
         */
        public static create(properties?: Block.ITabContainer): Block.TabContainer;

        /**
         * Encodes the specified TabContainer message. Does not implicitly {@link Block.TabContainer.verify|verify} messages.
         * @param message TabContainer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Block.ITabContainer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified TabContainer message, length delimited. Does not implicitly {@link Block.TabContainer.verify|verify} messages.
         * @param message TabContainer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Block.ITabContainer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a TabContainer message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns TabContainer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block.TabContainer;

        /**
         * Decodes a TabContainer message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns TabContainer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block.TabContainer;

        /**
         * Verifies a TabContainer message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a TabContainer message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns TabContainer
         */
        public static fromObject(object: { [k: string]: any }): Block.TabContainer;

        /**
         * Creates a plain object from a TabContainer message. Also converts values to other types if specified.
         * @param message TabContainer
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Block.TabContainer, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this TabContainer to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for TabContainer
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Tab. */
    interface ITab {

        /** Tab label */
        label?: (string|null);
    }

    /** Represents a Tab. */
    class Tab implements ITab {

        /**
         * Constructs a new Tab.
         * @param [properties] Properties to set
         */
        constructor(properties?: Block.ITab);

        /** Tab label. */
        public label: string;

        /**
         * Creates a new Tab instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Tab instance
         */
        public static create(properties?: Block.ITab): Block.Tab;

        /**
         * Encodes the specified Tab message. Does not implicitly {@link Block.Tab.verify|verify} messages.
         * @param message Tab message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: Block.ITab, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Tab message, length delimited. Does not implicitly {@link Block.Tab.verify|verify} messages.
         * @param message Tab message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: Block.ITab, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Tab message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Tab
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Block.Tab;

        /**
         * Decodes a Tab message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Tab
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Block.Tab;

        /**
         * Verifies a Tab message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Tab message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Tab
         */
        public static fromObject(object: { [k: string]: any }): Block.Tab;

        /**
         * Creates a plain object from a Tab message. Also converts values to other types if specified.
         * @param message Tab
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: Block.Tab, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Tab to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Tab
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Properties of a BokehChart. */
export interface IBokehChart {

    /** BokehChart figure */
    figure?: (string|null);

    /** BokehChart useContainerWidth */
    useContainerWidth?: (boolean|null);

    /** BokehChart elementId */
    elementId?: (string|null);
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

    /** BokehChart useContainerWidth. */
    public useContainerWidth: boolean;

    /** BokehChart elementId. */
    public elementId: string;

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

    /**
     * Gets the default type url for BokehChart
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Button. */
export interface IButton {

    /** Button id */
    id?: (string|null);

    /** Button label */
    label?: (string|null);

    /** Button default */
    "default"?: (boolean|null);

    /** Button help */
    help?: (string|null);

    /** Button formId */
    formId?: (string|null);

    /** Button isFormSubmitter */
    isFormSubmitter?: (boolean|null);

    /** Button type */
    type?: (string|null);

    /** Button disabled */
    disabled?: (boolean|null);

    /** Button useContainerWidth */
    useContainerWidth?: (boolean|null);
}

/** Represents a Button. */
export class Button implements IButton {

    /**
     * Constructs a new Button.
     * @param [properties] Properties to set
     */
    constructor(properties?: IButton);

    /** Button id. */
    public id: string;

    /** Button label. */
    public label: string;

    /** Button default. */
    public default: boolean;

    /** Button help. */
    public help: string;

    /** Button formId. */
    public formId: string;

    /** Button isFormSubmitter. */
    public isFormSubmitter: boolean;

    /** Button type. */
    public type: string;

    /** Button disabled. */
    public disabled: boolean;

    /** Button useContainerWidth. */
    public useContainerWidth: boolean;

    /**
     * Creates a new Button instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Button instance
     */
    public static create(properties?: IButton): Button;

    /**
     * Encodes the specified Button message. Does not implicitly {@link Button.verify|verify} messages.
     * @param message Button message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IButton, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Button message, length delimited. Does not implicitly {@link Button.verify|verify} messages.
     * @param message Button message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IButton, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Button message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Button
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Button;

    /**
     * Decodes a Button message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Button
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Button;

    /**
     * Verifies a Button message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Button message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Button
     */
    public static fromObject(object: { [k: string]: any }): Button;

    /**
     * Creates a plain object from a Button message. Also converts values to other types if specified.
     * @param message Button
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Button, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Button to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Button
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a CameraInput. */
export interface ICameraInput {

    /** CameraInput id */
    id?: (string|null);

    /** CameraInput label */
    label?: (string|null);

    /** CameraInput help */
    help?: (string|null);

    /** CameraInput formId */
    formId?: (string|null);

    /** CameraInput disabled */
    disabled?: (boolean|null);

    /** CameraInput labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a CameraInput. */
export class CameraInput implements ICameraInput {

    /**
     * Constructs a new CameraInput.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICameraInput);

    /** CameraInput id. */
    public id: string;

    /** CameraInput label. */
    public label: string;

    /** CameraInput help. */
    public help: string;

    /** CameraInput formId. */
    public formId: string;

    /** CameraInput disabled. */
    public disabled: boolean;

    /** CameraInput labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new CameraInput instance using the specified properties.
     * @param [properties] Properties to set
     * @returns CameraInput instance
     */
    public static create(properties?: ICameraInput): CameraInput;

    /**
     * Encodes the specified CameraInput message. Does not implicitly {@link CameraInput.verify|verify} messages.
     * @param message CameraInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICameraInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified CameraInput message, length delimited. Does not implicitly {@link CameraInput.verify|verify} messages.
     * @param message CameraInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICameraInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a CameraInput message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns CameraInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): CameraInput;

    /**
     * Decodes a CameraInput message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns CameraInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): CameraInput;

    /**
     * Verifies a CameraInput message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a CameraInput message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns CameraInput
     */
    public static fromObject(object: { [k: string]: any }): CameraInput;

    /**
     * Creates a plain object from a CameraInput message. Also converts values to other types if specified.
     * @param message CameraInput
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: CameraInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this CameraInput to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for CameraInput
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Checkbox. */
export interface ICheckbox {

    /** Checkbox id */
    id?: (string|null);

    /** Checkbox label */
    label?: (string|null);

    /** Checkbox default */
    "default"?: (boolean|null);

    /** Checkbox help */
    help?: (string|null);

    /** Checkbox formId */
    formId?: (string|null);

    /** Checkbox value */
    value?: (boolean|null);

    /** Checkbox setValue */
    setValue?: (boolean|null);

    /** Checkbox disabled */
    disabled?: (boolean|null);

    /** Checkbox labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a Checkbox. */
export class Checkbox implements ICheckbox {

    /**
     * Constructs a new Checkbox.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICheckbox);

    /** Checkbox id. */
    public id: string;

    /** Checkbox label. */
    public label: string;

    /** Checkbox default. */
    public default: boolean;

    /** Checkbox help. */
    public help: string;

    /** Checkbox formId. */
    public formId: string;

    /** Checkbox value. */
    public value: boolean;

    /** Checkbox setValue. */
    public setValue: boolean;

    /** Checkbox disabled. */
    public disabled: boolean;

    /** Checkbox labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new Checkbox instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Checkbox instance
     */
    public static create(properties?: ICheckbox): Checkbox;

    /**
     * Encodes the specified Checkbox message. Does not implicitly {@link Checkbox.verify|verify} messages.
     * @param message Checkbox message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICheckbox, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Checkbox message, length delimited. Does not implicitly {@link Checkbox.verify|verify} messages.
     * @param message Checkbox message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICheckbox, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Checkbox message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Checkbox
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Checkbox;

    /**
     * Decodes a Checkbox message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Checkbox
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Checkbox;

    /**
     * Verifies a Checkbox message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Checkbox message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Checkbox
     */
    public static fromObject(object: { [k: string]: any }): Checkbox;

    /**
     * Creates a plain object from a Checkbox message. Also converts values to other types if specified.
     * @param message Checkbox
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Checkbox, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Checkbox to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Checkbox
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a ClientState. */
export interface IClientState {

    /** ClientState queryString */
    queryString?: (string|null);

    /** ClientState widgetStates */
    widgetStates?: (IWidgetStates|null);

    /** ClientState pageScriptHash */
    pageScriptHash?: (string|null);

    /** ClientState pageName */
    pageName?: (string|null);
}

/** Represents a ClientState. */
export class ClientState implements IClientState {

    /**
     * Constructs a new ClientState.
     * @param [properties] Properties to set
     */
    constructor(properties?: IClientState);

    /** ClientState queryString. */
    public queryString: string;

    /** ClientState widgetStates. */
    public widgetStates?: (IWidgetStates|null);

    /** ClientState pageScriptHash. */
    public pageScriptHash: string;

    /** ClientState pageName. */
    public pageName: string;

    /**
     * Creates a new ClientState instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ClientState instance
     */
    public static create(properties?: IClientState): ClientState;

    /**
     * Encodes the specified ClientState message. Does not implicitly {@link ClientState.verify|verify} messages.
     * @param message ClientState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IClientState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ClientState message, length delimited. Does not implicitly {@link ClientState.verify|verify} messages.
     * @param message ClientState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IClientState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ClientState message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ClientState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ClientState;

    /**
     * Decodes a ClientState message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ClientState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ClientState;

    /**
     * Verifies a ClientState message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ClientState message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ClientState
     */
    public static fromObject(object: { [k: string]: any }): ClientState;

    /**
     * Creates a plain object from a ClientState message. Also converts values to other types if specified.
     * @param message ClientState
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ClientState, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ClientState to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ClientState
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Code. */
export interface ICode {

    /** Code codeText */
    codeText?: (string|null);

    /** Code language */
    language?: (string|null);

    /** Code showLineNumbers */
    showLineNumbers?: (boolean|null);
}

/** Represents a Code. */
export class Code implements ICode {

    /**
     * Constructs a new Code.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICode);

    /** Code codeText. */
    public codeText: string;

    /** Code language. */
    public language: string;

    /** Code showLineNumbers. */
    public showLineNumbers: boolean;

    /**
     * Creates a new Code instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Code instance
     */
    public static create(properties?: ICode): Code;

    /**
     * Encodes the specified Code message. Does not implicitly {@link Code.verify|verify} messages.
     * @param message Code message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICode, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Code message, length delimited. Does not implicitly {@link Code.verify|verify} messages.
     * @param message Code message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICode, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Code message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Code
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Code;

    /**
     * Decodes a Code message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Code
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Code;

    /**
     * Verifies a Code message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Code message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Code
     */
    public static fromObject(object: { [k: string]: any }): Code;

    /**
     * Creates a plain object from a Code message. Also converts values to other types if specified.
     * @param message Code
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Code, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Code to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Code
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a ColorPicker. */
export interface IColorPicker {

    /** ColorPicker id */
    id?: (string|null);

    /** ColorPicker label */
    label?: (string|null);

    /** ColorPicker default */
    "default"?: (string|null);

    /** ColorPicker help */
    help?: (string|null);

    /** ColorPicker formId */
    formId?: (string|null);

    /** ColorPicker value */
    value?: (string|null);

    /** ColorPicker setValue */
    setValue?: (boolean|null);

    /** ColorPicker disabled */
    disabled?: (boolean|null);

    /** ColorPicker labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a ColorPicker. */
export class ColorPicker implements IColorPicker {

    /**
     * Constructs a new ColorPicker.
     * @param [properties] Properties to set
     */
    constructor(properties?: IColorPicker);

    /** ColorPicker id. */
    public id: string;

    /** ColorPicker label. */
    public label: string;

    /** ColorPicker default. */
    public default: string;

    /** ColorPicker help. */
    public help: string;

    /** ColorPicker formId. */
    public formId: string;

    /** ColorPicker value. */
    public value: string;

    /** ColorPicker setValue. */
    public setValue: boolean;

    /** ColorPicker disabled. */
    public disabled: boolean;

    /** ColorPicker labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new ColorPicker instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ColorPicker instance
     */
    public static create(properties?: IColorPicker): ColorPicker;

    /**
     * Encodes the specified ColorPicker message. Does not implicitly {@link ColorPicker.verify|verify} messages.
     * @param message ColorPicker message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IColorPicker, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ColorPicker message, length delimited. Does not implicitly {@link ColorPicker.verify|verify} messages.
     * @param message ColorPicker message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IColorPicker, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ColorPicker message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ColorPicker
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ColorPicker;

    /**
     * Decodes a ColorPicker message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ColorPicker
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ColorPicker;

    /**
     * Verifies a ColorPicker message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ColorPicker message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ColorPicker
     */
    public static fromObject(object: { [k: string]: any }): ColorPicker;

    /**
     * Creates a plain object from a ColorPicker message. Also converts values to other types if specified.
     * @param message ColorPicker
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ColorPicker, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ColorPicker to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ColorPicker
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for StringArray
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for DoubleArray
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for Int32Array
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for Int64Array
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a SInt64Array. */
export interface ISInt64Array {

    /** SInt64Array data */
    data?: ((number|Long)[]|null);
}

/** Represents a SInt64Array. */
export class SInt64Array implements ISInt64Array {

    /**
     * Constructs a new SInt64Array.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISInt64Array);

    /** SInt64Array data. */
    public data: (number|Long)[];

    /**
     * Creates a new SInt64Array instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SInt64Array instance
     */
    public static create(properties?: ISInt64Array): SInt64Array;

    /**
     * Encodes the specified SInt64Array message. Does not implicitly {@link SInt64Array.verify|verify} messages.
     * @param message SInt64Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISInt64Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SInt64Array message, length delimited. Does not implicitly {@link SInt64Array.verify|verify} messages.
     * @param message SInt64Array message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISInt64Array, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SInt64Array message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SInt64Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SInt64Array;

    /**
     * Decodes a SInt64Array message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SInt64Array
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SInt64Array;

    /**
     * Verifies a SInt64Array message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SInt64Array message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SInt64Array
     */
    public static fromObject(object: { [k: string]: any }): SInt64Array;

    /**
     * Creates a plain object from a SInt64Array message. Also converts values to other types if specified.
     * @param message SInt64Array
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SInt64Array, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SInt64Array to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SInt64Array
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for UInt32Array
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an UploadedFileInfo. */
export interface IUploadedFileInfo {

    /** UploadedFileInfo id */
    id?: (number|Long|null);

    /** UploadedFileInfo name */
    name?: (string|null);

    /** UploadedFileInfo size */
    size?: (number|null);
}

/** Represents an UploadedFileInfo. */
export class UploadedFileInfo implements IUploadedFileInfo {

    /**
     * Constructs a new UploadedFileInfo.
     * @param [properties] Properties to set
     */
    constructor(properties?: IUploadedFileInfo);

    /** UploadedFileInfo id. */
    public id: (number|Long);

    /** UploadedFileInfo name. */
    public name: string;

    /** UploadedFileInfo size. */
    public size: number;

    /**
     * Creates a new UploadedFileInfo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UploadedFileInfo instance
     */
    public static create(properties?: IUploadedFileInfo): UploadedFileInfo;

    /**
     * Encodes the specified UploadedFileInfo message. Does not implicitly {@link UploadedFileInfo.verify|verify} messages.
     * @param message UploadedFileInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IUploadedFileInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified UploadedFileInfo message, length delimited. Does not implicitly {@link UploadedFileInfo.verify|verify} messages.
     * @param message UploadedFileInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IUploadedFileInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an UploadedFileInfo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UploadedFileInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): UploadedFileInfo;

    /**
     * Decodes an UploadedFileInfo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UploadedFileInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): UploadedFileInfo;

    /**
     * Verifies an UploadedFileInfo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an UploadedFileInfo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UploadedFileInfo
     */
    public static fromObject(object: { [k: string]: any }): UploadedFileInfo;

    /**
     * Creates a plain object from an UploadedFileInfo message. Also converts values to other types if specified.
     * @param message UploadedFileInfo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: UploadedFileInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this UploadedFileInfo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UploadedFileInfo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a FileUploaderState. */
export interface IFileUploaderState {

    /** FileUploaderState maxFileId */
    maxFileId?: (number|Long|null);

    /** FileUploaderState uploadedFileInfo */
    uploadedFileInfo?: (IUploadedFileInfo[]|null);
}

/** Represents a FileUploaderState. */
export class FileUploaderState implements IFileUploaderState {

    /**
     * Constructs a new FileUploaderState.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFileUploaderState);

    /** FileUploaderState maxFileId. */
    public maxFileId: (number|Long);

    /** FileUploaderState uploadedFileInfo. */
    public uploadedFileInfo: IUploadedFileInfo[];

    /**
     * Creates a new FileUploaderState instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FileUploaderState instance
     */
    public static create(properties?: IFileUploaderState): FileUploaderState;

    /**
     * Encodes the specified FileUploaderState message. Does not implicitly {@link FileUploaderState.verify|verify} messages.
     * @param message FileUploaderState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFileUploaderState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified FileUploaderState message, length delimited. Does not implicitly {@link FileUploaderState.verify|verify} messages.
     * @param message FileUploaderState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFileUploaderState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a FileUploaderState message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FileUploaderState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): FileUploaderState;

    /**
     * Decodes a FileUploaderState message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FileUploaderState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): FileUploaderState;

    /**
     * Verifies a FileUploaderState message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a FileUploaderState message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FileUploaderState
     */
    public static fromObject(object: { [k: string]: any }): FileUploaderState;

    /**
     * Creates a plain object from a FileUploaderState message. Also converts values to other types if specified.
     * @param message FileUploaderState
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: FileUploaderState, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this FileUploaderState to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FileUploaderState
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a ComponentInstance. */
export interface IComponentInstance {

    /** ComponentInstance id */
    id?: (string|null);

    /** ComponentInstance jsonArgs */
    jsonArgs?: (string|null);

    /** ComponentInstance specialArgs */
    specialArgs?: (ISpecialArg[]|null);

    /** ComponentInstance componentName */
    componentName?: (string|null);

    /** ComponentInstance url */
    url?: (string|null);

    /** ComponentInstance formId */
    formId?: (string|null);
}

/** Represents a ComponentInstance. */
export class ComponentInstance implements IComponentInstance {

    /**
     * Constructs a new ComponentInstance.
     * @param [properties] Properties to set
     */
    constructor(properties?: IComponentInstance);

    /** ComponentInstance id. */
    public id: string;

    /** ComponentInstance jsonArgs. */
    public jsonArgs: string;

    /** ComponentInstance specialArgs. */
    public specialArgs: ISpecialArg[];

    /** ComponentInstance componentName. */
    public componentName: string;

    /** ComponentInstance url. */
    public url: string;

    /** ComponentInstance formId. */
    public formId: string;

    /**
     * Creates a new ComponentInstance instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ComponentInstance instance
     */
    public static create(properties?: IComponentInstance): ComponentInstance;

    /**
     * Encodes the specified ComponentInstance message. Does not implicitly {@link ComponentInstance.verify|verify} messages.
     * @param message ComponentInstance message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IComponentInstance, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ComponentInstance message, length delimited. Does not implicitly {@link ComponentInstance.verify|verify} messages.
     * @param message ComponentInstance message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IComponentInstance, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ComponentInstance message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ComponentInstance
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ComponentInstance;

    /**
     * Decodes a ComponentInstance message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ComponentInstance
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ComponentInstance;

    /**
     * Verifies a ComponentInstance message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ComponentInstance message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ComponentInstance
     */
    public static fromObject(object: { [k: string]: any }): ComponentInstance;

    /**
     * Creates a plain object from a ComponentInstance message. Also converts values to other types if specified.
     * @param message ComponentInstance
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ComponentInstance, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ComponentInstance to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ComponentInstance
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a SpecialArg. */
export interface ISpecialArg {

    /** SpecialArg key */
    key?: (string|null);

    /** SpecialArg arrowDataframe */
    arrowDataframe?: (IArrowDataframe|null);

    /** SpecialArg bytes */
    bytes?: (Uint8Array|null);
}

/** Represents a SpecialArg. */
export class SpecialArg implements ISpecialArg {

    /**
     * Constructs a new SpecialArg.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISpecialArg);

    /** SpecialArg key. */
    public key: string;

    /** SpecialArg arrowDataframe. */
    public arrowDataframe?: (IArrowDataframe|null);

    /** SpecialArg bytes. */
    public bytes?: (Uint8Array|null);

    /** SpecialArg value. */
    public value?: ("arrowDataframe"|"bytes");

    /**
     * Creates a new SpecialArg instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SpecialArg instance
     */
    public static create(properties?: ISpecialArg): SpecialArg;

    /**
     * Encodes the specified SpecialArg message. Does not implicitly {@link SpecialArg.verify|verify} messages.
     * @param message SpecialArg message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISpecialArg, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SpecialArg message, length delimited. Does not implicitly {@link SpecialArg.verify|verify} messages.
     * @param message SpecialArg message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISpecialArg, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SpecialArg message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SpecialArg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SpecialArg;

    /**
     * Decodes a SpecialArg message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SpecialArg
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SpecialArg;

    /**
     * Verifies a SpecialArg message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SpecialArg message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SpecialArg
     */
    public static fromObject(object: { [k: string]: any }): SpecialArg;

    /**
     * Creates a plain object from a SpecialArg message. Also converts values to other types if specified.
     * @param message SpecialArg
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SpecialArg, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SpecialArg to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SpecialArg
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an ArrowDataframe. */
export interface IArrowDataframe {

    /** ArrowDataframe data */
    data?: (IArrowTable|null);

    /** ArrowDataframe height */
    height?: (number|null);

    /** ArrowDataframe width */
    width?: (number|null);
}

/** Represents an ArrowDataframe. */
export class ArrowDataframe implements IArrowDataframe {

    /**
     * Constructs a new ArrowDataframe.
     * @param [properties] Properties to set
     */
    constructor(properties?: IArrowDataframe);

    /** ArrowDataframe data. */
    public data?: (IArrowTable|null);

    /** ArrowDataframe height. */
    public height: number;

    /** ArrowDataframe width. */
    public width: number;

    /**
     * Creates a new ArrowDataframe instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ArrowDataframe instance
     */
    public static create(properties?: IArrowDataframe): ArrowDataframe;

    /**
     * Encodes the specified ArrowDataframe message. Does not implicitly {@link ArrowDataframe.verify|verify} messages.
     * @param message ArrowDataframe message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IArrowDataframe, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ArrowDataframe message, length delimited. Does not implicitly {@link ArrowDataframe.verify|verify} messages.
     * @param message ArrowDataframe message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IArrowDataframe, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an ArrowDataframe message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ArrowDataframe
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ArrowDataframe;

    /**
     * Decodes an ArrowDataframe message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ArrowDataframe
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ArrowDataframe;

    /**
     * Verifies an ArrowDataframe message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an ArrowDataframe message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ArrowDataframe
     */
    public static fromObject(object: { [k: string]: any }): ArrowDataframe;

    /**
     * Creates a plain object from an ArrowDataframe message. Also converts values to other types if specified.
     * @param message ArrowDataframe
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ArrowDataframe, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ArrowDataframe to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ArrowDataframe
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an ArrowTable. */
export interface IArrowTable {

    /** ArrowTable data */
    data?: (Uint8Array|null);

    /** ArrowTable index */
    index?: (Uint8Array|null);

    /** ArrowTable columns */
    columns?: (Uint8Array|null);

    /** ArrowTable styler */
    styler?: (IArrowTableStyler|null);
}

/** Represents an ArrowTable. */
export class ArrowTable implements IArrowTable {

    /**
     * Constructs a new ArrowTable.
     * @param [properties] Properties to set
     */
    constructor(properties?: IArrowTable);

    /** ArrowTable data. */
    public data: Uint8Array;

    /** ArrowTable index. */
    public index: Uint8Array;

    /** ArrowTable columns. */
    public columns: Uint8Array;

    /** ArrowTable styler. */
    public styler?: (IArrowTableStyler|null);

    /**
     * Creates a new ArrowTable instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ArrowTable instance
     */
    public static create(properties?: IArrowTable): ArrowTable;

    /**
     * Encodes the specified ArrowTable message. Does not implicitly {@link ArrowTable.verify|verify} messages.
     * @param message ArrowTable message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IArrowTable, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ArrowTable message, length delimited. Does not implicitly {@link ArrowTable.verify|verify} messages.
     * @param message ArrowTable message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IArrowTable, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an ArrowTable message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ArrowTable
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ArrowTable;

    /**
     * Decodes an ArrowTable message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ArrowTable
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ArrowTable;

    /**
     * Verifies an ArrowTable message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an ArrowTable message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ArrowTable
     */
    public static fromObject(object: { [k: string]: any }): ArrowTable;

    /**
     * Creates a plain object from an ArrowTable message. Also converts values to other types if specified.
     * @param message ArrowTable
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ArrowTable, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ArrowTable to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ArrowTable
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an ArrowTableStyler. */
export interface IArrowTableStyler {

    /** ArrowTableStyler uuid */
    uuid?: (string|null);

    /** ArrowTableStyler caption */
    caption?: (string|null);

    /** ArrowTableStyler styles */
    styles?: (string|null);

    /** ArrowTableStyler displayValues */
    displayValues?: (Uint8Array|null);
}

/** Represents an ArrowTableStyler. */
export class ArrowTableStyler implements IArrowTableStyler {

    /**
     * Constructs a new ArrowTableStyler.
     * @param [properties] Properties to set
     */
    constructor(properties?: IArrowTableStyler);

    /** ArrowTableStyler uuid. */
    public uuid: string;

    /** ArrowTableStyler caption. */
    public caption: string;

    /** ArrowTableStyler styles. */
    public styles: string;

    /** ArrowTableStyler displayValues. */
    public displayValues: Uint8Array;

    /**
     * Creates a new ArrowTableStyler instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ArrowTableStyler instance
     */
    public static create(properties?: IArrowTableStyler): ArrowTableStyler;

    /**
     * Encodes the specified ArrowTableStyler message. Does not implicitly {@link ArrowTableStyler.verify|verify} messages.
     * @param message ArrowTableStyler message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IArrowTableStyler, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ArrowTableStyler message, length delimited. Does not implicitly {@link ArrowTableStyler.verify|verify} messages.
     * @param message ArrowTableStyler message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IArrowTableStyler, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an ArrowTableStyler message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ArrowTableStyler
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ArrowTableStyler;

    /**
     * Decodes an ArrowTableStyler message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ArrowTableStyler
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ArrowTableStyler;

    /**
     * Verifies an ArrowTableStyler message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an ArrowTableStyler message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ArrowTableStyler
     */
    public static fromObject(object: { [k: string]: any }): ArrowTableStyler;

    /**
     * Creates a plain object from an ArrowTableStyler message. Also converts values to other types if specified.
     * @param message ArrowTableStyler
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ArrowTableStyler, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ArrowTableStyler to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ArrowTableStyler
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for DataFrame
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for Index
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for PlainIndex
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for RangeIndex
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for MultiIndex
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a DatetimeIndex. */
export interface IDatetimeIndex {

    /** DatetimeIndex data */
    data?: (IStringArray|null);
}

/** Represents a DatetimeIndex. */
export class DatetimeIndex implements IDatetimeIndex {

    /**
     * Constructs a new DatetimeIndex.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDatetimeIndex);

    /** DatetimeIndex data. */
    public data?: (IStringArray|null);

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

    /**
     * Gets the default type url for DatetimeIndex
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for TimedeltaIndex
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for Int64Index
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for Float64Index
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for CSSStyle
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for CellStyle
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for CellStyleArray
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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
    datetimes?: (IStringArray|null);

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
    public datetimes?: (IStringArray|null);

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

    /**
     * Gets the default type url for AnyArray
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for Table
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /**
     * Gets the default type url for TableStyle
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a DateInput. */
export interface IDateInput {

    /** DateInput id */
    id?: (string|null);

    /** DateInput label */
    label?: (string|null);

    /** DateInput default */
    "default"?: (string[]|null);

    /** DateInput min */
    min?: (string|null);

    /** DateInput max */
    max?: (string|null);

    /** DateInput isRange */
    isRange?: (boolean|null);

    /** DateInput help */
    help?: (string|null);

    /** DateInput formId */
    formId?: (string|null);

    /** DateInput value */
    value?: (string[]|null);

    /** DateInput setValue */
    setValue?: (boolean|null);

    /** DateInput disabled */
    disabled?: (boolean|null);

    /** DateInput labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a DateInput. */
export class DateInput implements IDateInput {

    /**
     * Constructs a new DateInput.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDateInput);

    /** DateInput id. */
    public id: string;

    /** DateInput label. */
    public label: string;

    /** DateInput default. */
    public default: string[];

    /** DateInput min. */
    public min: string;

    /** DateInput max. */
    public max: string;

    /** DateInput isRange. */
    public isRange: boolean;

    /** DateInput help. */
    public help: string;

    /** DateInput formId. */
    public formId: string;

    /** DateInput value. */
    public value: string[];

    /** DateInput setValue. */
    public setValue: boolean;

    /** DateInput disabled. */
    public disabled: boolean;

    /** DateInput labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new DateInput instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DateInput instance
     */
    public static create(properties?: IDateInput): DateInput;

    /**
     * Encodes the specified DateInput message. Does not implicitly {@link DateInput.verify|verify} messages.
     * @param message DateInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDateInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DateInput message, length delimited. Does not implicitly {@link DateInput.verify|verify} messages.
     * @param message DateInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDateInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DateInput message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DateInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DateInput;

    /**
     * Decodes a DateInput message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DateInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DateInput;

    /**
     * Verifies a DateInput message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DateInput message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DateInput
     */
    public static fromObject(object: { [k: string]: any }): DateInput;

    /**
     * Creates a plain object from a DateInput message. Also converts values to other types if specified.
     * @param message DateInput
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DateInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DateInput to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DateInput
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a DeckGlJsonChart. */
export interface IDeckGlJsonChart {

    /** DeckGlJsonChart json */
    json?: (string|null);

    /** DeckGlJsonChart tooltip */
    tooltip?: (string|null);

    /** DeckGlJsonChart useContainerWidth */
    useContainerWidth?: (boolean|null);
}

/** Represents a DeckGlJsonChart. */
export class DeckGlJsonChart implements IDeckGlJsonChart {

    /**
     * Constructs a new DeckGlJsonChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDeckGlJsonChart);

    /** DeckGlJsonChart json. */
    public json: string;

    /** DeckGlJsonChart tooltip. */
    public tooltip: string;

    /** DeckGlJsonChart useContainerWidth. */
    public useContainerWidth: boolean;

    /**
     * Creates a new DeckGlJsonChart instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeckGlJsonChart instance
     */
    public static create(properties?: IDeckGlJsonChart): DeckGlJsonChart;

    /**
     * Encodes the specified DeckGlJsonChart message. Does not implicitly {@link DeckGlJsonChart.verify|verify} messages.
     * @param message DeckGlJsonChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDeckGlJsonChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DeckGlJsonChart message, length delimited. Does not implicitly {@link DeckGlJsonChart.verify|verify} messages.
     * @param message DeckGlJsonChart message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDeckGlJsonChart, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DeckGlJsonChart message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeckGlJsonChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DeckGlJsonChart;

    /**
     * Decodes a DeckGlJsonChart message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeckGlJsonChart
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DeckGlJsonChart;

    /**
     * Verifies a DeckGlJsonChart message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DeckGlJsonChart message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeckGlJsonChart
     */
    public static fromObject(object: { [k: string]: any }): DeckGlJsonChart;

    /**
     * Creates a plain object from a DeckGlJsonChart message. Also converts values to other types if specified.
     * @param message DeckGlJsonChart
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DeckGlJsonChart, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DeckGlJsonChart to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DeckGlJsonChart
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Delta. */
export interface IDelta {

    /** Delta newElement */
    newElement?: (IElement|null);

    /** Delta addBlock */
    addBlock?: (IBlock|null);

    /** Delta addRows */
    addRows?: (INamedDataSet|null);

    /** Delta arrowAddRows */
    arrowAddRows?: (IArrowNamedDataSet|null);
}

/** Represents a Delta. */
export class Delta implements IDelta {

    /**
     * Constructs a new Delta.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDelta);

    /** Delta newElement. */
    public newElement?: (IElement|null);

    /** Delta addBlock. */
    public addBlock?: (IBlock|null);

    /** Delta addRows. */
    public addRows?: (INamedDataSet|null);

    /** Delta arrowAddRows. */
    public arrowAddRows?: (IArrowNamedDataSet|null);

    /** Delta type. */
    public type?: ("newElement"|"addBlock"|"addRows"|"arrowAddRows");

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

    /**
     * Gets the default type url for Delta
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a DocString. */
export interface IDocString {

    /** DocString docString */
    docString?: (string|null);

    /** DocString type */
    type?: (string|null);

    /** DocString name */
    name?: (string|null);

    /** DocString value */
    value?: (string|null);

    /** DocString members */
    members?: (IMember[]|null);
}

/** Represents a DocString. */
export class DocString implements IDocString {

    /**
     * Constructs a new DocString.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDocString);

    /** DocString docString. */
    public docString: string;

    /** DocString type. */
    public type: string;

    /** DocString name. */
    public name: string;

    /** DocString value. */
    public value: string;

    /** DocString members. */
    public members: IMember[];

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

    /**
     * Gets the default type url for DocString
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Member. */
export interface IMember {

    /** Member name */
    name?: (string|null);

    /** Member type */
    type?: (string|null);

    /** Member value */
    value?: (string|null);

    /** Member docString */
    docString?: (string|null);
}

/** Represents a Member. */
export class Member implements IMember {

    /**
     * Constructs a new Member.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMember);

    /** Member name. */
    public name: string;

    /** Member type. */
    public type: string;

    /** Member value. */
    public value?: (string|null);

    /** Member docString. */
    public docString?: (string|null);

    /** Member contents. */
    public contents?: ("value"|"docString");

    /**
     * Creates a new Member instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Member instance
     */
    public static create(properties?: IMember): Member;

    /**
     * Encodes the specified Member message. Does not implicitly {@link Member.verify|verify} messages.
     * @param message Member message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMember, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Member message, length delimited. Does not implicitly {@link Member.verify|verify} messages.
     * @param message Member message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMember, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Member message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Member
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Member;

    /**
     * Decodes a Member message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Member
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Member;

    /**
     * Verifies a Member message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Member message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Member
     */
    public static fromObject(object: { [k: string]: any }): Member;

    /**
     * Creates a plain object from a Member message. Also converts values to other types if specified.
     * @param message Member
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Member, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Member to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Member
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a DownloadButton. */
export interface IDownloadButton {

    /** DownloadButton id */
    id?: (string|null);

    /** DownloadButton label */
    label?: (string|null);

    /** DownloadButton default */
    "default"?: (boolean|null);

    /** DownloadButton help */
    help?: (string|null);

    /** DownloadButton formId */
    formId?: (string|null);

    /** DownloadButton url */
    url?: (string|null);

    /** DownloadButton disabled */
    disabled?: (boolean|null);

    /** DownloadButton useContainerWidth */
    useContainerWidth?: (boolean|null);
}

/** Represents a DownloadButton. */
export class DownloadButton implements IDownloadButton {

    /**
     * Constructs a new DownloadButton.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDownloadButton);

    /** DownloadButton id. */
    public id: string;

    /** DownloadButton label. */
    public label: string;

    /** DownloadButton default. */
    public default: boolean;

    /** DownloadButton help. */
    public help: string;

    /** DownloadButton formId. */
    public formId: string;

    /** DownloadButton url. */
    public url: string;

    /** DownloadButton disabled. */
    public disabled: boolean;

    /** DownloadButton useContainerWidth. */
    public useContainerWidth: boolean;

    /**
     * Creates a new DownloadButton instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DownloadButton instance
     */
    public static create(properties?: IDownloadButton): DownloadButton;

    /**
     * Encodes the specified DownloadButton message. Does not implicitly {@link DownloadButton.verify|verify} messages.
     * @param message DownloadButton message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDownloadButton, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DownloadButton message, length delimited. Does not implicitly {@link DownloadButton.verify|verify} messages.
     * @param message DownloadButton message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDownloadButton, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DownloadButton message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DownloadButton
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DownloadButton;

    /**
     * Decodes a DownloadButton message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DownloadButton
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DownloadButton;

    /**
     * Verifies a DownloadButton message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DownloadButton message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DownloadButton
     */
    public static fromObject(object: { [k: string]: any }): DownloadButton;

    /**
     * Creates a plain object from a DownloadButton message. Also converts values to other types if specified.
     * @param message DownloadButton
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DownloadButton, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DownloadButton to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DownloadButton
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Element. */
export interface IElement {

    /** Element alert */
    alert?: (IAlert|null);

    /** Element arrowDataFrame */
    arrowDataFrame?: (IArrow|null);

    /** Element arrowTable */
    arrowTable?: (IArrow|null);

    /** Element arrowVegaLiteChart */
    arrowVegaLiteChart?: (IArrowVegaLiteChart|null);

    /** Element audio */
    audio?: (IAudio|null);

    /** Element balloons */
    balloons?: (IBalloons|null);

    /** Element bokehChart */
    bokehChart?: (IBokehChart|null);

    /** Element button */
    button?: (IButton|null);

    /** Element downloadButton */
    downloadButton?: (IDownloadButton|null);

    /** Element cameraInput */
    cameraInput?: (ICameraInput|null);

    /** Element checkbox */
    checkbox?: (ICheckbox|null);

    /** Element colorPicker */
    colorPicker?: (IColorPicker|null);

    /** Element componentInstance */
    componentInstance?: (IComponentInstance|null);

    /** Element dataFrame */
    dataFrame?: (IDataFrame|null);

    /** Element table */
    table?: (IDataFrame|null);

    /** Element dateInput */
    dateInput?: (IDateInput|null);

    /** Element deckGlJsonChart */
    deckGlJsonChart?: (IDeckGlJsonChart|null);

    /** Element docString */
    docString?: (IDocString|null);

    /** Element empty */
    empty?: (IEmpty|null);

    /** Element exception */
    exception?: (IException|null);

    /** Element favicon */
    favicon?: (IFavicon|null);

    /** Element fileUploader */
    fileUploader?: (IFileUploader|null);

    /** Element graphvizChart */
    graphvizChart?: (IGraphVizChart|null);

    /** Element iframe */
    iframe?: (IIFrame|null);

    /** Element imgs */
    imgs?: (IImageList|null);

    /** Element json */
    json?: (IJson|null);

    /** Element markdown */
    markdown?: (IMarkdown|null);

    /** Element metric */
    metric?: (IMetric|null);

    /** Element multiselect */
    multiselect?: (IMultiSelect|null);

    /** Element numberInput */
    numberInput?: (INumberInput|null);

    /** Element plotlyChart */
    plotlyChart?: (IPlotlyChart|null);

    /** Element progress */
    progress?: (IProgress|null);

    /** Element radio */
    radio?: (IRadio|null);

    /** Element selectbox */
    selectbox?: (ISelectbox|null);

    /** Element slider */
    slider?: (ISlider|null);

    /** Element snow */
    snow?: (ISnow|null);

    /** Element spinner */
    spinner?: (ISpinner|null);

    /** Element text */
    text?: (IText|null);

    /** Element textArea */
    textArea?: (ITextArea|null);

    /** Element textInput */
    textInput?: (ITextInput|null);

    /** Element timeInput */
    timeInput?: (ITimeInput|null);

    /** Element vegaLiteChart */
    vegaLiteChart?: (IVegaLiteChart|null);

    /** Element video */
    video?: (IVideo|null);

    /** Element heading */
    heading?: (IHeading|null);

    /** Element code */
    code?: (ICode|null);
}

/** Represents an Element. */
export class Element implements IElement {

    /**
     * Constructs a new Element.
     * @param [properties] Properties to set
     */
    constructor(properties?: IElement);

    /** Element alert. */
    public alert?: (IAlert|null);

    /** Element arrowDataFrame. */
    public arrowDataFrame?: (IArrow|null);

    /** Element arrowTable. */
    public arrowTable?: (IArrow|null);

    /** Element arrowVegaLiteChart. */
    public arrowVegaLiteChart?: (IArrowVegaLiteChart|null);

    /** Element audio. */
    public audio?: (IAudio|null);

    /** Element balloons. */
    public balloons?: (IBalloons|null);

    /** Element bokehChart. */
    public bokehChart?: (IBokehChart|null);

    /** Element button. */
    public button?: (IButton|null);

    /** Element downloadButton. */
    public downloadButton?: (IDownloadButton|null);

    /** Element cameraInput. */
    public cameraInput?: (ICameraInput|null);

    /** Element checkbox. */
    public checkbox?: (ICheckbox|null);

    /** Element colorPicker. */
    public colorPicker?: (IColorPicker|null);

    /** Element componentInstance. */
    public componentInstance?: (IComponentInstance|null);

    /** Element dataFrame. */
    public dataFrame?: (IDataFrame|null);

    /** Element table. */
    public table?: (IDataFrame|null);

    /** Element dateInput. */
    public dateInput?: (IDateInput|null);

    /** Element deckGlJsonChart. */
    public deckGlJsonChart?: (IDeckGlJsonChart|null);

    /** Element docString. */
    public docString?: (IDocString|null);

    /** Element empty. */
    public empty?: (IEmpty|null);

    /** Element exception. */
    public exception?: (IException|null);

    /** Element favicon. */
    public favicon?: (IFavicon|null);

    /** Element fileUploader. */
    public fileUploader?: (IFileUploader|null);

    /** Element graphvizChart. */
    public graphvizChart?: (IGraphVizChart|null);

    /** Element iframe. */
    public iframe?: (IIFrame|null);

    /** Element imgs. */
    public imgs?: (IImageList|null);

    /** Element json. */
    public json?: (IJson|null);

    /** Element markdown. */
    public markdown?: (IMarkdown|null);

    /** Element metric. */
    public metric?: (IMetric|null);

    /** Element multiselect. */
    public multiselect?: (IMultiSelect|null);

    /** Element numberInput. */
    public numberInput?: (INumberInput|null);

    /** Element plotlyChart. */
    public plotlyChart?: (IPlotlyChart|null);

    /** Element progress. */
    public progress?: (IProgress|null);

    /** Element radio. */
    public radio?: (IRadio|null);

    /** Element selectbox. */
    public selectbox?: (ISelectbox|null);

    /** Element slider. */
    public slider?: (ISlider|null);

    /** Element snow. */
    public snow?: (ISnow|null);

    /** Element spinner. */
    public spinner?: (ISpinner|null);

    /** Element text. */
    public text?: (IText|null);

    /** Element textArea. */
    public textArea?: (ITextArea|null);

    /** Element textInput. */
    public textInput?: (ITextInput|null);

    /** Element timeInput. */
    public timeInput?: (ITimeInput|null);

    /** Element vegaLiteChart. */
    public vegaLiteChart?: (IVegaLiteChart|null);

    /** Element video. */
    public video?: (IVideo|null);

    /** Element heading. */
    public heading?: (IHeading|null);

    /** Element code. */
    public code?: (ICode|null);

    /** Element type. */
    public type?: ("alert"|"arrowDataFrame"|"arrowTable"|"arrowVegaLiteChart"|"audio"|"balloons"|"bokehChart"|"button"|"downloadButton"|"cameraInput"|"checkbox"|"colorPicker"|"componentInstance"|"dataFrame"|"table"|"dateInput"|"deckGlJsonChart"|"docString"|"empty"|"exception"|"favicon"|"fileUploader"|"graphvizChart"|"iframe"|"imgs"|"json"|"markdown"|"metric"|"multiselect"|"numberInput"|"plotlyChart"|"progress"|"radio"|"selectbox"|"slider"|"snow"|"spinner"|"text"|"textArea"|"textInput"|"timeInput"|"vegaLiteChart"|"video"|"heading"|"code");

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

    /**
     * Gets the default type url for Element
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Empty. */
export interface IEmpty {
}

/** Represents an Empty. */
export class Empty implements IEmpty {

    /**
     * Constructs a new Empty.
     * @param [properties] Properties to set
     */
    constructor(properties?: IEmpty);

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

    /**
     * Gets the default type url for Empty
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Exception. */
export interface IException {

    /** Exception type */
    type?: (string|null);

    /** Exception message */
    message?: (string|null);

    /** Exception messageIsMarkdown */
    messageIsMarkdown?: (boolean|null);

    /** Exception stackTrace */
    stackTrace?: (string[]|null);

    /** Exception isWarning */
    isWarning?: (boolean|null);
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

    /** Exception messageIsMarkdown. */
    public messageIsMarkdown: boolean;

    /** Exception stackTrace. */
    public stackTrace: string[];

    /** Exception isWarning. */
    public isWarning: boolean;

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

    /**
     * Gets the default type url for Exception
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Favicon. */
export interface IFavicon {

    /** Favicon url */
    url?: (string|null);
}

/** Represents a Favicon. */
export class Favicon implements IFavicon {

    /**
     * Constructs a new Favicon.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFavicon);

    /** Favicon url. */
    public url: string;

    /**
     * Creates a new Favicon instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Favicon instance
     */
    public static create(properties?: IFavicon): Favicon;

    /**
     * Encodes the specified Favicon message. Does not implicitly {@link Favicon.verify|verify} messages.
     * @param message Favicon message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFavicon, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Favicon message, length delimited. Does not implicitly {@link Favicon.verify|verify} messages.
     * @param message Favicon message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFavicon, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Favicon message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Favicon
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Favicon;

    /**
     * Decodes a Favicon message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Favicon
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Favicon;

    /**
     * Verifies a Favicon message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Favicon message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Favicon
     */
    public static fromObject(object: { [k: string]: any }): Favicon;

    /**
     * Creates a plain object from a Favicon message. Also converts values to other types if specified.
     * @param message Favicon
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Favicon, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Favicon to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Favicon
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a FileUploader. */
export interface IFileUploader {

    /** FileUploader id */
    id?: (string|null);

    /** FileUploader label */
    label?: (string|null);

    /** FileUploader type */
    type?: (string[]|null);

    /** FileUploader maxUploadSizeMb */
    maxUploadSizeMb?: (number|null);

    /** FileUploader multipleFiles */
    multipleFiles?: (boolean|null);

    /** FileUploader help */
    help?: (string|null);

    /** FileUploader formId */
    formId?: (string|null);

    /** FileUploader disabled */
    disabled?: (boolean|null);

    /** FileUploader labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a FileUploader. */
export class FileUploader implements IFileUploader {

    /**
     * Constructs a new FileUploader.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFileUploader);

    /** FileUploader id. */
    public id: string;

    /** FileUploader label. */
    public label: string;

    /** FileUploader type. */
    public type: string[];

    /** FileUploader maxUploadSizeMb. */
    public maxUploadSizeMb: number;

    /** FileUploader multipleFiles. */
    public multipleFiles: boolean;

    /** FileUploader help. */
    public help: string;

    /** FileUploader formId. */
    public formId: string;

    /** FileUploader disabled. */
    public disabled: boolean;

    /** FileUploader labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new FileUploader instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FileUploader instance
     */
    public static create(properties?: IFileUploader): FileUploader;

    /**
     * Encodes the specified FileUploader message. Does not implicitly {@link FileUploader.verify|verify} messages.
     * @param message FileUploader message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFileUploader, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified FileUploader message, length delimited. Does not implicitly {@link FileUploader.verify|verify} messages.
     * @param message FileUploader message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFileUploader, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a FileUploader message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FileUploader
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): FileUploader;

    /**
     * Decodes a FileUploader message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FileUploader
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): FileUploader;

    /**
     * Verifies a FileUploader message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a FileUploader message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FileUploader
     */
    public static fromObject(object: { [k: string]: any }): FileUploader;

    /**
     * Creates a plain object from a FileUploader message. Also converts values to other types if specified.
     * @param message FileUploader
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: FileUploader, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this FileUploader to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FileUploader
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a ForwardMsg. */
export interface IForwardMsg {

    /** ForwardMsg hash */
    hash?: (string|null);

    /** ForwardMsg metadata */
    metadata?: (IForwardMsgMetadata|null);

    /** ForwardMsg newSession */
    newSession?: (INewSession|null);

    /** ForwardMsg delta */
    delta?: (IDelta|null);

    /** ForwardMsg pageInfoChanged */
    pageInfoChanged?: (IPageInfo|null);

    /** ForwardMsg pageConfigChanged */
    pageConfigChanged?: (IPageConfig|null);

    /** ForwardMsg scriptFinished */
    scriptFinished?: (ForwardMsg.ScriptFinishedStatus|null);

    /** ForwardMsg gitInfoChanged */
    gitInfoChanged?: (IGitInfo|null);

    /** ForwardMsg pageProfile */
    pageProfile?: (IPageProfile|null);

    /** ForwardMsg sessionStatusChanged */
    sessionStatusChanged?: (ISessionStatus|null);

    /** ForwardMsg sessionEvent */
    sessionEvent?: (ISessionEvent|null);

    /** ForwardMsg pageNotFound */
    pageNotFound?: (IPageNotFound|null);

    /** ForwardMsg pagesChanged */
    pagesChanged?: (IPagesChanged|null);

    /** ForwardMsg refHash */
    refHash?: (string|null);

    /** ForwardMsg debugLastBackmsgId */
    debugLastBackmsgId?: (string|null);
}

/** Represents a ForwardMsg. */
export class ForwardMsg implements IForwardMsg {

    /**
     * Constructs a new ForwardMsg.
     * @param [properties] Properties to set
     */
    constructor(properties?: IForwardMsg);

    /** ForwardMsg hash. */
    public hash: string;

    /** ForwardMsg metadata. */
    public metadata?: (IForwardMsgMetadata|null);

    /** ForwardMsg newSession. */
    public newSession?: (INewSession|null);

    /** ForwardMsg delta. */
    public delta?: (IDelta|null);

    /** ForwardMsg pageInfoChanged. */
    public pageInfoChanged?: (IPageInfo|null);

    /** ForwardMsg pageConfigChanged. */
    public pageConfigChanged?: (IPageConfig|null);

    /** ForwardMsg scriptFinished. */
    public scriptFinished?: (ForwardMsg.ScriptFinishedStatus|null);

    /** ForwardMsg gitInfoChanged. */
    public gitInfoChanged?: (IGitInfo|null);

    /** ForwardMsg pageProfile. */
    public pageProfile?: (IPageProfile|null);

    /** ForwardMsg sessionStatusChanged. */
    public sessionStatusChanged?: (ISessionStatus|null);

    /** ForwardMsg sessionEvent. */
    public sessionEvent?: (ISessionEvent|null);

    /** ForwardMsg pageNotFound. */
    public pageNotFound?: (IPageNotFound|null);

    /** ForwardMsg pagesChanged. */
    public pagesChanged?: (IPagesChanged|null);

    /** ForwardMsg refHash. */
    public refHash?: (string|null);

    /** ForwardMsg debugLastBackmsgId. */
    public debugLastBackmsgId: string;

    /** ForwardMsg type. */
    public type?: ("newSession"|"delta"|"pageInfoChanged"|"pageConfigChanged"|"scriptFinished"|"gitInfoChanged"|"pageProfile"|"sessionStatusChanged"|"sessionEvent"|"pageNotFound"|"pagesChanged"|"refHash");

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

    /**
     * Gets the default type url for ForwardMsg
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace ForwardMsg {

    /** ScriptFinishedStatus enum. */
    enum ScriptFinishedStatus {
        FINISHED_SUCCESSFULLY = 0,
        FINISHED_WITH_COMPILE_ERROR = 1,
        FINISHED_EARLY_FOR_RERUN = 2
    }
}

/** Properties of a ForwardMsgMetadata. */
export interface IForwardMsgMetadata {

    /** ForwardMsgMetadata cacheable */
    cacheable?: (boolean|null);

    /** ForwardMsgMetadata deltaPath */
    deltaPath?: (number[]|null);

    /** ForwardMsgMetadata elementDimensionSpec */
    elementDimensionSpec?: (IElementDimensionSpec|null);
}

/** Represents a ForwardMsgMetadata. */
export class ForwardMsgMetadata implements IForwardMsgMetadata {

    /**
     * Constructs a new ForwardMsgMetadata.
     * @param [properties] Properties to set
     */
    constructor(properties?: IForwardMsgMetadata);

    /** ForwardMsgMetadata cacheable. */
    public cacheable: boolean;

    /** ForwardMsgMetadata deltaPath. */
    public deltaPath: number[];

    /** ForwardMsgMetadata elementDimensionSpec. */
    public elementDimensionSpec?: (IElementDimensionSpec|null);

    /**
     * Creates a new ForwardMsgMetadata instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ForwardMsgMetadata instance
     */
    public static create(properties?: IForwardMsgMetadata): ForwardMsgMetadata;

    /**
     * Encodes the specified ForwardMsgMetadata message. Does not implicitly {@link ForwardMsgMetadata.verify|verify} messages.
     * @param message ForwardMsgMetadata message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IForwardMsgMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ForwardMsgMetadata message, length delimited. Does not implicitly {@link ForwardMsgMetadata.verify|verify} messages.
     * @param message ForwardMsgMetadata message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IForwardMsgMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ForwardMsgMetadata message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ForwardMsgMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ForwardMsgMetadata;

    /**
     * Decodes a ForwardMsgMetadata message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ForwardMsgMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ForwardMsgMetadata;

    /**
     * Verifies a ForwardMsgMetadata message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ForwardMsgMetadata message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ForwardMsgMetadata
     */
    public static fromObject(object: { [k: string]: any }): ForwardMsgMetadata;

    /**
     * Creates a plain object from a ForwardMsgMetadata message. Also converts values to other types if specified.
     * @param message ForwardMsgMetadata
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ForwardMsgMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ForwardMsgMetadata to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ForwardMsgMetadata
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an ElementDimensionSpec. */
export interface IElementDimensionSpec {

    /** ElementDimensionSpec width */
    width?: (number|null);

    /** ElementDimensionSpec height */
    height?: (number|null);
}

/** Represents an ElementDimensionSpec. */
export class ElementDimensionSpec implements IElementDimensionSpec {

    /**
     * Constructs a new ElementDimensionSpec.
     * @param [properties] Properties to set
     */
    constructor(properties?: IElementDimensionSpec);

    /** ElementDimensionSpec width. */
    public width: number;

    /** ElementDimensionSpec height. */
    public height: number;

    /**
     * Creates a new ElementDimensionSpec instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ElementDimensionSpec instance
     */
    public static create(properties?: IElementDimensionSpec): ElementDimensionSpec;

    /**
     * Encodes the specified ElementDimensionSpec message. Does not implicitly {@link ElementDimensionSpec.verify|verify} messages.
     * @param message ElementDimensionSpec message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IElementDimensionSpec, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ElementDimensionSpec message, length delimited. Does not implicitly {@link ElementDimensionSpec.verify|verify} messages.
     * @param message ElementDimensionSpec message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IElementDimensionSpec, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an ElementDimensionSpec message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ElementDimensionSpec
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ElementDimensionSpec;

    /**
     * Decodes an ElementDimensionSpec message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ElementDimensionSpec
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ElementDimensionSpec;

    /**
     * Verifies an ElementDimensionSpec message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an ElementDimensionSpec message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ElementDimensionSpec
     */
    public static fromObject(object: { [k: string]: any }): ElementDimensionSpec;

    /**
     * Creates a plain object from an ElementDimensionSpec message. Also converts values to other types if specified.
     * @param message ElementDimensionSpec
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ElementDimensionSpec, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ElementDimensionSpec to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ElementDimensionSpec
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a GitInfo. */
export interface IGitInfo {

    /** GitInfo repository */
    repository?: (string|null);

    /** GitInfo branch */
    branch?: (string|null);

    /** GitInfo module */
    module?: (string|null);

    /** GitInfo untrackedFiles */
    untrackedFiles?: (string[]|null);

    /** GitInfo uncommittedFiles */
    uncommittedFiles?: (string[]|null);

    /** GitInfo state */
    state?: (GitInfo.GitStates|null);
}

/** Represents a GitInfo. */
export class GitInfo implements IGitInfo {

    /**
     * Constructs a new GitInfo.
     * @param [properties] Properties to set
     */
    constructor(properties?: IGitInfo);

    /** GitInfo repository. */
    public repository: string;

    /** GitInfo branch. */
    public branch: string;

    /** GitInfo module. */
    public module: string;

    /** GitInfo untrackedFiles. */
    public untrackedFiles: string[];

    /** GitInfo uncommittedFiles. */
    public uncommittedFiles: string[];

    /** GitInfo state. */
    public state: GitInfo.GitStates;

    /**
     * Creates a new GitInfo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GitInfo instance
     */
    public static create(properties?: IGitInfo): GitInfo;

    /**
     * Encodes the specified GitInfo message. Does not implicitly {@link GitInfo.verify|verify} messages.
     * @param message GitInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IGitInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified GitInfo message, length delimited. Does not implicitly {@link GitInfo.verify|verify} messages.
     * @param message GitInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IGitInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a GitInfo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GitInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): GitInfo;

    /**
     * Decodes a GitInfo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GitInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): GitInfo;

    /**
     * Verifies a GitInfo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a GitInfo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GitInfo
     */
    public static fromObject(object: { [k: string]: any }): GitInfo;

    /**
     * Creates a plain object from a GitInfo message. Also converts values to other types if specified.
     * @param message GitInfo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: GitInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this GitInfo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GitInfo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace GitInfo {

    /** GitStates enum. */
    enum GitStates {
        DEFAULT = 0,
        HEAD_DETACHED = 1,
        AHEAD_OF_REMOTE = 2
    }
}

/** Properties of a GraphVizChart. */
export interface IGraphVizChart {

    /** GraphVizChart spec */
    spec?: (string|null);

    /** GraphVizChart useContainerWidth */
    useContainerWidth?: (boolean|null);

    /** GraphVizChart elementId */
    elementId?: (string|null);
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

    /** GraphVizChart useContainerWidth. */
    public useContainerWidth: boolean;

    /** GraphVizChart elementId. */
    public elementId: string;

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

    /**
     * Gets the default type url for GraphVizChart
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Heading. */
export interface IHeading {

    /** Heading tag */
    tag?: (string|null);

    /** Heading anchor */
    anchor?: (string|null);

    /** Heading body */
    body?: (string|null);

    /** Heading help */
    help?: (string|null);

    /** Heading hideAnchor */
    hideAnchor?: (boolean|null);
}

/** Represents a Heading. */
export class Heading implements IHeading {

    /**
     * Constructs a new Heading.
     * @param [properties] Properties to set
     */
    constructor(properties?: IHeading);

    /** Heading tag. */
    public tag: string;

    /** Heading anchor. */
    public anchor: string;

    /** Heading body. */
    public body: string;

    /** Heading help. */
    public help: string;

    /** Heading hideAnchor. */
    public hideAnchor: boolean;

    /**
     * Creates a new Heading instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Heading instance
     */
    public static create(properties?: IHeading): Heading;

    /**
     * Encodes the specified Heading message. Does not implicitly {@link Heading.verify|verify} messages.
     * @param message Heading message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IHeading, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Heading message, length delimited. Does not implicitly {@link Heading.verify|verify} messages.
     * @param message Heading message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IHeading, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Heading message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Heading
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Heading;

    /**
     * Decodes a Heading message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Heading
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Heading;

    /**
     * Verifies a Heading message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Heading message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Heading
     */
    public static fromObject(object: { [k: string]: any }): Heading;

    /**
     * Creates a plain object from a Heading message. Also converts values to other types if specified.
     * @param message Heading
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Heading, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Heading to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Heading
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a IFrame. */
export interface IIFrame {

    /** IFrame src */
    src?: (string|null);

    /** IFrame srcdoc */
    srcdoc?: (string|null);

    /** IFrame width */
    width?: (number|null);

    /** IFrame hasWidth */
    hasWidth?: (boolean|null);

    /** IFrame height */
    height?: (number|null);

    /** IFrame scrolling */
    scrolling?: (boolean|null);
}

/** Represents a IFrame. */
export class IFrame implements IIFrame {

    /**
     * Constructs a new IFrame.
     * @param [properties] Properties to set
     */
    constructor(properties?: IIFrame);

    /** IFrame src. */
    public src?: (string|null);

    /** IFrame srcdoc. */
    public srcdoc?: (string|null);

    /** IFrame width. */
    public width: number;

    /** IFrame hasWidth. */
    public hasWidth: boolean;

    /** IFrame height. */
    public height: number;

    /** IFrame scrolling. */
    public scrolling: boolean;

    /** IFrame type. */
    public type?: ("src"|"srcdoc");

    /**
     * Creates a new IFrame instance using the specified properties.
     * @param [properties] Properties to set
     * @returns IFrame instance
     */
    public static create(properties?: IIFrame): IFrame;

    /**
     * Encodes the specified IFrame message. Does not implicitly {@link IFrame.verify|verify} messages.
     * @param message IFrame message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IIFrame, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified IFrame message, length delimited. Does not implicitly {@link IFrame.verify|verify} messages.
     * @param message IFrame message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IIFrame, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a IFrame message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns IFrame
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): IFrame;

    /**
     * Decodes a IFrame message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns IFrame
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): IFrame;

    /**
     * Verifies a IFrame message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a IFrame message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns IFrame
     */
    public static fromObject(object: { [k: string]: any }): IFrame;

    /**
     * Creates a plain object from a IFrame message. Also converts values to other types if specified.
     * @param message IFrame
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: IFrame, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this IFrame to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for IFrame
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Image. */
export interface IImage {

    /** Image markup */
    markup?: (string|null);

    /** Image url */
    url?: (string|null);

    /** Image caption */
    caption?: (string|null);
}

/** Represents an Image. */
export class Image implements IImage {

    /**
     * Constructs a new Image.
     * @param [properties] Properties to set
     */
    constructor(properties?: IImage);

    /** Image markup. */
    public markup: string;

    /** Image url. */
    public url: string;

    /** Image caption. */
    public caption: string;

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

    /**
     * Gets the default type url for Image
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an ImageList. */
export interface IImageList {

    /** ImageList imgs */
    imgs?: (IImage[]|null);

    /** ImageList width */
    width?: (number|null);
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

    /**
     * Gets the default type url for ImageList
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Json. */
export interface IJson {

    /** Json body */
    body?: (string|null);

    /** Json expanded */
    expanded?: (boolean|null);
}

/** Represents a Json. */
export class Json implements IJson {

    /**
     * Constructs a new Json.
     * @param [properties] Properties to set
     */
    constructor(properties?: IJson);

    /** Json body. */
    public body: string;

    /** Json expanded. */
    public expanded: boolean;

    /**
     * Creates a new Json instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Json instance
     */
    public static create(properties?: IJson): Json;

    /**
     * Encodes the specified Json message. Does not implicitly {@link Json.verify|verify} messages.
     * @param message Json message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IJson, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Json message, length delimited. Does not implicitly {@link Json.verify|verify} messages.
     * @param message Json message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IJson, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Json message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Json
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Json;

    /**
     * Decodes a Json message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Json
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Json;

    /**
     * Verifies a Json message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Json message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Json
     */
    public static fromObject(object: { [k: string]: any }): Json;

    /**
     * Creates a plain object from a Json message. Also converts values to other types if specified.
     * @param message Json
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Json, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Json to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Json
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a LabelVisibilityMessage. */
export interface ILabelVisibilityMessage {

    /** LabelVisibilityMessage value */
    value?: (LabelVisibilityMessage.LabelVisibilityOptions|null);
}

/** Represents a LabelVisibilityMessage. */
export class LabelVisibilityMessage implements ILabelVisibilityMessage {

    /**
     * Constructs a new LabelVisibilityMessage.
     * @param [properties] Properties to set
     */
    constructor(properties?: ILabelVisibilityMessage);

    /** LabelVisibilityMessage value. */
    public value: LabelVisibilityMessage.LabelVisibilityOptions;

    /**
     * Creates a new LabelVisibilityMessage instance using the specified properties.
     * @param [properties] Properties to set
     * @returns LabelVisibilityMessage instance
     */
    public static create(properties?: ILabelVisibilityMessage): LabelVisibilityMessage;

    /**
     * Encodes the specified LabelVisibilityMessage message. Does not implicitly {@link LabelVisibilityMessage.verify|verify} messages.
     * @param message LabelVisibilityMessage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ILabelVisibilityMessage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified LabelVisibilityMessage message, length delimited. Does not implicitly {@link LabelVisibilityMessage.verify|verify} messages.
     * @param message LabelVisibilityMessage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ILabelVisibilityMessage, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a LabelVisibilityMessage message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns LabelVisibilityMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): LabelVisibilityMessage;

    /**
     * Decodes a LabelVisibilityMessage message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns LabelVisibilityMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): LabelVisibilityMessage;

    /**
     * Verifies a LabelVisibilityMessage message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a LabelVisibilityMessage message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns LabelVisibilityMessage
     */
    public static fromObject(object: { [k: string]: any }): LabelVisibilityMessage;

    /**
     * Creates a plain object from a LabelVisibilityMessage message. Also converts values to other types if specified.
     * @param message LabelVisibilityMessage
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: LabelVisibilityMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this LabelVisibilityMessage to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for LabelVisibilityMessage
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace LabelVisibilityMessage {

    /** LabelVisibilityOptions enum. */
    enum LabelVisibilityOptions {
        VISIBLE = 0,
        HIDDEN = 1,
        COLLAPSED = 2
    }
}

/** Properties of a Markdown. */
export interface IMarkdown {

    /** Markdown body */
    body?: (string|null);

    /** Markdown allowHtml */
    allowHtml?: (boolean|null);

    /** Markdown isCaption */
    isCaption?: (boolean|null);

    /** Markdown elementType */
    elementType?: (Markdown.Type|null);

    /** Markdown help */
    help?: (string|null);
}

/** Represents a Markdown. */
export class Markdown implements IMarkdown {

    /**
     * Constructs a new Markdown.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMarkdown);

    /** Markdown body. */
    public body: string;

    /** Markdown allowHtml. */
    public allowHtml: boolean;

    /** Markdown isCaption. */
    public isCaption: boolean;

    /** Markdown elementType. */
    public elementType: Markdown.Type;

    /** Markdown help. */
    public help: string;

    /**
     * Creates a new Markdown instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Markdown instance
     */
    public static create(properties?: IMarkdown): Markdown;

    /**
     * Encodes the specified Markdown message. Does not implicitly {@link Markdown.verify|verify} messages.
     * @param message Markdown message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMarkdown, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Markdown message, length delimited. Does not implicitly {@link Markdown.verify|verify} messages.
     * @param message Markdown message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMarkdown, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Markdown message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Markdown
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Markdown;

    /**
     * Decodes a Markdown message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Markdown
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Markdown;

    /**
     * Verifies a Markdown message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Markdown message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Markdown
     */
    public static fromObject(object: { [k: string]: any }): Markdown;

    /**
     * Creates a plain object from a Markdown message. Also converts values to other types if specified.
     * @param message Markdown
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Markdown, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Markdown to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Markdown
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Markdown {

    /** Type enum. */
    enum Type {
        UNSPECIFIED = 0,
        NATIVE = 1,
        CAPTION = 2,
        CODE = 3,
        LATEX = 4,
        DIVIDER = 5
    }
}

/** Properties of a Metric. */
export interface IMetric {

    /** Metric label */
    label?: (string|null);

    /** Metric body */
    body?: (string|null);

    /** Metric delta */
    delta?: (string|null);

    /** Metric direction */
    direction?: (Metric.MetricDirection|null);

    /** Metric color */
    color?: (Metric.MetricColor|null);

    /** Metric help */
    help?: (string|null);

    /** Metric labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a Metric. */
export class Metric implements IMetric {

    /**
     * Constructs a new Metric.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMetric);

    /** Metric label. */
    public label: string;

    /** Metric body. */
    public body: string;

    /** Metric delta. */
    public delta: string;

    /** Metric direction. */
    public direction: Metric.MetricDirection;

    /** Metric color. */
    public color: Metric.MetricColor;

    /** Metric help. */
    public help: string;

    /** Metric labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new Metric instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Metric instance
     */
    public static create(properties?: IMetric): Metric;

    /**
     * Encodes the specified Metric message. Does not implicitly {@link Metric.verify|verify} messages.
     * @param message Metric message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMetric, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Metric message, length delimited. Does not implicitly {@link Metric.verify|verify} messages.
     * @param message Metric message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMetric, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Metric message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Metric
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Metric;

    /**
     * Decodes a Metric message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Metric
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Metric;

    /**
     * Verifies a Metric message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Metric message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Metric
     */
    public static fromObject(object: { [k: string]: any }): Metric;

    /**
     * Creates a plain object from a Metric message. Also converts values to other types if specified.
     * @param message Metric
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Metric, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Metric to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Metric
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Metric {

    /** MetricColor enum. */
    enum MetricColor {
        RED = 0,
        GREEN = 1,
        GRAY = 2
    }

    /** MetricDirection enum. */
    enum MetricDirection {
        DOWN = 0,
        UP = 1,
        NONE = 2
    }
}

/** Properties of a MultiSelect. */
export interface IMultiSelect {

    /** MultiSelect id */
    id?: (string|null);

    /** MultiSelect label */
    label?: (string|null);

    /** MultiSelect default */
    "default"?: (number[]|null);

    /** MultiSelect options */
    options?: (string[]|null);

    /** MultiSelect help */
    help?: (string|null);

    /** MultiSelect formId */
    formId?: (string|null);

    /** MultiSelect value */
    value?: (number[]|null);

    /** MultiSelect setValue */
    setValue?: (boolean|null);

    /** MultiSelect disabled */
    disabled?: (boolean|null);

    /** MultiSelect labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);

    /** MultiSelect maxSelections */
    maxSelections?: (number|null);
}

/** Represents a MultiSelect. */
export class MultiSelect implements IMultiSelect {

    /**
     * Constructs a new MultiSelect.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMultiSelect);

    /** MultiSelect id. */
    public id: string;

    /** MultiSelect label. */
    public label: string;

    /** MultiSelect default. */
    public default: number[];

    /** MultiSelect options. */
    public options: string[];

    /** MultiSelect help. */
    public help: string;

    /** MultiSelect formId. */
    public formId: string;

    /** MultiSelect value. */
    public value: number[];

    /** MultiSelect setValue. */
    public setValue: boolean;

    /** MultiSelect disabled. */
    public disabled: boolean;

    /** MultiSelect labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /** MultiSelect maxSelections. */
    public maxSelections: number;

    /**
     * Creates a new MultiSelect instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MultiSelect instance
     */
    public static create(properties?: IMultiSelect): MultiSelect;

    /**
     * Encodes the specified MultiSelect message. Does not implicitly {@link MultiSelect.verify|verify} messages.
     * @param message MultiSelect message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMultiSelect, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified MultiSelect message, length delimited. Does not implicitly {@link MultiSelect.verify|verify} messages.
     * @param message MultiSelect message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMultiSelect, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a MultiSelect message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MultiSelect
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MultiSelect;

    /**
     * Decodes a MultiSelect message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MultiSelect
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MultiSelect;

    /**
     * Verifies a MultiSelect message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a MultiSelect message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MultiSelect
     */
    public static fromObject(object: { [k: string]: any }): MultiSelect;

    /**
     * Creates a plain object from a MultiSelect message. Also converts values to other types if specified.
     * @param message MultiSelect
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: MultiSelect, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this MultiSelect to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MultiSelect
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a NamedDataSet. */
export interface INamedDataSet {

    /** NamedDataSet name */
    name?: (string|null);

    /** NamedDataSet hasName */
    hasName?: (boolean|null);

    /** NamedDataSet data */
    data?: (IDataFrame|null);
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

    /**
     * Gets the default type url for NamedDataSet
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a NewSession. */
export interface INewSession {

    /** NewSession initialize */
    initialize?: (IInitialize|null);

    /** NewSession scriptRunId */
    scriptRunId?: (string|null);

    /** NewSession name */
    name?: (string|null);

    /** NewSession mainScriptPath */
    mainScriptPath?: (string|null);

    /** NewSession config */
    config?: (IConfig|null);

    /** NewSession customTheme */
    customTheme?: (ICustomThemeConfig|null);

    /** NewSession appPages */
    appPages?: (IAppPage[]|null);

    /** NewSession pageScriptHash */
    pageScriptHash?: (string|null);
}

/** Represents a NewSession. */
export class NewSession implements INewSession {

    /**
     * Constructs a new NewSession.
     * @param [properties] Properties to set
     */
    constructor(properties?: INewSession);

    /** NewSession initialize. */
    public initialize?: (IInitialize|null);

    /** NewSession scriptRunId. */
    public scriptRunId: string;

    /** NewSession name. */
    public name: string;

    /** NewSession mainScriptPath. */
    public mainScriptPath: string;

    /** NewSession config. */
    public config?: (IConfig|null);

    /** NewSession customTheme. */
    public customTheme?: (ICustomThemeConfig|null);

    /** NewSession appPages. */
    public appPages: IAppPage[];

    /** NewSession pageScriptHash. */
    public pageScriptHash: string;

    /**
     * Creates a new NewSession instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NewSession instance
     */
    public static create(properties?: INewSession): NewSession;

    /**
     * Encodes the specified NewSession message. Does not implicitly {@link NewSession.verify|verify} messages.
     * @param message NewSession message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: INewSession, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified NewSession message, length delimited. Does not implicitly {@link NewSession.verify|verify} messages.
     * @param message NewSession message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: INewSession, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a NewSession message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NewSession
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): NewSession;

    /**
     * Decodes a NewSession message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NewSession
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): NewSession;

    /**
     * Verifies a NewSession message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a NewSession message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NewSession
     */
    public static fromObject(object: { [k: string]: any }): NewSession;

    /**
     * Creates a plain object from a NewSession message. Also converts values to other types if specified.
     * @param message NewSession
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: NewSession, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this NewSession to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NewSession
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Initialize. */
export interface IInitialize {

    /** Initialize userInfo */
    userInfo?: (IUserInfo|null);

    /** Initialize environmentInfo */
    environmentInfo?: (IEnvironmentInfo|null);

    /** Initialize sessionStatus */
    sessionStatus?: (ISessionStatus|null);

    /** Initialize commandLine */
    commandLine?: (string|null);

    /** Initialize sessionId */
    sessionId?: (string|null);
}

/** Represents an Initialize. */
export class Initialize implements IInitialize {

    /**
     * Constructs a new Initialize.
     * @param [properties] Properties to set
     */
    constructor(properties?: IInitialize);

    /** Initialize userInfo. */
    public userInfo?: (IUserInfo|null);

    /** Initialize environmentInfo. */
    public environmentInfo?: (IEnvironmentInfo|null);

    /** Initialize sessionStatus. */
    public sessionStatus?: (ISessionStatus|null);

    /** Initialize commandLine. */
    public commandLine: string;

    /** Initialize sessionId. */
    public sessionId: string;

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

    /**
     * Gets the default type url for Initialize
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Config. */
export interface IConfig {

    /** Config gatherUsageStats */
    gatherUsageStats?: (boolean|null);

    /** Config maxCachedMessageAge */
    maxCachedMessageAge?: (number|null);

    /** Config mapboxToken */
    mapboxToken?: (string|null);

    /** Config allowRunOnSave */
    allowRunOnSave?: (boolean|null);

    /** Config hideTopBar */
    hideTopBar?: (boolean|null);

    /** Config hideSidebarNav */
    hideSidebarNav?: (boolean|null);

    /** Config toolbarMode */
    toolbarMode?: (Config.ToolbarMode|null);
}

/** Represents a Config. */
export class Config implements IConfig {

    /**
     * Constructs a new Config.
     * @param [properties] Properties to set
     */
    constructor(properties?: IConfig);

    /** Config gatherUsageStats. */
    public gatherUsageStats: boolean;

    /** Config maxCachedMessageAge. */
    public maxCachedMessageAge: number;

    /** Config mapboxToken. */
    public mapboxToken: string;

    /** Config allowRunOnSave. */
    public allowRunOnSave: boolean;

    /** Config hideTopBar. */
    public hideTopBar: boolean;

    /** Config hideSidebarNav. */
    public hideSidebarNav: boolean;

    /** Config toolbarMode. */
    public toolbarMode: Config.ToolbarMode;

    /**
     * Creates a new Config instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Config instance
     */
    public static create(properties?: IConfig): Config;

    /**
     * Encodes the specified Config message. Does not implicitly {@link Config.verify|verify} messages.
     * @param message Config message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IConfig, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Config message, length delimited. Does not implicitly {@link Config.verify|verify} messages.
     * @param message Config message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IConfig, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Config message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Config
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Config;

    /**
     * Decodes a Config message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Config
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Config;

    /**
     * Verifies a Config message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Config message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Config
     */
    public static fromObject(object: { [k: string]: any }): Config;

    /**
     * Creates a plain object from a Config message. Also converts values to other types if specified.
     * @param message Config
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Config, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Config to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Config
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Config {

    /** ToolbarMode enum. */
    enum ToolbarMode {
        AUTO = 0,
        DEVELOPER = 1,
        VIEWER = 2,
        MINIMAL = 3
    }
}

/** Properties of a CustomThemeConfig. */
export interface ICustomThemeConfig {

    /** CustomThemeConfig primaryColor */
    primaryColor?: (string|null);

    /** CustomThemeConfig secondaryBackgroundColor */
    secondaryBackgroundColor?: (string|null);

    /** CustomThemeConfig backgroundColor */
    backgroundColor?: (string|null);

    /** CustomThemeConfig textColor */
    textColor?: (string|null);

    /** CustomThemeConfig font */
    font?: (CustomThemeConfig.FontFamily|null);

    /** CustomThemeConfig base */
    base?: (CustomThemeConfig.BaseTheme|null);

    /** CustomThemeConfig widgetBackgroundColor */
    widgetBackgroundColor?: (string|null);

    /** CustomThemeConfig widgetBorderColor */
    widgetBorderColor?: (string|null);

    /** CustomThemeConfig radii */
    radii?: (IRadii|null);

    /** CustomThemeConfig bodyFont */
    bodyFont?: (string|null);

    /** CustomThemeConfig codeFont */
    codeFont?: (string|null);

    /** CustomThemeConfig fontFaces */
    fontFaces?: (IFontFace[]|null);

    /** CustomThemeConfig fontSizes */
    fontSizes?: (IFontSizes|null);
}

/** Represents a CustomThemeConfig. */
export class CustomThemeConfig implements ICustomThemeConfig {

    /**
     * Constructs a new CustomThemeConfig.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICustomThemeConfig);

    /** CustomThemeConfig primaryColor. */
    public primaryColor: string;

    /** CustomThemeConfig secondaryBackgroundColor. */
    public secondaryBackgroundColor: string;

    /** CustomThemeConfig backgroundColor. */
    public backgroundColor: string;

    /** CustomThemeConfig textColor. */
    public textColor: string;

    /** CustomThemeConfig font. */
    public font: CustomThemeConfig.FontFamily;

    /** CustomThemeConfig base. */
    public base: CustomThemeConfig.BaseTheme;

    /** CustomThemeConfig widgetBackgroundColor. */
    public widgetBackgroundColor: string;

    /** CustomThemeConfig widgetBorderColor. */
    public widgetBorderColor: string;

    /** CustomThemeConfig radii. */
    public radii?: (IRadii|null);

    /** CustomThemeConfig bodyFont. */
    public bodyFont: string;

    /** CustomThemeConfig codeFont. */
    public codeFont: string;

    /** CustomThemeConfig fontFaces. */
    public fontFaces: IFontFace[];

    /** CustomThemeConfig fontSizes. */
    public fontSizes?: (IFontSizes|null);

    /**
     * Creates a new CustomThemeConfig instance using the specified properties.
     * @param [properties] Properties to set
     * @returns CustomThemeConfig instance
     */
    public static create(properties?: ICustomThemeConfig): CustomThemeConfig;

    /**
     * Encodes the specified CustomThemeConfig message. Does not implicitly {@link CustomThemeConfig.verify|verify} messages.
     * @param message CustomThemeConfig message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICustomThemeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified CustomThemeConfig message, length delimited. Does not implicitly {@link CustomThemeConfig.verify|verify} messages.
     * @param message CustomThemeConfig message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICustomThemeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a CustomThemeConfig message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns CustomThemeConfig
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): CustomThemeConfig;

    /**
     * Decodes a CustomThemeConfig message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns CustomThemeConfig
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): CustomThemeConfig;

    /**
     * Verifies a CustomThemeConfig message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a CustomThemeConfig message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns CustomThemeConfig
     */
    public static fromObject(object: { [k: string]: any }): CustomThemeConfig;

    /**
     * Creates a plain object from a CustomThemeConfig message. Also converts values to other types if specified.
     * @param message CustomThemeConfig
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: CustomThemeConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this CustomThemeConfig to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for CustomThemeConfig
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace CustomThemeConfig {

    /** BaseTheme enum. */
    enum BaseTheme {
        LIGHT = 0,
        DARK = 1
    }

    /** FontFamily enum. */
    enum FontFamily {
        SANS_SERIF = 0,
        SERIF = 1,
        MONOSPACE = 2
    }
}

/** Properties of a FontFace. */
export interface IFontFace {

    /** FontFace url */
    url?: (string|null);

    /** FontFace family */
    family?: (string|null);

    /** FontFace weight */
    weight?: (number|null);

    /** FontFace style */
    style?: (string|null);
}

/** Represents a FontFace. */
export class FontFace implements IFontFace {

    /**
     * Constructs a new FontFace.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFontFace);

    /** FontFace url. */
    public url: string;

    /** FontFace family. */
    public family: string;

    /** FontFace weight. */
    public weight: number;

    /** FontFace style. */
    public style: string;

    /**
     * Creates a new FontFace instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FontFace instance
     */
    public static create(properties?: IFontFace): FontFace;

    /**
     * Encodes the specified FontFace message. Does not implicitly {@link FontFace.verify|verify} messages.
     * @param message FontFace message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFontFace, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified FontFace message, length delimited. Does not implicitly {@link FontFace.verify|verify} messages.
     * @param message FontFace message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFontFace, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a FontFace message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FontFace
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): FontFace;

    /**
     * Decodes a FontFace message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FontFace
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): FontFace;

    /**
     * Verifies a FontFace message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a FontFace message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FontFace
     */
    public static fromObject(object: { [k: string]: any }): FontFace;

    /**
     * Creates a plain object from a FontFace message. Also converts values to other types if specified.
     * @param message FontFace
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: FontFace, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this FontFace to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FontFace
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Radii. */
export interface IRadii {

    /** Radii baseWidgetRadius */
    baseWidgetRadius?: (number|null);

    /** Radii checkboxRadius */
    checkboxRadius?: (number|null);
}

/** Represents a Radii. */
export class Radii implements IRadii {

    /**
     * Constructs a new Radii.
     * @param [properties] Properties to set
     */
    constructor(properties?: IRadii);

    /** Radii baseWidgetRadius. */
    public baseWidgetRadius: number;

    /** Radii checkboxRadius. */
    public checkboxRadius: number;

    /**
     * Creates a new Radii instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Radii instance
     */
    public static create(properties?: IRadii): Radii;

    /**
     * Encodes the specified Radii message. Does not implicitly {@link Radii.verify|verify} messages.
     * @param message Radii message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IRadii, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Radii message, length delimited. Does not implicitly {@link Radii.verify|verify} messages.
     * @param message Radii message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IRadii, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Radii message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Radii
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Radii;

    /**
     * Decodes a Radii message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Radii
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Radii;

    /**
     * Verifies a Radii message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Radii message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Radii
     */
    public static fromObject(object: { [k: string]: any }): Radii;

    /**
     * Creates a plain object from a Radii message. Also converts values to other types if specified.
     * @param message Radii
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Radii, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Radii to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Radii
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a FontSizes. */
export interface IFontSizes {

    /** FontSizes tinyFontSize */
    tinyFontSize?: (number|null);

    /** FontSizes smallFontSize */
    smallFontSize?: (number|null);

    /** FontSizes baseFontSize */
    baseFontSize?: (number|null);
}

/** Represents a FontSizes. */
export class FontSizes implements IFontSizes {

    /**
     * Constructs a new FontSizes.
     * @param [properties] Properties to set
     */
    constructor(properties?: IFontSizes);

    /** FontSizes tinyFontSize. */
    public tinyFontSize: number;

    /** FontSizes smallFontSize. */
    public smallFontSize: number;

    /** FontSizes baseFontSize. */
    public baseFontSize: number;

    /**
     * Creates a new FontSizes instance using the specified properties.
     * @param [properties] Properties to set
     * @returns FontSizes instance
     */
    public static create(properties?: IFontSizes): FontSizes;

    /**
     * Encodes the specified FontSizes message. Does not implicitly {@link FontSizes.verify|verify} messages.
     * @param message FontSizes message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IFontSizes, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified FontSizes message, length delimited. Does not implicitly {@link FontSizes.verify|verify} messages.
     * @param message FontSizes message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IFontSizes, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a FontSizes message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns FontSizes
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): FontSizes;

    /**
     * Decodes a FontSizes message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns FontSizes
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): FontSizes;

    /**
     * Verifies a FontSizes message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a FontSizes message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns FontSizes
     */
    public static fromObject(object: { [k: string]: any }): FontSizes;

    /**
     * Creates a plain object from a FontSizes message. Also converts values to other types if specified.
     * @param message FontSizes
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: FontSizes, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this FontSizes to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for FontSizes
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a UserInfo. */
export interface IUserInfo {

    /** UserInfo installationId */
    installationId?: (string|null);

    /** UserInfo installationIdV3 */
    installationIdV3?: (string|null);
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

    /** UserInfo installationIdV3. */
    public installationIdV3: string;

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

    /**
     * Gets the default type url for UserInfo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an EnvironmentInfo. */
export interface IEnvironmentInfo {

    /** EnvironmentInfo streamlitVersion */
    streamlitVersion?: (string|null);

    /** EnvironmentInfo pythonVersion */
    pythonVersion?: (string|null);
}

/** Represents an EnvironmentInfo. */
export class EnvironmentInfo implements IEnvironmentInfo {

    /**
     * Constructs a new EnvironmentInfo.
     * @param [properties] Properties to set
     */
    constructor(properties?: IEnvironmentInfo);

    /** EnvironmentInfo streamlitVersion. */
    public streamlitVersion: string;

    /** EnvironmentInfo pythonVersion. */
    public pythonVersion: string;

    /**
     * Creates a new EnvironmentInfo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnvironmentInfo instance
     */
    public static create(properties?: IEnvironmentInfo): EnvironmentInfo;

    /**
     * Encodes the specified EnvironmentInfo message. Does not implicitly {@link EnvironmentInfo.verify|verify} messages.
     * @param message EnvironmentInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IEnvironmentInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified EnvironmentInfo message, length delimited. Does not implicitly {@link EnvironmentInfo.verify|verify} messages.
     * @param message EnvironmentInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IEnvironmentInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an EnvironmentInfo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnvironmentInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): EnvironmentInfo;

    /**
     * Decodes an EnvironmentInfo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnvironmentInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): EnvironmentInfo;

    /**
     * Verifies an EnvironmentInfo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an EnvironmentInfo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnvironmentInfo
     */
    public static fromObject(object: { [k: string]: any }): EnvironmentInfo;

    /**
     * Creates a plain object from an EnvironmentInfo message. Also converts values to other types if specified.
     * @param message EnvironmentInfo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: EnvironmentInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this EnvironmentInfo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnvironmentInfo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a NumberInput. */
export interface INumberInput {

    /** NumberInput id */
    id?: (string|null);

    /** NumberInput label */
    label?: (string|null);

    /** NumberInput formId */
    formId?: (string|null);

    /** NumberInput format */
    format?: (string|null);

    /** NumberInput hasMin */
    hasMin?: (boolean|null);

    /** NumberInput hasMax */
    hasMax?: (boolean|null);

    /** NumberInput dataType */
    dataType?: (NumberInput.DataType|null);

    /** NumberInput default */
    "default"?: (number|null);

    /** NumberInput step */
    step?: (number|null);

    /** NumberInput min */
    min?: (number|null);

    /** NumberInput max */
    max?: (number|null);

    /** NumberInput help */
    help?: (string|null);

    /** NumberInput value */
    value?: (number|null);

    /** NumberInput setValue */
    setValue?: (boolean|null);

    /** NumberInput disabled */
    disabled?: (boolean|null);

    /** NumberInput labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a NumberInput. */
export class NumberInput implements INumberInput {

    /**
     * Constructs a new NumberInput.
     * @param [properties] Properties to set
     */
    constructor(properties?: INumberInput);

    /** NumberInput id. */
    public id: string;

    /** NumberInput label. */
    public label: string;

    /** NumberInput formId. */
    public formId: string;

    /** NumberInput format. */
    public format: string;

    /** NumberInput hasMin. */
    public hasMin: boolean;

    /** NumberInput hasMax. */
    public hasMax: boolean;

    /** NumberInput dataType. */
    public dataType: NumberInput.DataType;

    /** NumberInput default. */
    public default: number;

    /** NumberInput step. */
    public step: number;

    /** NumberInput min. */
    public min: number;

    /** NumberInput max. */
    public max: number;

    /** NumberInput help. */
    public help: string;

    /** NumberInput value. */
    public value: number;

    /** NumberInput setValue. */
    public setValue: boolean;

    /** NumberInput disabled. */
    public disabled: boolean;

    /** NumberInput labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new NumberInput instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NumberInput instance
     */
    public static create(properties?: INumberInput): NumberInput;

    /**
     * Encodes the specified NumberInput message. Does not implicitly {@link NumberInput.verify|verify} messages.
     * @param message NumberInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: INumberInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified NumberInput message, length delimited. Does not implicitly {@link NumberInput.verify|verify} messages.
     * @param message NumberInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: INumberInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a NumberInput message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NumberInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): NumberInput;

    /**
     * Decodes a NumberInput message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NumberInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): NumberInput;

    /**
     * Verifies a NumberInput message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a NumberInput message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NumberInput
     */
    public static fromObject(object: { [k: string]: any }): NumberInput;

    /**
     * Creates a plain object from a NumberInput message. Also converts values to other types if specified.
     * @param message NumberInput
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: NumberInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this NumberInput to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for NumberInput
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace NumberInput {

    /** DataType enum. */
    enum DataType {
        INT = 0,
        FLOAT = 1
    }
}

/** Properties of a PageConfig. */
export interface IPageConfig {

    /** PageConfig title */
    title?: (string|null);

    /** PageConfig favicon */
    favicon?: (string|null);

    /** PageConfig layout */
    layout?: (PageConfig.Layout|null);

    /** PageConfig initialSidebarState */
    initialSidebarState?: (PageConfig.SidebarState|null);

    /** PageConfig menuItems */
    menuItems?: (PageConfig.IMenuItems|null);
}

/** Represents a PageConfig. */
export class PageConfig implements IPageConfig {

    /**
     * Constructs a new PageConfig.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPageConfig);

    /** PageConfig title. */
    public title: string;

    /** PageConfig favicon. */
    public favicon: string;

    /** PageConfig layout. */
    public layout: PageConfig.Layout;

    /** PageConfig initialSidebarState. */
    public initialSidebarState: PageConfig.SidebarState;

    /** PageConfig menuItems. */
    public menuItems?: (PageConfig.IMenuItems|null);

    /**
     * Creates a new PageConfig instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PageConfig instance
     */
    public static create(properties?: IPageConfig): PageConfig;

    /**
     * Encodes the specified PageConfig message. Does not implicitly {@link PageConfig.verify|verify} messages.
     * @param message PageConfig message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPageConfig, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PageConfig message, length delimited. Does not implicitly {@link PageConfig.verify|verify} messages.
     * @param message PageConfig message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPageConfig, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PageConfig message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PageConfig
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PageConfig;

    /**
     * Decodes a PageConfig message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PageConfig
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PageConfig;

    /**
     * Verifies a PageConfig message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PageConfig message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PageConfig
     */
    public static fromObject(object: { [k: string]: any }): PageConfig;

    /**
     * Creates a plain object from a PageConfig message. Also converts values to other types if specified.
     * @param message PageConfig
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PageConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PageConfig to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PageConfig
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace PageConfig {

    /** Properties of a MenuItems. */
    interface IMenuItems {

        /** MenuItems getHelpUrl */
        getHelpUrl?: (string|null);

        /** MenuItems hideGetHelp */
        hideGetHelp?: (boolean|null);

        /** MenuItems reportABugUrl */
        reportABugUrl?: (string|null);

        /** MenuItems hideReportABug */
        hideReportABug?: (boolean|null);

        /** MenuItems aboutSectionMd */
        aboutSectionMd?: (string|null);
    }

    /** Represents a MenuItems. */
    class MenuItems implements IMenuItems {

        /**
         * Constructs a new MenuItems.
         * @param [properties] Properties to set
         */
        constructor(properties?: PageConfig.IMenuItems);

        /** MenuItems getHelpUrl. */
        public getHelpUrl: string;

        /** MenuItems hideGetHelp. */
        public hideGetHelp: boolean;

        /** MenuItems reportABugUrl. */
        public reportABugUrl: string;

        /** MenuItems hideReportABug. */
        public hideReportABug: boolean;

        /** MenuItems aboutSectionMd. */
        public aboutSectionMd: string;

        /**
         * Creates a new MenuItems instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MenuItems instance
         */
        public static create(properties?: PageConfig.IMenuItems): PageConfig.MenuItems;

        /**
         * Encodes the specified MenuItems message. Does not implicitly {@link PageConfig.MenuItems.verify|verify} messages.
         * @param message MenuItems message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: PageConfig.IMenuItems, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MenuItems message, length delimited. Does not implicitly {@link PageConfig.MenuItems.verify|verify} messages.
         * @param message MenuItems message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: PageConfig.IMenuItems, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MenuItems message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MenuItems
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PageConfig.MenuItems;

        /**
         * Decodes a MenuItems message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MenuItems
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PageConfig.MenuItems;

        /**
         * Verifies a MenuItems message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MenuItems message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MenuItems
         */
        public static fromObject(object: { [k: string]: any }): PageConfig.MenuItems;

        /**
         * Creates a plain object from a MenuItems message. Also converts values to other types if specified.
         * @param message MenuItems
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: PageConfig.MenuItems, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MenuItems to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MenuItems
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Layout enum. */
    enum Layout {
        CENTERED = 0,
        WIDE = 1
    }

    /** SidebarState enum. */
    enum SidebarState {
        AUTO = 0,
        EXPANDED = 1,
        COLLAPSED = 2
    }
}

/** Properties of a PageInfo. */
export interface IPageInfo {

    /** PageInfo queryString */
    queryString?: (string|null);
}

/** Represents a PageInfo. */
export class PageInfo implements IPageInfo {

    /**
     * Constructs a new PageInfo.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPageInfo);

    /** PageInfo queryString. */
    public queryString: string;

    /**
     * Creates a new PageInfo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PageInfo instance
     */
    public static create(properties?: IPageInfo): PageInfo;

    /**
     * Encodes the specified PageInfo message. Does not implicitly {@link PageInfo.verify|verify} messages.
     * @param message PageInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPageInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PageInfo message, length delimited. Does not implicitly {@link PageInfo.verify|verify} messages.
     * @param message PageInfo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPageInfo, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PageInfo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PageInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PageInfo;

    /**
     * Decodes a PageInfo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PageInfo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PageInfo;

    /**
     * Verifies a PageInfo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PageInfo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PageInfo
     */
    public static fromObject(object: { [k: string]: any }): PageInfo;

    /**
     * Creates a plain object from a PageInfo message. Also converts values to other types if specified.
     * @param message PageInfo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PageInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PageInfo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PageInfo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a PageNotFound. */
export interface IPageNotFound {

    /** PageNotFound pageName */
    pageName?: (string|null);
}

/** Represents a PageNotFound. */
export class PageNotFound implements IPageNotFound {

    /**
     * Constructs a new PageNotFound.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPageNotFound);

    /** PageNotFound pageName. */
    public pageName: string;

    /**
     * Creates a new PageNotFound instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PageNotFound instance
     */
    public static create(properties?: IPageNotFound): PageNotFound;

    /**
     * Encodes the specified PageNotFound message. Does not implicitly {@link PageNotFound.verify|verify} messages.
     * @param message PageNotFound message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPageNotFound, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PageNotFound message, length delimited. Does not implicitly {@link PageNotFound.verify|verify} messages.
     * @param message PageNotFound message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPageNotFound, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PageNotFound message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PageNotFound
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PageNotFound;

    /**
     * Decodes a PageNotFound message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PageNotFound
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PageNotFound;

    /**
     * Verifies a PageNotFound message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PageNotFound message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PageNotFound
     */
    public static fromObject(object: { [k: string]: any }): PageNotFound;

    /**
     * Creates a plain object from a PageNotFound message. Also converts values to other types if specified.
     * @param message PageNotFound
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PageNotFound, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PageNotFound to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PageNotFound
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a PageProfile. */
export interface IPageProfile {

    /** PageProfile commands */
    commands?: (ICommand[]|null);

    /** PageProfile execTime */
    execTime?: (number|Long|null);

    /** PageProfile prepTime */
    prepTime?: (number|Long|null);

    /** PageProfile config */
    config?: (string[]|null);

    /** PageProfile uncaughtException */
    uncaughtException?: (string|null);

    /** PageProfile attributions */
    attributions?: (string[]|null);

    /** PageProfile os */
    os?: (string|null);

    /** PageProfile timezone */
    timezone?: (string|null);

    /** PageProfile headless */
    headless?: (boolean|null);
}

/** Represents a PageProfile. */
export class PageProfile implements IPageProfile {

    /**
     * Constructs a new PageProfile.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPageProfile);

    /** PageProfile commands. */
    public commands: ICommand[];

    /** PageProfile execTime. */
    public execTime: (number|Long);

    /** PageProfile prepTime. */
    public prepTime: (number|Long);

    /** PageProfile config. */
    public config: string[];

    /** PageProfile uncaughtException. */
    public uncaughtException: string;

    /** PageProfile attributions. */
    public attributions: string[];

    /** PageProfile os. */
    public os: string;

    /** PageProfile timezone. */
    public timezone: string;

    /** PageProfile headless. */
    public headless: boolean;

    /**
     * Creates a new PageProfile instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PageProfile instance
     */
    public static create(properties?: IPageProfile): PageProfile;

    /**
     * Encodes the specified PageProfile message. Does not implicitly {@link PageProfile.verify|verify} messages.
     * @param message PageProfile message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPageProfile, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PageProfile message, length delimited. Does not implicitly {@link PageProfile.verify|verify} messages.
     * @param message PageProfile message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPageProfile, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PageProfile message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PageProfile
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PageProfile;

    /**
     * Decodes a PageProfile message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PageProfile
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PageProfile;

    /**
     * Verifies a PageProfile message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PageProfile message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PageProfile
     */
    public static fromObject(object: { [k: string]: any }): PageProfile;

    /**
     * Creates a plain object from a PageProfile message. Also converts values to other types if specified.
     * @param message PageProfile
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PageProfile, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PageProfile to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PageProfile
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an Argument. */
export interface IArgument {

    /** Argument k */
    k?: (string|null);

    /** Argument t */
    t?: (string|null);

    /** Argument m */
    m?: (string|null);

    /** Argument p */
    p?: (number|null);
}

/** Represents an Argument. */
export class Argument implements IArgument {

    /**
     * Constructs a new Argument.
     * @param [properties] Properties to set
     */
    constructor(properties?: IArgument);

    /** Argument k. */
    public k: string;

    /** Argument t. */
    public t: string;

    /** Argument m. */
    public m: string;

    /** Argument p. */
    public p: number;

    /**
     * Creates a new Argument instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Argument instance
     */
    public static create(properties?: IArgument): Argument;

    /**
     * Encodes the specified Argument message. Does not implicitly {@link Argument.verify|verify} messages.
     * @param message Argument message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IArgument, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Argument message, length delimited. Does not implicitly {@link Argument.verify|verify} messages.
     * @param message Argument message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IArgument, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an Argument message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Argument
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Argument;

    /**
     * Decodes an Argument message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Argument
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Argument;

    /**
     * Verifies an Argument message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an Argument message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Argument
     */
    public static fromObject(object: { [k: string]: any }): Argument;

    /**
     * Creates a plain object from an Argument message. Also converts values to other types if specified.
     * @param message Argument
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Argument, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Argument to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Argument
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Command. */
export interface ICommand {

    /** Command name */
    name?: (string|null);

    /** Command args */
    args?: (IArgument[]|null);

    /** Command time */
    time?: (number|Long|null);
}

/** Represents a Command. */
export class Command implements ICommand {

    /**
     * Constructs a new Command.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICommand);

    /** Command name. */
    public name: string;

    /** Command args. */
    public args: IArgument[];

    /** Command time. */
    public time: (number|Long);

    /**
     * Creates a new Command instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Command instance
     */
    public static create(properties?: ICommand): Command;

    /**
     * Encodes the specified Command message. Does not implicitly {@link Command.verify|verify} messages.
     * @param message Command message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICommand, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Command message, length delimited. Does not implicitly {@link Command.verify|verify} messages.
     * @param message Command message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICommand, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Command message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Command
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Command;

    /**
     * Decodes a Command message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Command
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Command;

    /**
     * Verifies a Command message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Command message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Command
     */
    public static fromObject(object: { [k: string]: any }): Command;

    /**
     * Creates a plain object from a Command message. Also converts values to other types if specified.
     * @param message Command
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Command, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Command to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Command
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a PagesChanged. */
export interface IPagesChanged {

    /** PagesChanged appPages */
    appPages?: (IAppPage[]|null);
}

/** Represents a PagesChanged. */
export class PagesChanged implements IPagesChanged {

    /**
     * Constructs a new PagesChanged.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPagesChanged);

    /** PagesChanged appPages. */
    public appPages: IAppPage[];

    /**
     * Creates a new PagesChanged instance using the specified properties.
     * @param [properties] Properties to set
     * @returns PagesChanged instance
     */
    public static create(properties?: IPagesChanged): PagesChanged;

    /**
     * Encodes the specified PagesChanged message. Does not implicitly {@link PagesChanged.verify|verify} messages.
     * @param message PagesChanged message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IPagesChanged, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified PagesChanged message, length delimited. Does not implicitly {@link PagesChanged.verify|verify} messages.
     * @param message PagesChanged message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IPagesChanged, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a PagesChanged message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns PagesChanged
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): PagesChanged;

    /**
     * Decodes a PagesChanged message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns PagesChanged
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): PagesChanged;

    /**
     * Verifies a PagesChanged message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a PagesChanged message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns PagesChanged
     */
    public static fromObject(object: { [k: string]: any }): PagesChanged;

    /**
     * Creates a plain object from a PagesChanged message. Also converts values to other types if specified.
     * @param message PagesChanged
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: PagesChanged, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this PagesChanged to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for PagesChanged
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a PlotlyChart. */
export interface IPlotlyChart {

    /** PlotlyChart url */
    url?: (string|null);

    /** PlotlyChart figure */
    figure?: (IFigure|null);

    /** PlotlyChart useContainerWidth */
    useContainerWidth?: (boolean|null);

    /** PlotlyChart theme */
    theme?: (string|null);
}

/** Represents a PlotlyChart. */
export class PlotlyChart implements IPlotlyChart {

    /**
     * Constructs a new PlotlyChart.
     * @param [properties] Properties to set
     */
    constructor(properties?: IPlotlyChart);

    /** PlotlyChart url. */
    public url?: (string|null);

    /** PlotlyChart figure. */
    public figure?: (IFigure|null);

    /** PlotlyChart useContainerWidth. */
    public useContainerWidth: boolean;

    /** PlotlyChart theme. */
    public theme: string;

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

    /**
     * Gets the default type url for PlotlyChart
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Figure. */
export interface IFigure {

    /** Figure spec */
    spec?: (string|null);

    /** Figure config */
    config?: (string|null);
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

    /**
     * Gets the default type url for Figure
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Progress. */
export interface IProgress {

    /** Progress value */
    value?: (number|null);

    /** Progress text */
    text?: (string|null);
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

    /** Progress text. */
    public text: string;

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

    /**
     * Gets the default type url for Progress
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a Radio. */
export interface IRadio {

    /** Radio id */
    id?: (string|null);

    /** Radio label */
    label?: (string|null);

    /** Radio default */
    "default"?: (number|null);

    /** Radio options */
    options?: (string[]|null);

    /** Radio help */
    help?: (string|null);

    /** Radio formId */
    formId?: (string|null);

    /** Radio value */
    value?: (number|null);

    /** Radio setValue */
    setValue?: (boolean|null);

    /** Radio disabled */
    disabled?: (boolean|null);

    /** Radio horizontal */
    horizontal?: (boolean|null);

    /** Radio labelVisibility */
    labelVisibility?: (ILabelVisibilityMessage|null);
}

/** Represents a Radio. */
export class Radio implements IRadio {

    /**
     * Constructs a new Radio.
     * @param [properties] Properties to set
     */
    constructor(properties?: IRadio);

    /** Radio id. */
    public id: string;

    /** Radio label. */
    public label: string;

    /** Radio default. */
    public default: number;

    /** Radio options. */
    public options: string[];

    /** Radio help. */
    public help: string;

    /** Radio formId. */
    public formId: string;

    /** Radio value. */
    public value: number;

    /** Radio setValue. */
    public setValue: boolean;

    /** Radio disabled. */
    public disabled: boolean;

    /** Radio horizontal. */
    public horizontal: boolean;

    /** Radio labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new Radio instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Radio instance
     */
    public static create(properties?: IRadio): Radio;

    /**
     * Encodes the specified Radio message. Does not implicitly {@link Radio.verify|verify} messages.
     * @param message Radio message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IRadio, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Radio message, length delimited. Does not implicitly {@link Radio.verify|verify} messages.
     * @param message Radio message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IRadio, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Radio message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Radio
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Radio;

    /**
     * Decodes a Radio message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Radio
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Radio;

    /**
     * Verifies a Radio message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Radio message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Radio
     */
    public static fromObject(object: { [k: string]: any }): Radio;

    /**
     * Creates a plain object from a Radio message. Also converts values to other types if specified.
     * @param message Radio
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Radio, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Radio to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Radio
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** RootContainer enum. */
export enum RootContainer {
    MAIN = 0,
    SIDEBAR = 1
}

/** Represents a Selectbox. */
export class Selectbox implements ISelectbox {

    /**
     * Constructs a new Selectbox.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISelectbox);

    /** Selectbox id. */
    public id: string;

    /** Selectbox label. */
    public label: string;

    /** Selectbox default. */
    public default: number;

    /** Selectbox options. */
    public options: string[];

    /** Selectbox help. */
    public help: string;

    /** Selectbox formId. */
    public formId: string;

    /** Selectbox value. */
    public value: number;

    /** Selectbox setValue. */
    public setValue: boolean;

    /** Selectbox disabled. */
    public disabled: boolean;

    /** Selectbox labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new Selectbox instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Selectbox instance
     */
    public static create(properties?: ISelectbox): Selectbox;

    /**
     * Encodes the specified Selectbox message. Does not implicitly {@link Selectbox.verify|verify} messages.
     * @param message Selectbox message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISelectbox, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Selectbox message, length delimited. Does not implicitly {@link Selectbox.verify|verify} messages.
     * @param message Selectbox message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISelectbox, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Selectbox message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Selectbox
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Selectbox;

    /**
     * Decodes a Selectbox message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Selectbox
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Selectbox;

    /**
     * Verifies a Selectbox message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Selectbox message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Selectbox
     */
    public static fromObject(object: { [k: string]: any }): Selectbox;

    /**
     * Creates a plain object from a Selectbox message. Also converts values to other types if specified.
     * @param message Selectbox
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Selectbox, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Selectbox to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Selectbox
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a SessionEvent. */
export class SessionEvent implements ISessionEvent {

    /**
     * Constructs a new SessionEvent.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISessionEvent);

    /** SessionEvent scriptChangedOnDisk. */
    public scriptChangedOnDisk?: (boolean|null);

    /** SessionEvent scriptWasManuallyStopped. */
    public scriptWasManuallyStopped?: (boolean|null);

    /** SessionEvent scriptCompilationException. */
    public scriptCompilationException?: (IException|null);

    /** SessionEvent type. */
    public type?: ("scriptChangedOnDisk"|"scriptWasManuallyStopped"|"scriptCompilationException");

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

    /**
     * Gets the default type url for SessionEvent
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a SessionStatus. */
export class SessionStatus implements ISessionStatus {

    /**
     * Constructs a new SessionStatus.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISessionStatus);

    /** SessionStatus runOnSave. */
    public runOnSave: boolean;

    /** SessionStatus scriptIsRunning. */
    public scriptIsRunning: boolean;

    /**
     * Creates a new SessionStatus instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SessionStatus instance
     */
    public static create(properties?: ISessionStatus): SessionStatus;

    /**
     * Encodes the specified SessionStatus message. Does not implicitly {@link SessionStatus.verify|verify} messages.
     * @param message SessionStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISessionStatus, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified SessionStatus message, length delimited. Does not implicitly {@link SessionStatus.verify|verify} messages.
     * @param message SessionStatus message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISessionStatus, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a SessionStatus message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SessionStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): SessionStatus;

    /**
     * Decodes a SessionStatus message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SessionStatus
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): SessionStatus;

    /**
     * Verifies a SessionStatus message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a SessionStatus message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SessionStatus
     */
    public static fromObject(object: { [k: string]: any }): SessionStatus;

    /**
     * Creates a plain object from a SessionStatus message. Also converts values to other types if specified.
     * @param message SessionStatus
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: SessionStatus, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this SessionStatus to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SessionStatus
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a Slider. */
export class Slider implements ISlider {

    /**
     * Constructs a new Slider.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISlider);

    /** Slider id. */
    public id: string;

    /** Slider formId. */
    public formId: string;

    /** Slider label. */
    public label: string;

    /** Slider format. */
    public format: string;

    /** Slider dataType. */
    public dataType: Slider.DataType;

    /** Slider default. */
    public default: number[];

    /** Slider min. */
    public min: number;

    /** Slider max. */
    public max: number;

    /** Slider step. */
    public step: number;

    /** Slider value. */
    public value: number[];

    /** Slider setValue. */
    public setValue: boolean;

    /** Slider options. */
    public options: string[];

    /** Slider help. */
    public help: string;

    /** Slider disabled. */
    public disabled: boolean;

    /** Slider labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /** Slider type. */
    public type: Slider.Type;

    /**
     * Creates a new Slider instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Slider instance
     */
    public static create(properties?: ISlider): Slider;

    /**
     * Encodes the specified Slider message. Does not implicitly {@link Slider.verify|verify} messages.
     * @param message Slider message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISlider, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Slider message, length delimited. Does not implicitly {@link Slider.verify|verify} messages.
     * @param message Slider message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISlider, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Slider message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Slider
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Slider;

    /**
     * Decodes a Slider message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Slider
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Slider;

    /**
     * Verifies a Slider message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Slider message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Slider
     */
    public static fromObject(object: { [k: string]: any }): Slider;

    /**
     * Creates a plain object from a Slider message. Also converts values to other types if specified.
     * @param message Slider
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Slider, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Slider to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Slider
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Slider {

    /** DataType enum. */
    enum DataType {
        INT = 0,
        FLOAT = 1,
        DATETIME = 2,
        DATE = 3,
        TIME = 4
    }

    /** Type enum. */
    enum Type {
        UNSPECIFIED = 0,
        SLIDER = 1,
        SELECT_SLIDER = 2
    }
}

/** Represents a Snow. */
export class Snow implements ISnow {

    /**
     * Constructs a new Snow.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISnow);

    /** Snow show. */
    public show: boolean;

    /**
     * Creates a new Snow instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Snow instance
     */
    public static create(properties?: ISnow): Snow;

    /**
     * Encodes the specified Snow message. Does not implicitly {@link Snow.verify|verify} messages.
     * @param message Snow message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISnow, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Snow message, length delimited. Does not implicitly {@link Snow.verify|verify} messages.
     * @param message Snow message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISnow, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Snow message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Snow
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Snow;

    /**
     * Decodes a Snow message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Snow
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Snow;

    /**
     * Verifies a Snow message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Snow message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Snow
     */
    public static fromObject(object: { [k: string]: any }): Snow;

    /**
     * Creates a plain object from a Snow message. Also converts values to other types if specified.
     * @param message Snow
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Snow, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Snow to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Snow
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a Spinner. */
export class Spinner implements ISpinner {

    /**
     * Constructs a new Spinner.
     * @param [properties] Properties to set
     */
    constructor(properties?: ISpinner);

    /** Spinner text. */
    public text: string;

    /**
     * Creates a new Spinner instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Spinner instance
     */
    public static create(properties?: ISpinner): Spinner;

    /**
     * Encodes the specified Spinner message. Does not implicitly {@link Spinner.verify|verify} messages.
     * @param message Spinner message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ISpinner, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified Spinner message, length delimited. Does not implicitly {@link Spinner.verify|verify} messages.
     * @param message Spinner message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ISpinner, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a Spinner message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Spinner
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): Spinner;

    /**
     * Decodes a Spinner message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Spinner
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): Spinner;

    /**
     * Verifies a Spinner message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a Spinner message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Spinner
     */
    public static fromObject(object: { [k: string]: any }): Spinner;

    /**
     * Creates a plain object from a Spinner message. Also converts values to other types if specified.
     * @param message Spinner
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: Spinner, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this Spinner to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Spinner
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /** Text help. */
    public help: string;

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

    /**
     * Gets the default type url for Text
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a TextArea. */
export class TextArea implements ITextArea {

    /**
     * Constructs a new TextArea.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITextArea);

    /** TextArea id. */
    public id: string;

    /** TextArea label. */
    public label: string;

    /** TextArea default. */
    public default: string;

    /** TextArea height. */
    public height: number;

    /** TextArea maxChars. */
    public maxChars: number;

    /** TextArea help. */
    public help: string;

    /** TextArea formId. */
    public formId: string;

    /** TextArea value. */
    public value: string;

    /** TextArea setValue. */
    public setValue: boolean;

    /** TextArea placeholder. */
    public placeholder: string;

    /** TextArea disabled. */
    public disabled: boolean;

    /** TextArea labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new TextArea instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TextArea instance
     */
    public static create(properties?: ITextArea): TextArea;

    /**
     * Encodes the specified TextArea message. Does not implicitly {@link TextArea.verify|verify} messages.
     * @param message TextArea message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITextArea, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TextArea message, length delimited. Does not implicitly {@link TextArea.verify|verify} messages.
     * @param message TextArea message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITextArea, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a TextArea message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TextArea
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): TextArea;

    /**
     * Decodes a TextArea message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TextArea
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): TextArea;

    /**
     * Verifies a TextArea message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a TextArea message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TextArea
     */
    public static fromObject(object: { [k: string]: any }): TextArea;

    /**
     * Creates a plain object from a TextArea message. Also converts values to other types if specified.
     * @param message TextArea
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: TextArea, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this TextArea to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TextArea
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a TextInput. */
export class TextInput implements ITextInput {

    /**
     * Constructs a new TextInput.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITextInput);

    /** TextInput id. */
    public id: string;

    /** TextInput label. */
    public label: string;

    /** TextInput default. */
    public default: string;

    /** TextInput type. */
    public type: TextInput.Type;

    /** TextInput maxChars. */
    public maxChars: number;

    /** TextInput help. */
    public help: string;

    /** TextInput formId. */
    public formId: string;

    /** TextInput value. */
    public value: string;

    /** TextInput setValue. */
    public setValue: boolean;

    /** TextInput autocomplete. */
    public autocomplete: string;

    /** TextInput placeholder. */
    public placeholder: string;

    /** TextInput disabled. */
    public disabled: boolean;

    /** TextInput labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /**
     * Creates a new TextInput instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TextInput instance
     */
    public static create(properties?: ITextInput): TextInput;

    /**
     * Encodes the specified TextInput message. Does not implicitly {@link TextInput.verify|verify} messages.
     * @param message TextInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITextInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TextInput message, length delimited. Does not implicitly {@link TextInput.verify|verify} messages.
     * @param message TextInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITextInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a TextInput message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TextInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): TextInput;

    /**
     * Decodes a TextInput message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TextInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): TextInput;

    /**
     * Verifies a TextInput message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a TextInput message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TextInput
     */
    public static fromObject(object: { [k: string]: any }): TextInput;

    /**
     * Creates a plain object from a TextInput message. Also converts values to other types if specified.
     * @param message TextInput
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: TextInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this TextInput to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TextInput
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace TextInput {

    /** Type enum. */
    enum Type {
        DEFAULT = 0,
        PASSWORD = 1
    }
}

/** Represents a TimeInput. */
export class TimeInput implements ITimeInput {

    /**
     * Constructs a new TimeInput.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITimeInput);

    /** TimeInput id. */
    public id: string;

    /** TimeInput label. */
    public label: string;

    /** TimeInput default. */
    public default: string;

    /** TimeInput help. */
    public help: string;

    /** TimeInput formId. */
    public formId: string;

    /** TimeInput value. */
    public value: string;

    /** TimeInput setValue. */
    public setValue: boolean;

    /** TimeInput disabled. */
    public disabled: boolean;

    /** TimeInput labelVisibility. */
    public labelVisibility?: (ILabelVisibilityMessage|null);

    /** TimeInput step. */
    public step: (number|Long);

    /**
     * Creates a new TimeInput instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TimeInput instance
     */
    public static create(properties?: ITimeInput): TimeInput;

    /**
     * Encodes the specified TimeInput message. Does not implicitly {@link TimeInput.verify|verify} messages.
     * @param message TimeInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITimeInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TimeInput message, length delimited. Does not implicitly {@link TimeInput.verify|verify} messages.
     * @param message TimeInput message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITimeInput, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a TimeInput message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TimeInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): TimeInput;

    /**
     * Decodes a TimeInput message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TimeInput
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): TimeInput;

    /**
     * Verifies a TimeInput message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a TimeInput message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TimeInput
     */
    public static fromObject(object: { [k: string]: any }): TimeInput;

    /**
     * Creates a plain object from a TimeInput message. Also converts values to other types if specified.
     * @param message TimeInput
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: TimeInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this TimeInput to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for TimeInput
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
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

    /** VegaLiteChart useContainerWidth. */
    public useContainerWidth: boolean;

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

    /**
     * Gets the default type url for VegaLiteChart
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a Video. */
export class Video implements IVideo {

    /**
     * Constructs a new Video.
     * @param [properties] Properties to set
     */
    constructor(properties?: IVideo);

    /** Video url. */
    public url: string;

    /** Video startTime. */
    public startTime: number;

    /** Video type. */
    public type: Video.Type;

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

    /**
     * Gets the default type url for Video
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

export namespace Video {

    /** Type enum. */
    enum Type {
        UNUSED = 0,
        NATIVE = 1,
        YOUTUBE_IFRAME = 2
    }
}

/** Represents a WidgetStates. */
export class WidgetStates implements IWidgetStates {

    /**
     * Constructs a new WidgetStates.
     * @param [properties] Properties to set
     */
    constructor(properties?: IWidgetStates);

    /** WidgetStates widgets. */
    public widgets: IWidgetState[];

    /**
     * Creates a new WidgetStates instance using the specified properties.
     * @param [properties] Properties to set
     * @returns WidgetStates instance
     */
    public static create(properties?: IWidgetStates): WidgetStates;

    /**
     * Encodes the specified WidgetStates message. Does not implicitly {@link WidgetStates.verify|verify} messages.
     * @param message WidgetStates message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IWidgetStates, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified WidgetStates message, length delimited. Does not implicitly {@link WidgetStates.verify|verify} messages.
     * @param message WidgetStates message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IWidgetStates, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a WidgetStates message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns WidgetStates
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): WidgetStates;

    /**
     * Decodes a WidgetStates message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns WidgetStates
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): WidgetStates;

    /**
     * Verifies a WidgetStates message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a WidgetStates message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns WidgetStates
     */
    public static fromObject(object: { [k: string]: any }): WidgetStates;

    /**
     * Creates a plain object from a WidgetStates message. Also converts values to other types if specified.
     * @param message WidgetStates
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: WidgetStates, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this WidgetStates to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for WidgetStates
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Represents a WidgetState. */
export class WidgetState implements IWidgetState {

    /**
     * Constructs a new WidgetState.
     * @param [properties] Properties to set
     */
    constructor(properties?: IWidgetState);

    /** WidgetState id. */
    public id: string;

    /** WidgetState triggerValue. */
    public triggerValue?: (boolean|null);

    /** WidgetState boolValue. */
    public boolValue?: (boolean|null);

    /** WidgetState doubleValue. */
    public doubleValue?: (number|null);

    /** WidgetState intValue. */
    public intValue?: (number|Long|null);

    /** WidgetState stringValue. */
    public stringValue?: (string|null);

    /** WidgetState doubleArrayValue. */
    public doubleArrayValue?: (IDoubleArray|null);

    /** WidgetState intArrayValue. */
    public intArrayValue?: (ISInt64Array|null);

    /** WidgetState stringArrayValue. */
    public stringArrayValue?: (IStringArray|null);

    /** WidgetState jsonValue. */
    public jsonValue?: (string|null);

    /** WidgetState arrowValue. */
    public arrowValue?: (IArrowTable|null);

    /** WidgetState bytesValue. */
    public bytesValue?: (Uint8Array|null);

    /** WidgetState fileUploaderStateValue. */
    public fileUploaderStateValue?: (IFileUploaderState|null);

    /** WidgetState value. */
    public value?: ("triggerValue"|"boolValue"|"doubleValue"|"intValue"|"stringValue"|"doubleArrayValue"|"intArrayValue"|"stringArrayValue"|"jsonValue"|"arrowValue"|"bytesValue"|"fileUploaderStateValue");

    /**
     * Creates a new WidgetState instance using the specified properties.
     * @param [properties] Properties to set
     * @returns WidgetState instance
     */
    public static create(properties?: IWidgetState): WidgetState;

    /**
     * Encodes the specified WidgetState message. Does not implicitly {@link WidgetState.verify|verify} messages.
     * @param message WidgetState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IWidgetState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified WidgetState message, length delimited. Does not implicitly {@link WidgetState.verify|verify} messages.
     * @param message WidgetState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IWidgetState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a WidgetState message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns WidgetState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): WidgetState;

    /**
     * Decodes a WidgetState message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns WidgetState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): WidgetState;

    /**
     * Verifies a WidgetState message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a WidgetState message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns WidgetState
     */
    public static fromObject(object: { [k: string]: any }): WidgetState;

    /**
     * Creates a plain object from a WidgetState message. Also converts values to other types if specified.
     * @param message WidgetState
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: WidgetState, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this WidgetState to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for WidgetState
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Namespace openmetrics. */
export namespace openmetrics {

    /** Properties of a MetricSet. */
    interface IMetricSet {

        /** MetricSet metricFamilies */
        metricFamilies?: (openmetrics.IMetricFamily[]|null);
    }

    /** Represents a MetricSet. */
    class MetricSet implements IMetricSet {

        /**
         * Constructs a new MetricSet.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IMetricSet);

        /** MetricSet metricFamilies. */
        public metricFamilies: openmetrics.IMetricFamily[];

        /**
         * Creates a new MetricSet instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MetricSet instance
         */
        public static create(properties?: openmetrics.IMetricSet): openmetrics.MetricSet;

        /**
         * Encodes the specified MetricSet message. Does not implicitly {@link openmetrics.MetricSet.verify|verify} messages.
         * @param message MetricSet message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IMetricSet, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MetricSet message, length delimited. Does not implicitly {@link openmetrics.MetricSet.verify|verify} messages.
         * @param message MetricSet message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IMetricSet, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MetricSet message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MetricSet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.MetricSet;

        /**
         * Decodes a MetricSet message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MetricSet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.MetricSet;

        /**
         * Verifies a MetricSet message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MetricSet message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MetricSet
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.MetricSet;

        /**
         * Creates a plain object from a MetricSet message. Also converts values to other types if specified.
         * @param message MetricSet
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.MetricSet, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MetricSet to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MetricSet
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a MetricFamily. */
    interface IMetricFamily {

        /** MetricFamily name */
        name?: (string|null);

        /** MetricFamily type */
        type?: (openmetrics.MetricType|null);

        /** MetricFamily unit */
        unit?: (string|null);

        /** MetricFamily help */
        help?: (string|null);

        /** MetricFamily metrics */
        metrics?: (openmetrics.IMetric[]|null);
    }

    /** Represents a MetricFamily. */
    class MetricFamily implements IMetricFamily {

        /**
         * Constructs a new MetricFamily.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IMetricFamily);

        /** MetricFamily name. */
        public name: string;

        /** MetricFamily type. */
        public type: openmetrics.MetricType;

        /** MetricFamily unit. */
        public unit: string;

        /** MetricFamily help. */
        public help: string;

        /** MetricFamily metrics. */
        public metrics: openmetrics.IMetric[];

        /**
         * Creates a new MetricFamily instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MetricFamily instance
         */
        public static create(properties?: openmetrics.IMetricFamily): openmetrics.MetricFamily;

        /**
         * Encodes the specified MetricFamily message. Does not implicitly {@link openmetrics.MetricFamily.verify|verify} messages.
         * @param message MetricFamily message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IMetricFamily, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MetricFamily message, length delimited. Does not implicitly {@link openmetrics.MetricFamily.verify|verify} messages.
         * @param message MetricFamily message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IMetricFamily, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MetricFamily message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MetricFamily
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.MetricFamily;

        /**
         * Decodes a MetricFamily message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MetricFamily
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.MetricFamily;

        /**
         * Verifies a MetricFamily message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MetricFamily message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MetricFamily
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.MetricFamily;

        /**
         * Creates a plain object from a MetricFamily message. Also converts values to other types if specified.
         * @param message MetricFamily
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.MetricFamily, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MetricFamily to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MetricFamily
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** MetricType enum. */
    enum MetricType {
        UNKNOWN = 0,
        GAUGE = 1,
        COUNTER = 2,
        STATE_SET = 3,
        INFO = 4,
        HISTOGRAM = 5,
        GAUGE_HISTOGRAM = 6,
        SUMMARY = 7
    }

    /** Properties of a Metric. */
    interface IMetric {

        /** Metric labels */
        labels?: (openmetrics.ILabel[]|null);

        /** Metric metricPoints */
        metricPoints?: (openmetrics.IMetricPoint[]|null);
    }

    /** Represents a Metric. */
    class Metric implements IMetric {

        /**
         * Constructs a new Metric.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IMetric);

        /** Metric labels. */
        public labels: openmetrics.ILabel[];

        /** Metric metricPoints. */
        public metricPoints: openmetrics.IMetricPoint[];

        /**
         * Creates a new Metric instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Metric instance
         */
        public static create(properties?: openmetrics.IMetric): openmetrics.Metric;

        /**
         * Encodes the specified Metric message. Does not implicitly {@link openmetrics.Metric.verify|verify} messages.
         * @param message Metric message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IMetric, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Metric message, length delimited. Does not implicitly {@link openmetrics.Metric.verify|verify} messages.
         * @param message Metric message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IMetric, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Metric message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Metric
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.Metric;

        /**
         * Decodes a Metric message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Metric
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.Metric;

        /**
         * Verifies a Metric message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Metric message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Metric
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.Metric;

        /**
         * Creates a plain object from a Metric message. Also converts values to other types if specified.
         * @param message Metric
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.Metric, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Metric to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Metric
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Label. */
    interface ILabel {

        /** Label name */
        name?: (string|null);

        /** Label value */
        value?: (string|null);
    }

    /** Represents a Label. */
    class Label implements ILabel {

        /**
         * Constructs a new Label.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.ILabel);

        /** Label name. */
        public name: string;

        /** Label value. */
        public value: string;

        /**
         * Creates a new Label instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Label instance
         */
        public static create(properties?: openmetrics.ILabel): openmetrics.Label;

        /**
         * Encodes the specified Label message. Does not implicitly {@link openmetrics.Label.verify|verify} messages.
         * @param message Label message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.ILabel, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Label message, length delimited. Does not implicitly {@link openmetrics.Label.verify|verify} messages.
         * @param message Label message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.ILabel, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Label message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Label
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.Label;

        /**
         * Decodes a Label message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Label
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.Label;

        /**
         * Verifies a Label message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Label message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Label
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.Label;

        /**
         * Creates a plain object from a Label message. Also converts values to other types if specified.
         * @param message Label
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.Label, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Label to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Label
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a MetricPoint. */
    interface IMetricPoint {

        /** MetricPoint unknownValue */
        unknownValue?: (openmetrics.IUnknownValue|null);

        /** MetricPoint gaugeValue */
        gaugeValue?: (openmetrics.IGaugeValue|null);

        /** MetricPoint counterValue */
        counterValue?: (openmetrics.ICounterValue|null);

        /** MetricPoint histogramValue */
        histogramValue?: (openmetrics.IHistogramValue|null);

        /** MetricPoint stateSetValue */
        stateSetValue?: (openmetrics.IStateSetValue|null);

        /** MetricPoint infoValue */
        infoValue?: (openmetrics.IInfoValue|null);

        /** MetricPoint summaryValue */
        summaryValue?: (openmetrics.ISummaryValue|null);

        /** MetricPoint timestamp */
        timestamp?: (google.protobuf.ITimestamp|null);
    }

    /** Represents a MetricPoint. */
    class MetricPoint implements IMetricPoint {

        /**
         * Constructs a new MetricPoint.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IMetricPoint);

        /** MetricPoint unknownValue. */
        public unknownValue?: (openmetrics.IUnknownValue|null);

        /** MetricPoint gaugeValue. */
        public gaugeValue?: (openmetrics.IGaugeValue|null);

        /** MetricPoint counterValue. */
        public counterValue?: (openmetrics.ICounterValue|null);

        /** MetricPoint histogramValue. */
        public histogramValue?: (openmetrics.IHistogramValue|null);

        /** MetricPoint stateSetValue. */
        public stateSetValue?: (openmetrics.IStateSetValue|null);

        /** MetricPoint infoValue. */
        public infoValue?: (openmetrics.IInfoValue|null);

        /** MetricPoint summaryValue. */
        public summaryValue?: (openmetrics.ISummaryValue|null);

        /** MetricPoint timestamp. */
        public timestamp?: (google.protobuf.ITimestamp|null);

        /** MetricPoint value. */
        public value?: ("unknownValue"|"gaugeValue"|"counterValue"|"histogramValue"|"stateSetValue"|"infoValue"|"summaryValue");

        /**
         * Creates a new MetricPoint instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MetricPoint instance
         */
        public static create(properties?: openmetrics.IMetricPoint): openmetrics.MetricPoint;

        /**
         * Encodes the specified MetricPoint message. Does not implicitly {@link openmetrics.MetricPoint.verify|verify} messages.
         * @param message MetricPoint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IMetricPoint, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MetricPoint message, length delimited. Does not implicitly {@link openmetrics.MetricPoint.verify|verify} messages.
         * @param message MetricPoint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IMetricPoint, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MetricPoint message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MetricPoint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.MetricPoint;

        /**
         * Decodes a MetricPoint message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MetricPoint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.MetricPoint;

        /**
         * Verifies a MetricPoint message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MetricPoint message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MetricPoint
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.MetricPoint;

        /**
         * Creates a plain object from a MetricPoint message. Also converts values to other types if specified.
         * @param message MetricPoint
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.MetricPoint, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MetricPoint to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MetricPoint
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UnknownValue. */
    interface IUnknownValue {

        /** UnknownValue doubleValue */
        doubleValue?: (number|null);

        /** UnknownValue intValue */
        intValue?: (number|Long|null);
    }

    /** Represents an UnknownValue. */
    class UnknownValue implements IUnknownValue {

        /**
         * Constructs a new UnknownValue.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IUnknownValue);

        /** UnknownValue doubleValue. */
        public doubleValue?: (number|null);

        /** UnknownValue intValue. */
        public intValue?: (number|Long|null);

        /** UnknownValue value. */
        public value?: ("doubleValue"|"intValue");

        /**
         * Creates a new UnknownValue instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UnknownValue instance
         */
        public static create(properties?: openmetrics.IUnknownValue): openmetrics.UnknownValue;

        /**
         * Encodes the specified UnknownValue message. Does not implicitly {@link openmetrics.UnknownValue.verify|verify} messages.
         * @param message UnknownValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IUnknownValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UnknownValue message, length delimited. Does not implicitly {@link openmetrics.UnknownValue.verify|verify} messages.
         * @param message UnknownValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IUnknownValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an UnknownValue message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UnknownValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.UnknownValue;

        /**
         * Decodes an UnknownValue message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UnknownValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.UnknownValue;

        /**
         * Verifies an UnknownValue message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an UnknownValue message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UnknownValue
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.UnknownValue;

        /**
         * Creates a plain object from an UnknownValue message. Also converts values to other types if specified.
         * @param message UnknownValue
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.UnknownValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UnknownValue to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UnknownValue
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GaugeValue. */
    interface IGaugeValue {

        /** GaugeValue doubleValue */
        doubleValue?: (number|null);

        /** GaugeValue intValue */
        intValue?: (number|Long|null);
    }

    /** Represents a GaugeValue. */
    class GaugeValue implements IGaugeValue {

        /**
         * Constructs a new GaugeValue.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IGaugeValue);

        /** GaugeValue doubleValue. */
        public doubleValue?: (number|null);

        /** GaugeValue intValue. */
        public intValue?: (number|Long|null);

        /** GaugeValue value. */
        public value?: ("doubleValue"|"intValue");

        /**
         * Creates a new GaugeValue instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GaugeValue instance
         */
        public static create(properties?: openmetrics.IGaugeValue): openmetrics.GaugeValue;

        /**
         * Encodes the specified GaugeValue message. Does not implicitly {@link openmetrics.GaugeValue.verify|verify} messages.
         * @param message GaugeValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IGaugeValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GaugeValue message, length delimited. Does not implicitly {@link openmetrics.GaugeValue.verify|verify} messages.
         * @param message GaugeValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IGaugeValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GaugeValue message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GaugeValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.GaugeValue;

        /**
         * Decodes a GaugeValue message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GaugeValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.GaugeValue;

        /**
         * Verifies a GaugeValue message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GaugeValue message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GaugeValue
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.GaugeValue;

        /**
         * Creates a plain object from a GaugeValue message. Also converts values to other types if specified.
         * @param message GaugeValue
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.GaugeValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GaugeValue to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GaugeValue
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CounterValue. */
    interface ICounterValue {

        /** CounterValue doubleValue */
        doubleValue?: (number|null);

        /** CounterValue intValue */
        intValue?: (number|Long|null);

        /** CounterValue created */
        created?: (google.protobuf.ITimestamp|null);

        /** CounterValue exemplar */
        exemplar?: (openmetrics.IExemplar|null);
    }

    /** Represents a CounterValue. */
    class CounterValue implements ICounterValue {

        /**
         * Constructs a new CounterValue.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.ICounterValue);

        /** CounterValue doubleValue. */
        public doubleValue?: (number|null);

        /** CounterValue intValue. */
        public intValue?: (number|Long|null);

        /** CounterValue created. */
        public created?: (google.protobuf.ITimestamp|null);

        /** CounterValue exemplar. */
        public exemplar?: (openmetrics.IExemplar|null);

        /** CounterValue total. */
        public total?: ("doubleValue"|"intValue");

        /**
         * Creates a new CounterValue instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CounterValue instance
         */
        public static create(properties?: openmetrics.ICounterValue): openmetrics.CounterValue;

        /**
         * Encodes the specified CounterValue message. Does not implicitly {@link openmetrics.CounterValue.verify|verify} messages.
         * @param message CounterValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.ICounterValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified CounterValue message, length delimited. Does not implicitly {@link openmetrics.CounterValue.verify|verify} messages.
         * @param message CounterValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.ICounterValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a CounterValue message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CounterValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.CounterValue;

        /**
         * Decodes a CounterValue message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CounterValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.CounterValue;

        /**
         * Verifies a CounterValue message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a CounterValue message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CounterValue
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.CounterValue;

        /**
         * Creates a plain object from a CounterValue message. Also converts values to other types if specified.
         * @param message CounterValue
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.CounterValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this CounterValue to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CounterValue
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a HistogramValue. */
    interface IHistogramValue {

        /** HistogramValue doubleValue */
        doubleValue?: (number|null);

        /** HistogramValue intValue */
        intValue?: (number|Long|null);

        /** HistogramValue count */
        count?: (number|Long|null);

        /** HistogramValue created */
        created?: (google.protobuf.ITimestamp|null);

        /** HistogramValue buckets */
        buckets?: (openmetrics.HistogramValue.IBucket[]|null);
    }

    /** Represents a HistogramValue. */
    class HistogramValue implements IHistogramValue {

        /**
         * Constructs a new HistogramValue.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IHistogramValue);

        /** HistogramValue doubleValue. */
        public doubleValue?: (number|null);

        /** HistogramValue intValue. */
        public intValue?: (number|Long|null);

        /** HistogramValue count. */
        public count: (number|Long);

        /** HistogramValue created. */
        public created?: (google.protobuf.ITimestamp|null);

        /** HistogramValue buckets. */
        public buckets: openmetrics.HistogramValue.IBucket[];

        /** HistogramValue sum. */
        public sum?: ("doubleValue"|"intValue");

        /**
         * Creates a new HistogramValue instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HistogramValue instance
         */
        public static create(properties?: openmetrics.IHistogramValue): openmetrics.HistogramValue;

        /**
         * Encodes the specified HistogramValue message. Does not implicitly {@link openmetrics.HistogramValue.verify|verify} messages.
         * @param message HistogramValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IHistogramValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified HistogramValue message, length delimited. Does not implicitly {@link openmetrics.HistogramValue.verify|verify} messages.
         * @param message HistogramValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IHistogramValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a HistogramValue message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns HistogramValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.HistogramValue;

        /**
         * Decodes a HistogramValue message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns HistogramValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.HistogramValue;

        /**
         * Verifies a HistogramValue message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a HistogramValue message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HistogramValue
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.HistogramValue;

        /**
         * Creates a plain object from a HistogramValue message. Also converts values to other types if specified.
         * @param message HistogramValue
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.HistogramValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this HistogramValue to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for HistogramValue
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace HistogramValue {

        /** Properties of a Bucket. */
        interface IBucket {

            /** Bucket count */
            count?: (number|Long|null);

            /** Bucket upperBound */
            upperBound?: (number|null);

            /** Bucket exemplar */
            exemplar?: (openmetrics.IExemplar|null);
        }

        /** Represents a Bucket. */
        class Bucket implements IBucket {

            /**
             * Constructs a new Bucket.
             * @param [properties] Properties to set
             */
            constructor(properties?: openmetrics.HistogramValue.IBucket);

            /** Bucket count. */
            public count: (number|Long);

            /** Bucket upperBound. */
            public upperBound: number;

            /** Bucket exemplar. */
            public exemplar?: (openmetrics.IExemplar|null);

            /**
             * Creates a new Bucket instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Bucket instance
             */
            public static create(properties?: openmetrics.HistogramValue.IBucket): openmetrics.HistogramValue.Bucket;

            /**
             * Encodes the specified Bucket message. Does not implicitly {@link openmetrics.HistogramValue.Bucket.verify|verify} messages.
             * @param message Bucket message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: openmetrics.HistogramValue.IBucket, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Bucket message, length delimited. Does not implicitly {@link openmetrics.HistogramValue.Bucket.verify|verify} messages.
             * @param message Bucket message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: openmetrics.HistogramValue.IBucket, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Bucket message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Bucket
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.HistogramValue.Bucket;

            /**
             * Decodes a Bucket message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Bucket
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.HistogramValue.Bucket;

            /**
             * Verifies a Bucket message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Bucket message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Bucket
             */
            public static fromObject(object: { [k: string]: any }): openmetrics.HistogramValue.Bucket;

            /**
             * Creates a plain object from a Bucket message. Also converts values to other types if specified.
             * @param message Bucket
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: openmetrics.HistogramValue.Bucket, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Bucket to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Bucket
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of an Exemplar. */
    interface IExemplar {

        /** Exemplar value */
        value?: (number|null);

        /** Exemplar timestamp */
        timestamp?: (google.protobuf.ITimestamp|null);

        /** Exemplar label */
        label?: (openmetrics.ILabel[]|null);
    }

    /** Represents an Exemplar. */
    class Exemplar implements IExemplar {

        /**
         * Constructs a new Exemplar.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IExemplar);

        /** Exemplar value. */
        public value: number;

        /** Exemplar timestamp. */
        public timestamp?: (google.protobuf.ITimestamp|null);

        /** Exemplar label. */
        public label: openmetrics.ILabel[];

        /**
         * Creates a new Exemplar instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Exemplar instance
         */
        public static create(properties?: openmetrics.IExemplar): openmetrics.Exemplar;

        /**
         * Encodes the specified Exemplar message. Does not implicitly {@link openmetrics.Exemplar.verify|verify} messages.
         * @param message Exemplar message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IExemplar, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Exemplar message, length delimited. Does not implicitly {@link openmetrics.Exemplar.verify|verify} messages.
         * @param message Exemplar message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IExemplar, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Exemplar message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Exemplar
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.Exemplar;

        /**
         * Decodes an Exemplar message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Exemplar
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.Exemplar;

        /**
         * Verifies an Exemplar message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Exemplar message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Exemplar
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.Exemplar;

        /**
         * Creates a plain object from an Exemplar message. Also converts values to other types if specified.
         * @param message Exemplar
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.Exemplar, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Exemplar to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Exemplar
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a StateSetValue. */
    interface IStateSetValue {

        /** StateSetValue states */
        states?: (openmetrics.StateSetValue.IState[]|null);
    }

    /** Represents a StateSetValue. */
    class StateSetValue implements IStateSetValue {

        /**
         * Constructs a new StateSetValue.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IStateSetValue);

        /** StateSetValue states. */
        public states: openmetrics.StateSetValue.IState[];

        /**
         * Creates a new StateSetValue instance using the specified properties.
         * @param [properties] Properties to set
         * @returns StateSetValue instance
         */
        public static create(properties?: openmetrics.IStateSetValue): openmetrics.StateSetValue;

        /**
         * Encodes the specified StateSetValue message. Does not implicitly {@link openmetrics.StateSetValue.verify|verify} messages.
         * @param message StateSetValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IStateSetValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified StateSetValue message, length delimited. Does not implicitly {@link openmetrics.StateSetValue.verify|verify} messages.
         * @param message StateSetValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IStateSetValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a StateSetValue message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns StateSetValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.StateSetValue;

        /**
         * Decodes a StateSetValue message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns StateSetValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.StateSetValue;

        /**
         * Verifies a StateSetValue message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a StateSetValue message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns StateSetValue
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.StateSetValue;

        /**
         * Creates a plain object from a StateSetValue message. Also converts values to other types if specified.
         * @param message StateSetValue
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.StateSetValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this StateSetValue to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for StateSetValue
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace StateSetValue {

        /** Properties of a State. */
        interface IState {

            /** State enabled */
            enabled?: (boolean|null);

            /** State name */
            name?: (string|null);
        }

        /** Represents a State. */
        class State implements IState {

            /**
             * Constructs a new State.
             * @param [properties] Properties to set
             */
            constructor(properties?: openmetrics.StateSetValue.IState);

            /** State enabled. */
            public enabled: boolean;

            /** State name. */
            public name: string;

            /**
             * Creates a new State instance using the specified properties.
             * @param [properties] Properties to set
             * @returns State instance
             */
            public static create(properties?: openmetrics.StateSetValue.IState): openmetrics.StateSetValue.State;

            /**
             * Encodes the specified State message. Does not implicitly {@link openmetrics.StateSetValue.State.verify|verify} messages.
             * @param message State message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: openmetrics.StateSetValue.IState, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified State message, length delimited. Does not implicitly {@link openmetrics.StateSetValue.State.verify|verify} messages.
             * @param message State message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: openmetrics.StateSetValue.IState, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a State message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns State
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.StateSetValue.State;

            /**
             * Decodes a State message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns State
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.StateSetValue.State;

            /**
             * Verifies a State message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a State message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns State
             */
            public static fromObject(object: { [k: string]: any }): openmetrics.StateSetValue.State;

            /**
             * Creates a plain object from a State message. Also converts values to other types if specified.
             * @param message State
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: openmetrics.StateSetValue.State, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this State to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for State
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of an InfoValue. */
    interface IInfoValue {

        /** InfoValue info */
        info?: (openmetrics.ILabel[]|null);
    }

    /** Represents an InfoValue. */
    class InfoValue implements IInfoValue {

        /**
         * Constructs a new InfoValue.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.IInfoValue);

        /** InfoValue info. */
        public info: openmetrics.ILabel[];

        /**
         * Creates a new InfoValue instance using the specified properties.
         * @param [properties] Properties to set
         * @returns InfoValue instance
         */
        public static create(properties?: openmetrics.IInfoValue): openmetrics.InfoValue;

        /**
         * Encodes the specified InfoValue message. Does not implicitly {@link openmetrics.InfoValue.verify|verify} messages.
         * @param message InfoValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.IInfoValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified InfoValue message, length delimited. Does not implicitly {@link openmetrics.InfoValue.verify|verify} messages.
         * @param message InfoValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.IInfoValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an InfoValue message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns InfoValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.InfoValue;

        /**
         * Decodes an InfoValue message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns InfoValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.InfoValue;

        /**
         * Verifies an InfoValue message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an InfoValue message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns InfoValue
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.InfoValue;

        /**
         * Creates a plain object from an InfoValue message. Also converts values to other types if specified.
         * @param message InfoValue
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.InfoValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this InfoValue to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for InfoValue
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SummaryValue. */
    interface ISummaryValue {

        /** SummaryValue doubleValue */
        doubleValue?: (number|null);

        /** SummaryValue intValue */
        intValue?: (number|Long|null);

        /** SummaryValue count */
        count?: (number|Long|null);

        /** SummaryValue created */
        created?: (google.protobuf.ITimestamp|null);

        /** SummaryValue quantile */
        quantile?: (openmetrics.SummaryValue.IQuantile[]|null);
    }

    /** Represents a SummaryValue. */
    class SummaryValue implements ISummaryValue {

        /**
         * Constructs a new SummaryValue.
         * @param [properties] Properties to set
         */
        constructor(properties?: openmetrics.ISummaryValue);

        /** SummaryValue doubleValue. */
        public doubleValue?: (number|null);

        /** SummaryValue intValue. */
        public intValue?: (number|Long|null);

        /** SummaryValue count. */
        public count: (number|Long);

        /** SummaryValue created. */
        public created?: (google.protobuf.ITimestamp|null);

        /** SummaryValue quantile. */
        public quantile: openmetrics.SummaryValue.IQuantile[];

        /** SummaryValue sum. */
        public sum?: ("doubleValue"|"intValue");

        /**
         * Creates a new SummaryValue instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SummaryValue instance
         */
        public static create(properties?: openmetrics.ISummaryValue): openmetrics.SummaryValue;

        /**
         * Encodes the specified SummaryValue message. Does not implicitly {@link openmetrics.SummaryValue.verify|verify} messages.
         * @param message SummaryValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: openmetrics.ISummaryValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SummaryValue message, length delimited. Does not implicitly {@link openmetrics.SummaryValue.verify|verify} messages.
         * @param message SummaryValue message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: openmetrics.ISummaryValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SummaryValue message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SummaryValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.SummaryValue;

        /**
         * Decodes a SummaryValue message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SummaryValue
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.SummaryValue;

        /**
         * Verifies a SummaryValue message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SummaryValue message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SummaryValue
         */
        public static fromObject(object: { [k: string]: any }): openmetrics.SummaryValue;

        /**
         * Creates a plain object from a SummaryValue message. Also converts values to other types if specified.
         * @param message SummaryValue
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: openmetrics.SummaryValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SummaryValue to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SummaryValue
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace SummaryValue {

        /** Properties of a Quantile. */
        interface IQuantile {

            /** Quantile quantile */
            quantile?: (number|null);

            /** Quantile value */
            value?: (number|null);
        }

        /** Represents a Quantile. */
        class Quantile implements IQuantile {

            /**
             * Constructs a new Quantile.
             * @param [properties] Properties to set
             */
            constructor(properties?: openmetrics.SummaryValue.IQuantile);

            /** Quantile quantile. */
            public quantile: number;

            /** Quantile value. */
            public value: number;

            /**
             * Creates a new Quantile instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Quantile instance
             */
            public static create(properties?: openmetrics.SummaryValue.IQuantile): openmetrics.SummaryValue.Quantile;

            /**
             * Encodes the specified Quantile message. Does not implicitly {@link openmetrics.SummaryValue.Quantile.verify|verify} messages.
             * @param message Quantile message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: openmetrics.SummaryValue.IQuantile, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Quantile message, length delimited. Does not implicitly {@link openmetrics.SummaryValue.Quantile.verify|verify} messages.
             * @param message Quantile message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: openmetrics.SummaryValue.IQuantile, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Quantile message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Quantile
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): openmetrics.SummaryValue.Quantile;

            /**
             * Decodes a Quantile message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Quantile
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): openmetrics.SummaryValue.Quantile;

            /**
             * Verifies a Quantile message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Quantile message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Quantile
             */
            public static fromObject(object: { [k: string]: any }): openmetrics.SummaryValue.Quantile;

            /**
             * Creates a plain object from a Quantile message. Also converts values to other types if specified.
             * @param message Quantile
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: openmetrics.SummaryValue.Quantile, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Quantile to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Quantile
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}

/** Namespace google. */
export namespace google {

    /** Namespace protobuf. */
    namespace protobuf {

        /** Properties of a Timestamp. */
        interface ITimestamp {

            /** Timestamp seconds */
            seconds?: (number|Long|null);

            /** Timestamp nanos */
            nanos?: (number|null);
        }

        /** Represents a Timestamp. */
        class Timestamp implements ITimestamp {

            /**
             * Constructs a new Timestamp.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ITimestamp);

            /** Timestamp seconds. */
            public seconds: (number|Long);

            /** Timestamp nanos. */
            public nanos: number;

            /**
             * Creates a new Timestamp instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Timestamp instance
             */
            public static create(properties?: google.protobuf.ITimestamp): google.protobuf.Timestamp;

            /**
             * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Timestamp message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Timestamp;

            /**
             * Decodes a Timestamp message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Timestamp;

            /**
             * Verifies a Timestamp message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Timestamp
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Timestamp;

            /**
             * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
             * @param message Timestamp
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Timestamp, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Timestamp to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Timestamp
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
