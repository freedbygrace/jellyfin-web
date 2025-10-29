# SyncPlay Enhancements - API Documentation

This document describes the enhancements made to the SyncPlay feature across three phases: Enhanced Group Information, Chat/Messaging System, and Session Lobby & Ready System.

## Table of Contents

- [Overview](#overview)
- [Phase 1: Enhanced Group Information & Visibility](#phase-1-enhanced-group-information--visibility)
- [Phase 2: Chat/Messaging System](#phase-2-chatmessaging-system)
- [Phase 3: Session Lobby & Ready System](#phase-3-session-lobby--ready-system)
- [WebSocket Updates](#websocket-updates)
- [Data Models](#data-models)
- [Usage Examples](#usage-examples)

## Overview

These enhancements provide SyncPlay groups with:
- Detailed member information (ping, buffering, ready states)
- Real-time chat messaging with history
- User-controlled lobby ready system for coordination before playback

All features integrate seamlessly with the existing SyncPlay WebSocket infrastructure for real-time updates.

## Phase 1: Enhanced Group Information & Visibility

### New Endpoints

#### Get Group Members
```
GET /SyncPlay/{groupId}/Members
```

Returns detailed information about all members in a specific SyncPlay group.

**Authorization**: `SyncPlayHasAccess` policy

**Parameters**:
- `groupId` (path, required): The group identifier (GUID)

**Response**: `200 OK`
```json
[
  {
    "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "userName": "JohnDoe",
    "ping": 45,
    "isBuffering": false,
    "isReady": true
  }
]
```

**Response Codes**:
- `200`: Success - Returns array of `GroupMemberInfoDto`
- `404`: Group not found

### Enhanced Endpoints

#### Get All Groups
```
GET /SyncPlay/List
```

Now includes detailed member information in the response.

**Response**: `200 OK`
```json
[
  {
    "groupId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "groupName": "Movie Night",
    "state": "Paused",
    "participants": ["JohnDoe", "JaneSmith"],
    "lastUpdatedAt": "2025-10-29T16:00:00Z",
    "members": [
      {
        "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "userName": "JohnDoe",
        "ping": 45,
        "isBuffering": false,
        "isReady": true
      }
    ]
  }
]
```

#### Get Specific Group
```
GET /SyncPlay/{groupId}
```

Now includes detailed member information in the response.

**Response**: Same structure as above, but for a single group.

### Data Models

#### GroupMemberInfoDto
```typescript
{
  userId: string;        // User GUID
  userName: string;      // Display name
  ping: number;          // Latency in milliseconds
  isBuffering: boolean;  // Automatic buffering state during playback
  isReady: boolean;      // User-controlled lobby ready state
}
```

## Phase 2: Chat/Messaging System

### Endpoints

#### Send Chat Message
```
POST /SyncPlay/Chat
```

Send a chat message to your SyncPlay group.

**Authorization**: `SyncPlayIsInGroup` policy (must be in a group)

**Request Body**:
```json
{
  "message": "Hello everyone!"
}
```

**Response**: `204 No Content` on success

**Response Codes**:
- `204`: Message sent successfully
- `404`: User is not in a group

#### Get Chat History
```
GET /SyncPlay/Chat
```

Retrieve chat message history for your SyncPlay group (up to 100 most recent messages).

**Authorization**: `SyncPlayIsInGroup` policy

**Response**: `200 OK`
```json
[
  {
    "messageId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "groupId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
    "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
    "userName": "JohnDoe",
    "message": "Hello everyone!",
    "timestamp": "2025-10-29T16:00:00Z",
    "isSystemMessage": false
  }
]
```

**Response Codes**:
- `200`: Success - Returns array of `ChatMessageDto`
- `404`: User is not in a group

### Features

- **Message History**: Groups maintain up to 100 most recent messages
- **System Messages**: Automatic messages when users join/leave
  - Format: `"{userName} joined the group"` or `"{userName} left the group"`
- **Real-time Updates**: All messages broadcast via WebSocket to all group members

### Data Models

#### ChatMessageDto
```typescript
{
  messageId: string;      // Message GUID
  groupId: string;        // Group GUID
  userId: string;         // Sender GUID (empty for system messages)
  userName: string;       // Sender name (or "System")
  message: string;        // Message content
  timestamp: string;      // UTC timestamp (ISO 8601)
  isSystemMessage: boolean; // true for system messages
}
```

## Phase 3: Session Lobby & Ready System

### Endpoints

#### Set Lobby Ready State
```
POST /SyncPlay/LobbyReady
```

Set your lobby ready state in the SyncPlay group. This is for lobby coordination before playback starts.

**Authorization**: `SyncPlayIsInGroup` policy

**Request Body**:
```json
{
  "isReady": true
}
```

**Response**: `204 No Content` on success

**Response Codes**:
- `204`: Ready state updated successfully
- `404`: User is not in a group

### Features

- **User-Controlled State**: Members explicitly mark themselves as ready
- **All-Ready Detection**: System tracks when all members are ready
- **Real-time Updates**: Ready state changes broadcast to all members
- **Separate from Buffering**: `IsReady` (lobby) is distinct from `IsBuffering` (playback)

### Key Distinction

| Property | Purpose | Control |
|----------|---------|---------|
| `isReady` | Lobby coordination before playback | User-controlled via `/LobbyReady` |
| `isBuffering` | Media buffering during playback | Automatic during playback |

### Data Models

#### ReadyUpdateDto
```typescript
{
  userId: string;      // User who changed state
  userName: string;    // User's display name
  isReady: boolean;    // New ready state
  allReady: boolean;   // Whether ALL members are now ready
}
```

## WebSocket Updates

All new features integrate with the existing SyncPlay WebSocket infrastructure. Clients receive real-time updates for:

### GroupUpdateType Enum

New update types added:

```typescript
enum GroupUpdateType {
  // ... existing types ...
  ChatMessage = "ChatMessage",    // New chat message
  UserReady = "UserReady"         // Ready state changed
}
```

### Chat Message Update
```json
{
  "groupId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "type": "ChatMessage",
  "data": {
    "messageId": "...",
    "groupId": "...",
    "userId": "...",
    "userName": "JohnDoe",
    "message": "Hello!",
    "timestamp": "2025-10-29T16:00:00Z",
    "isSystemMessage": false
  }
}
```

### Ready State Update
```json
{
  "groupId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "type": "UserReady",
  "data": {
    "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
    "userName": "JohnDoe",
    "isReady": true,
    "allReady": false
  }
}
```

## Data Models

### Complete Type Definitions

```typescript
// Phase 1: Group Member Information
interface GroupMemberInfoDto {
  userId: string;
  userName: string;
  ping: number;
  isBuffering: boolean;
  isReady: boolean;
}

interface GroupInfoDto {
  groupId: string;
  groupName: string;
  state: GroupStateType;
  participants: string[];
  lastUpdatedAt: string;
  members: GroupMemberInfoDto[];  // NEW in Phase 1
}

// Phase 2: Chat Messages
interface ChatMessageDto {
  messageId: string;
  groupId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  isSystemMessage: boolean;
}

interface SendChatMessageRequest {
  message: string;
}

// Phase 3: Lobby Ready
interface SetReadyRequest {
  isReady: boolean;
}

interface ReadyUpdateDto {
  userId: string;
  userName: string;
  isReady: boolean;
  allReady: boolean;
}
```

## Usage Examples

### Example 1: Display Member Status

```javascript
// Get group information
const response = await fetch('/SyncPlay/List');
const groups = await response.json();

groups.forEach(group => {
  console.log(`Group: ${group.groupName}`);
  group.members.forEach(member => {
    console.log(`  ${member.userName}:`);
    console.log(`    Ping: ${member.ping}ms`);
    console.log(`    Buffering: ${member.isBuffering}`);
    console.log(`    Ready: ${member.isReady}`);
  });
});
```

### Example 2: Send and Receive Chat Messages

```javascript
// Send a message
await fetch('/SyncPlay/Chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello everyone!' })
});

// Get message history
const messages = await fetch('/SyncPlay/Chat').then(r => r.json());
messages.forEach(msg => {
  const prefix = msg.isSystemMessage ? '[SYSTEM]' : `[${msg.userName}]`;
  console.log(`${prefix} ${msg.message}`);
});

// Listen for real-time messages via WebSocket
websocket.on('message', (update) => {
  if (update.type === 'ChatMessage') {
    displayMessage(update.data);
  }
});
```

### Example 3: Lobby Ready Coordination

```javascript
// Set ready state
await fetch('/SyncPlay/LobbyReady', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isReady: true })
});

// Listen for ready state changes
websocket.on('message', (update) => {
  if (update.type === 'UserReady') {
    console.log(`${update.data.userName} is ${update.data.isReady ? 'ready' : 'not ready'}`);
    
    if (update.data.allReady) {
      console.log('Everyone is ready! Starting playback...');
      // Auto-start playback or show UI prompt
    }
  }
});

// Display ready status in UI
const group = await fetch('/SyncPlay/List').then(r => r.json());
const readyCount = group[0].members.filter(m => m.isReady).length;
const totalCount = group[0].members.length;
console.log(`Ready: ${readyCount}/${totalCount}`);
```

## Migration Notes

### Backward Compatibility

All enhancements are backward compatible:
- Existing endpoints continue to work as before
- New fields in `GroupInfoDto` are additive
- New endpoints are optional to use
- WebSocket updates use new `GroupUpdateType` values that old clients can ignore

### Client Updates

To take advantage of these features, clients should:
1. Update to handle new `members` array in `GroupInfoDto`
2. Implement chat UI and handle `ChatMessage` WebSocket updates
3. Implement lobby ready UI and handle `UserReady` WebSocket updates
4. Distinguish between `isReady` (lobby) and `isBuffering` (playback) states

## Security Considerations

- All endpoints require authentication
- Chat endpoints require `SyncPlayIsInGroup` policy (user must be in a group)
- Member info endpoints require `SyncPlayHasAccess` policy (user must have access to the group)
- Chat messages are limited to 100 per group (automatic cleanup)
- No message editing or deletion (by design for simplicity)

## Performance Considerations

- Chat history is stored in memory (max 100 messages per group)
- WebSocket broadcasts are efficient (only to group members)
- No database persistence for chat messages (ephemeral by design)
- Ready state changes are lightweight (single boolean flag)

