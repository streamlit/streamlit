# Sanity checks

If you're having problems running your Streamlit app, here are a few things to try out.

## Check #0: Are you using a Streamlit-supported version of Python?

Streamlit will maintain backwards-compatibility with earlier Python versions as practical,
guaranteeing compatibility with _at least_ the last three minor versions of Python 3.

As new versions of Python are released, we will try to be compatible with the new version as soon
as possible, though frequently we are at the mercy of other Python packages to support these new versions as well.

Streamlit currently supports versions 3.6, 3.7 and 3.8 of Python. Python 3.9 support is currently on-hold as we
wait for [pyarrow to support Python 3.9](https://arrow.apache.org/docs/python/install.html#python-compatibility).

## Check #1: Is Streamlit running?

On a Mac or Linux machine, type this on the terminal:

```bash
ps -Al | grep streamlit
```

If you don't see `streamlit run` in the output (or `streamlit hello`, if that's
the command you ran) then the Streamlit server is not running. So re-run your command and see if the bug goes away.

## Check #2: Is this an already-fixed Streamlit bug?

We try to fix bugs quickly, so many times a problem will go away when you
upgrade Streamlit. So the first thing to try when having an issue is upgrading
to the latest version of Streamlit:

```bash
pip install --upgrade streamlit
streamlit version
```

...and then verify that the version number printed is `0.78.0`.

**Try reproducing the issue now.** If not fixed, keep reading on.

## Check #3: Are you running the correct Streamlit binary?

Let's check whether your Python environment is set up correctly. Edit the
Streamlit script where you're experiencing your issue, **comment everything
out, and add these lines instead:**

```python
import streamlit as st
st.write(st.__version__)
```

...then call `streamlit run` on your script and make sure it says the same
version as above. If not the same version, check out [these
instructions](clean-install.md) for some sure-fire ways to set up your
environment.

## Check #4: Is your browser caching your app too aggressively?

There are two easy ways to check this:

1. Load your app in a browser then press `Ctrl-Shift-R` or `⌘-Shift-R` to do a
   hard refresh (Chrome/Firefox).

2. As a test, run Streamlit on another port. This way the browser starts the
   page with a brand new cache. For that, pass the `--server.port`
   argument to Streamlit on the command line:

   ```bash
   streamlit run my_app.py --server.port=9876
   ```

## Check #5: Is this a Streamlit regression?

If you've upgraded to the latest version of Streamlit and things aren't
working, you can downgrade at any time using this command:

```bash
pip install --upgrade streamlit==0.50
```

...where `0.50` is the version you'd like to downgrade to. See
[Changelog](../changelog.md) for a complete list of Streamlit versions.

## Check #6 [Windows]: Is Python added to your PATH?

When installed by downloading from [python.org](https://www.python.org/downloads/), Python is
not automatically added to the [Windows system PATH](https://www.howtogeek.com/118594/how-to-edit-your-system-path-for-easy-command-line-access). Because of this, you may get error messages
like the following:

Command Prompt:

```shell
C:\Users\streamlit> streamlit hello
'streamlit' is not recognized as an internal or external command,
operable program or batch file.
```

PowerShell:

```shell
PS C:\Users\streamlit> streamlit hello
streamlit : The term 'streamlit' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that
the path is correct and try again.
At line:1 char:1
+ streamlit hello
+ ~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (streamlit:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
```

To resolve this issue, add [Python to the Windows system PATH](https://datatofish.com/add-python-to-windows-path/).

After adding Python to your Windows PATH, you should then be able to follow the instructions in our [Get Started](../getting_started.html#install-streamlit) section.

## Check #7 [Windows]: Do you need Build Tools for Visual Studio installed?

Starting with version [0.63](http://localhost:8000/changelog.html#version-0-63-0) (July 2020), Streamlit added [pyarrow](https://arrow.apache.org/docs/python/) as an install dependency
as part of the [Streamlit Components](http://localhost:8000/streamlit_components.html) feature release. Occasionally, when trying to install Streamlit from
PyPI, you may see errors such as the following:

```shell
Using cached pyarrow-1.0.1.tar.gz (1.3 MB)
  Installing build dependencies ... error
  ERROR: Command errored out with exit status 1:
   command: 'c:\users\streamlit\appdata\local\programs\python\python38-32\python.exe' 'c:\users\streamlit\appdata\local\programs\python\python38-32\lib\site-packages\pip' install --ignore-installed --no-user --prefix 'C:\Users\streamlit\AppData\Local\Temp\pip-build-env-s7owjrle\overlay' --no-warn-script-location --no-binary :none: --only-binary :none: -i https://pypi.org/simple -- 'cython >= 0.29' 'numpy==1.14.5; python_version<'"'"'3.7'"'"'' 'numpy==1.16.0; python_version>='"'"'3.7'"'"'' setuptools setuptools_scm wheel
       cwd: None

  Complete output (319 lines):

      Running setup.py install for numpy: finished with status 'error'
      ERROR: Command errored out with exit status 1:
       command: 'c:\users\streamlit\appdata\local\programs\python\python38-32\python.exe' -u -c 'import sys, setuptools, tokenize; sys.argv[0] = '"'"'C:\\Users\\streamlit\\AppData\\Local\\Temp\\pip-install-0jwfwx_u\\numpy\\setup.py'"'"'; __file__='"'"'C:\\Users\\streamlit\\AppData\\Local\\Temp\\pip-install-0jwfwx_u\\numpy\\setup.py'"'"';f=getattr(tokenize, '"'"'open'"'"', open)(__file__);code=f.read().replace('"'"'\r\n'"'"', '"'"'\n'"'"');f.close();exec(compile(code, __file__, '"'"'exec'"'"'))' install --record 'C:\Users\streamlit\AppData\Local\Temp\pip-record-eys4l2gc\install-record.txt' --single-version-externally-managed --prefix 'C:\Users\streamlit\AppData\Local\Temp\pip-build-env-s7owjrle\overlay' --compile --install-headers 'C:\Users\streamlit\AppData\Local\Temp\pip-build-env-s7owjrle\overlay\Include\numpy'
           cwd: C:\Users\streamlit\AppData\Local\Temp\pip-install-0jwfwx_u\numpy\
      Complete output (298 lines):

      blas_opt_info:
      blas_mkl_info:
      No module named 'numpy.distutils._msvccompiler' in numpy.distutils; trying from distutils
      customize MSVCCompiler
        libraries mkl_rt not found in ['c:\\users\\streamlit\\appdata\\local\\programs\\python\\python38-32\\lib', 'C:\\', 'c:\\users\\streamlit\\appdata\\local\\programs\\python\\python38-32\\libs']
        NOT AVAILABLE

      blis_info:
      No module named 'numpy.distutils._msvccompiler' in numpy.distutils; trying from distutils
      customize MSVCCompiler
        libraries blis not found in ['c:\\users\\streamlit\\appdata\\local\\programs\\python\\python38-32\\lib', 'C:\\', 'c:\\users\\streamlit\\appdata\\local\\programs\\python\\python38-32\\libs']
        NOT AVAILABLE

      # <truncated for brevity> #

      c:\users\streamlit\appdata\local\programs\python\python38-32\lib\distutils\dist.py:274: UserWarning: Unknown distribution option: 'define_macros'
        warnings.warn(msg)
      running install
      running build
      running config_cc
      unifing config_cc, config, build_clib, build_ext, build commands --compiler options
      running config_fc
      unifing config_fc, config, build_clib, build_ext, build commands --fcompiler options
      running build_src
      build_src
      building py_modules sources
      creating build
      creating build\src.win32-3.8
      creating build\src.win32-3.8\numpy
      creating build\src.win32-3.8\numpy\distutils
      building library "npymath" sources
      No module named 'numpy.distutils._msvccompiler' in numpy.distutils; trying from distutils
      error: Microsoft Visual C++ 14.0 is required. Get it with "Build Tools for Visual Studio": https://visualstudio.microsoft.com/downloads/
      ----------------------------------------
  ERROR: Command errored out with exit status 1: 'c:\users\streamlit\appdata\local\programs\python\python38-32\python.exe' -u -c 'import sys, setuptools, tokenize; sys.argv[0] = '"'"'C:\\Users\\streamlit\\AppData\\Local\\Temp\\pip-install-0jwfwx_u\\numpy\\setup.py'"'"'; __file__='"'"'C:\\Users\\streamlit\\AppData\\Local\\Temp\\pip-install-0jwfwx_u\\numpy\\setup.py'"'"';f=getattr(tokenize, '"'"'open'"'"', open)(__file__);code=f.read().replace('"'"'\r\n'"'"', '"'"'\n'"'"');f.close();exec(compile(code, __file__, '"'"'exec'"'"'))' install --record 'C:\Users\streamlit\AppData\Local\Temp\pip-record-eys4l2gc\install-record.txt' --single-version-externally-managed --prefix 'C:\Users\streamlit\AppData\Local\Temp\pip-build-env-s7owjrle\overlay' --compile --install-headers 'C:\Users\streamlit\AppData\Local\Temp\pip-build-env-s7owjrle\overlay\Include\numpy' Check the logs for full command output.
  ----------------------------------------
```

This error indicates that Python is trying to compile certain libraries during install, but it cannot find the proper compilers on your system,
as reflected by the line `error: Microsoft Visual C++ 14.0 is required. Get it with "Build Tools for Visual Studio"`.

Installing [Build Tools for Visual Studio](https://visualstudio.microsoft.com/downloads/) should resolve this issue.
