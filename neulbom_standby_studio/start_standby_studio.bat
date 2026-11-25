@echo off
chcp 65001 >nul
cd /d %~dp0

echo ========================================================
echo   🏛️ 늘봄사주 스탠바이 체험 스튜디오 (포트 4000)
echo ========================================================
echo.
echo 브라우저를 엽니다: http://localhost:4000
start http://localhost:4000
echo 서버 실행 중...
node server.js
pause
