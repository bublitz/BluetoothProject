@Echo off
Echo Update packages...
Call yarn install
Echo:
rem Echo Clean App...
rem cd android
rem Call gradlew clean
rem cd ..
Echo:
Echo Build Debug App...
Call yarn android