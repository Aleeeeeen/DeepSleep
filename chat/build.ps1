param(
    [Parameter(Mandatory)] [string]$SourceArchive,
    [Parameter(Mandatory)] [string]$BuildTools,
    [Parameter(Mandatory)] [string]$AndroidJar,
    [string]$D8Jar = "$BuildTools/lib/d8.jar",
    [string]$Jdk = $env:JAVA_HOME,
    [switch]$ReuseAssets
)
$ErrorActionPreference = 'Stop'
function Run([string]$exe, [string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "$exe failed with exit $LASTEXITCODE" }
}
$root = $PSScriptRoot
$out = Join-Path $root 'out'
$assets = Join-Path $out 'assets'
$classes = Join-Path $out 'classes'
$dex = Join-Path $out 'dex'
New-Item -ItemType Directory -Force -Path $assets,$classes,$dex | Out-Null
if (!$ReuseAssets) { Run 'python' @("$root/prepare.py",$SourceArchive,$assets) }
if (!(Test-Path "$assets/mobile-client.js") -or !(Test-Path "$assets/history-import.tar.gz")) { throw 'Missing prepared mobile assets' }
$env:JAVA_HOME = $Jdk
$env:PATH = "$Jdk/bin;$env:PATH"
Run "$BuildTools/aapt2.exe" @('compile','--dir',"$root/res",'-o',"$out/res.zip")
Run "$BuildTools/aapt2.exe" @('link','-I',$AndroidJar,'--manifest',"$root/AndroidManifest.xml",'--java',"$out/generated",'-o',"$out/base.apk","$out/res.zip")
$sources = @(Get-ChildItem "$root/src","$out/generated" -Recurse -Filter '*.java' | ForEach-Object FullName)
Run "$Jdk/bin/javac.exe" (@('--release','8','-encoding','UTF-8','-classpath',$AndroidJar,'-d',$classes) + $sources)
Run "$Jdk/bin/jar.exe" @('--create','--file',"$out/app.jar",'-C',$classes,'.')
Run "$Jdk/bin/java.exe" @('-cp',$D8Jar,'com.android.tools.r8.D8','--min-api','26','--lib',$AndroidJar,'--output',$dex,"$out/app.jar")
Run 'python' @('-c', 'from pathlib import Path; import sys,zipfile; p=Path(sys.argv[1]); z=zipfile.ZipFile(p/"base.apk","a"); z.write(p/"dex"/"classes.dex","classes.dex"); [z.write(f,"assets/"+f.name) for f in (p/"assets").iterdir() if f.is_file()]; z.close()', $out)
Run "$BuildTools/zipalign.exe" @('-f','4',"$out/base.apk","$out/aligned.apk")
$signing = Join-Path $env:LOCALAPPDATA 'DSChatPrototype'
New-Item -ItemType Directory -Force $signing | Out-Null
$key = Join-Path $signing 'debug.p12'
if (!(Test-Path $key)) {
    Run "$Jdk/bin/keytool.exe" @('-genkeypair','-storetype','PKCS12','-keystore',$key,'-storepass','android','-keypass','android','-alias','prototype','-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=DS Chat Local Prototype')
}
$apk = Join-Path $out 'DeepSleep-0.4-arm64.apk'
Run "$Jdk/bin/java.exe" @('-jar',"$BuildTools/lib/apksigner.jar",'sign','--ks',$key,'--ks-key-alias','prototype','--ks-pass','pass:android','--out',$apk,"$out/aligned.apk")
Run "$Jdk/bin/java.exe" @('-jar',"$BuildTools/lib/apksigner.jar",'verify','--verbose',$apk)
Get-FileHash $apk
