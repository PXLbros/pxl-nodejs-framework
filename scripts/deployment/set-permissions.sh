#!/bin/bash

APP_DIR=/home/ec2-user/app/pxl-nodejs-framework

echo "Change permissions (Directory: $APP_DIR)..."

# Check if the directory exists
if [ -d "$APP_DIR" ]; then
  echo "Directory exists. Change permissions..."

  chown ec2-user:ec2-user -R "$APP_DIR/"
else
  echo "Directory does not exist. Skip changing permissions..."
fi

nvm use

npm install

./node_modules/.bin/yalc push

echo "Done with stuff :-)"
