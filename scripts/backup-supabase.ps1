$ErrorActionPreference = 'Stop'

$projectRef = 'diyskqeunfunotqfmncq'
$dbUser = "postgres.$projectRef"
$dbHost = 'aws-1-us-east-1.pooler.supabase.com'
$backupStamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$backupDir = Join-Path $env:LOCALAPPDATA "ObaBrownieBackups\Temp-Oba-Brownie-$backupStamp"
$cliRoot = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'
$cliPath = Get-ChildItem -Path $cliRoot -Filter supabase.exe -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI nao encontrado. Instale/inicie o Docker Desktop e tente novamente.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop nao esta em execucao. Inicie-o e execute este script novamente.'
}
if (-not $cliPath) {
    throw 'Supabase CLI nao encontrada no cache do npm. Execute npx --yes supabase@latest --version e tente novamente.'
}

$securePassword = Read-Host 'Senha do banco Supabase (entrada oculta)' -AsSecureString
$dbPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
$encodedPassword = [Uri]::EscapeDataString($dbPassword)
$dbUrl = "postgresql://${dbUser}:${encodedPassword}@${dbHost}:5432/postgres"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

try {
    $commonArgs = @('db', 'dump', '--db-url', $dbUrl)
    & $cliPath @commonArgs '--file' (Join-Path $backupDir 'roles.sql') '--role-only'
    if ($LASTEXITCODE -ne 0) { throw 'O dump de roles falhou.' }

    & $cliPath @commonArgs '--file' (Join-Path $backupDir 'schema.sql')
    if ($LASTEXITCODE -ne 0) { throw 'O dump do schema falhou.' }

    & $cliPath @commonArgs '--file' (Join-Path $backupDir 'data.sql') '--data-only' '--use-copy'
    if ($LASTEXITCODE -ne 0) { throw 'O dump dos dados falhou.' }

    $files = Get-ChildItem -LiteralPath $backupDir -File
    $expected = @('roles.sql', 'schema.sql', 'data.sql')
    foreach ($name in $expected) {
        $file = $files | Where-Object Name -EQ $name
        if (-not $file -or $file.Length -eq 0) { throw "Arquivo ausente ou vazio: $name" }
    }

    Write-Host "Backup concluido em: $backupDir"
    $files | Select-Object Name, Length
}
finally {
    $dbPassword = $null
    $securePassword.Dispose()
}
