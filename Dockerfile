FROM node:12

WORKDIR /usr/src/app

COPY yarn.lock ./
COPY package.json ./
RUN yarn install --pure-lockfile

COPY . .

RUN yarn build

CMD [ "node", "out/index.js" ]
