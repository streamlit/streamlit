# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


class NoStaticFiles(Exception):
    pass


class S3NoCredentials(Exception):
    pass


class NoSessionContext(Exception):
    pass


class MarkdownFormattedException(Exception):
    """Exceptions with Markdown in their description.

    Instances of this class can use markdown in their messages, which will get
    nicely formatted on the frontend.
    """

    pass


class StreamlitAPIException(MarkdownFormattedException):
    """Base class for Streamlit API exceptions.

    An API exception should be thrown when user code interacts with the
    Streamlit API incorrectly. (That is, when we throw an exception as a
    result of a user's malformed `st.foo` call, it should be a
    StreamlitAPIException or subclass.)

    When displaying these exceptions on the frontend, we strip Streamlit
    entries from the stack trace so that the user doesn't see a bunch of
    noise related to Streamlit internals.

    """

    pass


class DuplicateWidgetID(StreamlitAPIException):
    pass


class StreamlitAPIWarning(StreamlitAPIException, Warning):
    """Used to display a warning.

    Note that this should not be "raised", but passed to st.exception
    instead.
    """

    def __init__(self, *args):
        super(StreamlitAPIWarning, self).__init__(*args)
        import inspect
        import traceback

        f = inspect.currentframe()
        self.tacked_on_stack = traceback.extract_stack(f)


class StreamlitDeprecationWarning(StreamlitAPIWarning):
    """Used to display a warning.

    Note that this should not be "raised", but passed to st.exception
    instead.
    """

    def __init__(self, config_option, msg, *args):
        message = """
{0}

You can disable this warning by disabling the config option:
`{1}`

```
st.set_option('{1}', False)
```
or in your `.streamlit/config.toml`
```
[deprecation]
{2} = False
```
    """.format(
            msg, config_option, config_option.split(".")[1]
        )
        # TODO: create a deprecation docs page to add to deprecation msg #1669
        # For more details, please see: https://docs.streamlit.io/path/to/deprecation/docs.html

        super(StreamlitAPIWarning, self).__init__(message, *args)
