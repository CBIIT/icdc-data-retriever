FROM node:16.17.0  AS fnl_base_image
ENV PORT 3000
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
