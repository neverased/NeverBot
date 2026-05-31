# Use the same major Node.js version as CI and local development.
FROM node:26.2.0 AS base

# Set up PNPM environment variables
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Node 25+ does not bundle Corepack; install it to use packageManager-pinned pnpm.
RUN npm install -g corepack@0.35.0 && corepack enable

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

ENV NODE_ENV=production

# Expose port 3500 (matches app default PORT)
EXPOSE 3500

USER node

# Run the application in production
CMD [ "node", "dist/main" ]
