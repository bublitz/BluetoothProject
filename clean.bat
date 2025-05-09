@Echo off
Echo:
Echo Clean Android...
cd android
call gradlew clean
cd ..
Echo:
Echo Clean Packages...
call yarn cache clean
call yarn start --reset-cache
Echo:
Echo Ok...