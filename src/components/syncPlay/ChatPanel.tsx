/* eslint-disable @stylistic/jsx-quotes, react/jsx-no-bind, @typescript-eslint/no-floating-promises */

/**
 * SyncPlay Chat Panel Component
 *
 * Real-time chat interface for SyncPlay groups.
 * Displays message history and allows sending new messages.
 *
 * Part of Phase 2: Chat/Messaging System
 */

import React, { useState, useRef, useEffect } from 'react';
import { formatMessageTime, type ChatMessage } from '../../types/syncPlay';
import { isValidChatMessage, sanitizeChatMessage } from '../../utils/syncPlayApi';
import './ChatPanel.scss';

export interface ChatPanelProps {
    /** Array of chat messages */
    messages: ChatMessage[];

    /** Current user's ID */
    currentUserId: string;

    /** Callback when user sends a message */
    onSendMessage: (message: string) => void;

    /** Whether the chat is loading */
    isLoading?: boolean;

    /** Whether sending is disabled */
    disabled?: boolean;

    /** Custom class name */
    className?: string;
}

/**
 * Chat Panel Component
 */
const ChatPanel: React.FC<ChatPanelProps> = ({
    messages,
    currentUserId,
    onSendMessage,
    isLoading = false,
    disabled = false,
    className = ''
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedMessage = inputValue.trim();
        if (!trimmedMessage || !isValidChatMessage(trimmedMessage)) {
            return;
        }

        setIsSending(true);
        try {
            const sanitized = sanitizeChatMessage(trimmedMessage);
            await onSendMessage(sanitized);
            setInputValue('');
            inputRef.current?.focus();
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit(e as unknown as React.FormEvent);
        }
    };

    return (
        <div className={`syncplay-chat-panel ${className}`}>
            <div className="chat-header">
                <h3>Chat</h3>
                {messages.length > 0 && (
                    <span className="message-count">{messages.length}</span>
                )}
            </div>

            <div className="chat-messages">
                {isLoading ? (
                    <div className="chat-loading">
                        <div className="spinner" />
                        <p>Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="chat-empty">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <ChatMessageItem
                                key={message.messageId}
                                message={message}
                                isOwnMessage={message.userId === currentUserId}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    className="chat-input"
                    placeholder="Type a message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={disabled || isSending}
                    maxLength={500}
                    aria-label="Chat message input"
                />
                <button
                    type="submit"
                    className="send-button"
                    disabled={disabled || isSending || !inputValue.trim()}
                    aria-label="Send message"
                >
                    {isSending ? (
                        <i className="material-icons">hourglass_empty</i>
                    ) : (
                        <i className="material-icons">send</i>
                    )}
                </button>
            </form>
        </div>
    );
};

interface ChatMessageItemProps {
    message: ChatMessage;
    isOwnMessage: boolean;
}

/**
 * Individual chat message item
 */
const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
    message,
    isOwnMessage
}) => {
    const formattedTime = formatMessageTime(message.timestamp);

    if (message.isSystemMessage) {
        return (
            <div className="chat-message system-message">
                <span className="message-text">{message.message}</span>
                <span className="message-time">{formattedTime}</span>
            </div>
        );
    }

    return (
        <div
            className={`chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`}
            data-message-id={message.messageId}
        >
            <div className="message-header">
                <span className="message-author">
                    {isOwnMessage ? 'You' : message.userName}
                </span>
                <span className="message-time">{formattedTime}</span>
            </div>
            <div className="message-content">
                <p className="message-text">{message.message}</p>
            </div>
        </div>
    );
};

export default ChatPanel;

