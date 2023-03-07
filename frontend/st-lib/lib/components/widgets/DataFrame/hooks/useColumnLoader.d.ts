import { Quiver } from "src/lib/Quiver";
import { Arrow as ArrowProto } from "src/autogen/proto";
import { BaseColumn, BaseColumnProps, ColumnCreator } from "src/components/widgets/DataFrame/columns";
export declare const INDEX_IDENTIFIER = "index";
export declare const COLUMN_POSITION_PREFIX = "col:";
/**
 * Options to configure columns.
 */
export interface ColumnConfigProps {
    width?: number;
    title?: string;
    type?: string;
    hidden?: boolean;
    editable?: boolean;
    metadata?: Record<string, unknown>;
    alignment?: string;
}
/**
 * Apply the user-defined column configuration if supplied.
 *
 * @param columnProps - The column properties to apply the config to.
 * @param columnConfigMapping - The user-defined column configuration mapping.
 *
 * @return the column properties with the config applied.
 */
export declare function applyColumnConfig(columnProps: BaseColumnProps, columnConfigMapping: Map<string | number, ColumnConfigProps>): BaseColumnProps;
/**
 * Extracts the user-defined column configuration from the proto message.
 *
 * @param element - The proto message of the dataframe element.
 *
 * @returns the user-defined column configuration.
 */
export declare function getColumnConfig(element: ArrowProto): Map<string, any>;
type ColumnLoaderReturn = {
    columns: BaseColumn[];
};
/**
 * Get the column type (creator class of column type) for the given column properties.
 *
 * @param column - The column properties.
 *
 * @returns the column creator of the corresponding column type.
 */
export declare function getColumnType(column: BaseColumnProps): ColumnCreator;
/**
 * Custom hook that handles loads and configures all table columns from the Arrow table.
 *
 * @param element - The proto message of the dataframe element
 * @param data - The Arrow data extracted from the proto message
 * @param disabled - Whether the widget is disabled
 *
 * @returns the columns and the cell content getter compatible with glide-data-grid.
 */
declare function useColumnLoader(element: ArrowProto, data: Quiver, disabled: boolean): ColumnLoaderReturn;
export default useColumnLoader;
