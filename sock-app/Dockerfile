#FROM node:8.12-alpine
FROM node:17-alpine3.12
WORKDIR /usr/src/app
# COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN #npm i nodemon@1.18.9 typescript@3.2.2 ts-node@7.0.1 -g
RUN npm i nodemon@1.18.9 typescript@4.4.4 ts-node@10.4.0 -g
# RUN npm install
# COPY . .
EXPOSE 3000
CMD nodemon