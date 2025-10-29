/**
 * SyncPlay Container Component
 * 
 * Main container that integrates all SyncPlay enhancement features:
 * - Phase 1: Enhanced member information
 * - Phase 2: Chat/messaging system
 * - Phase 3: Lobby and ready system
 * 
 * This component manages state and coordinates between all sub-components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { GroupInfo, ChatMessage, ReadyUpdate } from '../../types/syncPlay';
import {
    getGroupInfo,
    getChatHistory,
    sendChatMessage,
    setLobbyReady
} from '../../utils/syncPlayApi';
import {
    SyncPlayWebSocketHandler,
    onChatMessage,
    onReadyUpdate
} from '../../utils/syncPlayWebSocket';
import LobbyScreen from './LobbyScreen';
import MemberList from './MemberList';
import ChatPanel from './ChatPanel';
import './SyncPlayContainer.scss';

export interface SyncPlayContainerProps {
    /** The Jellyfin API client */
    apiClient: any;
    
    /** Current user's ID */
    currentUserId: string;
    
    /** Optional group ID */
    groupId?: string;
    
    /** Whether to show lobby initially */
    showLobby?: boolean;
    
    /** Callback when playback should start */
    onStartPlayback?: () => void;
    
    /** Custom class name */
    className?: string;
}

/**
 * SyncPlay Container Component
 */
const SyncPlayContainer: React.FC<SyncPlayContainerProps> = ({
    apiClient,
    currentUserId,
    groupId,
    showLobby: initialShowLobby = true,
    onStartPlayback,
    className = ''
}) => {
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [showLobby, setShowLobby] = useState(initialShowLobby);
    const [wsHandler] = useState(() => new SyncPlayWebSocketHandler());

    // Load initial data
    useEffect(() => {
        loadData();
        setupWebSocket();

        return () => {
            wsHandler.disconnect();
        };
    }, [groupId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [groupData, chatData] = await Promise.all([
                getGroupInfo(apiClient, groupId),
                getChatHistory(apiClient)
            ]);
            setGroup(groupData);
            setMessages(chatData);
        } catch (error) {
            console.error('Failed to load SyncPlay data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const setupWebSocket = () => {
        wsHandler.init(apiClient);
        setIsConnected(true);

        // Listen for chat messages
        const unsubChat = onChatMessage((message: ChatMessage) => {
            setMessages(prev => [...prev, message]);
        });

        // Listen for ready state updates
        const unsubReady = onReadyUpdate((update: ReadyUpdate) => {
            setGroup(prev => {
                if (!prev) return prev;
                
                // Update the member's ready state
                const updatedMembers = prev.members.map(member =>
                    member.userId === update.userId
                        ? { ...member, isReady: update.isReady }
                        : member
                );

                return {
                    ...prev,
                    members: updatedMembers
                };
            });
        });

        return () => {
            unsubChat();
            unsubReady();
        };
    };

    const handleSendMessage = useCallback(async (message: string) => {
        try {
            await sendChatMessage(apiClient, message);
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }, [apiClient]);

    const handleToggleReady = useCallback(async (isReady: boolean) => {
        try {
            await setLobbyReady(apiClient, isReady);
            
            // Optimistically update local state
            setGroup(prev => {
                if (!prev) return prev;
                
                const updatedMembers = prev.members.map(member =>
                    member.userId === currentUserId
                        ? { ...member, isReady }
                        : member
                );

                return {
                    ...prev,
                    members: updatedMembers
                };
            });
        } catch (error) {
            console.error('Failed to set ready state:', error);
        }
    }, [apiClient, currentUserId]);

    const handleStartPlayback = useCallback(() => {
        setShowLobby(false);
        if (onStartPlayback) {
            onStartPlayback();
        }
    }, [onStartPlayback]);

    if (isLoading || !group) {
        return (
            <div className={`syncplay-container loading ${className}`}>
                <div className="loading-content">
                    <div className="spinner" />
                    <p>Loading SyncPlay session...</p>
                </div>
            </div>
        );
    }

    if (showLobby) {
        return (
            <LobbyScreen
                group={group}
                currentUserId={currentUserId}
                onToggleReady={handleToggleReady}
                onStartPlayback={handleStartPlayback}
                className={className}
            />
        );
    }

    return (
        <div className={`syncplay-container ${className}`}>
            <div className="syncplay-main">
                <div className="video-section">
                    {/* Video player would go here */}
                    <div className="video-placeholder">
                        <p>Video Player</p>
                    </div>
                    
                    <div className="connection-status">
                        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                        <span className="status-text">
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>

                <div className="sidebar">
                    <div className="sidebar-content">
                        <div className="sidebar-section">
                            <MemberList
                                members={group.members}
                                currentUserId={currentUserId}
                                showDetailedPing={true}
                            />
                        </div>
                        
                        <div className="sidebar-section">
                            <ChatPanel
                                messages={messages}
                                currentUserId={currentUserId}
                                onSendMessage={handleSendMessage}
                                disabled={!isConnected}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyncPlayContainer;

