; Instalador de Wallpaper Solar (Inno Setup 6 — https://jrsoftware.org/isinfo.php)
;
;   Uso normal: build\build.ps1  (pasa la versión con /DAppVersion=x.y.z)
;   A mano:     "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" build\installer.iss
;
; - Instalación POR USUARIO en %LOCALAPPDATA%\Programs\WallpaperSolar: no pide administrador.
; - Casilla "Iniciar con Windows" (HKCU\...\Run, la misma entrada que usa la bandeja).
; - Si el wallpaper está abierto, el instalador/desinstalador lo detecta (AppMutex) y pide cerrarlo.
; - Desinstalación limpia: programa, accesos, entrada de inicio (también la marca del
;   Administrador de tareas), ajustes, registros y caché de WebView2 (%APPDATA%\WallpaperSolar).

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define AppName "Wallpaper Solar"
#define AppExe "WallpaperSolar.exe"
#define RunValue "WallpaperSolar"

[Setup]
; AppId identifica la aplicación entre versiones: NO cambiarlo (las actualizaciones se instalan encima).
AppId={{8F3C2B71-5D4E-4A9B-9C1E-2B7A6D4F0E15}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=RubiKeys
DefaultDirName={localappdata}\Programs\WallpaperSolar
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
; Mismo nombre que SINGLE_INSTANCE_MUTEX en src/wallpaper_solar/config.py
AppMutex=Local\SolarWallpaperJPL_SingleInstance
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
OutputDir=output
OutputBaseFilename=WallpaperSolar-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "autostart"; Description: "Iniciar Wallpaper Solar al iniciar sesión en Windows"; GroupDescription: "Opciones:"

[Files]
Source: "output\dist\WallpaperSolar\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autoprograms}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#RunValue}"; ValueData: """{app}\{#AppExe}"""; Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "{app}\{#AppExe}"; Description: "Iniciar Wallpaper Solar ahora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Ajustes, registros y caché de WebView2 (todo lo que el programa escribe vive aquí).
; Los archivos del programa los borra el propio desinstalador; {app} NO se borra entero a
; propósito, por si alguien lo instaló dentro de una carpeta con otras cosas.
Type: filesandordirs; Name: "{userappdata}\WallpaperSolar"
Type: dirifempty; Name: "{app}"

[Code]
const
  WebView2ClientKey = 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2Download = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';

{ WebView2 viene con Windows 10/11 actualizados; si falta, se avisa y se ofrece descargarlo. }
function HasWebView2: Boolean;
var
  Version: String;
begin
  Result :=
    (RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')) or
    (RegQueryStringValue(HKLM, WebView2ClientKey, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0')) or
    (RegQueryStringValue(HKCU, WebView2ClientKey, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;

function InitializeSetup: Boolean;
var
  ErrorCode: Integer;
begin
  Result := True;
  if not HasWebView2 then
  begin
    if MsgBox('Wallpaper Solar necesita Microsoft Edge WebView2 Runtime, que no está instalado.' + #13#10 + #13#10 +
              '¿Abrir la página de descarga de Microsoft? (Después vuelve a ejecutar este instalador.)',
              mbConfirmation, MB_YESNO) = IDYES then
      ShellExec('open', WebView2Download, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    Result := False;
  end;
end;

{ Al desinstalar: la entrada de inicio puede haberla creado la bandeja (sin la casilla del
  instalador) y Windows guarda aparte si se desactivó desde el Administrador de tareas. }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
  Attempt: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', '{#RunValue}');
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run', '{#RunValue}');

    { Datos del usuario: [UninstallDelete] ya lo intentó, pero si el programa o WebView2 aún
      estaban cerrándose, algún archivo seguía abierto (p. ej. logs\wallpaper.log).
      Se reintenta durante unos 6 segundos. }
    DataDir := ExpandConstant('{userappdata}\WallpaperSolar');
    Attempt := 0;
    while DirExists(DataDir) and (Attempt < 12) do
    begin
      DelTree(DataDir, True, True, True);
      if DirExists(DataDir) then
        Sleep(500);
      Attempt := Attempt + 1;
    end;
  end;
end;
