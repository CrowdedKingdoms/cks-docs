---
draft: true
---

# Custom Build Image Setup

This project uses a custom build image to speed up CI/CD builds by pre-installing dependencies and build tools. This document explains how to set up and maintain the custom build image system.

## Overview

The custom build image system consists of:

1. **`Dockerfile.build`** - Defines the custom build image with Node.js 18, npm, and common build dependencies pre-installed
2. **`.github/workflows/build-image.yml`** - GitHub workflow to build and push the custom build image to ECR
3. **Modified `Dockerfile`** - Updated to use the custom build image as the base for the builder stage
4. **`scripts/manage-build-image.sh`** - Helper script to manage the build image locally

## Benefits

- **Faster builds**: Dependencies are pre-cached in the build image
- **Consistent environment**: Same build tools and versions across all builds
- **Reduced network usage**: Less downloading during builds
- **Better caching**: Docker layer caching is more effective

## Initial Setup

### 1. Create ECR Repository

First, you need to create an ECR repository for the build image:

```bash
# Option 1: Use the management script
./scripts/manage-build-image.sh setup

# Option 2: Create manually via AWS CLI
aws ecr create-repository \
  --repository-name crowd-rocks/cks-game-api-build-image \
  --region us-east-2 \
  --image-scanning-configuration scanOnPush=true
```

### 2. Build and Push Initial Image

Build and push the first version of the custom build image:

```bash
# Option 1: Use the management script (recommended)
./scripts/manage-build-image.sh deploy

# Option 2: Manual commands
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 317700178317.dkr.ecr.us-east-2.amazonaws.com
docker buildx build --platform linux/arm64 -f Dockerfile.build -t 317700178317.dkr.ecr.us-east-2.amazonaws.com/crowd-rocks/cks-game-api-build-image:node-18-alpine .
docker push 317700178317.dkr.ecr.us-east-2.amazonaws.com/crowd-rocks/cks-game-api-build-image:node-18-alpine
```

### 3. Update GitHub Secrets

Ensure your repository has the following GitHub secrets configured:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

These are already configured for your existing deployment workflow.

## Automated Workflow

The custom build image is automatically managed through GitHub workflows:

### Build Image Workflow (`.github/workflows/build-image.yml`)

- **Triggers**: 
  - Push to the `dev` branch when `Dockerfile.build`, `package*.json`, or the workflow file changes
  - Manual dispatch with `workflow_dispatch`

- **What it does**:
  - Builds the custom build image for ARM64 architecture
  - Pushes to ECR with multiple tags: `node-18-alpine`, `node-18-alpine-{run_number}`, and `latest`

### Deploy Workflow Updates (`.github/workflows/deploy-dev.yml`)

The deployment workflow has been updated to:
- Check if the build image exists in ECR
- Trigger the build image workflow if the image doesn't exist
- Wait for the build image to be available before proceeding with the application build

## Manual Management

Use the provided script for manual operations:

```bash
# Check if build image exists in ECR
./scripts/manage-build-image.sh check

# Build image locally only
./scripts/manage-build-image.sh build

# Push existing local image to ECR
./scripts/manage-build-image.sh push

# Build and push in one command
./scripts/manage-build-image.sh deploy

# Setup ECR repository
./scripts/manage-build-image.sh setup

# Show help
./scripts/manage-build-image.sh help
```

## Updating the Build Image

The build image should be updated when:

1. **Dependencies change**: When you add/remove dependencies in `package.json`
2. **Node.js version updates**: When upgrading the Node.js version
3. **Build tools change**: When adding new build tools or global packages

### Automatic Updates

The build image will automatically rebuild when:
- `Dockerfile.build` is modified
- `package.json` or `package-lock.json` is modified
- Changes are pushed to the `dev` branch

### Manual Updates

To force an update of the build image:

```bash
# Via GitHub workflow dispatch
# Go to Actions tab in GitHub → Build and Push Custom Build Image → Run workflow → Set force_build to true

# Via local script
./scripts/manage-build-image.sh deploy
```

## Troubleshooting

### Build Image Not Found

If you get an error about the build image not being found:

1. Check if the ECR repository exists:
   ```bash
   aws ecr describe-repositories --repository-names crowd-rocks/cks-game-api-build-image --region us-east-2
   ```

2. Build and push the image manually:
   ```bash
   ./scripts/manage-build-image.sh deploy
   ```

### Permission Issues

If you get permission errors:

1. Verify AWS credentials are configured correctly
2. Ensure the IAM user/role has ECR permissions:
   - `ecr:GetAuthorizationToken`
   - `ecr:BatchCheckLayerAvailability`
   - `ecr:GetDownloadUrlForLayer`
   - `ecr:BatchGetImage`
   - `ecr:BatchImportLayerPart`
   - `ecr:CompleteLayerUpload`
   - `ecr:CreateRepository`
   - `ecr:DescribeRepositories`
   - `ecr:DescribeImages`
   - `ecr:InitiateLayerUpload`
   - `ecr:PutImage`
   - `ecr:UploadLayerPart`

### Build Failures

If the build image workflow fails:

1. Check the GitHub Actions logs for specific errors
2. Verify the `Dockerfile.build` syntax is correct
3. Ensure all required files are present in the repository

## Configuration

Key configuration values are defined in:

- **ECR Repository**: `crowd-rocks/cks-game-api-build-image`
- **Image Tag**: `node-18-alpine`
- **AWS Region**: `us-east-2`
- **Platform**: `linux/arm64`

To change these values, update:
- `.github/workflows/build-image.yml`
- `scripts/manage-build-image.sh`
- `Dockerfile` (the FROM statement)

## Performance Impact

Expected performance improvements:
- **Build time reduction**: 30-50% faster builds due to pre-cached dependencies
- **Network usage**: Reduced by ~80% during npm install phase
- **Cache hit rate**: Higher Docker layer cache hit rates

Monitor your build times before and after implementation to measure the actual impact. 