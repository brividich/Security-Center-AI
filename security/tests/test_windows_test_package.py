import subprocess
from pathlib import Path

from django.test import SimpleTestCase


REPO_ROOT = Path(__file__).resolve().parents[2]
DOC_ROOT = REPO_ROOT / "docs" / "security-center"
INSTALLER_ROOT = REPO_ROOT / "installer" / "windows"
WINDOWS_SCRIPT_ROOT = REPO_ROOT / "scripts" / "windows"


def git_command(*args):
    return ["git", "-c", f"safe.directory={REPO_ROOT.as_posix()}", *args]


class WindowsTestPackageStaticTests(SimpleTestCase):
    def test_operator_scripts_exist(self):
        for script_name in [
            "setup_test_deployment.ps1",
            "installer_apply_setup.ps1",
            "configure_sqlserver_env.ps1",
            "drop_test_database.ps1",
            "start_security_center.bat",
            "stop_security_center.bat",
            "restart_security_center.bat",
            "open_security_center.bat",
            "package_test_deployment.ps1",
            "clean_generated_artifacts.ps1",
            "install_service.ps1",
            "uninstall_service.ps1",
            "start_service.bat",
            "stop_service.bat",
            "restart_service.bat",
            "service_status.bat",
            "open_firewall_8000.ps1",
        ]:
            with self.subTest(script_name=script_name):
                path = WINDOWS_SCRIPT_ROOT / script_name
                self.assertTrue(path.exists(), script_name)
                self.assertGreater(len(path.read_text(encoding="utf-8").strip()), 100, script_name)

    def test_package_script_excludes_sensitive_and_generated_paths(self):
        package_script = (WINDOWS_SCRIPT_ROOT / "package_test_deployment.ps1").read_text(encoding="utf-8")

        for forbidden_pattern in [
            ".git",
            ".venv",
            "node_modules",
            "__pycache__",
            ".pytest_cache",
            "logs",
            "uploads",
            "attachments",
            "reports",
            "mailbox",
            "inbox",
            "security_raw_inbox",
            "runtime",
            "tests",
            ".env",
            "db.sqlite3",
            "secrets.json",
            "credentials.json",
            "token.json",
            "winsw.xml",
            "SecurityCenterAI.xml",
            ".key",
            ".pem",
            ".pfx",
            ".p12",
            ".exe",
            ".sqlite3",
            ".db",
            ".log",
        ]:
            with self.subTest(forbidden_pattern=forbidden_pattern):
                self.assertIn(f'"{forbidden_pattern}"', package_script)

    def test_package_script_handles_optional_bundled_service_wrappers(self):
        package_script = (WINDOWS_SCRIPT_ROOT / "package_test_deployment.ps1").read_text(encoding="utf-8")

        for required_text in [
            "tools\\windows\\winsw.exe",
            "$repoWinSwPath",
            "$packageWinSwPath",
            '"current"',
            "WinSW-x64.exe",
            "Copy-Item -LiteralPath $repoWinSwPath -Destination $packageWinSwPath -Force",
            "WinSW incluso nel pacchetto",
            "WinSW non trovato: il servizio Windows usera NSSM se disponibile",
            "Copiare o rinominare il binario verificato in tools\\windows\\winsw.exe",
            "tools\\windows\\nssm.exe",
            "$repoNssmPath",
            "$packageNssmPath",
            "Copy-Item -LiteralPath $repoNssmPath -Destination $packageNssmPath -Force",
            "NSSM incluso nel pacchetto come fallback",
            "Nessun wrapper servizio trovato",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, package_script)

    def test_gitignore_keeps_optional_local_service_wrappers_out_of_git(self):
        gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("tools/windows/winsw.exe", gitignore)
        self.assertIn("tools/windows/nssm.exe", gitignore)
        self.assertIn("tools/windows/winsw.xml", gitignore)
        self.assertIn("tools/windows/SecurityCenterAI.xml", gitignore)

    def test_gitignore_contains_generated_artifact_policy(self):
        gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")

        for required_text in [
            ".env",
            ".env.*",
            "!.env.example",
            "!.env.test-sqlserver.example",
            ".venv/",
            "venv/",
            "__pycache__/",
            "*.pyc",
            ".pytest_cache/",
            "db.sqlite3",
            "*.sqlite3",
            "logs/",
            "dist/",
            "frontend/dist/",
            "frontend/node_modules/",
            "node_modules/",
            "security_raw_inbox/",
            "media/uploads/",
            "*.log",
            "*.zip",
            "*.exe",
            "dist/installer/",
            "tools/windows/winsw.exe",
            "tools/windows/nssm.exe",
            "tools/windows/SecurityCenterAI.xml",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, gitignore)

    def test_gitignore_allows_safe_env_examples_and_ignores_local_wrappers(self):
        checks = {
            ".env": True,
            ".env.example": False,
            ".env.test-sqlserver.example": False,
            "tools/windows/winsw.exe": True,
            "tools/windows/nssm.exe": True,
            "tools/windows/README.md": False,
        }

        for path, should_be_ignored in checks.items():
            with self.subTest(path=path):
                result = subprocess.run(
                    git_command("check-ignore", "--no-index", "-q", path),
                    cwd=REPO_ROOT,
                    check=False,
                )
                self.assertEqual(result.returncode == 0, should_be_ignored)

    def test_tools_windows_readme_is_available_and_not_ignored(self):
        readme_path = REPO_ROOT / "tools" / "windows" / "README.md"
        self.assertTrue(readme_path.exists())

        result = subprocess.run(
            git_command("check-ignore", "--no-index", "-q", "tools/windows/README.md"),
            cwd=REPO_ROOT,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)

    def test_tools_windows_readme_documents_winsw_preferred_and_nssm_fallback(self):
        readme = (REPO_ROOT / "tools" / "windows" / "README.md").read_text(encoding="utf-8")

        for required_text in [
            "WinSW e il wrapper servizio Windows preferito",
            "tools\\windows\\winsw.exe",
            "release ufficiali WinSW su GitHub",
            "tools\\windows\\nssm.exe",
            "NSSM resta disponibile solo come fallback opzionale",
            "release ufficiale NSSM",
            "Non rinominare eseguibili non correlati",
            "include automaticamente",
            "Non viene eseguito alcun download automatico",
            "responsabilita di licenza",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, readme)

    def test_inno_setup_installer_files_exist(self):
        installer_script = INSTALLER_ROOT / "SecurityCenterAI-Test.iss"
        build_script = WINDOWS_SCRIPT_ROOT / "build_installer.ps1"

        self.assertTrue(installer_script.exists())
        self.assertTrue(build_script.exists())
        self.assertGreater(len(installer_script.read_text(encoding="utf-8").strip()), 100)
        self.assertGreater(len(build_script.read_text(encoding="utf-8").strip()), 100)

    def test_inno_setup_script_references_package_and_shortcuts(self):
        installer_script = (INSTALLER_ROOT / "SecurityCenterAI-Test.iss").read_text(encoding="utf-8")

        for required_text in [
            '#define AppName "Security Center AI"',
            "SecurityCenterAI-Setup-{#AppVersion}",
            "dist\\SecurityCenterAI-Test-",
            "{autopf}\\Security Center AI",
            "install_service.ps1",
            "tools\\windows\\winsw.exe",
            "tools\\windows\\nssm.exe",
            "start_service.bat",
            "stop_service.bat",
            "restart_service.bat",
            "service_status.bat",
            "open_security_center.bat",
            "[Code]",
            "WizardStyle=classic",
            "Tipo installazione",
            "CreateInputQueryPage",
            "Database SQL Server TEST",
            "Autenticazione SQL Server",
            "Componenti e primo avvio",
            "installer_apply_setup.ps1",
            "installer-setup.json",
            "RunGuidedSetupFromInstaller",
            "uninstall_service.ps1",
            "[UninstallRun]",
            "WINDOWS_INSTALLER_EXE.md",
            ".env",
            ".venv\\*",
            "runtime\\*",
            "node_modules\\*",
            "db.sqlite3",
            "security_raw_inbox\\*",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, installer_script)

        icons_section = installer_script.split("[Icons]", 1)[1].split("[Run]", 1)[0]
        self.assertNotIn("Flags: shellexec", icons_section)
        self.assertNotIn(
            'Name: "desktopicon"; Description: "Crea collegamento Desktop per aprire Security Center AI"; GroupDescription: "Collegamenti opzionali:"; Flags: unchecked',
            installer_script,
        )
        self.assertNotIn("-DbPassword", installer_script)
        self.assertNotIn("first_run_wizard.ps1", installer_script)
        self.assertNotIn("run_inno_guided_setup.ps1", installer_script)
        self.assertNotIn("Procedura guidata TEST", installer_script)

    def test_inno_setup_has_native_guided_pages(self):
        installer_script = (INSTALLER_ROOT / "SecurityCenterAI-Test.iss").read_text(encoding="utf-8")

        for required_text in [
            "SetupModePage: TInputOptionWizardPage",
            "SqlPage: TInputQueryWizardPage",
            "SqlDiscoveryButton: TNewButton",
            "SqlDiscoveryList: TNewListBox",
            "AuthPage: TInputOptionWizardPage",
            "SqlAuthPage: TInputQueryWizardPage",
            "GuideOptionsPage: TInputOptionWizardPage",
            "Installazione completa TEST guidata",
            "Solo copia file e collegamenti",
            "Server SQL di partenza o istanza nota, esempio localhost\\SQLEXPRESS",
            "Rileva istanze SQL",
            "Discovery locale da servizi Windows e registry SQL Server",
            "WriteSqlDiscoveryScript",
            "LoadStringsFromFile",
            "Database TEST",
            "Driver ODBC SQL Server",
            "Allowed hosts Django",
            "Porta applicazione",
            "Autenticazione Windows / Trusted Connection",
            "Utente SQL",
            "Password SQL",
            "Creare il database TEST se manca",
            "Caricare dati demo sintetici",
            "Installare e avviare il servizio Windows SecurityCenterAI",
            "Usare il frontend gia incluso",
            "senza aprire finestre PowerShell",
            "SkipSmokeCheck",
            "OpenBrowser",
            "SaveStringToFile(ConfigPath, Json, False)",
            "DeleteFile(ConfigPath)",
            "Exec('powershell.exe'",
            "notepad.exe",
            "Aprirlo ora?",
            "SW_HIDE",
            "runtime\\installer-setup.log",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, installer_script)

        self.assertNotIn("DB_PASSWORD", installer_script)

    def test_installer_build_script_resolves_inno_and_outputs_dist_installer(self):
        build_script = (WINDOWS_SCRIPT_ROOT / "build_installer.ps1").read_text(encoding="utf-8")

        for required_text in [
            "ISCC.exe",
            "INNO_SETUP_ISCC",
            "SecurityCenterAI-Test.iss",
            "package_test_deployment.ps1",
            "dist",
            "installer",
            "SecurityCenterAI-Setup-$resolvedVersion.exe",
            "-Version",
            '"current"',
            "tools\\windows\\winsw.exe",
            "WinSW incluso nell'installer",
            "tools\\windows\\nssm.exe",
            "NSSM incluso nell'installer",
            "Nessun wrapper servizio trovato nel pacchetto",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, build_script)

    def test_setup_script_supports_install_service_flow(self):
        script = (WINDOWS_SCRIPT_ROOT / "setup_test_deployment.ps1").read_text(encoding="utf-8")

        for required_text in [
            "[switch]$InstallService",
            "[switch]$ConfigureSqlServer",
            "[switch]$CreateDatabase",
            "configure_sqlserver_env.ps1",
            ".env non trovato. Eseguire configure_sqlserver_env.ps1 oppure creare .env da .env.test-sqlserver.example.",
            "-CreateDatabase",
            "-SkipDjangoActions",
            "-DbHost",
            "-DbName",
            "-TrustedConnection",
            "-DbUser",
            "-AllowedHosts",
            "-Port",
            "[switch]$SkipFrontendBuild",
            "Uso frontend/dist gia incluso nel pacchetto installer.",
            "non richiedere Node/npm",
            '$ErrorActionPreference = "Continue"',
            "$exitCode = $LASTEXITCODE",
            "Restart-SelfAsAdministratorIfNeeded",
            "Installazione in Program Files rilevata",
            "-Verb RunAs",
            "install_service.ps1",
            "Resolve-ServiceWrapperForServiceInstall",
            "tools\\windows\\winsw.exe",
            "Get-Command \"winsw.exe\"",
            "tools\\windows\\nssm.exe",
            "Get-Command \"nssm.exe\"",
            "Nessun wrapper servizio trovato. Copiare winsw.exe in tools\\windows\\winsw.exe oppure nssm.exe in tools\\windows\\nssm.exe.",
            "-StartService",
            "Oppure, in modalita manuale legacy",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, script)

        self.assertLess(
            script.index("Resolve-ServiceWrapperForServiceInstall"),
            script.index("Invoke-CheckedCommand -FilePath \"powershell\""),
        )

    def test_installer_apply_setup_runner_is_hidden_bootstrap(self):
        script = (WINDOWS_SCRIPT_ROOT / "installer_apply_setup.ps1").read_text(encoding="utf-8")

        for required_text in [
            "installer-setup.log",
            "Add-SensitiveValue",
            "Redact-LogValue",
            "DB_PASSWORD|SECRET_KEY|PASSWORD|PWD",
            "ScriptStackTrace",
            "Log dettagliato",
            "Add-NamedStringArg",
            "Format-ArgumentLog",
            "Argomenti:",
            "ConvertFrom-Json",
            "configure_sqlserver_env.ps1",
            "setup_test_deployment.ps1",
            "Add-NamedStringArg -Arguments $configureArgs -Name \"DbPassword\"",
            "Add-NamedStringArg -Arguments $configureArgs -Name \"DbDriver\"",
            "$configureArgs[\"CreateDatabase\"] = $true",
            "Remove-Item -LiteralPath $ConfigPath",
            "NonInteractive = $true",
            "SkipDjangoActions = $true",
            "$setupArgs[\"SkipFrontendBuild\"] = $true",
            "$setupArgs[\"InstallService\"] = $true",
            "$setupArgs[\"SeedDemo\"] = $true",
            "$setupArgs[\"SkipSmokeCheck\"] = $true",
            "*>&1",
            "-Arguments $configureArgs",
            "-Arguments $setupArgs",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, script)

        self.assertNotRegex(script, r"powershell.+DbPassword")
        self.assertNotRegex(script, r"Write-(Host|Output|Warning|Error).+DbPassword")
        self.assertNotRegex(script, r"Write-(Host|Output|Warning|Error).+SECRET_KEY")

    def test_installer_apply_setup_runner_checks_powershell_script_status(self):
        script = (WINDOWS_SCRIPT_ROOT / "installer_apply_setup.ps1").read_text(encoding="utf-8")
        invoke_helper = script.split("function Invoke-StepScript", 1)[1].split("Set-Location", 1)[0]

        self.assertIn("$scriptSucceeded = $?", invoke_helper)
        self.assertIn("if (!$scriptSucceeded)", invoke_helper)
        self.assertNotIn("$LASTEXITCODE", invoke_helper)

    def test_configure_sqlserver_env_wizard_is_safe_and_guided(self):
        script = (WINDOWS_SCRIPT_ROOT / "configure_sqlserver_env.ps1").read_text(encoding="utf-8")

        for required_text in [
            ".env.test-sqlserver.example",
            "Copy-Item -LiteralPath $EnvExamplePath -Destination $EnvPath",
            "[string]$DbHost",
            "[string]$DbName",
            "[string]$TrustedConnection",
            "[string]$DbUser",
            "[string]$DbPassword",
            "[switch]$Force",
            "[switch]$TestConnection",
            "[switch]$CreateDatabase",
            "[switch]$RunMigrations",
            "[switch]$SeedDemo",
            "[switch]$NonInteractive",
            "[switch]$SkipDjangoActions",
            "Read-Host $Prompt -AsSecureString",
            "DB_TRUSTED_CONNECTION",
            "ODBC Driver 18 for SQL Server",
            "Get-LocalSqlInstanceCandidates",
            "Open-SqlConnectionWithDiscovery",
            "Discovery istanze SQL Server locali",
            "AllowEmptyCollection",
            "MSSQLSERVER",
            "MSSQL$*",
            "Instance Names\\SQL",
            "Provo istanza SQL rilevata",
            "DB_HOST aggiornato nella .env con istanza rilevata",
            "DB_ID(?)",
            "CREATE DATABASE $(Quote-SqlIdentifier -Name $Name)",
            "CREATE DATABASE $quotedName;",
            "Tentare la creazione del database ora?",
            "Database non disponibile. Operazione interrotta prima di test Django, migrazioni o seed.",
            "security_db_check",
            "migrate",
            "seed_security_uat_demo",
            "security_uat_smoke_check",
            "supporto manuale della .env esistente",
            "Aggiornare la configurazione guidata in .env?",
            "Django secret key: <masked>",
            "Password SQL: <masked>",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, script)

        self.assertNotRegex(script, r"Write-(Host|Output|Warning|Error).+DB_PASSWORD")
        self.assertNotRegex(script, r"Write-(Host|Output|Warning|Error).+SECRET_KEY")
        self.assertNotIn("sk-", script)
        self.assertNotIn("@example.com", script)
        self.assertNotIn("DROP DATABASE", script)

    def test_drop_test_database_script_is_explicit_and_guarded(self):
        script = (WINDOWS_SCRIPT_ROOT / "drop_test_database.ps1").read_text(encoding="utf-8")

        for required_text in [
            "SupportsShouldProcess",
            "[switch]$ForceUnsafeName",
            "[switch]$DryRun",
            "Questo script non viene mai eseguito dall'uninstaller.",
            "DB_NAME",
            "(?i)(TEST|UAT)",
            "DROP $dbName",
            "Conferma non corrispondente. Operazione annullata.",
            "ALTER DATABASE $quotedName SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $quotedName;",
            "New-Object -TypeName System.Data.Odbc.OdbcConnection",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, script)

        self.assertNotRegex(script, r"Write-(Host|Output|Warning|Error).+DB_PASSWORD")
        self.assertNotRegex(script, r"Write-(Host|Output|Warning|Error).+SECRET_KEY")

    def test_service_scripts_use_waitress_and_do_not_print_secrets(self):
        forbidden_texts = [
            "DB_PASSWORD",
            "SECRET_KEY",
            "DJANGO_SECRET_KEY",
            "SQLSERVER_PASSWORD",
            "webhook",
        ]

        for script_name in [
            "install_service.ps1",
            "uninstall_service.ps1",
            "start_service.bat",
            "stop_service.bat",
            "restart_service.bat",
            "service_status.bat",
            "open_firewall_8000.ps1",
        ]:
            with self.subTest(script_name=script_name):
                script = (WINDOWS_SCRIPT_ROOT / script_name).read_text(encoding="utf-8")
                for forbidden_text in forbidden_texts:
                    self.assertNotIn(forbidden_text, script)

        install_script = (WINDOWS_SCRIPT_ROOT / "install_service.ps1").read_text(encoding="utf-8")
        for required_text in [
            "winsw.exe",
            "tools\\windows\\winsw.exe",
            "Get-Command \"winsw.exe\"",
            "winsw.xml",
            "SecurityCenterAI.xml",
            "Get-WinSwXmlPath",
            "Write-WinSwXml",
            "<id>$ServiceName</id>",
            "<name>$DisplayName</name>",
            "<description>$ServiceDescription</description>",
            "<executable>$(ConvertTo-XmlText -Value $PythonPath)</executable>",
            "<arguments>$(ConvertTo-XmlText -Value $WaitressArguments)</arguments>",
            "<workingdirectory>$(ConvertTo-XmlText -Value $RepoRoot.Path)</workingdirectory>",
            "<logpath>$(ConvertTo-XmlText -Value $LogsDir)</logpath>",
            "WinSW non trovato, uso fallback NSSM.",
            "nssm.exe",
            "tools\\windows\\nssm.exe",
            "Get-Command \"nssm.exe\"",
            "Nessun wrapper servizio trovato. Copiare winsw.exe in tools\\windows\\winsw.exe oppure nssm.exe in tools\\windows\\nssm.exe.",
            "waitress",
            "SecurityCenterAI",
            "service.out.log",
            "service.err.log",
            "launcher.log",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, install_script)

        self.assertLess(
            install_script.index("Test-Path -LiteralPath $ToolWinSw"),
            install_script.index("Get-Command \"nssm.exe\""),
        )
        self.assertLess(
            install_script.index("Get-Command \"winsw.exe\""),
            install_script.index("Test-Path -LiteralPath $ToolNssm"),
        )
        self.assertNotIn("DB_PASSWORD", install_script)
        self.assertNotIn("SECRET_KEY", install_script)

        uninstall_script = (WINDOWS_SCRIPT_ROOT / "uninstall_service.ps1").read_text(encoding="utf-8")
        for required_text in [
            "winsw.exe",
            "winsw.xml",
            "SecurityCenterAI.xml",
            "Get-WinSwXmlPath",
            "Invoke-WinSwUninstall",
            "Invoke-NssmUninstall",
            "sc.exe delete",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, uninstall_script)

        for script_name, required_text in [
            ("start_service.bat", "sc.exe start SecurityCenterAI"),
            ("stop_service.bat", "sc.exe stop SecurityCenterAI"),
            ("service_status.bat", "sc.exe query SecurityCenterAI"),
        ]:
            with self.subTest(script_name=script_name):
                script = (WINDOWS_SCRIPT_ROOT / script_name).read_text(encoding="utf-8")
                self.assertIn(required_text, script)

    def test_cleanup_script_is_safe_by_default(self):
        script = (WINDOWS_SCRIPT_ROOT / "clean_generated_artifacts.ps1").read_text(encoding="utf-8")

        for required_text in [
            "[switch]$DryRun",
            "[switch]$OldInstallerVersionsOnly",
            "[string]$KeepVersion",
            "[switch]$IncludeNodeModules",
            "[switch]$IncludeLogs",
            "[switch]$IncludeEnv",
            "[switch]$IncludeLocalTools",
            "[switch]$IncludeDatabases",
            "DRY RUN:",
            "[switch]$ContinueOnError",
            "Rimozione non riuscita",
            "dist",
            "frontend\\dist",
            ".pytest_cache",
            "__pycache__",
            "*.pyc",
            "Skip .env: non viene mai rimosso senza -IncludeEnv e conferma.",
            "DELETE LOCAL ENV",
            "tools\\windows\\winsw.exe",
            "tools\\windows\\nssm.exe",
            "Skip strumenti locali",
            "DELETE LOCAL DATABASES",
            "Test-PathInsideRepo",
            "Remove-OldInstallerVersions",
            "SecurityCenterAI-Test-$versionToKeep",
            "SecurityCenterAI-Setup-$versionToKeep.exe",
            "Versione corrente non trovata. Usare -KeepVersion <x.y.z>.",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, script)

        default_section = script.split("if ($IncludeEnv)", 1)[0]
        self.assertNotIn('Remove-GeneratedPath -Path (Join-Path $RepoRoot ".env")', default_section)
        self.assertNotIn('Remove-GeneratedPath -Path (Join-Path $RepoRoot "tools\\windows\\winsw.exe")', default_section)
        self.assertNotIn('Remove-GeneratedPath -Path (Join-Path $RepoRoot "tools\\windows\\nssm.exe")', default_section)

    def test_windows_package_doc_mentions_required_safety_topics(self):
        doc = (DOC_ROOT / "WINDOWS_TEST_PACKAGE.md").read_text(encoding="utf-8")

        for required_text in [
            "CREATE DATABASE SecurityCenterAI_TEST",
            "non esporre su Internet",
            "Non committare `.env`",
            "ODBC Driver 18 for SQL Server",
            "New-NetFirewallRule",
            "setup_test_deployment.ps1 -SeedDemo",
            "setup_test_deployment.ps1 -ConfigureSqlServer -SeedDemo -InstallService",
            "setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService",
            "Waitress",
            "install_service.ps1 -StartService",
            "drop_test_database.ps1",
            "standard uninstall non elimina il database SQL Server",
            "open_security_center.bat",
            "WINDOWS_SERVICE_DEPLOYMENT.md",
            "tools/windows/winsw.exe",
            "tools/windows/nssm.exe",
            "WinSW preferito",
            "NSSM resta fallback opzionale",
            "Non viene eseguito alcun download automatico",
            "Configurazione guidata",
            "configure_sqlserver_env.ps1 -TestConnection",
            ".env` contiene segreti",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, doc)

    def test_windows_installer_doc_mentions_required_safety_topics(self):
        doc = (DOC_ROOT / "WINDOWS_INSTALLER_EXE.md").read_text(encoding="utf-8")

        for required_text in [
            "Inno Setup 6",
            "SecurityCenterAI-Setup-0.5.17.exe",
            "procedura guidata classica Windows",
            "PowerShell resta usato solo come bootstrap interno nascosto",
            "Tipo installazione",
            "Database SQL Server TEST",
            "Autenticazione SQL Server",
            "Componenti e primo avvio",
            "Riepilogo finale",
            "installer_apply_setup.ps1",
            "runtime\\installer-setup.log",
            "Non vengono creati collegamenti operatore a wizard PowerShell o setup PowerShell",
            "crea `.venv` e installa `requirements.txt`",
            "esegue `security_db_check` e `migrate`",
            "drop_test_database.ps1",
            "standard uninstall non elimina il database SQL Server",
            "CREATE DATABASE [SecurityCenterAI_TEST];",
            "SQL Server resta il database target",
            "test LAN",
            "Non esporre su Internet",
            "Waitress",
            "Python resta necessario",
            ".venv",
            "runtime",
            "node_modules",
            "security_raw_inbox",
            "Nessuna integrazione Microsoft Graph",
            "Nessuna integrazione IMAP",
            "tools\\windows\\winsw.exe",
            "tools\\windows\\nssm.exe",
            "WinSW e il wrapper servizio preferito",
            "NSSM resta fallback opzionale",
            "Nessun download automatico di WinSW o NSSM",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, doc)

        self.assertNotIn("first_run_wizard.ps1", doc)
        self.assertNotIn("run_inno_guided_setup.ps1", doc)
        self.assertNotIn("Procedura guidata TEST", doc)

    def test_patch_history_and_deployment_artifact_policy_exist(self):
        patch_history = DOC_ROOT / "patch-history"
        policy = DOC_ROOT / "DEPLOYMENT_ARTIFACT_POLICY.md"

        self.assertTrue(patch_history.is_dir())
        self.assertTrue(policy.exists())

        for doc_name in [
            "PATCH_13.5_CONFIGURATION_STUDIO.md",
            "PATCH_14_CONFIGURATION_API.md",
            "PATCH_14_SUMMARY.md",
            "PATCH_15A_MODULE_WORKSPACES.md",
            "PATCH_15B_SOURCE_WIZARD.md",
            "PATCH_15_SOURCE_WIZARD.md",
            "PATCH_18_FRONTEND_ITALIAN_LOCALIZATION.md",
            "PATCH_12_SUMMARY.md",
            "PATCH_13_MAILBOX_PIPELINE_SUMMARY.md",
            "PATCH_13_SUMMARY.md",
        ]:
            with self.subTest(doc_name=doc_name):
                self.assertTrue((patch_history / doc_name).exists())

        policy_text = policy.read_text(encoding="utf-8")
        for required_text in [
            "Cosa va in Git",
            "Cosa deve restare locale",
            "tools/windows/winsw.exe",
            "tools/windows/nssm.exe",
            "dist/SecurityCenterAI-Test-<version>/",
            "dist/installer/",
            ".env",
            "database",
            "clean_generated_artifacts.ps1 -DryRun",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, policy_text)

    def test_windows_service_doc_mentions_service_operator_flow(self):
        doc = (DOC_ROOT / "WINDOWS_SERVICE_DEPLOYMENT.md").read_text(encoding="utf-8")

        for required_text in [
            "Waitress",
            "nssm.exe",
            "PowerShell amministrativa",
            "configure_sqlserver_env.ps1 -TestConnection",
            "setup_test_deployment.ps1 -ConfigureSqlServer -SeedDemo -InstallService",
            "setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService",
            "drop_test_database.ps1",
            "standard uninstall non elimina il database SQL Server",
            "Copy-Item .env.test-sqlserver.example .env",
            "CREATE DATABASE SecurityCenterAI_TEST",
            "ODBC Driver 18 for SQL Server",
            "Python resta necessario",
            "SecurityCenterAI",
            "service.out.log",
            "service.err.log",
            "launcher.log",
            "open_firewall_8000.ps1",
            "Nessuna integrazione Microsoft Graph",
            "Nessuna integrazione IMAP",
            "tools/windows/winsw.exe",
            "tools/windows/nssm.exe",
            "WinSW e il wrapper preferito",
            "NSSM e solo fallback",
            "Non viene eseguito alcun download automatico",
            ".env` contiene segreti",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, doc)

    def test_sqlserver_deployment_doc_mentions_guided_configuration(self):
        doc = (DOC_ROOT / "SQLSERVER_TEST_DEPLOYMENT.md").read_text(encoding="utf-8")

        for required_text in [
            "Configurazione guidata",
            "configure_sqlserver_env.ps1 -TestConnection",
            "setup_test_deployment.ps1 -ConfigureSqlServer -SeedDemo -InstallService",
            "setup_test_deployment.ps1 -ConfigureSqlServer -CreateDatabase -SeedDemo -InstallService",
            "supporto manuale resta disponibile",
            "password viene richiesta con input sicuro",
            "password viene comunque salvata localmente nella `.env`",
            "DB deve esistere oppure puo essere creato solo con richiesta esplicita",
            "CREATE DATABASE [SecurityCenterAI_TEST];",
            "standard uninstall non elimina il database SQL Server",
            "drop_test_database.ps1",
            "Non committare `.env`",
            "Non usare database di produzione",
        ]:
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, doc)

    def test_existing_deployment_docs_point_to_windows_package(self):
        for doc_name in [
            "LOCAL_TEST_DEPLOYMENT.md",
            "SQLSERVER_TEST_DEPLOYMENT.md",
            "LOCAL_TESTING_QUICKSTART.md",
        ]:
            with self.subTest(doc_name=doc_name):
                doc = (DOC_ROOT / doc_name).read_text(encoding="utf-8")
                self.assertIn("WINDOWS_TEST_PACKAGE.md", doc)
