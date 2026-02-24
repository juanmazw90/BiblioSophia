@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================
::  BiblioSophia — Instalador de dependencias
::  Instala yt-dlp y FFmpeg si no están presentes.
::  Doble clic para ejecutar.
:: ============================================================

title BiblioSophia — Instalador de dependencias

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       BiblioSophia — Setup de dependencias   ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── 1. Verificar que winget está disponible ──────────────────
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] winget no encontrado.
    echo      winget viene incluido en Windows 10/11.
    echo      Actualiza Windows o instala "App Installer" desde la Microsoft Store.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('winget --version 2^>nul') do set WINGET_VER=%%v
echo  [OK] winget disponible  %WINGET_VER%
echo.

:: ── 2. Verificar / instalar yt-dlp ───────────────────────────
echo  Comprobando yt-dlp...
yt-dlp --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('yt-dlp --version 2^>nul') do set YTDLP_VER=%%v
    echo  [OK] yt-dlp ya instalado  !YTDLP_VER!
) else (
    echo  [ ] yt-dlp no encontrado. Instalando...
    winget install --id yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements
    if !errorlevel! equ 0 (
        echo  [OK] yt-dlp instalado correctamente.
    ) else (
        echo  [!] Error instalando yt-dlp.
        echo      Descárgalo manualmente en: https://github.com/yt-dlp/yt-dlp/releases
    )
)

echo.

:: ── 3. Verificar / instalar FFmpeg ───────────────────────────
echo  Comprobando FFmpeg...
ffmpeg -version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=3" %%v in ('ffmpeg -version 2^>nul ^| findstr "ffmpeg version"') do set FFMPEG_VER=%%v
    echo  [OK] FFmpeg ya instalado  !FFMPEG_VER!
) else (
    echo  [ ] FFmpeg no encontrado. Instalando...
    winget install --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements
    if !errorlevel! equ 0 (
        echo  [OK] FFmpeg instalado correctamente.
    ) else (
        echo  [!] Error instalando FFmpeg.
        echo      Descárgalo manualmente en: https://ffmpeg.org/download.html
    )
)

echo.

:: ── 4. Refrescar PATH y verificación final ───────────────────
echo  Actualizando variables de entorno...
:: Recargar PATH del sistema sin necesidad de reiniciar
for /f "skip=2 tokens=3*" %%a in ('reg query HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment /v PATH 2^>nul') do set SYS_PATH=%%a %%b
for /f "skip=2 tokens=3*" %%a in ('reg query HKCU\Environment /v PATH 2^>nul') do set USR_PATH=%%a %%b
set PATH=%SYS_PATH%;%USR_PATH%;%PATH%

echo.
echo  ── Verificación final ─────────────────────────────────────
yt-dlp --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('yt-dlp --version 2^>nul') do echo  [OK] yt-dlp   %%v
) else (
    echo  [!] yt-dlp: no detectado en PATH. Reinicia el PC e intenta de nuevo.
)

ffmpeg -version >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] FFmpeg  listo
) else (
    echo  [!] FFmpeg: no detectado en PATH. Reinicia el PC e intenta de nuevo.
)

echo.
echo  ══════════════════════════════════════════════════════════
echo   Listo. Puedes abrir BiblioSophia ahora.
echo   Si algo no funciona, reinicia el PC y vuelve a intentarlo.
echo  ══════════════════════════════════════════════════════════
echo.
pause
