FROM node:18-slim

# Install Chromium, fonts, and ffmpeg for ARM support
RUN apt-get update \
    && apt-get install -y \
        chromium \
        fonts-liberation \
        ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

# Create downloads directory
RUN mkdir -p downloads

EXPOSE 3000

CMD ["node", "src/manager.js"]
