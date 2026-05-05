# Start dev server in background
$proc = Start-Process -FilePath "npm" -ArgumentList "run","dev"PassThru -NoNewWindow
$proc.Id