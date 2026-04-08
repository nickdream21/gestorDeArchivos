import os
import shutil
import subprocess
import sys
from pathlib import Path

def build_python_exe():
    print("Building Python OCR Engine...")
    
    # Project paths
    project_root = Path.cwd()
    ocr_src_dir = project_root / 'src' / 'ocr'
    ocr_script = ocr_src_dir / 'ocr_engine.py'
    
    # Source models path (User's home directory)
    user_home = Path.home()
    easyocr_models_src = user_home / '.EasyOCR' / 'model'
    
    if not easyocr_models_src.exists():
        print(f"WARNING: EasyOCR models not found at {easyocr_models_src}. Bundled exe might need internet.")
        models_arg = []
    else:
        print(f"Found EasyOCR models at {easyocr_models_src}")
        # PyInstaller --add-data format: "source;dest"
        # We want models to be in root of the bundle or a specific folder. 
        # In the script we look for 'models' relative to base path.
        # So we map source '.../model' to dest 'models'
        models_arg = ['--add-data', f'{easyocr_models_src};models']

    # PyInstaller command
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--noconfirm',
        '--onedir',           # Directory based (easier for debugging, faster startup than onefile)
        '--windowed',         # No console window (or --console if we want to see logs, maybe --console for now?)
                              # Actually 'main.js' uses 'exec' and reads stdout. --console is SAFER for stdout capture.
                              # If windowed, stdout/stderr might be redirected. Let's stick to --console or default. 
                              # Wait, 'windowed' suppresses the console window popping up.
                              # But we need stdout. 'exec' captures stdout of console apps.
                              # If we use --windowed, print() might not go to stdout.
                              # Let's use --console. The user won't see it if called via exec unless they open the exe directly.
                              # BUT, if we want to avoid a popup window, we usually want --windowed...
                              # However, for 'exec(command, cb)', a console app doesn't necessarily pop up a window if spawned correctly?
                              # Electron's exec usually hides the window.
                              # Let's START with --console to ensure stdout works.
        '--console', 
        '--name', 'ocr_engine',
        '--clean',
        '--distpath', 'ocr_engine_build',
        str(ocr_script)
    ]
    
    if models_arg:
        cmd.extend(models_arg)
        
    print(f"Running command: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print("Error building Python executable:")
        print(result.stderr)
        sys.exit(1)
    
    print("Build successful!")
    print(result.stdout)

    # Move the dist folder content to a location Electron-builder expects?
    # Or just leave it in 'dist/ocr_engine'
    
if __name__ == "__main__":
    build_python_exe()
