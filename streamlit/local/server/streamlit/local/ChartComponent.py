from .caseconverters import to_upper_camel_case, to_lower_camel_case

class ChartComponent:
    def __init__(self, type, props):
        """Constructor.

        Args:
            type -- a snake-case string with the component name.
            props -- the ReCharts component value as a dict.
        """
        self._type = type
        self._props = [(str(k), str(v)) for (k,v) in props.items()]

    @property
    def type(self):
        return self._type

    def marshall(self, proto_component):
        proto_component.type = to_upper_camel_case(self._type)
        for (key, value) in self._props:
            proto_prop = proto_component.props.add()
            proto_prop.key = to_lower_camel_case(key)
            proto_prop.value = value
