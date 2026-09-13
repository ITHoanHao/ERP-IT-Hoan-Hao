@echo off
title IT Hoan Hao - ERP Lite
cd /d "%~dp0"

if not exist node_modules (
  echo ==============================================
  echo   LAN DAU CHAY - Dang tu dong cai dat...
  echo   Vui long doi khoang 20-40 giay, dung tat cua so nay.
  echo ==============================================
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo ==============================================
    echo   CAI DAT THAT BAI. Nguyen nhan thuong gap:
    echo   - Chua cai Node.js: tai tai https://nodejs.org
    echo   - Khong co mang Internet luc cai dat lan dau
    echo ==============================================
    pause
    exit /b 1
  )
  echo.
  echo Cai dat xong.
  echo.
)

if not exist "%USERPROFILE%\ERPLiteData\data.db" (
  echo Lan dau tien su dung - dang tao tai khoan quan tri...
  call npm run seed
  echo.
)

echo Dang khoi dong ERP Lite...
echo Du lieu duoc luu tai: %USERPROFILE%\ERPLiteData
echo.
node server.js
pause
