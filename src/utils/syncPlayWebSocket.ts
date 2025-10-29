/**
 * SyncPlay WebSocket Handler
 * 
 * Handles WebSocket communication for enhanced SyncPlay features.
 * Extends the existing SyncPlay WebSocket functionality to support:
 * - Phase 2: Chat message updates
 * - Phase 3: Ready state updates
 */

import Events from './events';
import type {
    GroupUpdate,
    GroupUpdateType,
    ChatMessage,
    ReadyUpdate,
    SyncPlayChatMessageUpdate,
    SyncPlayReadyUpdate
} from '../types/syncPlay';

/**
 * Event handler type for group updates
 */
export type GroupUpdateHandler<T = unknown> = (data: T) => void;

/**
 * WebSocket handler for SyncPlay enhancements
 */
export class SyncPlayWebSocketHandler {
    private handlers: Map<string, GroupUpdateHandler[]>;
    private apiClient: any;
    private isInitialized: boolean;

    constructor() {
        this.handlers = new Map();
        this.apiClient = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the WebSocket handler with an API client
     * @param apiClient The Jellyfin API client
     */
    init(apiClient: any): void {
        if (this.isInitialized) {
            console.warn('SyncPlayWebSocketHandler already initialized');
            return;
        }

        this.apiClient = apiClient;
        this.setupWebSocketListeners();
        this.isInitialized = true;
    }

    /**
     * Set up WebSocket listeners for SyncPlay updates
     */
    private setupWebSocketListeners(): void {
        if (!this.apiClient) {
            console.error('API client not set');
            return;
        }

        // Hook into the existing SyncPlay message processing
        // The apiClient should have a method to listen for SyncPlay group updates
        if (typeof this.apiClient.onSyncPlayGroupUpdate === 'function') {
            this.apiClient.onSyncPlayGroupUpdate = (cmd: GroupUpdate) => {
                this.processGroupUpdate(cmd);
            };
        }
    }

    /**
     * Process incoming group updates
     * @param update The group update message
     */
    private processGroupUpdate(update: GroupUpdate): void {
        const { type, data } = update;

        // Handle new message types
        switch (type) {
            case 'ChatMessage':
                this.handleChatMessage(data as ChatMessage);
                break;
            case 'UserReady':
                this.handleReadyUpdate(data as ReadyUpdate);
                break;
            default:
                // Let other handlers process unknown types
                this.emit(type, data);
                break;
        }
    }

    /**
     * Handle chat message updates
     * @param message The chat message
     */
    private handleChatMessage(message: ChatMessage): void {
        console.debug('SyncPlay: Chat message received', message);
        this.emit('ChatMessage', message);
        this.emit('chat-message', message); // Alternative event name
    }

    /**
     * Handle ready state updates
     * @param update The ready state update
     */
    private handleReadyUpdate(update: ReadyUpdate): void {
        console.debug('SyncPlay: Ready state update', update);
        this.emit('UserReady', update);
        this.emit('user-ready', update); // Alternative event name
    }

    /**
     * Register a handler for a specific update type
     * @param type The update type to listen for
     * @param handler The handler function
     */
    on<T = unknown>(type: string, handler: GroupUpdateHandler<T>): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler as GroupUpdateHandler);
    }

    /**
     * Unregister a handler for a specific update type
     * @param type The update type
     * @param handler The handler function to remove
     */
    off<T = unknown>(type: string, handler: GroupUpdateHandler<T>): void {
        const handlers = this.handlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler as GroupUpdateHandler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event to all registered handlers
     * @param type The event type
     * @param data The event data
     */
    private emit<T = unknown>(type: string, data: T): void {
        const handlers = this.handlers.get(type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in SyncPlay handler for ${type}:`, error);
                }
            });
        }
    }

    /**
     * Register a one-time handler for a specific update type
     * @param type The update type to listen for
     * @param handler The handler function
     */
    once<T = unknown>(type: string, handler: GroupUpdateHandler<T>): void {
        const onceHandler: GroupUpdateHandler<T> = (data: T) => {
            handler(data);
            this.off(type, onceHandler);
        };
        this.on(type, onceHandler);
    }

    /**
     * Clear all handlers for a specific type
     * @param type The update type
     */
    clearHandlers(type?: string): void {
        if (type) {
            this.handlers.delete(type);
        } else {
            this.handlers.clear();
        }
    }

    /**
     * Disconnect and clean up
     */
    disconnect(): void {
        this.clearHandlers();
        this.isInitialized = false;
        this.apiClient = null;
    }

    /**
     * Check if the handler is connected
     */
    isConnected(): boolean {
        return this.isInitialized && this.apiClient != null;
    }
}

/**
 * Singleton instance for global use
 */
let globalHandler: SyncPlayWebSocketHandler | null = null;

/**
 * Get the global WebSocket handler instance
 * @returns The global handler instance
 */
export function getGlobalHandler(): SyncPlayWebSocketHandler {
    if (!globalHandler) {
        globalHandler = new SyncPlayWebSocketHandler();
    }
    return globalHandler;
}

/**
 * Initialize the global WebSocket handler
 * @param apiClient The Jellyfin API client
 */
export function initGlobalHandler(apiClient: any): void {
    const handler = getGlobalHandler();
    handler.init(apiClient);
}

/**
 * Helper function to register a chat message handler
 * @param handler The handler function
 * @returns Function to unregister the handler
 */
export function onChatMessage(handler: GroupUpdateHandler<ChatMessage>): () => void {
    const globalHandler = getGlobalHandler();
    globalHandler.on('chat-message', handler);
    return () => globalHandler.off('chat-message', handler);
}

/**
 * Helper function to register a ready state handler
 * @param handler The handler function
 * @returns Function to unregister the handler
 */
export function onReadyUpdate(handler: GroupUpdateHandler<ReadyUpdate>): () => void {
    const globalHandler = getGlobalHandler();
    globalHandler.on('user-ready', handler);
    return () => globalHandler.off('user-ready', handler);
}

/**
 * Helper function to register a generic group update handler
 * @param type The update type
 * @param handler The handler function
 * @returns Function to unregister the handler
 */
export function onGroupUpdate<T = unknown>(
    type: string,
    handler: GroupUpdateHandler<T>
): () => void {
    const globalHandler = getGlobalHandler();
    globalHandler.on(type, handler);
    return () => globalHandler.off(type, handler);
}

export default SyncPlayWebSocketHandler;

