import inspect


def wrap_widget(original_widget, callback_name):
    def wrapper(*args, **kwargs):
        def new_widget(callback):
            sig = inspect.signature(callback)
            num_parameters = len(sig.parameters)

            def context_passer(context=None):
                print("Hello")
                print(sig)
                if num_parameters > 1:
                    kwargs[callback_name] = lambda x: callback(x, context)
                else:
                    kwargs[callback_name] = callback

                return original_widget(*args, **kwargs)

            return context_passer

        return new_widget

    return wrapper
