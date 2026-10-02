$ErrorActionPreference = "Stop"

$javaHome = if ($env:JAVA_HOME) {
    $env:JAVA_HOME
} else {
    "C:\Program Files\Android\Android Studio\jbr"
}

$java = Join-Path $javaHome "bin\java.exe"
$wrapperJar = "gradle\wrapper\gradle-wrapper.jar"

if (-not (Test-Path -LiteralPath $java)) {
    throw "Java was not found. Set JAVA_HOME or install Android Studio."
}

Push-Location -LiteralPath $PSScriptRoot
try {
    & $java "-Dorg.gradle.appname=gradlew" -classpath $wrapperJar org.gradle.wrapper.GradleWrapperMain @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
