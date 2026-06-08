# Base image for Node.js
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Hugging Face Spaces requires the app to run on port 7860
EXPOSE 7860

# Define the command to run your app
# Make sure your main file is named correctly (e.g., index.js, app.js, or server.js)
CMD ["node", "server.js"]