@echo off
rem ---------------------------------------------------------------------------
rem  Trouve Node.js pour WARBOUND, sans installation ni droits administrateur.
rem  Ordre : 1) version portable dans tools\node  2) Node.js deja present
rem          3) telechargement du ZIP officiel depuis nodejs.org (verifie par SHA-256)
rem  Rien n'est modifie en dehors du dossier du jeu. Le PATH n'est change que
rem  pour la fenetre en cours.
rem  Appele par LANCER-WARBOUND.bat et BUILD-WARBOUND.bat.
rem ---------------------------------------------------------------------------
set "WB_ROOT=%~dp0.."
set "WB_NODE=%~dp0node"

if exist "%WB_NODE%\node.exe" goto :portable

set "WB_MAJOR=0"
where node >nul 2>nul
if not errorlevel 1 (
  for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "WB_MAJOR=%%v"
)
if %WB_MAJOR% GEQ 18 (
  echo [WARBOUND] Node.js deja disponible sur ce PC ^(version %WB_MAJOR%^) : il sera utilise tel quel.
  exit /b 0
)

echo [WARBOUND] Node.js introuvable ^(ou trop ancien^). Telechargement de la version portable officielle...
set "WB_ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "WB_ARCH=arm64"
if /i "%PROCESSOR_ARCHITECTURE%"=="x86" if not defined PROCESSOR_ARCHITEW6432 set "WB_ARCH=x86"
if /i "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "WB_ARCH=arm64"

where curl >nul 2>nul
if errorlevel 1 goto :outils
where tar >nul 2>nul
if errorlevel 1 goto :outils

set "WB_BASE=https://nodejs.org/dist/latest-v22.x"
set "WB_TMP=%~dp0telechargement"
if not exist "%WB_TMP%" mkdir "%WB_TMP%"

curl -fsSL -o "%WB_TMP%\SHASUMS256.txt" "%WB_BASE%/SHASUMS256.txt"
if errorlevel 1 goto :reseau

set "WB_ZIP="
set "WB_HASH="
for /f "tokens=1,2" %%a in ('findstr /c:"win-%WB_ARCH%.zip" "%WB_TMP%\SHASUMS256.txt"') do (
  set "WB_HASH=%%a"
  set "WB_ZIP=%%b"
)
if not defined WB_ZIP (
  echo [WARBOUND] ERREUR : aucune version portable de Node.js pour l'architecture %WB_ARCH%.
  exit /b 1
)

echo [WARBOUND] Telechargement de %WB_ZIP% depuis nodejs.org ^(environ 35 Mo^)...
curl -fL --progress-bar -o "%WB_TMP%\%WB_ZIP%" "%WB_BASE%/%WB_ZIP%"
if errorlevel 1 goto :reseau

rem Verification de l'empreinte SHA-256 publiee par nodejs.org
set "WB_GOT=absent"
set "WB_SEEN="
for /f "skip=1 tokens=*" %%h in ('certutil -hashfile "%WB_TMP%\%WB_ZIP%" SHA256') do if not defined WB_SEEN (set "WB_GOT=%%h"& set "WB_SEEN=1")
set "WB_GOT=%WB_GOT: =%"
if /i not "%WB_GOT%"=="%WB_HASH%" (
  echo [WARBOUND] ERREUR : l'empreinte du fichier telecharge ne correspond pas a celle de nodejs.org.
  echo            Le fichier est supprime par securite. Reessayez plus tard.
  del "%WB_TMP%\%WB_ZIP%" >nul 2>nul
  exit /b 1
)
echo [WARBOUND] Empreinte SHA-256 verifiee.

echo [WARBOUND] Extraction dans tools\node ...
tar -xf "%WB_TMP%\%WB_ZIP%" -C "%WB_TMP%"
if errorlevel 1 (
  echo [WARBOUND] ERREUR : l'extraction du ZIP a echoue.
  exit /b 1
)
move "%WB_TMP%\%WB_ZIP:~0,-4%" "%WB_NODE%" >nul
if not exist "%WB_NODE%\node.exe" (
  echo [WARBOUND] ERREUR : node.exe introuvable apres extraction.
  exit /b 1
)
rmdir /s /q "%WB_TMP%" >nul 2>nul

:portable
rem PATH modifie uniquement pour cette fenetre de commande
set "PATH=%WB_NODE%;%PATH%"
"%WB_NODE%\node.exe" -v >nul 2>nul
if errorlevel 1 (
  echo [WARBOUND] ERREUR : node.exe portable ne peut pas s'executer.
  echo            Une regle de securite de ce PC bloque probablement les programmes
  echo            lances depuis ce dossier. Ne la contournez pas : demandez a votre
  echo            administrateur, ou utilisez un PC personnel.
  exit /b 1
)
for /f %%v in ('"%WB_NODE%\node.exe" -v') do echo [WARBOUND] Node.js portable %%v ^(dossier tools\node^).
exit /b 0

:outils
echo [WARBOUND] ERREUR : curl.exe ou tar.exe est absent ^(ils sont fournis avec Windows 10 version 1803 et suivantes^).
echo            Telechargez manuellement le fichier "node-v22.x.x-win-%WB_ARCH%.zip" sur https://nodejs.org/fr/download
echo            puis decompressez son contenu dans le dossier tools\node ^(node.exe doit etre dans tools\node^).
exit /b 1

:reseau
echo [WARBOUND] ERREUR : telechargement impossible depuis nodejs.org.
echo            Le reseau ou les regles de securite de ce PC bloquent peut-etre cet acces.
echo            Rien n'a ete contourne. Vous pouvez telecharger le ZIP manuellement sur
echo            https://nodejs.org/fr/download et le decompresser dans tools\node.
exit /b 1
