import textwrap


def clean_text(text):
    return textwrap.dedent(str(text)).strip()
