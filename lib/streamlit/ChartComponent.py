# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import case_converters


class ChartComponent(object):
    def __init__(self, type, props):
        """Constructor.

        Parameters
        ----------
        type : str
            A snake-case string with the component name.
        props : dict
            The ReCharts component value as a dict.

        """
        self._type = type
        self._props = [(str(k), str(v)) for (k,v) in props.items()]

    @property
    def type(self):
        return self._type

    def marshall(self, proto_component):
        proto_component.type = case_converters.to_upper_camel_case(self._type)
        for (key, value) in self._props:
            proto_prop = proto_component.props.add()
            proto_prop.key = case_converters.to_lower_camel_case(key)
            proto_prop.value = value
