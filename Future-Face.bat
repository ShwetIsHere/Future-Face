@echo off
setlocal EnableExtensions
title Future-Face - Age Transformation Launcher

REM Restore standard Windows paths first.
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"

set "PROJECT_DIR=E:\Face Convert\Fature-Face"
set "PYTHON_EXE=C:\Users\SHWET\.conda\envs\sam_env\python.exe"
set "CONDA_PREFIX=C:\Users\SHWET\.conda\envs\sam_env"
set "VSVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set "LAUNCHER=%PROJECT_DIR%\Future-Face.py"

echo.
echo ============================================================
echo   Future-Face - Age Transformation Launcher
echo ============================================================
echo.

if not exist "%PROJECT_DIR%\" (
  echo ERROR: Project folder not found:
  echo "%PROJECT_DIR%"
  goto :fail
)
if not exist "%PYTHON_EXE%" (
  echo ERROR: Python environment not found:
  echo "%PYTHON_EXE%"
  goto :fail
)
if not exist "%LAUNCHER%" (
  echo ERROR: Python script not found:
  echo "%LAUNCHER%"
  goto :fail
)
if not exist "%VSVARS%" (
  echo ERROR: Visual Studio C++ setup script not found:
  echo "%VSVARS%"
  goto :fail
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo ERROR: Could not enter the Future-Face folder.
  goto :fail
)

set "PATH=%CONDA_PREFIX%;%CONDA_PREFIX%\Scripts;%CONDA_PREFIX%\Library\bin;%PATH%"
set "PYTHONHOME="
set "PYTHONPATH="
set "CONDA_DEFAULT_ENV=sam_env"

echo [1/4] Checking Python, PyTorch, CUDA, GPU, and OpenCV...
"%PYTHON_EXE%" -c "import sys,torch,cv2; print('Python:',sys.executable); print('PyTorch:',torch.__version__); print('CUDA available:',torch.cuda.is_available()); print('GPU:',torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Not detected'); print('OpenCV:',cv2.__version__)"
if errorlevel 1 (
  echo.
  echo ERROR: Python, PyTorch, or OpenCV check failed.
  echo For missing cv2, run:
  echo "%PYTHON_EXE%" -m pip install opencv-contrib-python==4.10.0.84
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
  echo "%PROJECT_DIR%\models\Future-Face-ResNet50-Final.pth"
  goto :fail
)
if not exist "%PROJECT_DIR%\models\face_detection_yunet_2023mar.onnx" (
  echo ERROR: YuNet face detector not found.
  echo "%PROJECT_DIR%\models\face_detection_yunet_2023mar.onnx"
  goto :fail
)
if not exist "%PROJECT_DIR%\SAM-official\pretrained_models\sam_ffhq_aging.pt" (
  echo ERROR: Age-transformation checkpoint not found.
  echo "%PROJECT_DIR%\SAM-official\pretrained_models\sam_ffhq_aging.pt"
  goto :fail
)
if not exist "%PROJECT_DIR%\SAM-official\scripts\inference.py" (
  echo ERROR: Inference script not found.
  echo "%PROJECT_DIR%\SAM-official\scripts\inference.py"
  goto :fail
)

echo.
echo [4/4] Launching Future-Face...
echo - Select an image using the file picker.
echo - YuNet detects and crops the face, then resizes it to 224x224.
echo - Age estimation and transformation use the cropped face.
echo - Only Future-Face_Comparison.jpg is retained; temporary outputs are cleaned.
echo - After each run, choose whether to test another image.
echo.
"%PYTHON_EXE%" "%LAUNCHER%"
set "APP_EXIT_CODE=%ERRORLEVEL%"
if not "%APP_EXIT_CODE%"=="0" (
  echo.
  echo ERROR: Future-Face exited with code %APP_EXIT_CODE%.
  goto :fail
)

echo.
echo Future-Face finished.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo Future-Face stopped because of an error.
echo Copy the error above before closing this window.
echo ============================================================
echo.
pause
exit /b 1
