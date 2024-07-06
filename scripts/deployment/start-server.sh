#!/bin/bash

DOCKER_DIR=/home/ec2-user/app/docker

cd $DOCKER_DIR

docker-compose up --build --detach --remove-orphans || { echo "Failed to start containers"; exit 1; }
