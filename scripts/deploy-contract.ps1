# Deploy Forge module to Aptos ShelbyNet (PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"

if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"')
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

$Deployer = $env:FORGE_DEPLOYER_ADDRESS
$NodeUrl = if ($env:APTOS_NODE_URL) { $env:APTOS_NODE_URL } else { "https://api.shelbynet.shelby.xyz/v1" }
$Pk = $env:SHELBY_SIGNER_PRIVATE_KEY
$Treasury = $env:FORGE_TREASURY_ADDRESS

if (-not $Deployer -or -not $Treasury) {
  Write-Error "Set FORGE_DEPLOYER_ADDRESS and FORGE_TREASURY_ADDRESS explicitly. Deployment has no address defaults."
}
$ExpectedConfirmation = "${Deployer}:${Treasury}"
if ($env:CONFIRM_FORGE_DEPLOYMENT -ne $ExpectedConfirmation) {
  Write-Error "Set CONFIRM_FORGE_DEPLOYMENT=$ExpectedConfirmation after independently confirming both addresses."
}

$env:APTOS_CONFIG_DIR = Join-Path $Root ".aptos"
$MoveDir = Join-Path $Root "move"
Push-Location $MoveDir

$GasUnitPrice = if ($env:GAS_UNIT_PRICE) { $env:GAS_UNIT_PRICE } else { "100" }
$MaxGas = if ($env:MAX_GAS) { $env:MAX_GAS } else { "100000" }
$Profile = $env:APTOS_PROFILE

$AuthArgs = @()
if ($Profile) {
  $AuthArgs = @("--profile", $Profile)
} elseif ($Pk) {
  $AuthArgs = @("--private-key", $Pk)
} else {
  Write-Error "Set APTOS_PROFILE=shelby or SHELBY_SIGNER_PRIVATE_KEY in .env"
}

Write-Host "Compiling forge module for $Deployer..."
aptos move compile --named-addresses "forge=$Deployer"

Write-Host "Publishing..."
aptos move publish `
  --named-addresses "forge=$Deployer" `
  @AuthArgs `
  --url $NodeUrl `
  --gas-unit-price $GasUnitPrice `
  --max-gas $MaxGas `
  --assume-yes

Write-Host "Initializing platform (treasury=$Treasury)..."
aptos move run `
  --function-id "${Deployer}::forge::initialize_platform" `
  --args "address:${Treasury}" `
  @AuthArgs `
  --url $NodeUrl `
  --gas-unit-price $GasUnitPrice `
  --max-gas $MaxGas `
  --assume-yes

Pop-Location
Write-Host "Done. Contract at $Deployer"
Write-Host "Set NEXT_PUBLIC_CONTRACT_ADDRESS and NEXT_PUBLIC_MODULE_ADDRESS to $Deployer"
