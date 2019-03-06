/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Component that displays a single cell in a Pandas Dataframe.
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { SortDirection } from '../SortDirection';

class DataFrameCell extends PureComponent {
  render() {
    const {
      columnIndex, rowIndex, className, style, contents, columnSortDirection, headerClickedCallback,
    } = this.props;

    let onClick;
    let role;
    let tabIndex;
    if (headerClickedCallback != null && rowIndex === 0) {
      onClick = () => headerClickedCallback(columnIndex);
      role = "button";
      tabIndex = 0;
    } else {
      onClick = undefined;
      role = undefined;
      tabIndex = undefined;
    }

    // The sort icon is only drawn in the top row
    const sortIcon = rowIndex === 0 ? this.drawSortIcon(columnSortDirection) : undefined;

    return (
      <div className={className} style={style} onClick={onClick} role={role} tabIndex={tabIndex}>
        {sortIcon}
        {contents}
      </div>
      );
  }

  drawSortIcon(sortDirection) {
    // If these icons are changed, you may also need to update DataFrame.SORT_ICON_WIDTH
    // to ensure proper column width padding
    switch (sortDirection) {
      case SortDirection.ASCENDING:
        return (
          <svg className="sort-arrow-icon" viewBox="0 -1 10 10">
            <use xlinkHref="./open-iconic.min.svg#arrow-thick-top"/>
          </svg>
        );

      case SortDirection.DESCENDING:
        return (
          <svg className="sort-arrow-icon" viewBox="0 -1 10 10">
            <use xlinkHref="./open-iconic.min.svg#arrow-thick-bottom"/>
          </svg>
        );

      case undefined:
      default:
        return null;
    }
  }
}

DataFrameCell.defaultProps = {
  columnSortDirection: undefined,
  headerClickedCallback: undefined,
};

DataFrameCell.propTypes = {
  /** The cell's column index in the DataFrame */
  columnIndex: PropTypes.number.isRequired,

  /** The cell's row index in the DataFrame */
  rowIndex: PropTypes.number.isRequired,

  /** The cell's css class name */
  className: PropTypes.string.isRequired,

  /** Additional css styling for the cell */
  style: PropTypes.object.isRequired,

  /** The HTML contents of the cell. Added to the DOM as a child of this DataFrameCell  */
  contents: PropTypes.node.isRequired,

  /**
   * The {@link SortDirection} for this column, or undefined if the column is unsorted.
   * No sorting is done here - this property is used to determine which, if any, sort icon
   * to draw in column-header cells.
   */
  columnSortDirection: PropTypes.string,

  /**
   * An optional callback that will be called when a column header is clicked.
   * (The property is ignored for non-header cells). The callback will be passed this
   * cell's columnIndex.
   *
   * {@link DataFrame} uses this to toggle column sorting.
   */
  headerClickedCallback: PropTypes.func,
};

export default DataFrameCell;
