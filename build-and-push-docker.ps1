# Exit on error

param(
    [string]$BuilderName = "desktop-linux"
)

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
$builderNamePattern = "^\s*$([regex]::Escape($BuilderName))\*?\s"
if ($buildxList -match $builderNamePattern -and $buildxList -match "$BuilderName.*running") {
    Write-Host "Using existing buildx builder '$BuilderName'."
    docker buildx use $BuilderName
}
else {
    Write-Host "Setting up Docker buildx builder '$BuilderName'..."
    if ($buildxList -match $builderNamePattern) {
        docker buildx use $BuilderName
    }
    else {
        docker buildx create --use --name $BuilderName
    }
    docker buildx inspect $BuilderName --bootstrap
}

Write-Host "Starting multi-platform build and push for ${FULL_IMAGE_NAME}:${TAG} and ${FULL_IMAGE_NAME}:latest using builder '$BuilderName'..."

docker buildx build `
    --builder "$BuilderName" `
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