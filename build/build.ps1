# Genera el instalador de Wallpaper Solar en un solo paso:
#   web (Vite) -> tests -> WallpaperSolar.exe (PyInstaller) -> instalador (Inno Setup)
#
# Uso (desde la raíz del proyecto o con la tarea de VS Code "Compilar instalador"):
#   powershell -NoProfile -ExecutionPolicy Bypass -File build\build.ps1
#   ... -SkipTests        sin pasar los tests
#   ... -SkipInstaller    sólo el .exe (sin Inno Setup)
#
# Requisitos: .venv con requirements-dev.txt (tarea "2. Instalar dependencias"), Node.js 20.19+
# e Inno Setup 6 (https://jrsoftware.org/isdl.php) para el último paso.
#
# Resultado:
#   build\output\dist\WallpaperSolar\WallpaperSolar.exe     (programa suelto)
#   build\output\WallpaperSolar-Setup-<versión>.exe         (instalador)

param(
    [switch]$SkipTests,
    [switch]$SkipInstaller
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step($n, $text) { Write-Host "`n[$n/4] $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "Ha fallado: $what (código $LASTEXITCODE)" } }

$Py = Join-Path $Root '.venv\Scripts\python.exe'
if (-not (Test-Path $Py)) {
    throw "No existe .venv. Ejecuta antes las tareas '1. Crear entorno virtual' y '2. Instalar dependencias'."
}

# Versión: única fuente en src/wallpaper_solar/__init__.py
$Version = & $Py -c "import sys; sys.path.insert(0, 'src'); import wallpaper_solar; print(wallpaper_solar.__version__)"
Check 'leer la versión'
Write-Host "== Wallpaper Solar $Version ==" -ForegroundColor Green

Step 1 'Simulación web (npm ci + vite build)'
npm --prefix web ci --no-audit --no-fund
Check 'npm ci'
npm --prefix web run build
Check 'vite build'

if ($SkipTests) {
    Step 2 'Tests (omitidos)'
} else {
    Step 2 'Tests'
    & $Py -m pytest -q
    Check 'pytest'
}

Step 3 'Ejecutable (PyInstaller)'
& $Py -m PyInstaller build\wallpaper.spec --noconfirm --clean `
    --distpath build\output\dist --workpath build\output\work
Check 'PyInstaller'
$Exe = Join-Path $Root 'build\output\dist\WallpaperSolar\WallpaperSolar.exe'
Write-Host "   $Exe"

if ($SkipInstaller) {
    Step 4 'Instalador (omitido)'
    exit 0
}

Step 4 'Instalador (Inno Setup)'
$Iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $Iscc) {
    Write-Warning "No se encontró Inno Setup 6. Instálalo desde https://jrsoftware.org/isdl.php y repite."
    Write-Warning "El programa suelto ya está listo en: $Exe"
    exit 0
}

& $Iscc "/DAppVersion=$Version" build\installer.iss
Check 'Inno Setup'
$Setup = Join-Path $Root "build\output\WallpaperSolar-Setup-$Version.exe"
Write-Host "`nListo: $Setup" -ForegroundColor Green
