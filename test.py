"""Test scripts to see if the server is working."""

from tiny_notebook import Notebook

print('Notebook')
print(Notebook)
notebook = Notebook()

import time # debug

with Notebook() as write:
    print('Created a Notebook.')
    write.text('This is some text. Hello, world!\nAnd some more text.\n    ...and a couple spaces with text')
    write.alert('Sleeping for 5 seconds.')
    import time
    time.sleep(5)
    print("We're about to send out a bit more text.")
    write.text("Here is a bit more text. Let's see how this renders!")
    write.alert('Success', type='success')
    write.alert('Info', type='info')
    write.alert('Warning', type='warning')
print('Sleeping for another second...')
time.sleep(1)
