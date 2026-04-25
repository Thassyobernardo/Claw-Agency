# =============================================================================
# EcoLink Australia - Desbloquear usuario (marcar email_verified = true)
#
# Uso quando o RESEND_API_KEY nao esta setado e o email de verificacao nao
# chegou. Este script marca o usuario como verificado direto no banco pra
# voce poder fazer login.
#
# Pre-requisitos:
#   $env:DATABASE_URL = "postgresql://..."   (a mesma do Railway)
#
# Uso:
#   cd C:\Users\Taric\Desktop\clawbot-real\scripts
#   .\01_desbloquear_usuario.ps1                       # lista nao-verificados e desbloqueia todos
#   .\01_desbloquear_usuario.ps1 -Email "x@y.com"      # desbloqueia so esse
# =============================================================================

param(
    [string]$Email
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL nao definido." -ForegroundColor Red
    Write-Host '  Faca: $env:DATABASE_URL = "postgresql://..."' -ForegroundColor Yellow
    exit 1
}

$projectRoot = Split-Path -Parent $PSScriptRoot

$unlockJs = @'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require",
  max: 1, connect_timeout: 30,
});
const email = process.env.UNLOCK_EMAIL || null;
try {
  // Lista quem esta nao-verificado
  const pending = await sql`
    SELECT u.email, u.name, c.name AS company_name, u.created_at
    FROM users u JOIN companies c ON c.id = u.company_id
    WHERE u.email_verified = false
      AND (${email}::text IS NULL OR u.email = ${email}::text)
    ORDER BY u.created_at DESC
  `;
  if (pending.length === 0) {
    console.log("ℹ️  Nenhum usuario nao-verificado encontrado.");
    process.exit(0);
  }
  console.log("\n━━ Usuarios que serao desbloqueados ━━");
  for (const r of pending) {
    console.log(`  • ${r.email}  (${r.name}, ${r.company_name}, criado ${new Date(r.created_at).toISOString()})`);
  }
  // Desbloqueia
  const updated = await sql`
    UPDATE users
    SET email_verified = true, verify_token = NULL, updated_at = NOW()
    WHERE email_verified = false
      AND (${email}::text IS NULL OR email = ${email}::text)
    RETURNING email
  `;
  console.log(`\n✅ ${updated.length} usuario(s) desbloqueado(s). Ja pode fazer login.`);
} catch (e) {
  console.error("❌", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
'@

$tmpFile = Join-Path $projectRoot "_ecolink_unlock_$([guid]::NewGuid().ToString('N')).mjs"
Set-Content -Path $tmpFile -Value $unlockJs -Encoding UTF8

try {
    if ($Email) { $env:UNLOCK_EMAIL = $Email }
    & node $tmpFile
    if ($LASTEXITCODE -ne 0) { throw "Desbloqueio falhou" }
} finally {
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
    Remove-Item Env:UNLOCK_EMAIL -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
