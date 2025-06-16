# Use Node.js latest as the base image
FROM node:latest AS base

# Set up PNPM environment variables
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Enable Corepack, which includes pnpm
RUN corepack enable

# Copy the application code to /app
COPY . /app

# Set /app as the working directory
WORKDIR /app

# Create a stage for installing production dependencies
FROM base AS prod-deps

# Use a mount cache for pnpm to speed up installs, installing only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Create a stage for building the application
FROM base AS build

# Use the same cache, install all dependencies, then build the app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

# Final image: copy production deps and built files
FROM base

# Copy the node_modules folder from prod-deps
COPY --from=prod-deps /app/node_modules /app/node_modules

# Copy the built artifacts from build
COPY --from=build /app/dist /app/dist

# Copy the CHANGELOG.md file
COPY CHANGELOG.md /app/CHANGELOG.md

# Expose port 8000
EXPOSE 8000

# Run the application in production
CMD [ "pnpm", "run", "start:prod" ]