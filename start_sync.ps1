if (-not (Test-Path .\config.json)) {
  Copy-Item .\config.example.json .\config.json
  Write-Host 'config.json created from config.example.json. Fill botToken and channelChatId, then run again.'
  exit 0
}

node .\src\index.js

