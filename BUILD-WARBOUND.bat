@echo off
setlocal
title WARBOUND - Construction du jeu
cd /d "%~dp0"
echo ============================================================
echo   WARBOUND - Construction du jeu
echo ============================================================
call "%~dp0tools\trouver-node.bat"
if errorlevel 1 goto :echec

if not exist "node_modules\vite\package.json" (
  echo [WARBOUND] Installation locale des dependances ^(dossier node_modules du jeu^)...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo [WARBOUND] ERREUR : installation des dependances impossible.
    echo            Le registre npm ^(registry.npmjs.org^) est peut-etre bloque sur ce reseau.
    goto :echec
  )
)

echo [WARBOUND] Compilation avec Vite...
call npm run build
if errorlevel 1 (
  echo [WARBOUND] ERREUR : la compilation a echoue. Voir les messages ci-dessus.
  goto :echec
)
if not exist "dist\index.html" (
  echo [WARBOUND] ERREUR : dist\index.html n'a pas ete produit.
  goto :echec
)
echo.
echo [WARBOUND] Construction terminee : dossier dist pret.
if /i not "%~1"=="/silencieux" pause
endlocal & exit /b 0

:echec
echo.
if /i not "%~1"=="/silencieux" pause
endlocal & exit /b 1
