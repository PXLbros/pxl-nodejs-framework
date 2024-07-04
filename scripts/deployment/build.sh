#!/bin/bash

APP_DIR=/home/ec2-user/app/pxl-nodejs-framework

echo "Build... (Directory: $APP_DIR)"

cd $APP_DIR

pwd

# Source ~/.zshrc
source ~/.zshrc

nvm use

npm install

npm run build

./node_modules/.bin/yalc push

echo "Done!"
