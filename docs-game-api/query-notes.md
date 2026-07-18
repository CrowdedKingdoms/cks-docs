# GraphQL Queries

```graphql
# Get chunk with specific LOD levels
query GetChunkWithLods($input: GetChunkInput!) {
  getChunk(input: $input) {
    chunkId
    lods { level data }
  }
}

# Get only LOD data  
query GetChunkLods($input: GetChunkLodsInput!) {
  getChunkLods(input: $input) {
    lods { level data }
  }
}

# Update LOD data (no ownership required)
mutation UpdateChunkLods($input: UpdateChunkLodsInput!) {
  updateChunkLods(input: $input) {
    chunkId
    lods { level data }
  }
}

query GetChunksByDistance($input: GetChunksByDistanceInput!) {
  getChunksByDistance(input: $input) {
    limit
    skip
    chunks {
      chunkId
      appId
      coordinates {
        x
        y
        z
      }
      # Fields returned depend on distance:
      voxels         # Distance 0-2
      voxelStates {  # Distance 0-2
        voxelCoord { x y z }
        voxelType
        state
      }
      chunkState     # Distance 0-2
      lods {         # Distance 3+ (filtered by level)
        level
        data
      }
    }
  }
}

{
  "input": {
    "appId": "1",
    "centerCoordinate": {
      "x": "100",
      "y": "50",
      "z": "-200"
    },
    "maxDistance": 5,
    "limit": 100,
    "skip": 0
  }
}


query TeleportRequest($input: TeleportRequestInput!) {
  teleportRequest(input: $input) {
    success
    errorCode
  }
}

{
  "input": {
    "appId": "1",
    "chunkAddress": {
      "x": "0",
      "y": "0",
      "z": "0"
    },
    "voxelAddress": {
      "x": 100,
      "y": 64,
      "z": 200
    },
    "UUID": "550e8400-e29b-41d4-a716-446655440000"
  }
}

```
