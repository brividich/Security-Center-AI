#define AppName "Security Center AI"

; Manual fallback used when the build script does not pass /DAppVersion.
; Keep this aligned with the project version shown in README.md.
#ifndef AppVersion
#define AppVersion "0.5.17"
#endif

#ifndef SourcePackageDir
#define SourcePackageDir "..\..\dist\SecurityCenterAI-Test-" + AppVersion
#endif

#ifndef OutputDir
#define OutputDir "..\..\dist\installer"
#endif

[Setup]
AppId={{6B8A1CE1-6C24-4B7E-8B1B-2C9C5A0A1058}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Security Center AI
DefaultDirName={autopf}\Security Center AI
DefaultGroupName=Security Center AI
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=SecurityCenterAI-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=classic
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName={#AppName}
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Crea collegamento Desktop per aprire Security Center AI"; GroupDescription: "Collegamenti opzionali:"

[Files]
; The recursive package source includes tools\windows\winsw.exe when bundled, with tools\windows\nssm.exe as optional fallback.
Source: "{#SourcePackageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".env,.venv\*,runtime\*,node_modules\*,db.sqlite3,*.sqlite3,*.db,*.bak,*.dump,*.log,*.key,*.pem,*.pfx,*.p12,*.cer,*.crt,logs\*,media\*,uploads\*,attachments\*,reports\*,mailbox\*,inbox\*,security_raw_inbox\*"

[Icons]
Name: "{group}\Apri Security Center AI"; Filename: "{app}\scripts\windows\open_security_center.bat"; WorkingDir: "{app}"
Name: "{group}\Stato servizio"; Filename: "{app}\scripts\windows\service_status.bat"; WorkingDir: "{app}"
Name: "{group}\Avvia servizio"; Filename: "{app}\scripts\windows\start_service.bat"; WorkingDir: "{app}"
Name: "{group}\Arresta servizio"; Filename: "{app}\scripts\windows\stop_service.bat"; WorkingDir: "{app}"
Name: "{group}\Riavvia servizio"; Filename: "{app}\scripts\windows\restart_service.bat"; WorkingDir: "{app}"
Name: "{group}\Documentazione installazione"; Filename: "{app}\docs\security-center\WINDOWS_INSTALLER_EXE.md"; WorkingDir: "{app}"
Name: "{commondesktop}\Apri Security Center AI"; Filename: "{app}\scripts\windows\open_security_center.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\docs\security-center\WINDOWS_INSTALLER_EXE.md"; Description: "Apri documentazione installazione"; Flags: postinstall shellexec skipifsilent unchecked

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""try {{ & '{app}\scripts\windows\uninstall_service.ps1' } catch {{ exit 0 }}; exit 0"""; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveSecurityCenterAIService"

[Code]
var
  SetupModePage: TInputOptionWizardPage;
  SqlPage: TInputQueryWizardPage;
  SqlDiscoveryButton: TNewButton;
  SqlDiscoveryList: TNewListBox;
  SqlDiscoveryLabel: TNewStaticText;
  AuthPage: TInputOptionWizardPage;
  SqlAuthPage: TInputQueryWizardPage;
  GuideOptionsPage: TInputOptionWizardPage;
  ProgressPage: TOutputProgressWizardPage;

function JsonEscape(Value: string): string;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
  StringChangeEx(Result, #13, '', True);
  StringChangeEx(Result, #10, '', True);
end;

function BoolToJson(Value: Boolean): string;
begin
  if Value then
    Result := 'true'
  else
    Result := 'false';
end;

function BoolText(Value: Boolean): string;
begin
  if Value then
    Result := 'True'
  else
    Result := 'False';
end;

function IsDigits(Value: string): Boolean;
var
  I: Integer;
begin
  Result := Length(Value) > 0;
  for I := 1 to Length(Value) do
  begin
    if Pos(Copy(Value, I, 1), '0123456789') = 0 then
    begin
      Result := False;
      Exit;
    end;
  end;
end;

function PowerShellSingleQuote(Value: string): string;
begin
  Result := Value;
  StringChangeEx(Result, '''', '''''', True);
  Result := '''' + Result + '''';
end;

function IsFullInstall: Boolean;
begin
  Result := SetupModePage.Values[0];
end;

procedure SqlDiscoveryListClick(Sender: TObject);
begin
  if SqlDiscoveryList.ItemIndex >= 0 then
    SqlPage.Values[0] := SqlDiscoveryList.Items[SqlDiscoveryList.ItemIndex];
end;

procedure WriteSqlDiscoveryScript(ScriptPath: string; ResultPath: string);
var
  Script: string;
begin
  Script :=
    '$ErrorActionPreference = ''SilentlyContinue''' + #13#10 +
    '$items = New-Object System.Collections.Generic.List[string]' + #13#10 +
    'function Add-Candidate([string]$value) {' + #13#10 +
    '  if ([string]::IsNullOrWhiteSpace($value)) { return }' + #13#10 +
    '  $value = $value.Trim()' + #13#10 +
    '  foreach ($existing in $items) { if ($existing -ieq $value) { return } }' + #13#10 +
    '  [void]$items.Add($value)' + #13#10 +
    '}' + #13#10 +
    '$computer = $env:COMPUTERNAME' + #13#10 +
    'Get-Service | Where-Object { $_.Name -eq ''MSSQLSERVER'' -or $_.Name -like ''MSSQL$*'' } | ForEach-Object {' + #13#10 +
    '  if ($_.Name -eq ''MSSQLSERVER'') {' + #13#10 +
    '    Add-Candidate ''localhost''' + #13#10 +
    '    Add-Candidate $computer' + #13#10 +
    '  } elseif ($_.Name -like ''MSSQL$*'') {' + #13#10 +
    '    $instance = $_.Name.Substring(6)' + #13#10 +
    '    Add-Candidate (''localhost\'' + $instance)' + #13#10 +
    '    Add-Candidate ($computer + ''\'' + $instance)' + #13#10 +
    '  }' + #13#10 +
    '}' + #13#10 +
    '$registryPaths = @(''HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL'', ''HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL'')' + #13#10 +
    'foreach ($registryPath in $registryPaths) {' + #13#10 +
    '  if (Test-Path -LiteralPath $registryPath) {' + #13#10 +
    '    $props = Get-ItemProperty -LiteralPath $registryPath' + #13#10 +
    '    foreach ($property in $props.PSObject.Properties) {' + #13#10 +
    '      if ($property.Name -in @(''PSPath'', ''PSParentPath'', ''PSChildName'', ''PSDrive'', ''PSProvider'')) { continue }' + #13#10 +
    '      if ($property.Name -eq ''MSSQLSERVER'') {' + #13#10 +
    '        Add-Candidate ''localhost''' + #13#10 +
    '        Add-Candidate $computer' + #13#10 +
    '      } else {' + #13#10 +
    '        Add-Candidate (''localhost\'' + $property.Name)' + #13#10 +
    '        Add-Candidate ($computer + ''\'' + $property.Name)' + #13#10 +
    '      }' + #13#10 +
    '    }' + #13#10 +
    '  }' + #13#10 +
    '}' + #13#10 +
    'Add-Candidate ''localhost\SQLEXPRESS''' + #13#10 +
    'Add-Candidate ''.\SQLEXPRESS''' + #13#10 +
    'Add-Candidate ''localhost''' + #13#10 +
    '$items | Set-Content -LiteralPath ' + PowerShellSingleQuote(ResultPath) + ' -Encoding UTF8' + #13#10;

  SaveStringToFile(ScriptPath, Script, False);
end;

procedure DiscoverSqlInstancesButtonClick(Sender: TObject);
var
  ScriptPath: string;
  ResultPath: string;
  Params: string;
  ResultCode: Integer;
  Lines: TArrayOfString;
  I: Integer;
begin
  ScriptPath := ExpandConstant('{tmp}\security-center-sql-discovery.ps1');
  ResultPath := ExpandConstant('{tmp}\security-center-sql-discovery.txt');

  SqlDiscoveryButton.Enabled := False;
  SqlDiscoveryLabel.Caption := 'Rilevamento istanze SQL in corso...';
  SqlDiscoveryList.Items.Clear;
  try
    DeleteFile(ResultPath);
    WriteSqlDiscoveryScript(ScriptPath, ResultPath);
    Params := '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ' + AddQuotes(ScriptPath);

    if Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) and LoadStringsFromFile(ResultPath, Lines) then
    begin
      for I := 0 to GetArrayLength(Lines) - 1 do
      begin
        if Trim(Lines[I]) <> '' then
          SqlDiscoveryList.Items.Add(Trim(Lines[I]));
      end;

      if SqlDiscoveryList.Items.Count > 0 then
      begin
        SqlDiscoveryList.ItemIndex := 0;
        SqlPage.Values[0] := SqlDiscoveryList.Items[0];
        SqlDiscoveryLabel.Caption := 'Istanze rilevate: selezionarne una dalla lista.';
      end
      else
        SqlDiscoveryLabel.Caption := 'Nessuna istanza SQL rilevata localmente.';
    end
    else
      SqlDiscoveryLabel.Caption := 'Discovery SQL non riuscito. Inserire il server manualmente.';
  finally
    SqlDiscoveryButton.Enabled := True;
  end;
end;

procedure InitializeWizard;
begin
  SetupModePage :=
    CreateInputOptionPage(
      wpSelectDir,
      'Tipo installazione',
      'Scegliere come preparare Security Center AI.',
      'L''installazione completa usa un wizard Windows classico per copiare l''applicativo, configurare il database TEST, preparare l''ambiente e installare il servizio.',
      True,
      False);
  SetupModePage.Add('Installazione completa TEST guidata');
  SetupModePage.Add('Solo copia file e collegamenti');
  SetupModePage.Values[0] := True;

  SqlPage :=
    CreateInputQueryPage(
      SetupModePage.ID,
      'Database SQL Server TEST',
      'Inserire i parametri principali del database.',
      'Usare solo istanze e database di test. L''installer non include credenziali o dati reali.');
  SqlPage.Add('Server SQL di partenza o istanza nota, esempio localhost\SQLEXPRESS:', False);
  SqlPage.Add('Database TEST:', False);
  SqlPage.Add('Driver ODBC SQL Server:', False);
  SqlPage.Add('Allowed hosts Django:', False);
  SqlPage.Add('Porta applicazione:', False);
  SqlPage.Values[0] := 'localhost\SQLEXPRESS';
  SqlPage.Values[1] := 'SecurityCenterAI_TEST';
  SqlPage.Values[2] := 'ODBC Driver 18 for SQL Server';
  SqlPage.Values[3] := '127.0.0.1,localhost';
  SqlPage.Values[4] := '8000';

  SqlDiscoveryButton := TNewButton.Create(WizardForm);
  SqlDiscoveryButton.Parent := SqlPage.Surface;
  SqlDiscoveryButton.Caption := 'Rileva istanze SQL';
  SqlDiscoveryButton.Left := SqlPage.Edits[0].Left;
  SqlDiscoveryButton.Top := SqlPage.Edits[4].Top + SqlPage.Edits[4].Height + ScaleY(8);
  SqlDiscoveryButton.Width := ScaleX(130);
  SqlDiscoveryButton.OnClick := @DiscoverSqlInstancesButtonClick;

  SqlDiscoveryLabel := TNewStaticText.Create(WizardForm);
  SqlDiscoveryLabel.Parent := SqlPage.Surface;
  SqlDiscoveryLabel.Left := SqlDiscoveryButton.Left + SqlDiscoveryButton.Width + ScaleX(8);
  SqlDiscoveryLabel.Top := SqlDiscoveryButton.Top + ScaleY(5);
  SqlDiscoveryLabel.Width := SqlPage.SurfaceWidth - SqlDiscoveryLabel.Left;
  SqlDiscoveryLabel.Caption := 'Discovery locale da servizi Windows e registry SQL Server.';

  SqlDiscoveryList := TNewListBox.Create(WizardForm);
  SqlDiscoveryList.Parent := SqlPage.Surface;
  SqlDiscoveryList.Left := SqlPage.Edits[0].Left;
  SqlDiscoveryList.Top := SqlDiscoveryButton.Top + SqlDiscoveryButton.Height + ScaleY(6);
  SqlDiscoveryList.Width := SqlPage.Edits[0].Width;
  SqlDiscoveryList.Height := ScaleY(52);
  SqlDiscoveryList.OnClick := @SqlDiscoveryListClick;

  AuthPage :=
    CreateInputOptionPage(
      SqlPage.ID,
      'Autenticazione SQL Server',
      'Scegliere come il portale si collega al database.',
      'Per test locali con SQL Server Express di solito va bene Autenticazione Windows.',
      True,
      False);
  AuthPage.Add('Autenticazione Windows / Trusted Connection');
  AuthPage.Add('Autenticazione SQL Server');
  AuthPage.Values[0] := True;

  SqlAuthPage :=
    CreateInputQueryPage(
      AuthPage.ID,
      'Credenziali SQL Server',
      'Inserire le credenziali dell''account SQL di test.',
      'La password non viene mostrata nel wizard e viene salvata solo nella .env locale installata.');
  SqlAuthPage.Add('Utente SQL:', False);
  SqlAuthPage.Add('Password SQL:', True);

  GuideOptionsPage :=
    CreateInputOptionPage(
      SqlAuthPage.ID,
      'Componenti e primo avvio',
      'Scegliere cosa deve preparare l''installer.',
      'Le operazioni vengono eseguite alla fine della copia file, senza aprire finestre PowerShell all''operatore.',
      False,
      False);
  GuideOptionsPage.Add('Creare il database TEST se manca e i permessi SQL lo consentono');
  GuideOptionsPage.Add('Caricare dati demo sintetici');
  GuideOptionsPage.Add('Installare e avviare il servizio Windows SecurityCenterAI');
  GuideOptionsPage.Add('Usare il frontend gia incluso, senza richiedere Node/npm sul PC di test');
  GuideOptionsPage.Add('Saltare lo smoke check dei dati demo');
  GuideOptionsPage.Add('Aprire il browser al termine');
  GuideOptionsPage.Values[0] := False;
  GuideOptionsPage.Values[1] := True;
  GuideOptionsPage.Values[2] := True;
  GuideOptionsPage.Values[3] := True;
  GuideOptionsPage.Values[4] := False;
  GuideOptionsPage.Values[5] := True;

  ProgressPage :=
    CreateOutputProgressPage(
      'Setup applicazione',
      'Security Center AI sta configurando ambiente, database e servizio.');
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PageID = SqlPage.ID) or (PageID = AuthPage.ID) or (PageID = SqlAuthPage.ID) or (PageID = GuideOptionsPage.ID) then
    Result := not IsFullInstall;
  if (PageID = SqlAuthPage.ID) and IsFullInstall then
    Result := AuthPage.Values[0];
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = SqlPage.ID then
  begin
    if Trim(SqlPage.Values[0]) = '' then
    begin
      MsgBox('Inserire il server SQL.', mbError, MB_OK);
      Result := False;
    end
    else if Trim(SqlPage.Values[1]) = '' then
    begin
      MsgBox('Inserire il nome database TEST.', mbError, MB_OK);
      Result := False;
    end
    else if Trim(SqlPage.Values[2]) = '' then
    begin
      MsgBox('Inserire il driver ODBC SQL Server.', mbError, MB_OK);
      Result := False;
    end
    else if Trim(SqlPage.Values[3]) = '' then
    begin
      MsgBox('Inserire ALLOWED_HOSTS, ad esempio 127.0.0.1,localhost.', mbError, MB_OK);
      Result := False;
    end
    else if not IsDigits(Trim(SqlPage.Values[4])) then
    begin
      MsgBox('Inserire una porta numerica, ad esempio 8000.', mbError, MB_OK);
      Result := False;
    end;
  end;

  if CurPageID = SqlAuthPage.ID then
  begin
    if not AuthPage.Values[0] then
    begin
      if Trim(SqlAuthPage.Values[0]) = '' then
      begin
        MsgBox('Inserire utente SQL oppure tornare indietro e scegliere Autenticazione Windows.', mbError, MB_OK);
        Result := False;
      end
      else if SqlAuthPage.Values[1] = '' then
      begin
        MsgBox('Inserire password SQL oppure tornare indietro e scegliere Autenticazione Windows.', mbError, MB_OK);
        Result := False;
      end;
    end;
  end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo + NewLine + NewLine + MemoTasksInfo;

  if IsFullInstall then
  begin
    Result :=
      Result + NewLine + NewLine +
      'Installazione guidata:' + NewLine +
      Space + 'Database: ' + Trim(SqlPage.Values[1]) + NewLine +
      Space + 'Server SQL: ' + Trim(SqlPage.Values[0]) + NewLine +
      Space + 'Porta applicazione: ' + Trim(SqlPage.Values[4]) + NewLine +
      Space + 'Servizio Windows: ' + BoolText(GuideOptionsPage.Values[2]) + NewLine +
      Space + 'Dati demo sintetici: ' + BoolText(GuideOptionsPage.Values[1]);
  end
  else
  begin
    Result := Result + NewLine + NewLine + 'Installazione guidata: solo copia file e collegamenti';
  end;
end;

procedure RunGuidedSetupFromInstaller;
var
  RuntimeDir: string;
  ConfigPath: string;
  LogPath: string;
  ScriptPath: string;
  Json: string;
  Params: string;
  ResultCode: Integer;
  OpenResultCode: Integer;
begin
  if not IsFullInstall then
    Exit;

  RuntimeDir := ExpandConstant('{app}\runtime');
  ForceDirectories(RuntimeDir);
  ConfigPath := RuntimeDir + '\installer-setup.json';
  LogPath := RuntimeDir + '\installer-setup.log';
  ScriptPath := ExpandConstant('{app}\scripts\windows\installer_apply_setup.ps1');

  Json :=
    '{' + #13#10 +
    '  "DbHost": "' + JsonEscape(Trim(SqlPage.Values[0])) + '",' + #13#10 +
    '  "DbName": "' + JsonEscape(Trim(SqlPage.Values[1])) + '",' + #13#10 +
    '  "DbDriver": "' + JsonEscape(Trim(SqlPage.Values[2])) + '",' + #13#10 +
    '  "AllowedHosts": "' + JsonEscape(Trim(SqlPage.Values[3])) + '",' + #13#10 +
    '  "Port": "' + JsonEscape(Trim(SqlPage.Values[4])) + '",' + #13#10 +
    '  "TrustedConnection": "' + BoolText(AuthPage.Values[0]) + '",' + #13#10 +
    '  "TrustServerCertificate": "True",' + #13#10 +
    '  "DbUser": "' + JsonEscape(Trim(SqlAuthPage.Values[0])) + '",' + #13#10 +
    '  "DbPassword": "' + JsonEscape(SqlAuthPage.Values[1]) + '",' + #13#10 +
    '  "CreateDatabase": ' + BoolToJson(GuideOptionsPage.Values[0]) + ',' + #13#10 +
    '  "SeedDemo": ' + BoolToJson(GuideOptionsPage.Values[1]) + ',' + #13#10 +
    '  "InstallService": ' + BoolToJson(GuideOptionsPage.Values[2]) + ',' + #13#10 +
    '  "SkipFrontendBuild": ' + BoolToJson(GuideOptionsPage.Values[3]) + ',' + #13#10 +
    '  "SkipSmokeCheck": ' + BoolToJson(GuideOptionsPage.Values[4]) + ',' + #13#10 +
    '  "OpenBrowser": ' + BoolToJson(GuideOptionsPage.Values[5]) + #13#10 +
    '}';

  if not SaveStringToFile(ConfigPath, Json, False) then
  begin
    MsgBox('Impossibile creare la configurazione temporanea del setup guidato.', mbError, MB_OK);
    Exit;
  end;

  Params :=
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ' + AddQuotes(ScriptPath) +
    ' -ConfigPath ' + AddQuotes(ConfigPath);

  ProgressPage.SetText('Applicazione delle scelte del wizard in corso...', 'Questa operazione puo richiedere alcuni minuti.');
  ProgressPage.SetProgress(0, 100);
  ProgressPage.Show;
  try
    if not Exec('powershell.exe', Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      DeleteFile(ConfigPath);
      if MsgBox('Impossibile avviare il setup guidato interno. Aprire il log di installazione?', mbError, MB_YESNO) = IDYES then
        Exec('notepad.exe', AddQuotes(LogPath), '', SW_SHOW, ewNoWait, OpenResultCode);
    end
    else if ResultCode <> 0 then
    begin
      if MsgBox('Il setup guidato non e stato completato. Il log e in runtime\installer-setup.log. Aprirlo ora?', mbError, MB_YESNO) = IDYES then
        Exec('notepad.exe', AddQuotes(LogPath), '', SW_SHOW, ewNoWait, OpenResultCode);
    end;
  finally
    ProgressPage.Hide;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    RunGuidedSetupFromInstaller;
end;
