# SyncPlay Integration Example

This document shows how to integrate the new SyncPlay enhancement components into the existing Jellyfin web client UI.

## Overview

The SyncPlay enhancements have been integrated with the existing SyncPlay plugin system through:

1. **Manager.js** - Extended to handle new WebSocket message types (`ChatMessage`, `UserReady`)
2. **plugin.ts** - Exposes SyncPlay globally for React components
3. **useSyncPlayEnhancements.ts** - React hook that bridges the plugin with React components
4. **SyncPlayContainer.tsx** - Main container component using the hook

## Integration Flow

```
Server WebSocket → Manager.js → Events → useSyncPlayEnhancements → React Components
```

### Detailed Flow:

1. **Server sends WebSocket message** (e.g., `ChatMessage` or `UserReady`)
2. **Manager.js receives it** in `processGroupUpdate(cmd, apiClient)`
3. **Manager triggers Events** using `Events.trigger(this, 'syncplay-chatmessage', [data])`
4. **useSyncPlayEnhancements hook listens** to these events
5. **Hook updates React state**
6. **Components re-render** with new data

## Using the Components

### Option 1: Add to Existing SyncPlay Menu

You can add the new components to the existing SyncPlay menu dialog. Here's an example:

```typescript
// In SyncPlayMenu.tsx or a new SyncPlayDialog.tsx

import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import { SyncPlayContainer } from '../../../../components/syncPlay';
import { useApi } from 'hooks/useApi';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

export const SyncPlayDialog = ({ open, onClose, groupId }) => {
    const { __legacyApiClient__, user } = useApi();
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>SyncPlay Session</DialogTitle>
            <DialogContent>
                <Tabs value={tabValue} onChange={handleTabChange}>
                    <Tab label="Members" />
                    <Tab label="Chat" />
                    <Tab label="Lobby" />
                </Tabs>

                <SyncPlayContainer
                    apiClient={__legacyApiClient__}
                    currentUserId={user?.Id || ''}
                    groupId={groupId}
                    showLobby={tabValue === 2}
                    onStartPlayback={() => {
                        // Handle playback start
                        console.log('Starting playback...');
                    }}
                />
            </DialogContent>
        </Dialog>
    );
};
```

### Option 2: Add to SyncPlay Settings

You can add the chat and member list to the existing SyncPlay settings dialog:

```typescript
// In SettingsEditor.js or a new React-based settings component

import { MemberList, ChatPanel } from '../../../../../components/syncPlay';
import { useSyncPlayEnhancements } from '../../../../../hooks/useSyncPlayEnhancements';

export const SyncPlaySettings = ({ apiClient, groupId }) => {
    const {
        group,
        messages,
        sendMessage
    } = useSyncPlayEnhancements({
        apiClient,
        groupId,
        autoLoad: true
    });

    return (
        <div className="syncplay-settings">
            <div className="syncplay-settings-section">
                <h3>Group Members</h3>
                {group && (
                    <MemberList
                        members={group.members}
                        currentUserId={apiClient.getCurrentUserId()}
                    />
                )}
            </div>

            <div className="syncplay-settings-section">
                <h3>Chat</h3>
                <ChatPanel
                    messages={messages}
                    currentUserId={apiClient.getCurrentUserId()}
                    onSendMessage={sendMessage}
                />
            </div>
        </div>
    );
};
```

### Option 3: Standalone SyncPlay Page

Create a dedicated SyncPlay page with all features:

```typescript
// In src/apps/experimental/routes/syncplay.tsx

import React from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from 'hooks/useApi';
import { SyncPlayContainer } from '../../../components/syncPlay';
import { playbackManager } from '../../../components/playback/playbackmanager';

export const SyncPlayPage = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const { __legacyApiClient__, user } = useApi();

    const handleStartPlayback = () => {
        // Get the SyncPlay Manager
        const syncPlay = (window as any).SyncPlay;
        if (syncPlay && __legacyApiClient__) {
            syncPlay.Manager.resumeGroupPlayback(__legacyApiClient__);
        }
    };

    return (
        <div className="syncplay-page">
            <h1>SyncPlay Session</h1>
            <SyncPlayContainer
                apiClient={__legacyApiClient__}
                currentUserId={user?.Id || ''}
                groupId={groupId}
                showLobby={true}
                onStartPlayback={handleStartPlayback}
            />
        </div>
    );
};
```

## Using Individual Components

You can also use the components individually:

### Member List Only

```typescript
import { MemberList } from 'components/syncPlay';
import { useSyncPlayEnhancements } from 'hooks/useSyncPlayEnhancements';

const MyComponent = () => {
    const { group } = useSyncPlayEnhancements({
        apiClient: myApiClient,
        autoLoad: true
    });

    return group ? (
        <MemberList
            members={group.members}
            currentUserId={myApiClient.getCurrentUserId()}
        />
    ) : null;
};
```

### Chat Panel Only

```typescript
import { ChatPanel } from 'components/syncPlay';
import { useSyncPlayEnhancements } from 'hooks/useSyncPlayEnhancements';

const MyComponent = () => {
    const { messages, sendMessage } = useSyncPlayEnhancements({
        apiClient: myApiClient,
        autoLoad: true
    });

    return (
        <ChatPanel
            messages={messages}
            currentUserId={myApiClient.getCurrentUserId()}
            onSendMessage={sendMessage}
        />
    );
};
```

### Lobby Screen Only

```typescript
import { LobbyScreen } from 'components/syncPlay';
import { useSyncPlayEnhancements } from 'hooks/useSyncPlayEnhancements';

const MyComponent = () => {
    const { group, setReady } = useSyncPlayEnhancements({
        apiClient: myApiClient,
        autoLoad: true
    });

    const currentMember = group?.members.find(
        m => m.userId === myApiClient.getCurrentUserId()
    );

    return group ? (
        <LobbyScreen
            members={group.members}
            currentUserId={myApiClient.getCurrentUserId()}
            isReady={currentMember?.isReady || false}
            onToggleReady={setReady}
            onStartPlayback={() => {
                // Start playback
            }}
        />
    ) : null;
};
```

## Testing the Integration

1. **Start the Jellyfin server** with SyncPlay enhancements at `http://localhost:8096`

2. **Build and run the web client**:
   ```bash
   npm install
   npm run dev
   ```

3. **Create a SyncPlay group**:
   - Click the SyncPlay button in the toolbar
   - Click "Create new group"

4. **Test the features**:
   - Open the SyncPlay dialog/page
   - See member list with ping and buffering status
   - Send chat messages
   - Toggle ready state in lobby
   - Start playback when all ready

## API Reference

### useSyncPlayEnhancements Hook

```typescript
const {
    group,           // Current group info with members
    messages,        // Chat message history
    isLoading,       // Loading state
    isConnected,     // WebSocket connection state
    error,           // Error state
    reloadGroup,     // Reload group info
    reloadChat,      // Reload chat history
    sendMessage,     // Send a chat message
    setReady         // Set ready state
} = useSyncPlayEnhancements({
    apiClient,       // Required: Jellyfin API client
    groupId,         // Optional: Group ID
    autoLoad,        // Optional: Auto-load data (default: true)
    pollingInterval  // Optional: Polling interval in ms (default: 0 = disabled)
});
```

### Component Props

See the TypeScript definitions in each component file for detailed prop types.

## Next Steps

1. Choose an integration approach (dialog, settings, or standalone page)
2. Add the components to your chosen location
3. Test with the enhanced server
4. Customize styling to match your UI theme
5. Add any additional features or customizations

## Notes

- The components are fully typed with TypeScript
- All components are responsive and mobile-friendly
- Dark/light theme support is built-in
- WebSocket updates are automatic via the hook
- The integration is backward compatible with existing SyncPlay functionality

