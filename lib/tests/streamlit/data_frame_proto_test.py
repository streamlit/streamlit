"""Unit test for data_frame_proto.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import unittest

import streamlit.data_frame_proto as data_frame_proto


class DataFrameProtoTest(unittest.TestCase):
    """Test streamlit.data_frame_proto."""

    def test_marshall_data_frame(self):
        """Test streamlit.data_frame_proto.marshall_data_frame.
        """
        pass

    def test_convert_anything_to_df(self):
        """Test streamlit.data_frame_proto.convert_anything_to_df.

        Need to test dataframe is:
        * pandas.core.frame.DataFrame
        * pandas_styler
        * numpy.ndaray and has a shape
        * default
        """
        pass

    def test_is_pandas_styler(self):
        """Test streamlit.data_frame_proto._is_pandas_styler.

        Need to test the following:
        * object is of type pandas.io.formats.style.Styler
        """
        pass

    def test_marshall_styles(self):
        """Test streamlit.data_frame_proto._marshall_styles.

        Need to test the following:
        * styler is:
          * None
          * not None
        * display_values is:
          * None
          * not None
        """
        pass

    def test_get_css_styles(self):
        """Test streamlit.data_frame_proto._get_css_styles.

        Need to test the following:
        * cell_selector_regex isnt found
        * cell_style['props'] isn't a list
        * cell_style['props'] does not equal 2
        * style has name and value
        * style does not have name and value
        """
        pass

    def test_get_custom_display_values(self):
        """Test streamlit.data_frame_proto._get_custom_display_values.

        Need to test the following:
        * row_header regex is found
          * we find row header more than once.
        * cell_selector regex isn't found.
        * has_custom_display_values
          * true
          * false
        """
        pass

    def test_marshall_index(self):
        """Test streamlit.data_frame_proto._marshall_index.

        Need to test type(pandas_index):
        * pd.Index
        * pd.RangeIndex
          * index min or max is NA
          * index min or max is not NA
        * pd.MultiIndex
          * has codes
          * does not have codes
        * pd.DateTime
          * has timezone
          * no timezone
        * pd.Timedelta
        * pd.Int64
        * pd.Float64
        * not found
        """
        pass

    def test_marshall_table(self):
        """Test streamlit.data_frame_proto._marshall_table.

        Need to test the following:
        * pandas_table
        """
        pass

    def test_any_array(self):
        """Test streamlit.data_frame_proto._marshall_any_array.

        Need to test the following of DataFrame.any:
        * pandas_array doesn't have a dtype
        * pandas_array isn't 1D
        * Check data types:
          * np.floating
          * np.timedelta64
          * np.integer
          * np.bool
          * np.object
          * np.datetime64
            * pandas_array.dt.tz is None
            * pandas_array.dt.tz is not None
          * data type not found
        """
        pass

    def test_add_rows(self):
        """Test streamlit.data_frame_proto._add_rows.

        Need to test the following:
        * df1.data.cols is empty
           * df2.data.cols is empty
           * df2.data.cols is not empty
        * len(df1.data.cols) != len(df2.data.cols)
        * df1.data.cols and df2.cols is not empty.
        """
        pass

    def test_concat_index(self):
        """Test streamlit.data_frame_proto._concat_index.

        Need to test the following:
        * index1 is empty
        * index1.type != index2.type
        * protobuf.index types of:
          * plain
          * range
          * multi
          * int_64
          * datetime
          * timedelta
          * default
        """
        pass

    def test_concat_any_array(self):
        """Test streamlit.data_frame_proto._concat_any_array.

        Need to test the following:
        * df.any1 is empty
        * df.any1.type != df.any2.type
        * df.any1 and df.any2 are not empty.
        """
        pass

    def test_concat_cell_style_array(self):
        """Test streamlit.data_frame_proto._concat_cell_style_array.

        Need to test the following:
        * style1 is empty
        * style1 and style2 are not empty.
        """
        pass

    def test_get_data_frame(self):
        """Test streamlit.data_frame_proto._get_data_frame.

        Need to test the following:
        * delta.new_element
          * element_type not in data_frame, table, chart
          * element_type of:
            * data_frame
            * table
            * chart
            * vega_lite_chart
              * if there's a name
              * only one dataset
              * default
        * delta.add_rows
          * add_rows.name != name
          * add_rows.name == name
        * delta not new_elment or add_rows
        """
        pass

    def test_get_dataset(self):
        """Test streamlit.data_frame_proto._get_dataset.

        Need to test getting the data from a pandas.DataFrame if:
        * the name is found
        * the name is not found
        """
        pass

    def test_index_len(self):
        """Test streamlit.data_frame_proto._index_len.

        Need to test length of the following protobuf.Index types:
        * plain
        * range
        * multi
          * labels == 0
          * labels != 0
        * int_64
        * datetime
        * timedelta
        """
        pass

    def test_any_array_len(self):
        """Test streamlit.data_frame_proto._any_array_len.

        Need to test the following:
        * Gets the length of pandas.DataFrame.any
        """
        pass
