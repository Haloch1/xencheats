param(
  [string]$NodePath = "node",
  [string]$BridgeScript = (Join-Path $PSScriptRoot "xen-reinvestment-bridge.mjs"),
  [int]$CdpPort = 9222
)

$ErrorActionPreference = "Stop"
if ($NodePath -eq "node") {
  $NodePath = (Get-Command node -ErrorAction Stop).Source
}

$localAppData = $env:LOCALAPPDATA
if (-not $localAppData) { $localAppData = Join-Path $HOME "AppData\Local" }
$profileDirectory = Join-Path $localAppData "XenReinvestmentBridge\CoinbaseProfile"
New-Item -ItemType Directory -Force -Path $profileDirectory | Out-Null

$chromeCandidates = @(
  (Join-Path ${env:ProgramFiles} "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$chromePath = $chromeCandidates | Select-Object -First 1
if (-not $chromePath) { throw "Google Chrome was not found for the persistent Coinbase profile." }

$escapedProfile = [regex]::Escape($profileDirectory)
$chromeProcess = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "^(chrome|chrome\.exe)$" -and $_.CommandLine -match $escapedProfile }

if (-not $chromeProcess) {
  $chromeArguments = "--user-data-dir=`"$profileDirectory`" --profile-directory=Default --remote-debugging-port=$CdpPort --remote-allow-origins=http://127.0.0.1:$CdpPort --new-window https://www.coinbase.com/home"
  Start-Process -FilePath $chromePath -ArgumentList $chromeArguments | Out-Null
}

$env:XEN_COINBASE_BROWSER_CDP_URL = "http://127.0.0.1:$CdpPort"
$env:XEN_COINBASE_BROWSER_HEADLESS = "false"
& $NodePath $BridgeScript
exit $LASTEXITCODE
