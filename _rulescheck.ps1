$ErrorActionPreference = 'Stop'
$proj = 'hivez-21680'
$out = @()
function Log($s) { $script:out += $s }
try {
  $cfg = Get-Content "$env:USERPROFILE\.config\configstore\firebase-tools.json" -Raw | ConvertFrom-Json
  $rt = $cfg.tokens.refresh_token
  if (-not $rt) { throw 'NO REFRESH TOKEN in configstore' }
  $body = @{
    client_id = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
    client_secret = 'j9iVZfS8kkCEFUPaAeJV0sAi'
    refresh_token = $rt
    grant_type = 'refresh_token'
  }
  $tok = Invoke-RestMethod -Uri 'https://oauth2.googleapis.com/token' -Method Post -Body $body
  Log "TOKEN OK (len $($tok.access_token.Length))"
  $H = @{ Authorization = "Bearer $($tok.access_token)" }

  $rel = Invoke-RestMethod -Uri "https://firebaserules.googleapis.com/v1/projects/$proj/releases" -Headers $H
  Log '===RELEASES==='
  $fs = $null
  foreach ($r in $rel.releases) {
    Log "$($r.name) -> $($r.rulesetName) (updated $($r.updateTime))"
    if ($r.name -match 'cloud.firestore') { $fs = $r }
  }
  if ($fs) {
    $rsId = $fs.rulesetName.Split('/')[-1]
    $rs = Invoke-RestMethod -Uri "https://firebaserules.googleapis.com/v1/projects/$proj/rulesets/$rsId" -Headers $H
    $src = $rs.source.files[0].content
    Set-Content -Path "_deployed.rules" -Value $src -Encoding UTF8
    $lines = ($src -split "`n").Count
    $cntNoBlock = ([regex]::Matches($src, 'noBlockBetween')).Count
    $cntSplit = ([regex]::Matches($src, '[.]split\(')).Count
    $cntAllowList = ([regex]::Matches($src, 'allow list: if signedIn\(\)')).Count
    $cntSaved = ([regex]::Matches($src, 'match /savedPosts')).Count
    $cntBlocks = ([regex]::Matches($src, 'match /blocks')).Count
    $cntReports = ([regex]::Matches($src, 'match /reports')).Count
    $cntAdmin = ([regex]::Matches($src, 'isAdmin')).Count
    Log "===LIVE RULESET $rsId (created $($rs.createTime))==="
    Log "line count: $lines"
    Log "noBlockBetween occurrences: $cntNoBlock"
    Log "id-split occurrences: $cntSplit"
    Log "allow list signedIn: $cntAllowList"
    Log "savedPosts matches: $cntSaved"
    Log "blocks matches: $cntBlocks"
    Log "reports matches: $cntReports"
    Log "isAdmin occurrences: $cntAdmin"
    $local = Get-Content 'firestore.rules' -Raw
    $localNorm = ($local -replace "`r`n", "`n").Trim()
    $srcNorm = ($src -replace "`r`n", "`n").Trim()
    $same = $srcNorm -eq $localNorm
    Log "DEPLOYED == LOCAL (exact): $same"
    Log "line counts: local=$(($localNorm -split "`n").Count) deployed=$lines"
  } else {
    Log 'NO cloud.firestore release found'
  }

  try {
    $auth = Invoke-RestMethod -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$proj/config" -Headers $H
    Log '===AUTHORIZED DOMAINS==='
    foreach ($d in $auth.authorizedDomains) { Log $d.domain }
  } catch { Log "AUTH CONFIG FAILED: $($_.Exception.Message)" }
} catch {
  Log "FATAL: $($_.Exception.Message)"
}
$out -join "`n" | Set-Content -Path '_rulescheck.log' -Encoding UTF8
