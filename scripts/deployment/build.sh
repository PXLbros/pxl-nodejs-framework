#!/bin/bash

APP_DIR=/home/ec2-user/app/pxl-nodejs-framework

cd $APP_DIR

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm use

npm install

npm run build

./node_modules/.bin/yalc push

echo "Done!"
