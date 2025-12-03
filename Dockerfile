FROM node:18-slim

# Install Chromium and fonts for ARM support
# We use chromium instead of google-chrome-stable because Chrome is not available for ARM64 Linux
RUN apt-get update \
    && apt-get install -y chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 procps \
      --no-install-recommends \
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
