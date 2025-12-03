
WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

# Create downloads directory
RUN mkdir -p downloads

EXPOSE 3000

CMD ["node", "src/manager.js"]
