# SyncPlay Enhancements - Web Client Integration Guide

This guide provides step-by-step instructions for integrating the SyncPlay enhancements (Phases 1-3) into the Jellyfin web client.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Phase 1: Enhanced Member Information](#phase-1-enhanced-member-information)
- [Phase 2: Chat/Messaging System](#phase-2-chatmessaging-system)
- [Phase 3: Lobby & Ready System](#phase-3-lobby--ready-system)
- [WebSocket Integration](#websocket-integration)
- [State Management](#state-management)
- [Testing](#testing)

## Prerequisites

### Required Knowledge
- TypeScript/JavaScript
- React (web client uses React components)
- WebSocket communication
- Jellyfin API client usage

### Development Setup
1. Clone the jellyfin-web repository:
   ```bash
   git clone https://github.com/jellyfin/jellyfin-web.git
   cd jellyfin-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm start
   ```

4. Point to your enhanced Jellyfin server:
   - Configure the server URL to point to `http://localhost:8096` (or your server)

## Architecture Overview

### Current SyncPlay Structure

The web client likely has SyncPlay code in:
- `src/components/syncPlay/` - React components for SyncPlay UI
- `src/controllers/` - Legacy controllers (if any)
- `src/plugins/syncPlay/` - SyncPlay plugin code
- `src/scripts/` - Utility scripts

### Integration Points

1. **API Client**: Update API calls to use new endpoints
2. **WebSocket Handler**: Add handlers for new message types
3. **UI Components**: Create/update React components
4. **State Management**: Track member info, chat, and ready states

## Phase 1: Enhanced Member Information

### Step 1: Update TypeScript Types

Create or update `src/types/syncPlay.ts`:

```typescript
// Member information from Phase 1
export interface GroupMemberInfo {
    userId: string;
    userName: string;
    ping: number;
    isBuffering: boolean;
    isReady: boolean;
}

// Enhanced group info
export interface GroupInfo {
    groupId: string;
    groupName: string;
    state: string;
    participants: string[];
    lastUpdatedAt: string;
    members: GroupMemberInfo[];  // NEW in Phase 1
}
```

### Step 2: Update API Client

Update the API client to fetch enhanced group info:

```typescript
// src/utils/syncPlayApi.ts (or similar)
import { ApiClient } from '@jellyfin/sdk';

export async function getGroupInfo(
    api: ApiClient,
    groupId?: string
): Promise<GroupInfo> {
    const endpoint = groupId 
        ? `/SyncPlay/${groupId}`
        : '/SyncPlay/List';
    
    const response = await api.get(endpoint);
    return response.data;
}

export async function getGroupMembers(
    api: ApiClient,
    groupId: string
): Promise<GroupMemberInfo[]> {
    const response = await api.get(`/SyncPlay/${groupId}/Members`);
    return response.data;
}
```

### Step 3: Create Member List Component

Create `src/components/syncPlay/MemberList.tsx`:

```typescript
import React from 'react';
import { GroupMemberInfo } from '../../types/syncPlay';

interface MemberListProps {
    members: GroupMemberInfo[];
}

const MemberList: React.FC<MemberListProps> = ({ members }) => {
    const getPingColor = (ping: number) => {
        if (ping < 50) return 'green';
        if (ping < 100) return 'yellow';
        if (ping < 200) return 'orange';
        return 'red';
    };

    const getPingLabel = (ping: number) => {
        if (ping < 50) return 'Excellent';
        if (ping < 100) return 'Good';
        if (ping < 200) return 'Fair';
        return 'Poor';
    };

    return (
        <div className="syncplay-member-list">
            <h3>Members ({members.length})</h3>
            {members.map(member => (
                <div key={member.userId} className="member-card">
                    <div className="member-header">
                        <span className={`status-indicator ${member.isReady ? 'ready' : 'not-ready'}`}>
                            {member.isReady ? '●' : '○'}
                        </span>
                        <span className="member-name">{member.userName}</span>
                        <span 
                            className={`ping-badge ${getPingColor(member.ping)}`}
                            title={getPingLabel(member.ping)}
                        >
                            {member.ping}ms
                        </span>
                    </div>
                    <div className="member-status">
                        <span className={member.isReady ? 'ready' : 'not-ready'}>
                            {member.isReady ? '✓ Ready' : '○ Not Ready'}
                        </span>
                        <span className={member.isBuffering ? 'buffering' : ''}>
                            {member.isBuffering ? '⟳ Buffering' : '✓ Not Buffering'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MemberList;
```

### Step 4: Add Styles

Create `src/styles/syncPlay.scss`:

```scss
.syncplay-member-list {
    padding: 1rem;
    
    .member-card {
        background: var(--card-background);
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        
        .member-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
            
            .status-indicator {
                font-size: 1.2rem;
                
                &.ready { color: var(--success-color); }
                &.not-ready { color: var(--muted-color); }
            }
            
            .member-name {
                flex: 1;
                font-weight: 500;
            }
            
            .ping-badge {
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.875rem;
                
                &.green { background: #4caf50; color: white; }
                &.yellow { background: #ffeb3b; color: black; }
                &.orange { background: #ff9800; color: white; }
                &.red { background: #f44336; color: white; }
            }
        }
        
        .member-status {
            display: flex;
            gap: 1rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
            
            .ready { color: var(--success-color); }
            .not-ready { color: var(--muted-color); }
            .buffering { color: var(--warning-color); }
        }
    }
}
```

## Phase 2: Chat/Messaging System

### Step 1: Update TypeScript Types

Add to `src/types/syncPlay.ts`:

```typescript
export interface ChatMessage {
    messageId: string;
    groupId: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: string;
    isSystemMessage: boolean;
}

export interface SendChatMessageRequest {
    message: string;
}
```

### Step 2: Update API Client

Add to `src/utils/syncPlayApi.ts`:

```typescript
export async function sendChatMessage(
    api: ApiClient,
    message: string
): Promise<void> {
    await api.post('/SyncPlay/Chat', { message });
}

export async function getChatHistory(
    api: ApiClient
): Promise<ChatMessage[]> {
    const response = await api.get('/SyncPlay/Chat');
    return response.data;
}
```

### Step 3: Create Chat Component

Create `src/components/syncPlay/ChatPanel.tsx`:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types/syncPlay';

interface ChatPanelProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    currentUserId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
    messages, 
    onSendMessage,
    currentUserId 
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (isCollapsed) {
        return (
            <div className="chat-panel collapsed" onClick={() => setIsCollapsed(false)}>
                💬 Chat ({messages.length})
            </div>
        );
    }

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <h3>💬 Chat</h3>
                <button onClick={() => setIsCollapsed(true)}>−</button>
            </div>
            
            <div className="chat-messages">
                {messages.map(msg => (
                    <div 
                        key={msg.messageId}
                        className={`chat-message ${
                            msg.isSystemMessage ? 'system' : 
                            msg.userId === currentUserId ? 'own' : 'other'
                        }`}
                    >
                        {msg.isSystemMessage ? (
                            <div className="system-message">
                                <span className="timestamp">{formatTime(msg.timestamp)}</span>
                                <span className="message">{msg.message}</span>
                            </div>
                        ) : (
                            <div className="user-message">
                                <div className="message-header">
                                    <span className="username">{msg.userName}</span>
                                    <span className="timestamp">{formatTime(msg.timestamp)}</span>
                                </div>
                                <div className="message-content">{msg.message}</div>
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="chat-input">
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
                <button onClick={handleSend}>Send</button>
            </div>
        </div>
    );
};

export default ChatPanel;
```

### Step 4: Add Chat Styles

Add to `src/styles/syncPlay.scss`:

```scss
.chat-panel {
    display: flex;
    flex-direction: column;
    height: 400px;
    background: var(--card-background);
    border-radius: 8px;
    
    &.collapsed {
        height: auto;
        padding: 0.5rem 1rem;
        cursor: pointer;
        
        &:hover {
            background: var(--card-background-hover);
        }
    }
    
    .chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--divider-color);
        
        h3 {
            margin: 0;
        }
        
        button {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
        }
    }
    
    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        
        .chat-message {
            margin-bottom: 1rem;
            
            &.system {
                text-align: center;
                
                .system-message {
                    display: inline-block;
                    padding: 0.25rem 0.75rem;
                    background: var(--info-background);
                    border-radius: 12px;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    
                    .timestamp {
                        margin-right: 0.5rem;
                        opacity: 0.7;
                    }
                }
            }
            
            &.own .user-message {
                margin-left: auto;
                background: var(--primary-color);
                color: white;
            }
            
            &.other .user-message {
                margin-right: auto;
                background: var(--secondary-background);
            }
            
            .user-message {
                max-width: 70%;
                padding: 0.75rem;
                border-radius: 12px;
                
                .message-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.25rem;
                    font-size: 0.875rem;
                    
                    .username {
                        font-weight: 500;
                    }
                    
                    .timestamp {
                        opacity: 0.7;
                    }
                }
                
                .message-content {
                    word-wrap: break-word;
                }
            }
        }
    }
    
    .chat-input {
        display: flex;
        gap: 0.5rem;
        padding: 1rem;
        border-top: 1px solid var(--divider-color);
        
        input {
            flex: 1;
            padding: 0.5rem;
            border: 1px solid var(--input-border);
            border-radius: 4px;
            background: var(--input-background);
            color: var(--text-primary);
        }
        
        button {
            padding: 0.5rem 1rem;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            
            &:hover {
                background: var(--primary-color-hover);
            }
        }
    }
}
```

## Phase 3: Lobby & Ready System

### Step 1: Update TypeScript Types

Add to `src/types/syncPlay.ts`:

```typescript
export interface SetReadyRequest {
    isReady: boolean;
}

export interface ReadyUpdate {
    userId: string;
    userName: string;
    isReady: boolean;
    allReady: boolean;
}
```

### Step 2: Update API Client

Add to `src/utils/syncPlayApi.ts`:

```typescript
export async function setLobbyReady(
    api: ApiClient,
    isReady: boolean
): Promise<void> {
    await api.post('/SyncPlay/LobbyReady', { isReady });
}
```

### Step 3: Create Lobby Component

Create `src/components/syncPlay/LobbyScreen.tsx`:

```typescript
import React from 'react';
import { GroupInfo } from '../../types/syncPlay';

interface LobbyScreenProps {
    group: GroupInfo;
    currentUserId: string;
    onToggleReady: (isReady: boolean) => void;
    onStartPlayback: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({
    group,
    currentUserId,
    onToggleReady,
    onStartPlayback
}) => {
    const currentMember = group.members.find(m => m.userId === currentUserId);
    const isReady = currentMember?.isReady || false;
    const readyCount = group.members.filter(m => m.isReady).length;
    const totalCount = group.members.length;
    const allReady = readyCount === totalCount && totalCount > 0;

    return (
        <div className="syncplay-lobby">
            <h1>{group.groupName} - Lobby</h1>
            
            <div className="lobby-content">
                <div className="members-section">
                    <h2>Members ({readyCount}/{totalCount} ready)</h2>
                    <div className="progress-bar">
                        <div 
                            className="progress-fill"
                            style={{ width: `${(readyCount / totalCount) * 100}%` }}
                        />
                    </div>
                    
                    <div className="member-list">
                        {group.members.map(member => (
                            <div key={member.userId} className="member-item">
                                <span className={`ready-indicator ${member.isReady ? 'ready' : 'not-ready'}`}>
                                    {member.isReady ? '✓' : '○'}
                                </span>
                                <span className="member-name">{member.userName}</span>
                                {!member.isReady && <span className="waiting-text">(waiting...)</span>}
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="ready-controls">
                    <button
                        className={`ready-toggle ${isReady ? 'ready' : 'not-ready'}`}
                        onClick={() => onToggleReady(!isReady)}
                    >
                        {isReady ? '✓ Ready' : 'Mark Ready'}
                    </button>
                    
                    {allReady && (
                        <div className="all-ready-section">
                            <p className="all-ready-message">Everyone is ready!</p>
                            <button
                                className="start-button"
                                onClick={onStartPlayback}
                            >
                                Start Playback
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LobbyScreen;
```

### Step 4: Add Lobby Styles

Add to `src/styles/syncPlay.scss`:

```scss
.syncplay-lobby {
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;

    h1 {
        text-align: center;
        margin-bottom: 2rem;
    }

    .lobby-content {
        background: var(--card-background);
        border-radius: 12px;
        padding: 2rem;

        .members-section {
            margin-bottom: 2rem;

            h2 {
                margin-bottom: 1rem;
            }

            .progress-bar {
                height: 8px;
                background: var(--divider-color);
                border-radius: 4px;
                margin-bottom: 1.5rem;
                overflow: hidden;

                .progress-fill {
                    height: 100%;
                    background: var(--success-color);
                    transition: width 0.3s ease;
                }
            }

            .member-list {
                .member-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    margin-bottom: 0.5rem;
                    background: var(--secondary-background);
                    border-radius: 8px;

                    .ready-indicator {
                        font-size: 1.5rem;

                        &.ready { color: var(--success-color); }
                        &.not-ready { color: var(--muted-color); }
                    }

                    .member-name {
                        flex: 1;
                        font-weight: 500;
                    }

                    .waiting-text {
                        color: var(--text-secondary);
                        font-style: italic;
                    }
                }
            }
        }

        .ready-controls {
            text-align: center;

            .ready-toggle {
                padding: 1rem 2rem;
                font-size: 1.125rem;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;

                &.not-ready {
                    background: var(--primary-color);
                    color: white;

                    &:hover {
                        background: var(--primary-color-hover);
                    }
                }

                &.ready {
                    background: var(--success-color);
                    color: white;
                }
            }

            .all-ready-section {
                margin-top: 2rem;
                padding: 1.5rem;
                background: var(--success-background);
                border-radius: 8px;

                .all-ready-message {
                    font-size: 1.25rem;
                    font-weight: 500;
                    color: var(--success-color);
                    margin-bottom: 1rem;
                }

                .start-button {
                    padding: 1rem 3rem;
                    font-size: 1.25rem;
                    background: var(--success-color);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;

                    &:hover {
                        background: var(--success-color-hover);
                    }
                }
            }
        }
    }
}
```

## WebSocket Integration

### Step 1: Update WebSocket Handler

Update or create `src/utils/syncPlayWebSocket.ts`:

```typescript
import { ChatMessage, ReadyUpdate } from '../types/syncPlay';

export enum GroupUpdateType {
    // Existing types...
    ChatMessage = 'ChatMessage',
    UserReady = 'UserReady'
}

export interface GroupUpdate<T> {
    groupId: string;
    type: GroupUpdateType;
    data: T;
}

export class SyncPlayWebSocketHandler {
    private ws: WebSocket | null = null;
    private handlers: Map<GroupUpdateType, ((data: any) => void)[]> = new Map();

    connect(serverUrl: string, accessToken: string) {
        const wsUrl = `${serverUrl.replace('http', 'ws')}/socket?api_key=${accessToken}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = (event) => {
            const update = JSON.parse(event.data);
            this.handleUpdate(update);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket closed');
            // Implement reconnection logic
        };
    }

    private handleUpdate(update: GroupUpdate<any>) {
        const handlers = this.handlers.get(update.type);
        if (handlers) {
            handlers.forEach(handler => handler(update.data));
        }
    }

    on(type: GroupUpdateType, handler: (data: any) => void) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);
    }

    off(type: GroupUpdateType, handler: (data: any) => void) {
        const handlers = this.handlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.handlers.clear();
    }
}
```

### Step 2: Create SyncPlay Container Component

Create `src/components/syncPlay/SyncPlayContainer.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { SyncPlayWebSocketHandler, GroupUpdateType } from '../../utils/syncPlayWebSocket';
import { GroupInfo, ChatMessage, ReadyUpdate } from '../../types/syncPlay';
import { getGroupInfo, getChatHistory, sendChatMessage, setLobbyReady } from '../../utils/syncPlayApi';
import MemberList from './MemberList';
import ChatPanel from './ChatPanel';
import LobbyScreen from './LobbyScreen';

const SyncPlayContainer: React.FC = () => {
    const api = useApi();
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [wsHandler] = useState(() => new SyncPlayWebSocketHandler());
    const [showLobby, setShowLobby] = useState(true);

    useEffect(() => {
        // Initialize
        loadGroupInfo();
        loadChatHistory();
        setupWebSocket();

        return () => {
            wsHandler.disconnect();
        };
    }, []);

    const loadGroupInfo = async () => {
        try {
            const groupData = await getGroupInfo(api);
            setGroup(groupData);
        } catch (error) {
            console.error('Failed to load group info:', error);
        }
    };

    const loadChatHistory = async () => {
        try {
            const history = await getChatHistory(api);
            setMessages(history);
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    };

    const setupWebSocket = () => {
        const serverUrl = api.basePath;
        const accessToken = api.accessToken;

        wsHandler.connect(serverUrl, accessToken);

        // Handle chat messages
        wsHandler.on(GroupUpdateType.ChatMessage, (message: ChatMessage) => {
            setMessages(prev => [...prev, message]);
        });

        // Handle ready state updates
        wsHandler.on(GroupUpdateType.UserReady, (update: ReadyUpdate) => {
            setGroup(prev => {
                if (!prev) return prev;

                return {
                    ...prev,
                    members: prev.members.map(member =>
                        member.userId === update.userId
                            ? { ...member, isReady: update.isReady }
                            : member
                    )
                };
            });

            // Show notification if all ready
            if (update.allReady) {
                // Show notification or auto-start
                console.log('All members are ready!');
            }
        });
    };

    const handleSendMessage = async (message: string) => {
        try {
            await sendChatMessage(api, message);
            // Message will be received via WebSocket
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    const handleToggleReady = async (isReady: boolean) => {
        try {
            await setLobbyReady(api, isReady);
            // Update will be received via WebSocket
        } catch (error) {
            console.error('Failed to set ready state:', error);
        }
    };

    const handleStartPlayback = () => {
        setShowLobby(false);
        // Start video playback
    };

    if (!group) {
        return <div>Loading...</div>;
    }

    if (showLobby) {
        return (
            <LobbyScreen
                group={group}
                currentUserId={api.getCurrentUserId()}
                onToggleReady={handleToggleReady}
                onStartPlayback={handleStartPlayback}
            />
        );
    }

    return (
        <div className="syncplay-container">
            <div className="video-player">
                {/* Video player component */}
            </div>

            <div className="syncplay-sidebar">
                <MemberList members={group.members} />
                <ChatPanel
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    currentUserId={api.getCurrentUserId()}
                />
            </div>
        </div>
    );
};

export default SyncPlayContainer;
```

## State Management

### Option 1: React Context (Recommended for Simple Cases)

Create `src/contexts/SyncPlayContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { GroupInfo, ChatMessage } from '../types/syncPlay';

interface SyncPlayContextType {
    group: GroupInfo | null;
    messages: ChatMessage[];
    updateGroup: (group: GroupInfo) => void;
    addMessage: (message: ChatMessage) => void;
}

const SyncPlayContext = createContext<SyncPlayContextType | undefined>(undefined);

export const SyncPlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const updateGroup = (newGroup: GroupInfo) => {
        setGroup(newGroup);
    };

    const addMessage = (message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
    };

    return (
        <SyncPlayContext.Provider value={{ group, messages, updateGroup, addMessage }}>
            {children}
        </SyncPlayContext.Provider>
    );
};

export const useSyncPlay = () => {
    const context = useContext(SyncPlayContext);
    if (!context) {
        throw new Error('useSyncPlay must be used within SyncPlayProvider');
    }
    return context;
};
```

### Option 2: Redux (For Complex State Management)

If using Redux, create actions and reducers:

```typescript
// src/store/syncPlay/actions.ts
export const UPDATE_GROUP = 'syncPlay/UPDATE_GROUP';
export const ADD_MESSAGE = 'syncPlay/ADD_MESSAGE';
export const UPDATE_MEMBER_READY = 'syncPlay/UPDATE_MEMBER_READY';

// src/store/syncPlay/reducer.ts
const initialState = {
    group: null,
    messages: []
};

export default function syncPlayReducer(state = initialState, action) {
    switch (action.type) {
        case UPDATE_GROUP:
            return { ...state, group: action.payload };
        case ADD_MESSAGE:
            return { ...state, messages: [...state.messages, action.payload] };
        case UPDATE_MEMBER_READY:
            return {
                ...state,
                group: {
                    ...state.group,
                    members: state.group.members.map(m =>
                        m.userId === action.payload.userId
                            ? { ...m, isReady: action.payload.isReady }
                            : m
                    )
                }
            };
        default:
            return state;
    }
}
```

## Testing

### Unit Tests

Create `src/components/syncPlay/__tests__/MemberList.test.tsx`:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import MemberList from '../MemberList';

describe('MemberList', () => {
    const mockMembers = [
        {
            userId: '1',
            userName: 'User1',
            ping: 45,
            isBuffering: false,
            isReady: true
        },
        {
            userId: '2',
            userName: 'User2',
            ping: 150,
            isBuffering: true,
            isReady: false
        }
    ];

    it('renders member list correctly', () => {
        render(<MemberList members={mockMembers} />);

        expect(screen.getByText('Members (2)')).toBeInTheDocument();
        expect(screen.getByText('User1')).toBeInTheDocument();
        expect(screen.getByText('User2')).toBeInTheDocument();
    });

    it('displays ping with correct color', () => {
        render(<MemberList members={mockMembers} />);

        const ping1 = screen.getByText('45ms');
        expect(ping1).toHaveClass('green');

        const ping2 = screen.getByText('150ms');
        expect(ping2).toHaveClass('orange');
    });
});
```

### Integration Tests

Test the full flow:

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { SyncPlayProvider, useSyncPlay } from '../contexts/SyncPlayContext';

describe('SyncPlay Integration', () => {
    it('updates group info correctly', () => {
        const { result } = renderHook(() => useSyncPlay(), {
            wrapper: SyncPlayProvider
        });

        act(() => {
            result.current.updateGroup({
                groupId: '1',
                groupName: 'Test Group',
                state: 'Paused',
                participants: ['User1'],
                lastUpdatedAt: new Date().toISOString(),
                members: []
            });
        });

        expect(result.current.group?.groupName).toBe('Test Group');
    });
});
```

## Summary

### Files to Create/Modify

**New Files**:
1. `src/types/syncPlay.ts` - TypeScript type definitions
2. `src/utils/syncPlayApi.ts` - API client functions
3. `src/utils/syncPlayWebSocket.ts` - WebSocket handler
4. `src/components/syncPlay/MemberList.tsx` - Member list component
5. `src/components/syncPlay/ChatPanel.tsx` - Chat component
6. `src/components/syncPlay/LobbyScreen.tsx` - Lobby component
7. `src/components/syncPlay/SyncPlayContainer.tsx` - Main container
8. `src/contexts/SyncPlayContext.tsx` - React context (optional)
9. `src/styles/syncPlay.scss` - Styles

**Modified Files**:
- Existing SyncPlay components to use new API endpoints
- WebSocket connection logic to handle new message types
- Main app routing to include lobby screen

### Next Steps

1. **Implement the components** following this guide
2. **Test with the enhanced server** running on localhost:8096
3. **Iterate on UI/UX** based on user feedback
4. **Add error handling** and loading states
5. **Optimize performance** (memoization, virtualization)
6. **Add accessibility** features (ARIA labels, keyboard navigation)
7. **Write comprehensive tests**

### Resources

- [Jellyfin Web Repository](https://github.com/jellyfin/jellyfin-web)
- [API Documentation](./syncplay-enhancements.md)
- [UI Recommendations](./syncplay-ui-recommendations.md)
- [Project Summary](./syncplay-summary.md)

