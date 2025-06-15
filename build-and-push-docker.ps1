# Exit on error
$ErrorActionPreference = "Stop"

# --- Configuration ---
$DOCKER_REGISTRY_USER = "neverased"
$IMAGE_NAME = "neverbot"

# Extract version from package.json
$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$TAG = "v$($packageJson.version)"
$PLATFORMS = "linux/amd64,linux/arm64"

$FULL_IMAGE_NAME = "$DOCKER_REGISTRY_USER/$IMAGE_NAME"

Write-Host "Building and pushing Docker image: ${FULL_IMAGE_NAME}:${TAG}"
Write-Host "Target platforms: $PLATFORMS"

# Check if logged into Docker
$dockerInfo = docker info 2>$null
if ($dockerInfo -notmatch "Username:") {
    Write-Warning "You might not be logged into a Docker registry. Please log in first (e.g., 'docker login')."
}

# Ensure buildx builder is available and in use
$buildxList = docker buildx ls
if ($buildxList -notmatch "mybuilder.*running") {
    Write-Host "Setting up Docker buildx builder 'mybuilder'..."
    if ($buildxList -match "mybuilder") {
        docker buildx use mybuilder
    }
    else {
        docker buildx create --use --name mybuilder
    }
    docker buildx inspect mybuilder --bootstrap
}
else {
    Write-Host "Using existing buildx builder 'mybuilder'."
    docker buildx use mybuilder
}

Write-Host "Starting multi-platform build and push for ${FULL_IMAGE_NAME}:${TAG} and ${FULL_IMAGE_NAME}:latest..."

docker buildx build `
    --platform "$PLATFORMS" `
    -t "${FULL_IMAGE_NAME}:${TAG}" `
    -t "${FULL_IMAGE_NAME}:latest" `
    --push `
    .

Write-Host ""
Write-Host "Successfully built and pushed:"
Write-Host "  ${FULL_IMAGE_NAME}:${TAG}"
Write-Host "  ${FULL_IMAGE_NAME}:latest"
Write-Host "For platforms: $PLATFORMS"
Write-Host ""
Write-Host "Note: Your Dockerfile exposes port 8000. Ensure your application inside the container listens on this port."