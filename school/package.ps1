$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$buildRoot = Join-Path $repoRoot 'school-output'
$downloadRoot = Join-Path $repoRoot 'school-download'
New-Item -ItemType Directory -Path $buildRoot, $downloadRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot 'runtime'), (Join-Path $buildRoot 'licenses') -Force | Out-Null

$releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
$release = $releases | Where-Object { $_.version -match '^v22\.\d+\.\d+$' -and $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
if (-not $release) { throw 'No supported Node.js 22 Windows x64 release was found.' }
$version = $release.version
$archiveName = "node-$version-win-x64.zip"
$baseUrl = "https://nodejs.org/dist/$version"
$checksums = (Invoke-WebRequest -Uri "$baseUrl/SHASUMS256.txt").Content
$match = [regex]::Match($checksums, ('(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($archiveName) + '\s*$'))
if (-not $match.Success) { throw 'Official SHA-256 for the Windows runtime was not found.' }
$archivePath = Join-Path $downloadRoot $archiveName
Invoke-WebRequest -Uri "$baseUrl/$archiveName" -OutFile $archivePath
$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $match.Groups[1].Value.ToLowerInvariant()) { throw 'Runtime checksum does not match the official release.' }
Expand-Archive -LiteralPath $archivePath -DestinationPath $downloadRoot
$runtimeSource = Join-Path $downloadRoot "node-$version-win-x64"
Copy-Item -LiteralPath (Join-Path $runtimeSource 'node.exe') -Destination (Join-Path $buildRoot 'runtime/node.exe')
Copy-Item -LiteralPath (Join-Path $runtimeSource 'LICENSE') -Destination (Join-Path $buildRoot 'licenses/Node.js-LICENSE.txt')
Copy-Item -LiteralPath (Join-Path $repoRoot 'preview-3d/dist') -Destination $buildRoot -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'preview-3d/serve-preview.mjs') -Destination $buildRoot
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '게임시작.cmd') -Destination $buildRoot
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '학교용_사용방법.txt') -Destination $buildRoot
foreach ($packageName in @('react','react-dom','scheduler','three','cannon-es')) {
  $source = Join-Path $repoRoot "preview-3d/node_modules/$packageName/LICENSE"
  if (-not (Test-Path -LiteralPath $source)) { throw "Missing license: $packageName" }
  Copy-Item -LiteralPath $source -Destination (Join-Path $buildRoot "licenses/$packageName-LICENSE.txt")
}
$actualVersion = & (Join-Path $buildRoot 'runtime/node.exe') --version
if ($actualVersion.Trim() -ne $version) { throw 'Bundled runtime version check failed.' }
$manifest = [ordered]@{
  edition = 'fraction-cannon-school-windows-x64'
  commit = $env:GITHUB_SHA
  nodeVersion = $version
  nodeArchiveUrl = "$baseUrl/$archiveName"
  nodeArchiveSha256 = $actualHash
  nodeExecutableSha256 = (Get-FileHash -LiteralPath (Join-Path $buildRoot 'runtime/node.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
  launchFile = '게임시작.cmd'
  offline = $true
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $buildRoot 'package-info.json') -Encoding utf8NoBOM
$manifest | ConvertTo-Json -Compress | Write-Output
