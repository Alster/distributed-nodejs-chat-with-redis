FROM node:8.12-alpine
WORKDIR /usr/src/app
# COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm i nodemon@1.18.9 typescript@3.2.2 ts-node@7.0.1 -g
# RUN npm install
# COPY . .
EXPOSE 3000
CMD nodemon