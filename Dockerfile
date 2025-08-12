# Use Node 23+ base image
FROM node:23

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose the Vite dev server port
EXPOSE 4444

# Run dev server
CMD ["npm", "run", "dev-external"]
