declare global {
    interface Window {
        analytics: any;
    }
}
/** @function initializeSegment
 * Loads the global analytics service provided segment.io
 *  @see {@link https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/quickstart/#}
 *  @version 4.1.0
 */
export declare const initializeSegment: () => void;
