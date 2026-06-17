@echo off
title Deploy Posts and Media to Portfolio
cd /d "%~dp0"
echo.
echo Daily deploy: export vault -^> posts.json + media -^> GitHub -^> Vercel
echo.
call npm run deploy-site
echo.
pause