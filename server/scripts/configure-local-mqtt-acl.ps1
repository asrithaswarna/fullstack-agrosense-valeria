$ErrorActionPreference = 'Stop'

$resultPath = Join-Path $PSScriptRoot '..\.stage8-mqtt-setup.txt'
$installPath = 'C:\Program Files\Mosquitto'
$configPath = Join-Path $installPath 'mosquitto.conf'
$passwordPath = Join-Path $installPath 'valeria-passwords'
$aclPath = Join-Path $installPath 'valeria-acl'
$passwordTool = Join-Path $installPath 'mosquitto_passwd.exe'
$environmentPath = Join-Path $PSScriptRoot '..\.env'
$publisherCredentialsPath = Join-Path $PSScriptRoot '..\mqtt-publishers.local.json'
$backupSuffix = '.stage8-backup'
$serviceName = 'mosquitto'

function Write-Result([string]$message) {
  Set-Content -Path $resultPath -Value $message -Encoding UTF8
}

function Set-EnvironmentValue([System.Collections.Generic.List[string]]$lines, [string]$name, [string]$value) {
  $pattern = '^\s*' + [regex]::Escape($name) + '='
  $found = $false
  for ($index = 0; $index -lt $lines.Count; $index += 1) {
    if ($lines[$index] -match $pattern) {
      $lines[$index] = "$name=$value"
      $found = $true
    }
  }
  if (-not $found) {
    $lines.Add("$name=$value")
  }
}

function New-StrongPassword {
  $bytes = New-Object byte[] 36
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', 'A').Replace('/', 'B')
}

function Set-PrivateFileAcl([string]$path, [string]$user) {
  & icacls.exe $path /inheritance:r /grant:r "${user}:(F)" 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not restrict access to $path."
  }
}

try {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'This setup must run in an elevated Administrator session.'
  }
  if (-not (Test-Path $configPath) -or -not (Test-Path $passwordTool)) {
    throw 'Mosquitto configuration or password utility was not found in the expected installation folder.'
  }
  if (-not (Test-Path $environmentPath)) {
    throw 'server\.env is required; copy server\.env.example and configure PostgreSQL/JWT first.'
  }
  foreach ($path in @($configPath, $environmentPath, $passwordPath, $aclPath, $publisherCredentialsPath)) {
    if (Test-Path "$path$backupSuffix") {
      throw "A previous setup backup already exists at $path$backupSuffix; inspect it before retrying."
    }
  }

  $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  Push-Location (Join-Path $projectRoot 'server')
  try {
    $query = "import 'dotenv/config'; import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); try { const greenhouses = await prisma.greenhouse.findMany({ select: { id: true } }); console.log(greenhouses.map((greenhouse) => greenhouse.id).join('\n')) } finally { await prisma.`$disconnect() }"
    $greenhouseIds = @(& node --input-type=module -e $query)
    if ($LASTEXITCODE -ne 0 -or $greenhouseIds.Count -eq 0) {
      throw 'Could not load greenhouse IDs from the configured PostgreSQL database.'
    }
  } finally {
    Pop-Location
  }

  foreach ($greenhouseId in $greenhouseIds) {
    if ($greenhouseId -notmatch '^[0-9a-fA-F-]{36}$') {
      throw 'The greenhouse database returned an invalid MQTT ACL identifier.'
    }
  }

  $user = "$env:USERDOMAIN\$env:USERNAME"
  $backendPassword = New-StrongPassword
  $publisherCredentials = @()
  $acl = @(
    'user valeria_backend',
    'topic read valeria/greenhouses/#',
    'topic write valeria/greenhouses/#'
  )

  Copy-Item $configPath "$configPath$backupSuffix"
  Copy-Item $environmentPath "$environmentPath$backupSuffix"
  $serviceWasRunning = (Get-Service -Name $serviceName).Status -eq 'Running'
  if ($serviceWasRunning) {
    Stop-Service -Name $serviceName
    (Get-Service -Name $serviceName).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(20))
  }

  try {
    & $passwordTool -c -b $passwordPath 'valeria_backend' $backendPassword
    if ($LASTEXITCODE -ne 0) {
      throw 'Mosquitto could not create the backend password entry.'
    }

    foreach ($greenhouseId in $greenhouseIds) {
      $publisherPassword = New-StrongPassword
      & $passwordTool -b $passwordPath $greenhouseId $publisherPassword
      if ($LASTEXITCODE -ne 0) {
        throw 'Mosquitto could not create a greenhouse publisher password entry.'
      }
      $publisherCredentials += [ordered]@{
        greenhouseId = $greenhouseId
        username = $greenhouseId
        password = $publisherPassword
      }
      $acl += "user $greenhouseId"
      $acl += "topic write valeria/greenhouses/$greenhouseId/#"
    }

    Set-Content -Path $aclPath -Value $acl -Encoding ASCII
    Set-PrivateFileAcl $passwordPath $user
    Set-PrivateFileAcl $aclPath $user

    $config = [System.IO.File]::ReadAllText($configPath)
    $config += "`r`n# VALERIA local authenticated MQTT configuration`r`n"
    $config += "listener 1883 127.0.0.1`r`n"
    $config += "allow_anonymous false`r`n"
    $config += "password_file `"$passwordPath`"`r`n"
    $config += "acl_file `"$aclPath`"`r`n"
    [System.IO.File]::WriteAllText($configPath, $config, (New-Object System.Text.UTF8Encoding($false)))

    $environmentLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in [System.IO.File]::ReadAllLines($environmentPath)) {
      $environmentLines.Add($line)
    }
    Set-EnvironmentValue $environmentLines 'MQTT_BROKER_URL' 'mqtt://localhost:1883'
    Set-EnvironmentValue $environmentLines 'MQTT_USERNAME' 'valeria_backend'
    Set-EnvironmentValue $environmentLines 'MQTT_PASSWORD' $backendPassword
    Set-EnvironmentValue $environmentLines 'MQTT_CLIENT_ID' 'valeria-backend'
    [System.IO.File]::WriteAllLines($environmentPath, $environmentLines, (New-Object System.Text.UTF8Encoding($false)))
    Set-Content -Path $publisherCredentialsPath -Value ($publisherCredentials | ConvertTo-Json -Depth 4) -Encoding UTF8
    Set-PrivateFileAcl $environmentPath $user
    Set-PrivateFileAcl $publisherCredentialsPath $user

    if ($serviceWasRunning) {
      Start-Service -Name $serviceName
      (Get-Service -Name $serviceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(20))
      $connected = $false
      for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
          $client.Connect('127.0.0.1', 1883)
          $connected = $true
          break
        } catch {
          Start-Sleep -Milliseconds 250
        } finally {
          $client.Dispose()
        }
      }
      if (-not $connected) {
        throw 'Mosquitto did not listen on 127.0.0.1:1883 after restart.'
      }
    }
  } catch {
    if (Test-Path $configPath) { Copy-Item "$configPath$backupSuffix" $configPath -Force }
    if (Test-Path $environmentPath) { Copy-Item "$environmentPath$backupSuffix" $environmentPath -Force }
    if ($serviceWasRunning -and (Get-Service -Name $serviceName).Status -ne 'Running') {
      Start-Service -Name $serviceName
    }
    throw
  }

  Write-Result "SUCCESS`r`nGreenhouse publisher accounts configured: $($publisherCredentials.Count)`r`nBackend credentials are in server\.env.`r`nGreenhouse publisher credentials are in server\mqtt-publishers.local.json.`r`nMosquitto config and credentials have administrator-only ACLs."
} catch {
  Write-Result "FAILED`r`n$($_.Exception.Message)"
  exit 1
}
