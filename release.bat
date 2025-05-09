@echo off
rem call nvm use 16.20.0
rem set NODE_OPTIONS=--openssl-legacy-provider
call yarn install
cd android
rem echo Clean Gradlew...
rem call gradlew clean
echo Build Release app...
call gradlew bundleRelease
set NODE_OPTIONS=
cd app\build\outputs\bundle\release
explorer .
cd ..\..\..\..\..\..
