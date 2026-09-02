Output assets/demo.gif
Require npm

Set FontSize 13
Set Width 1100
Set Height 560
Set Padding 12
Set Theme "Dracula"

Sleep 500ms

Type "npm ci"
Enter
Sleep 4s

Type "npm test"
Enter
Sleep 3s

Type "npm run build"
Enter
Sleep 3s

Type "ls dist/manifest.json dist/service-worker-loader.js"
Enter
Sleep 1s
