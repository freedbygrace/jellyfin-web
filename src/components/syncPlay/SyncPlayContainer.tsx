/* eslint-disable @typescript-eslint/no-explicit-any, @stylistic/jsx-quotes */

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

import React, { useState, useCallback } from 'react';
import { useSyncPlayEnhancements } from '../../hooks/useSyncPlayEnhancements';
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
    const [showLobby, setShowLobby] = useState(initialShowLobby);

    // Use the SyncPlay enhancements hook
    const {
        group,
        messages,
        isLoading,
        isConnected,
        sendMessage,
        setReady
    } = useSyncPlayEnhancements({
        apiClient,
        groupId,
        autoLoad: true
    });

    const handleSendMessage = useCallback(async (message: string) => {
        try {
            await sendMessage(message);
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }, [sendMessage]);

    const handleToggleReady = useCallback(async (isReady: boolean) => {
        try {
            await setReady(isReady);
        } catch (error) {
            console.error('Failed to set ready state:', error);
        }
    }, [setReady]);

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

