FROM node:12.16.0

WORKDIR /usr/src/app

COPY package*.json ./

RUN yarn

COPY . .

CMD ["yarn", "start"]