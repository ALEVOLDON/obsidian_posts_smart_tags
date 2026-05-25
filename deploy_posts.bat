@echo off
title Deploy Telegram Posts to Portfolio
cd /d "%~dp0"
call npm run deploy-site
echo.
pause
