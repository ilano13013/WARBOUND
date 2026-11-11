@echo off
setlocal
title WARBOUND - Serveur local
cd /d "%~dp0"
echo ============================================================
echo   WARBOUND - The Fracture Chronicles
echo ============================================================
call "%~dp0tools\trouver-node.bat"
if errorlevel 1 goto :echec

if not exist "dist\index.html" (
  echo [WARBOUND] Premier lancement : le jeu doit d'abord etre construit.
  call "%~dp0BUILD-WARBOUND.bat" /silencieux
  if errorlevel 1 goto :echec
)

echo [WARBOUND] Demarrage du serveur local et ouverture du navigateur...
node "%~dp0tools\serve.mjs"
if errorlevel 1 goto :echec
endlocal & exit /b 0

:echec
echo.
echo [WARBOUND] Le jeu n'a pas pu etre lance. Voir les messages ci-dessus.
pause
endlocal & exit /b 1
