/**
 * SyncPlay Enhancement Types
 * 
 * Type definitions for the enhanced SyncPlay features including:
 * - Phase 1: Enhanced member information
 * - Phase 2: Chat/messaging system
 * - Phase 3: Lobby and ready system
 */

// ============================================================================
// Phase 1: Enhanced Member Information
// ============================================================================

/**
 * Detailed information about a group member
 */
export interface GroupMemberInfo {
    /** Unique identifier for the user */
    userId: string;
    
    /** Display name of the user */
    userName: string;
    
    /** Network latency in milliseconds */
    ping: number;
    
    /** Whether the member is currently buffering */
    isBuffering: boolean;
    
    /** Whether the member is ready (lobby state) */
    isReady: boolean;
}

/**
 * Enhanced group information with member details
 */
export interface GroupInfo {
    /** Unique identifier for the group */
    groupId: string;
    
    /** Name of the group */
    groupName: string;
    
    /** Current playback state */
    state: string;
    
    /** List of participant session IDs */
    participants: string[];
    
    /** Timestamp of last update */
    lastUpdatedAt: string;
    
    /** Detailed information about all members */
    members: GroupMemberInfo[];
}

// ============================================================================
// Phase 2: Chat/Messaging System
// ============================================================================

/**
 * A chat message in a SyncPlay group
 */
export interface ChatMessage {
    /** Unique identifier for the message */
    messageId: string;
    
    /** Group this message belongs to */
    groupId: string;
    
    /** User who sent the message */
    userId: string;
    
    /** Display name of the sender */
    userName: string;
    
    /** Message content */
    message: string;
    
    /** ISO 8601 timestamp */
    timestamp: string;
    
    /** Whether this is a system-generated message */
    isSystemMessage: boolean;
}

/**
 * Request to send a chat message
 */
export interface SendChatMessageRequest {
    /** Message content to send */
    message: string;
}

/**
 * WebSocket update containing a chat message
 */
export interface SyncPlayChatMessageUpdate {
    /** Type identifier */
    type: 'ChatMessage';
    
    /** The chat message */
    data: ChatMessage;
}

// ============================================================================
// Phase 3: Lobby & Ready System
// ============================================================================

/**
 * Request to set ready state in lobby
 */
export interface SetReadyRequest {
    /** Whether the user is ready */
    isReady: boolean;
}

/**
 * Information about a ready state change
 */
export interface ReadyUpdate {
    /** User whose ready state changed */
    userId: string;
    
    /** Display name of the user */
    userName: string;
    
    /** New ready state */
    isReady: boolean;
    
    /** Whether all members are now ready */
    allReady: boolean;
}

/**
 * WebSocket update containing ready state change
 */
export interface SyncPlayReadyUpdate {
    /** Type identifier */
    type: 'UserReady';
    
    /** Ready state information */
    data: ReadyUpdate;
}

// ============================================================================
// WebSocket Updates
// ============================================================================

/**
 * Types of group updates that can be received via WebSocket
 */
export enum GroupUpdateType {
    // Existing types (from original SyncPlay)
    GroupJoined = 'GroupJoined',
    GroupLeft = 'GroupLeft',
    GroupUpdate = 'GroupUpdate',
    StateUpdate = 'StateUpdate',
    PlayQueue = 'PlayQueue',
    NotInGroup = 'NotInGroup',
    GroupDoesNotExist = 'GroupDoesNotExist',
    CreateGroupDenied = 'CreateGroupDenied',
    JoinGroupDenied = 'JoinGroupDenied',
    LibraryAccessDenied = 'LibraryAccessDenied',
    UserJoined = 'UserJoined',
    UserLeft = 'UserLeft',
    GroupWait = 'GroupWait',
    PrepareSession = 'PrepareSession',
    BufferingDone = 'BufferingDone',
    
    // New types from enhancements
    /** Chat message update (Phase 2) */
    ChatMessage = 'ChatMessage',
    
    /** User ready state update (Phase 3) */
    UserReady = 'UserReady'
}

/**
 * Generic group update wrapper
 */
export interface GroupUpdate<T = unknown> {
    /** Group identifier */
    groupId: string;
    
    /** Type of update */
    type: GroupUpdateType | string;
    
    /** Update data */
    data: T;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Ping quality classification
 */
export enum PingQuality {
    Excellent = 'excellent',
    Good = 'good',
    Fair = 'fair',
    Poor = 'poor'
}

/**
 * Helper function to classify ping quality
 */
export function getPingQuality(ping: number): PingQuality {
    if (ping < 50) return PingQuality.Excellent;
    if (ping < 100) return PingQuality.Good;
    if (ping < 200) return PingQuality.Fair;
    return PingQuality.Poor;
}

/**
 * Helper function to get ping quality label
 */
export function getPingQualityLabel(ping: number): string {
    const quality = getPingQuality(ping);
    switch (quality) {
        case PingQuality.Excellent: return 'Excellent';
        case PingQuality.Good: return 'Good';
        case PingQuality.Fair: return 'Fair';
        case PingQuality.Poor: return 'Poor';
    }
}

/**
 * Helper function to get ping quality color
 */
export function getPingQualityColor(ping: number): string {
    const quality = getPingQuality(ping);
    switch (quality) {
        case PingQuality.Excellent: return 'green';
        case PingQuality.Good: return 'yellow';
        case PingQuality.Fair: return 'orange';
        case PingQuality.Poor: return 'red';
    }
}

/**
 * Helper function to format timestamp
 */
export function formatMessageTime(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

/**
 * Helper function to check if all members are ready
 */
export function areAllMembersReady(members: GroupMemberInfo[]): boolean {
    return members.length > 0 && members.every(m => m.isReady);
}

/**
 * Helper function to count ready members
 */
export function countReadyMembers(members: GroupMemberInfo[]): number {
    return members.filter(m => m.isReady).length;
}

