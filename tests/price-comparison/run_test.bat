@echo off
echo Installing dependencies... > test_log.txt
call npm install >> test_log.txt 2>&1
if %errorlevel% neq 0 (
    echo npm install failed >> test_log.txt
    exit /b %errorlevel%
)
echo Running test... >> test_log.txt
call npm test >> test_log.txt 2>&1
if %errorlevel% neq 0 (
    echo npm test failed >> test_log.txt
    exit /b %errorlevel%
)
echo Done. >> test_log.txt
