@echo off
setlocal EnableExtensions
title Future-Face - Web Application Launcher

REM Restore standard Windows paths first.
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"

set "PROJECT_DIR=E:\Face Convert\Fature-Face"
set "PYTHON_EXE=C:\Users\SHWET\.conda\envs\sam_env\python.exe"
set "CONDA_PREFIX=C:\Users\SHWET\.conda\envs\sam_env"
set "VSVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set "WEB_APP=%PROJECT_DIR%\app.py"

echo.
echo ============================================================
echo   Future-Face - AI Age Transformation Web Application
echo ============================================================
echo.

if not exist "%PROJECT_DIR%\" (
  echo ERROR: Project folder not found: "%PROJECT_DIR%"
  goto :fail
)
if not exist "%PYTHON_EXE%" (
  echo ERROR: Python environment not found: "%PYTHON_EXE%"
  goto :fail
)
if not exist "%WEB_APP%" (
  echo ERROR: Web application script not found: "%WEB_APP%"
  goto :fail
)
if not exist "%VSVARS%" (
  echo ERROR: Visual Studio C++ setup script not found: "%VSVARS%"
  goto :fail
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo ERROR: Could not enter project folder.
  goto :fail
)

set "PATH=%CONDA_PREFIX%;%CONDA_PREFIX%\Scripts;%CONDA_PREFIX%\Library\bin;%PATH%"
set "PYTHONHOME="
set "PYTHONPATH="
set "CONDA_DEFAULT_ENV=sam_env"

echo [1/4] Checking Python, PyTorch, CUDA, GPU, and OpenCV...
"%PYTHON_EXE%" -c "import sys,torch,cv2,flask; print('Python:',sys.executable); print('PyTorch:',torch.__version__); print('CUDA available:',torch.cuda.is_available()); print('GPU:',torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Not detected'); print('OpenCV:',cv2.__version__); print('Flask:',flask.__version__)"
if errorlevel 1 (
  echo.
  echo ERROR: Environment check failed.
  goto :fail
)

echo.
echo [2/4] Initializing Visual Studio C++ Build Tools...
call "%VSVARS%" >nul
if errorlevel 1 (
  echo ERROR: Could not initialize Visual Studio C++ Build Tools.
  goto :fail
)
where.exe cl.exe
if errorlevel 1 (
  echo ERROR: cl.exe is not available after initializing Build Tools.
  goto :fail
)

echo.
echo [3/4] Checking required model files...
if not exist "%PROJECT_DIR%\models\Future-Face-ResNet50-Final.pth" (
  echo ERROR: Age-estimation model not found.
  goto :fail
)
if not exist "%PROJECT_DIR%\models\face_detection_yunet_2023mar.onnx" (
  echo ERROR: YuNet face detector not found.
  goto :fail
)
if not exist "%PROJECT_DIR%\SAM-official\pretrained_models\sam_ffhq_aging.pt" (
  echo ERROR: Age-transformation checkpoint not found.
  goto :fail
)
if not exist "%PROJECT_DIR%\SAM-official\scripts\inference.py" (
  echo ERROR: Inference script not found.
  goto :fail
)

echo.
echo [4/4] Starting Future-Face Web Server...
echo Opening browser at http://127.0.0.1:5000
echo.

REM Automatically open browser after 2 seconds in a background thread
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:5000"

"%PYTHON_EXE%" "%WEB_APP%"
set "APP_EXIT_CODE=%ERRORLEVEL%"
if not "%APP_EXIT_CODE%"=="0" (
  echo.
  echo ERROR: Future-Face Web Server exited with code %APP_EXIT_CODE%.
  goto :fail
)

exit /b 0

:fail
echo.
echo ============================================================
echo Future-Face Web Server stopped because of an error.
echo ============================================================
echo.
pause
exit /b 1
