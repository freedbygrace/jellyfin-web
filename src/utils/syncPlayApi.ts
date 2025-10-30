/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises */

/**
 * SyncPlay API Utilities
 *
 * API client functions for the enhanced SyncPlay features.
 * These functions extend the existing Jellyfin API client to support:
 * - Phase 1: Enhanced member information
 * - Phase 2: Chat/messaging system
 * - Phase 3: Lobby and ready system
 */

import type {
    GroupInfo,
    GroupMemberInfo,
    ChatMessage,
    SendChatMessageRequest,
    SetReadyRequest
} from '../types/syncPlay';

/**
 * Get enhanced group information including member details
 * @param apiClient The Jellyfin API client
 * @param groupId Optional group ID. If not provided, returns current group info
 * @returns Promise resolving to group information
 */
export async function getGroupInfo(
    apiClient: any,
    groupId?: string
): Promise<GroupInfo> {
    const endpoint = groupId
        ? `SyncPlay/${groupId}`
        : 'SyncPlay/List';

    try {
        const response = await apiClient.getJSON(
            apiClient.getUrl(endpoint)
        );
        return response;
    } catch (error) {
        console.error('Failed to get group info:', error);
        throw error;
    }
}

/**
 * Get detailed information about all members in a group
 * @param apiClient The Jellyfin API client
 * @param groupId The group ID
 * @returns Promise resolving to array of member information
 */
export async function getGroupMembers(
    apiClient: any,
    groupId: string
): Promise<GroupMemberInfo[]> {
    try {
        const response = await apiClient.getJSON(
            apiClient.getUrl(`SyncPlay/${groupId}/Members`)
        );
        return response;
    } catch (error) {
        console.error('Failed to get group members:', error);
        throw error;
    }
}

/**
 * Send a chat message to the current SyncPlay group
 * @param apiClient The Jellyfin API client
 * @param message The message text to send
 * @returns Promise that resolves when message is sent
 */
export async function sendChatMessage(
    apiClient: any,
    message: string
): Promise<void> {
    const request: SendChatMessageRequest = { message };

    try {
        await apiClient.ajax({
            type: 'POST',
            url: apiClient.getUrl('SyncPlay/Chat'),
            data: JSON.stringify(request),
            contentType: 'application/json'
        });
    } catch (error) {
        console.error('Failed to send chat message:', error);
        throw error;
    }
}

/**
 * Get chat message history for the current SyncPlay group
 * @param apiClient The Jellyfin API client
 * @returns Promise resolving to array of chat messages
 */
export async function getChatHistory(
    apiClient: any
): Promise<ChatMessage[]> {
    try {
        const response = await apiClient.getJSON(
            apiClient.getUrl('SyncPlay/Chat')
        );
        return response;
    } catch (error) {
        console.error('Failed to get chat history:', error);
        throw error;
    }
}

/**
 * Set the ready state in the lobby
 * @param apiClient The Jellyfin API client
 * @param isReady Whether the user is ready
 * @returns Promise that resolves when ready state is set
 */
export async function setLobbyReady(
    apiClient: any,
    isReady: boolean
): Promise<void> {
    const request: SetReadyRequest = { isReady };

    try {
        await apiClient.ajax({
            type: 'POST',
            url: apiClient.getUrl('SyncPlay/LobbyReady'),
            data: JSON.stringify(request),
            contentType: 'application/json'
        });
    } catch (error) {
        console.error('Failed to set lobby ready state:', error);
        throw error;
    }
}

/**
 * Helper function to handle API errors consistently
 * @param error The error object
 * @param context Description of what operation failed
 */
export function handleApiError(error: any, context: string): void {
    console.error(`${context}:`, error);

    // You can add toast notifications here if needed
    // import toast from '../components/toast/toast';
    // toast(error.message || 'An error occurred');
}

/**
 * Check if the API client is initialized and ready
 * @param apiClient The API client to check
 * @returns True if the client is ready
 */
export function isApiClientReady(apiClient: any): boolean {
    return apiClient != null && typeof apiClient.getUrl === 'function';
}

/**
 * Retry an API call with exponential backoff
 * @param fn The function to retry
 * @param maxAttempts Maximum number of retry attempts
 * @param delay Initial delay in milliseconds
 * @returns Promise resolving to the function result
 */
export async function retryApiCall<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxAttempts) {
                // Exponential backoff
                const waitTime = delay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    throw lastError;
}

/**
 * Batch multiple API calls and return results
 * @param apiClient The Jellyfin API client
 * @param groupId The group ID
 * @returns Promise resolving to all data
 */
export async function fetchAllSyncPlayData(
    apiClient: any,
    groupId?: string
): Promise<{
    groupInfo: GroupInfo;
    chatHistory: ChatMessage[];
}> {
    try {
        const [groupInfo, chatHistory] = await Promise.all([
            getGroupInfo(apiClient, groupId),
            getChatHistory(apiClient)
        ]);

        return { groupInfo, chatHistory };
    } catch (error) {
        console.error('Failed to fetch SyncPlay data:', error);
        throw error;
    }
}

/**
 * Poll for group updates at regular intervals
 * @param apiClient The Jellyfin API client
 * @param groupId The group ID
 * @param callback Function to call with updated data
 * @param interval Polling interval in milliseconds
 * @returns Function to stop polling
 */
export function pollGroupInfo(
    apiClient: any,
    groupId: string | undefined,
    callback: (groupInfo: GroupInfo) => void,
    interval: number = 5000
): () => void {
    let isPolling = true;

    const poll = async () => {
        while (isPolling) {
            try {
                const groupInfo = await getGroupInfo(apiClient, groupId);
                callback(groupInfo);
            } catch (error) {
                console.error('Polling error:', error);
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }
    };

    poll();

    // Return stop function
    return () => {
        isPolling = false;
    };
}

/**
 * Validate message content before sending
 * @param message The message to validate
 * @returns True if message is valid
 */
export function isValidChatMessage(message: string): boolean {
    const trimmed = message.trim();
    return trimmed.length > 0 && trimmed.length <= 500; // Max 500 characters
}

/**
 * Sanitize message content
 * @param message The message to sanitize
 * @returns Sanitized message
 */
export function sanitizeChatMessage(message: string): string {
    return message
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .substring(0, 500); // Enforce max length
}

