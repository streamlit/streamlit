from streamlit.proto.Progress_pb2 import Progress as ProgressProto
from streamlit.errors import StreamlitAPIException


class ProgressMixin:
    def progress(dg, value):
        """Display a progress bar.

        Parameters
        ----------
        value : int or float
            0 <= value <= 100 for int

            0.0 <= value <= 1.0 for float

        Example
        -------
        Here is an example of a progress bar increasing over time:

        >>> import time
        >>>
        >>> my_bar = st.progress(0)
        >>>
        >>> for percent_complete in range(100):
        ...     time.sleep(0.1)
        ...     my_bar.progress(percent_complete + 1)

        """
        # TODO: standardize numerical type checking across st.* functions.
        progress_proto = ProgressProto()

        if isinstance(value, float):
            if 0.0 <= value <= 1.0:
                progress_proto.value = int(value * 100)
            else:
                raise StreamlitAPIException(
                    "Progress Value has invalid value [0.0, 1.0]: %f" % value
                )

        elif isinstance(value, int):
            if 0 <= value <= 100:
                progress_proto.value = value
            else:
                raise StreamlitAPIException(
                    "Progress Value has invalid value [0, 100]: %d" % value
                )
        else:
            raise StreamlitAPIException(
                "Progress Value has invalid type: %s" % type(value).__name__
            )

        return dg._enqueue("progress", progress_proto)  # type: ignore
