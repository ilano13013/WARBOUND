#!/usr/bin/env bash
# Récupère les sources CC0 utilisées par tools/assets/build-assets.mjs (≈ 450 Mo, hors dépôt).
# Usage : ASSET_SRC=/chemin/vers/dossier bash tools/assets/fetch-sources.sh && node tools/assets/build-assets.mjs
set -euo pipefail
SRC="${ASSET_SRC:-/tmp/claude-0/assets-dl}"; mkdir -p "$SRC"; cd "$SRC"
clone() { [ -d "$2" ] || git clone -q --depth 1 --filter=blob:none --no-checkout "https://github.com/$1" "$2"; }
clone trebeljahr/quaternius-showcase quaternius-showcase      # modèles Quaternius (CC0), voir LICENSES.md du dépôt
clone petroulacl/fps-asset-kit fps-asset-kit                    # Flat Guns (CC0), textures ambientCG (CC0), sons (CC0)
clone J-Ponzo/gltf-universal-animation-library gltf-universal-animation-library   # Universal Animation Library (CC0)
( cd quaternius-showcase && git checkout HEAD -- LICENSES.md public/glb )
( cd fps-asset-kit && git checkout HEAD -- README.md weapons textures sfx )
( cd gltf-universal-animation-library && git checkout HEAD -- LICENSE README.md glTF )
echo "Sources prêtes dans $SRC"
