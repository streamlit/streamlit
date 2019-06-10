import sys
import traceback


def marshall(exception_proto, exception, exception_traceback=None):
    """Marshalls an Exception.proto message.

    Parameters
    ----------
    exception_proto : Exception.proto
        The Exception protobuf to fill out

    exception : Exception
        The exception whose data we're extracting

    exception_traceback : Exception Traceback or None
        If None or False, does not show display the trace. If True,
        tries to capture a trace automatically. If a Traceback object,
        displays the given traceback.
    """
    exception_proto.type = type(exception).__name__
    exception_proto.message = str(exception)

    # Get and extract the traceback for the exception.
    if exception_traceback is not None:
        extracted_traceback = traceback.extract_tb(exception_traceback)
    elif hasattr(exception, '__traceback__'):
        # This is the Python 3 way to get the traceback.
        extracted_traceback = traceback.extract_tb(exception.__traceback__)
    else:
        # Hack for Python 2 which will extract the traceback as long as this
        # method was called on the exception as it was caught, which is
        # likely what the user would do.
        _, live_exception, live_traceback = sys.exc_info()
        if exception == live_exception:
            extracted_traceback = traceback.extract_tb(live_traceback)
        else:
            extracted_traceback = None

    # Format the extracted traceback and add it to the protobuf element.
    if extracted_traceback is None:
        stack_trace = [
            'Cannot extract the stack trace for this exception. '
            'Try calling exception() within the `catch` block.']
    else:
        stack_trace = traceback.format_list(extracted_traceback)

    exception_proto.stack_trace.extend(stack_trace)

