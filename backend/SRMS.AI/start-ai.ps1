$env:PATH = "C:\Users\LINUKA\AppData\Local\Programs\Python\Python312;C:\Users\LINUKA\AppData\Local\Programs\Python\Python312\Scripts;" + $env:PATH
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SRMS AI Detection Service" -ForegroundColor Cyan
Write-Host "  YOLOv8 + EasyOCR | Port 8000" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
python main.py
