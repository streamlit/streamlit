{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {

  buildInputs = [
    pkgs.python39
    pkgs.python39Packages.virtualenv
    pkgs.nodejs-18_x
    pkgs.yarn
    pkgs.protobuf
    pkgs.graphviz
    pkgs.gawk
    pkgs.mysql
    pkgs.libmysqlclient
    pkgs.pipenv
    pkgs.postgresql
    pkgs.pre-commit
  ];

  shellHook = ''
    virtualenv --no-setuptools .venv
    export PATH=$PWD/.venv/bin:$PATH
    export PIPENV_VENV_IN_PROJECT=1
    export TMPDIR=/var/tmp
  '';
}
