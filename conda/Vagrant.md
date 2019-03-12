# Vagrant

[Vagrant](https://www.vagrantup.com/) is a tools that makes it easy to
spin up VMs to test things out on a clean easily reproducible `machine`

## TL;DR
* Vagrant up might take a while cause its installing everything.
* Streamlit code will be in `/streamlit`

```
$ vagrant up
$ vagrant ssh
vagrant $ pip install streamlit
vagrant $ streamlit hello
vagrant $ # or even
vagrant $ conda env create -f streamlit.yml
vagrant $ exit
$ vagrant destroy -f
```

## Installation

### macOS
```
$ brew cask install vagrant virtualbox
```

### Ubuntu
Instal the vagrant deb from [here](https://www.vagrantup.com/downloads.html)
and also
[install virtualbox](https://www.virtualbox.org/wiki/Linux_Downloads)
if its not already installed

## Vagrantfile

There's a Vagrantfile in this directory that runs ubuntu bionic and
autmoatically installs anaconda AND setups X so things like firefox work
from the command line ie `streamlit hello` will work.

See [Vagrantfile](Vagrantfile) and its history for more details.  The
history of the Vagrantfile contains information on how to install or
modify things.
