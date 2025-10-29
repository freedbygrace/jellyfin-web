/**
 * SyncPlay Enhancements Hook
 * 
 * React hook for using the enhanced SyncPlay features.
 * Integrates with the existing SyncPlay plugin system.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Events from '../utils/events';
import type {
    GroupInfo,
    ChatMessage,
    ReadyUpdate
} from '../types/syncPlay';
import {
    getGroupInfo,
    getChatHistory,
    sendChatMessage as sendChatMessageApi,
    setLobbyReady as setLobbyReadyApi
} from '../utils/syncPlayApi';

export interface UseSyncPlayEnhancementsOptions {
    /** The Jellyfin API client */
    apiClient: any;
    
    /** Optional group ID */
    groupId?: string;
    
    /** Whether to auto-load data on mount */
    autoLoad?: boolean;
    
    /** Polling interval for group info (0 to disable) */
    pollingInterval?: number;
}

export interface UseSyncPlayEnhancementsReturn {
    /** Current group information */
    group: GroupInfo | null;
    
    /** Chat message history */
    messages: ChatMessage[];
    
    /** Whether data is loading */
    isLoading: boolean;
    
    /** Whether WebSocket is connected */
    isConnected: boolean;
    
    /** Error state */
    error: Error | null;
    
    /** Reload group information */
    reloadGroup: () => Promise<void>;
    
    /** Reload chat history */
    reloadChat: () => Promise<void>;
    
    /** Send a chat message */
    sendMessage: (message: string) => Promise<void>;
    
    /** Set ready state */
    setReady: (isReady: boolean) => Promise<void>;
}

/**
 * Hook for using SyncPlay enhancements
 */
export function useSyncPlayEnhancements(
    options: UseSyncPlayEnhancementsOptions
): UseSyncPlayEnhancementsReturn {
    const {
        apiClient,
        groupId,
        autoLoad = true,
        pollingInterval = 0
    } = options;

    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    const pollingIntervalRef = useRef<number | null>(null);
    const isMountedRef = useRef(true);

    // Load group information
    const reloadGroup = useCallback(async () => {
        if (!apiClient) return;

        try {
            setError(null);
            const groupData = await getGroupInfo(apiClient, groupId);
            if (isMountedRef.current) {
                setGroup(groupData);
            }
        } catch (err) {
            console.error('Failed to load group info:', err);
            if (isMountedRef.current) {
                setError(err as Error);
            }
        }
    }, [apiClient, groupId]);

    // Load chat history
    const reloadChat = useCallback(async () => {
        if (!apiClient) return;

        try {
            setError(null);
            const chatData = await getChatHistory(apiClient);
            if (isMountedRef.current) {
                setMessages(chatData);
            }
        } catch (err) {
            console.error('Failed to load chat history:', err);
            if (isMountedRef.current) {
                setError(err as Error);
            }
        }
    }, [apiClient]);

    // Send a chat message
    const sendMessage = useCallback(async (message: string) => {
        if (!apiClient) {
            throw new Error('API client not available');
        }

        try {
            setError(null);
            await sendChatMessageApi(apiClient, message);
        } catch (err) {
            console.error('Failed to send message:', err);
            setError(err as Error);
            throw err;
        }
    }, [apiClient]);

    // Set ready state
    const setReady = useCallback(async (isReady: boolean) => {
        if (!apiClient) {
            throw new Error('API client not available');
        }

        try {
            setError(null);
            await setLobbyReadyApi(apiClient, isReady);
            
            // Optimistically update local state
            setGroup(prev => {
                if (!prev) return prev;
                
                const currentUserId = apiClient.getCurrentUserId();
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
        } catch (err) {
            console.error('Failed to set ready state:', err);
            setError(err as Error);
            throw err;
        }
    }, [apiClient]);

    // Initial load
    useEffect(() => {
        if (!autoLoad || !apiClient) return;

        const loadData = async () => {
            setIsLoading(true);
            try {
                await Promise.all([reloadGroup(), reloadChat()]);
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
            }
        };

        loadData();
    }, [autoLoad, apiClient, reloadGroup, reloadChat]);

    // Set up polling
    useEffect(() => {
        if (pollingInterval <= 0 || !apiClient) return;

        pollingIntervalRef.current = window.setInterval(() => {
            reloadGroup();
        }, pollingInterval);

        return () => {
            if (pollingIntervalRef.current !== null) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [pollingInterval, apiClient, reloadGroup]);

    // Listen for WebSocket events from the existing SyncPlay Manager
    useEffect(() => {
        if (!apiClient) return;

        // Try to get the SyncPlay Manager instance
        // This assumes the SyncPlay plugin exports its Manager
        const syncPlayManager = (window as any).SyncPlay?.Manager;
        
        if (!syncPlayManager) {
            console.warn('SyncPlay Manager not found');
            return;
        }

        setIsConnected(true);

        // Listen for chat messages
        const handleChatMessage = (_event: any, message: ChatMessage) => {
            if (isMountedRef.current) {
                setMessages(prev => [...prev, message]);
            }
        };

        // Listen for ready state updates
        const handleReadyUpdate = (_event: any, update: ReadyUpdate) => {
            if (isMountedRef.current) {
                setGroup(prev => {
                    if (!prev) return prev;
                    
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
            }
        };

        // Subscribe to events
        Events.on(syncPlayManager, 'syncplay-chatmessage', handleChatMessage);
        Events.on(syncPlayManager, 'syncplay-userready', handleReadyUpdate);

        return () => {
            Events.off(syncPlayManager, 'syncplay-chatmessage', handleChatMessage);
            Events.off(syncPlayManager, 'syncplay-userready', handleReadyUpdate);
        };
    }, [apiClient]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return {
        group,
        messages,
        isLoading,
        isConnected,
        error,
        reloadGroup,
        reloadChat,
        sendMessage,
        setReady
    };
}

