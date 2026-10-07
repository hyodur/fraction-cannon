@echo off
chcp 65001 >nul
setlocal
title Fraction Cannon - School Edition
pushd "%~dp0"
if not exist "%~dp0runtime\node.exe" (
  echo 실행 프로그램이 없어요. ZIP을 모두 압축 해제한 뒤 다시 실행해 주세요.
  if not "%FRACTION_CANNON_NO_PAUSE%"=="1" pause
  exit /b 1
)
"%~dp0runtime\node.exe" "%~dp0serve-preview.mjs" %*
set "SCHOOL_EXIT_CODE=%ERRORLEVEL%"
popd
if not "%FRACTION_CANNON_NO_PAUSE%"=="1" pause
exit /b %SCHOOL_EXIT_CODE%
