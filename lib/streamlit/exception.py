import sys
import traceback

def marshall(element, exception, exception_traceback=None):
    """Marshall an element.exception proto message.

    See DeltaGenerator for in-depth docs.

    """
    element.exception.type = type(exception).__name__
    element.exception.message = str(exception)

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

    element.exception.stack_trace.extend(stack_trace)

