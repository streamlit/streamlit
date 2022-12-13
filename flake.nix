{
  description = "Streamlit flake";

  inputs.nixpkgs.url = "nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
  let
      # Generate a user-friendly version number.
      version = builtins.substring 0 8 self.lastModifiedDate;

      # System types to support.
      supportedSystems = [ "x86_64-linux" "x86_64-darwin" "aarch64-linux" "aarch64-darwin" ];

      # Helper function to generate an attrset '{ x86_64-linux = f "x86_64-linux"; ... }'.
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

      overlay = final: prev: {
        yarn = prev.yarn.override {
          nodejs = prev.nodejs-16_x;
        };
      };

      # Nixpkgs instantiated for supported system types.
      nixpkgsFor = forAllSystems (system: import nixpkgs {
        overlays = [ overlay ];
        inherit system;
      });

  in
  {
    devShells = forAllSystems (system:
    let
      pkgs = nixpkgsFor.${system};
    in {
      default = pkgs.mkShell {
        buildInputs = with pkgs; [
          python39
          python39Packages.virtualenv
          nodejs-16_x
          yarn
          protobuf
          mypy-protobuf
          graphviz
          gawk
          mysql
          libmysqlclient
          pipenv
          postgresql
          pre-commit
        ];

        shellHook = ''
          virtualenv --no-setuptools .venv
          export PATH=$PWD/.venv/bin:$PATH
          export PIPENV_VENV_IN_PROJECT=1
        '';
      };
    });
  };
}
