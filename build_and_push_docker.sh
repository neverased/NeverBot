#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# !!! IMPORTANT: Replace 'your-dockerhub-username' with your actual Docker Hub username or registry path !!!
DOCKER_REGISTRY_USER="neverased" # Takes username from first script argument, or uses default
IMAGE_NAME="neverbot"
#TAG="v3.1.0"
# Automatically extract version from package.json using jq
TAG="v$(jq -r .version package.json)"
PLATFORMS="linux/amd64,linux/arm64" # Platforms to build for

FULL_IMAGE_NAME="${DOCKER_REGISTRY_USER}/${IMAGE_NAME}"

# --- Main Script ---
echo "Building and pushing Docker image: ${FULL_IMAGE_NAME}:${TAG}"
echo "Target platforms: ${PLATFORMS}"

# Check if logged into Docker Hub (or your registry)
# This is a basic check; for other registries, login commands differ.
if ! docker info 2>/dev/null | grep -q "Username:"; then
    echo "WARNING: You might not be logged into a Docker registry. Please log in first (e.g., 'docker login')."
fi

# Ensure buildx builder is available and in use.
# Creates a new builder instance if one named 'mybuilder' doesn't exist or isn't running.
if ! docker buildx ls | grep -q "mybuilder.*running"; then
    echo "Setting up Docker buildx builder 'mybuilder'..."
    if docker buildx ls | grep -q "mybuilder"; then
        docker buildx use mybuilder
    else
        docker buildx create --use --name mybuilder
    fi
    # Ensure the builder is bootstrapped (ready to build)
    docker buildx inspect mybuilder --bootstrap
else
    echo "Using existing buildx builder 'mybuilder'."
    docker buildx use mybuilder # Ensure it's the current builder
fi

echo "Starting multi-platform build and push for ${FULL_IMAGE_NAME}:${TAG} and ${FULL_IMAGE_NAME}:latest..."

docker buildx build \
    --platform "${PLATFORMS}" \
    -t "${FULL_IMAGE_NAME}:${TAG}" \
    -t "${FULL_IMAGE_NAME}:latest" \
    --push \
    .

echo ""
echo "Successfully built and pushed:"
echo "  ${FULL_IMAGE_NAME}:${TAG}"
echo "  ${FULL_IMAGE_NAME}:latest"
echo "For platforms: ${PLATFORMS}"
echo ""
echo "Note: Your Dockerfile exposes port 8000. Ensure your application inside the container listens on this port."
