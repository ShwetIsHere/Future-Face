@echo off
setlocal EnableExtensions
title SAM Official - Age Transformation

REM Restore standard Windows system paths in case PATH was overwritten.
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"

set "PROJECT_DIR=E:\Face Convert\Fature-Face\SAM-official"
set "PYTHON_EXE=C:\Users\SHWET\.conda\envs\sam_env\python.exe"
set "CONDA_PREFIX=C:\Users\SHWET\.conda\envs\sam_env"
set "VSVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set "CHECKPOINT=pretrained_models\sam_ffhq_aging.pt"
set "IMAGE_DIR=notebooks\images"

echo.
echo ============================================================
echo   SAM Official - Age Transformation Launcher
echo ============================================================
echo.

if not exist "%PROJECT_DIR%\" (
  echo ERROR: Project folder not found: "%PROJECT_DIR%"
  goto :fail
)
if not exist "%PYTHON_EXE%" (
  echo ERROR: sam_env Python not found: "%PYTHON_EXE%"
  echo Check the actual environment path in Anaconda Prompt with:
  echo conda run -n sam_env python -c "import sys; print(sys.executable)"
  goto :fail
)
if not exist "%VSVARS%" (
  echo ERROR: Visual Studio C++ setup script not found:
  echo "%VSVARS%"
  goto :fail
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo ERROR: Could not enter the SAM project folder.
  goto :fail
)

REM Use this Conda environment explicitly, without running conda activate.
set "PATH=%CONDA_PREFIX%;%CONDA_PREFIX%\Scripts;%CONDA_PREFIX%\Library\bin;%PATH%"
set "PYTHONHOME="
set "PYTHONPATH="
set "CONDA_DEFAULT_ENV=sam_env"

echo [1/4] Using the sam_env Python directly...
"%PYTHON_EXE%" -c "import sys,torch; print('Python:',sys.executable); print('PyTorch:',torch.__version__); print('CUDA available:',torch.cuda.is_available()); print('GPU:',torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Not detected')"
if errorlevel 1 (
  echo ERROR: sam_env Python or PyTorch check failed.
  goto :fail
)

echo.
echo [2/4] Initializing Visual Studio 2022 C++ Build Tools...
call "%VSVARS%" >nul
if errorlevel 1 (
  echo ERROR: Could not initialize Visual Studio C++ Build Tools.
  goto :fail
)
where.exe cl.exe
if errorlevel 1 (
  echo ERROR: cl.exe is still not available after initializing Build Tools.
  goto :fail
)

if not exist "%CHECKPOINT%" (
  echo ERROR: Checkpoint not found: "%CHECKPOINT%"
  goto :fail
)
if not exist "%IMAGE_DIR%\" (
  echo ERROR: Image directory not found: "%IMAGE_DIR%"
  goto :fail
)

echo.
echo [3/4] Listing available images...
set "SAM_IMAGE_DIR=%IMAGE_DIR%"
"%PYTHON_EXE%" -c "import os,sys; from pathlib import Path; p=Path(os.environ['SAM_IMAGE_DIR']); exts={'.jpg','.jpeg','.png','.bmp','.tif','.tiff','.ppm'}; fs=sorted(x for x in p.rglob('*') if x.is_file() and x.suffix.lower() in exts); print('\nAvailable images:'); [print(f'{i}. {x.relative_to(p)}') for i,x in enumerate(fs,1)]; print('\nNo supported images found.' if not fs else ''); sys.exit(0 if fs else 2)"
if errorlevel 1 (
  echo ERROR: Could not list images.
  goto :fail
)

echo.
set "IMAGE_NUMBER="
set /p "IMAGE_NUMBER=Enter the image number to transform: "
if not defined IMAGE_NUMBER (
  echo ERROR: No image number entered.
  goto :fail
)

"%PYTHON_EXE%" -c "import os,sys; from pathlib import Path; p=Path(os.environ['SAM_IMAGE_DIR']); exts={'.jpg','.jpeg','.png','.bmp','.tif','.tiff','.ppm'}; fs=sorted(x for x in p.rglob('*') if x.is_file() and x.suffix.lower() in exts); n=int(sys.argv[1]); sys.exit('Invalid image number.' if n<1 or n>len(fs) else 0)" "%IMAGE_NUMBER%"
if errorlevel 1 (
  echo ERROR: Invalid image number.
  goto :fail
)

set "SELECTED_IMAGE="
set "SAM_SELECTION_FILE=%TEMP%\sam_selected_image.txt"
del "%SAM_SELECTION_FILE%" >nul 2>&1
"%PYTHON_EXE%" -c "import os,sys; from pathlib import Path; p=Path(os.environ['SAM_IMAGE_DIR']); exts={'.jpg','.jpeg','.png','.bmp','.tif','.tiff','.ppm'}; fs=sorted(x for x in p.rglob('*') if x.is_file() and x.suffix.lower() in exts); print(fs[int(sys.argv[1])-1].resolve())" "%IMAGE_NUMBER%" > "%SAM_SELECTION_FILE%"
if errorlevel 1 (
  echo ERROR: Python could not resolve the selected image.
  type "%SAM_SELECTION_FILE%"
  del "%SAM_SELECTION_FILE%" >nul 2>&1
  goto :fail
)
set /p "SELECTED_IMAGE="<"%SAM_SELECTION_FILE%"
del "%SAM_SELECTION_FILE%" >nul 2>&1
if not defined SELECTED_IMAGE (
  echo ERROR: Could not resolve selected image.
  goto :fail
)

echo.
echo Selected image: "%SELECTED_IMAGE%"
set "TARGET_AGE="
set /p "TARGET_AGE=Enter target age (0-100, for example 50): "
if not defined TARGET_AGE (
  echo ERROR: No target age entered.
  goto :fail
)
"%PYTHON_EXE%" -c "import sys; s=sys.argv[1]; sys.exit(0 if s.isdigit() and 0<=int(s)<=100 else 1)" "%TARGET_AGE%"
if errorlevel 1 (
  echo ERROR: Target age must be a whole number from 0 to 100.
  goto :fail
)

set "OUTPUT_DIR=inference_output_%TARGET_AGE%"
set "SINGLE_IMAGE_INPUT=%PROJECT_DIR%\sam_single_image_input"
if not exist "%SINGLE_IMAGE_INPUT%\" mkdir "%SINGLE_IMAGE_INPUT%"
if errorlevel 1 (
  echo ERROR: Could not create input folder.
  goto :fail
)
del /q "%SINGLE_IMAGE_INPUT%\*.jpg" "%SINGLE_IMAGE_INPUT%\*.jpeg" "%SINGLE_IMAGE_INPUT%\*.png" "%SINGLE_IMAGE_INPUT%\*.bmp" "%SINGLE_IMAGE_INPUT%\*.tif" "%SINGLE_IMAGE_INPUT%\*.tiff" "%SINGLE_IMAGE_INPUT%\*.ppm" >nul 2>&1
for %%F in ("%SELECTED_IMAGE%") do set "SELECTED_NAME=%%~nxF"
copy /y "%SELECTED_IMAGE%" "%SINGLE_IMAGE_INPUT%\%SELECTED_NAME%" >nul
if errorlevel 1 (
  echo ERROR: Could not copy selected image.
  goto :fail
)

echo.
echo [4/4] Running SAM inference with sam_env Python...
echo Target age: %TARGET_AGE%
echo.
"%PYTHON_EXE%" scripts\inference.py --exp_dir "%OUTPUT_DIR%" --checkpoint_path "%CHECKPOINT%" --data_path "%SINGLE_IMAGE_INPUT%" --target_age "%TARGET_AGE%" --test_batch_size 1 --test_workers 0 --n_images 1 --couple_outputs
if errorlevel 1 (
  echo.
  echo ERROR: SAM inference failed. Review the error above.
  goto :fail
)

echo.
echo Inference finished. Results folder:
echo "%PROJECT_DIR%\%OUTPUT_DIR%"
set "OPEN_RESULT="
set /p "OPEN_RESULT=Open the output folder now? (Y/N): "
if /i "%OPEN_RESULT%"=="Y" start "" "%PROJECT_DIR%\%OUTPUT_DIR%"
echo.
pause
exit /b 0

:fail
echo.
echo Launcher stopped at an error. This window will remain open.
pause
exit /b 1
