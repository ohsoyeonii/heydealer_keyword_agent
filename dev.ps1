# 헤이딜러 키워드 에이전트 실행 스크립트
# 사용법: .\dev.ps1

$ROOT = $PSScriptRoot
$BACKEND = "$ROOT\backend"
$FRONTEND = "$ROOT\frontend"

Write-Host "=== 헤이딜러 키워드 에이전트 시작 ===" -ForegroundColor Cyan
Write-Host "Backend  : http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend : http://localhost:3000" -ForegroundColor Green
Write-Host "중지: Ctrl+C`n"

# 백엔드 실행 (별도 창)
Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "Set-Location '$BACKEND'; & '.venv\Scripts\activate.ps1'; uvicorn main:app --reload --port 8000"

# 프론트엔드 실행 (별도 창)
Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "Set-Location '$FRONTEND'; npm run dev"

Write-Host "두 개의 새 창에서 서버가 시작됩니다." -ForegroundColor Yellow
Write-Host "브라우저에서 http://localhost:3000 을 여세요." -ForegroundColor Yellow
