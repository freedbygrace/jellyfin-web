/* eslint-disable @stylistic/jsx-quotes */

/**
 * SyncPlay Lobby Screen Component
 *
 * Pre-playback lobby where users can see who's in the group and mark themselves as ready.
 * Playback starts when all members are ready.
 *
 * Part of Phase 3: Lobby & Ready System
 */

import React from 'react';
import type { GroupInfo } from '../../types/syncPlay';
import { areAllMembersReady, countReadyMembers } from '../../types/syncPlay';
import MemberList from './MemberList';
import './LobbyScreen.scss';

export interface LobbyScreenProps {
    /** Group information */
    group: GroupInfo;

    /** Current user's ID */
    currentUserId: string;

    /** Callback when user toggles ready state */
    onToggleReady: (isReady: boolean) => void;

    /** Callback when playback should start */
    onStartPlayback?: () => void;

    /** Whether the user is the group owner */
    isGroupOwner?: boolean;

    /** Custom class name */
    className?: string;
}

/**
 * Lobby Screen Component
 */
const LobbyScreen: React.FC<LobbyScreenProps> = ({
    group,
    currentUserId,
    onToggleReady,
    onStartPlayback,
    className = ''
}) => {
    const currentMember = group.members.find(m => m.userId === currentUserId);
    const isReady = currentMember?.isReady ?? false;
    const allReady = areAllMembersReady(group.members);
    const readyCount = countReadyMembers(group.members);
    const totalCount = group.members.length;

    const handleToggleReady = () => {
        onToggleReady(!isReady);
    };

    const handleStartPlayback = () => {
        if (allReady && onStartPlayback) {
            onStartPlayback();
        }
    };

    return (
        <div className={`syncplay-lobby-screen ${className}`}>
            <div className="lobby-container">
                <header className="lobby-header">
                    <h1 className="lobby-title">{group.groupName}</h1>
                    <p className="lobby-subtitle">
                        Waiting for everyone to be ready...
                    </p>
                </header>

                <div className="lobby-content">
                    <div className="lobby-status-card">
                        <div className="status-icon-container">
                            {allReady ? (
                                <div className="status-icon ready-icon">
                                    <i className="material-icons">check_circle</i>
                                </div>
                            ) : (
                                <div className="status-icon waiting-icon">
                                    <i className="material-icons">hourglass_empty</i>
                                </div>
                            )}
                        </div>

                        <div className="status-text">
                            <h2 className="status-title">
                                {allReady ? 'Everyone is ready!' : 'Waiting for members...'}
                            </h2>
                            <p className="status-description">
                                {readyCount} of {totalCount} members ready
                            </p>
                        </div>

                        <div className="ready-progress">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(readyCount / totalCount) * 100}%` }}
                                />
                            </div>
                            <div className="progress-labels">
                                {group.members.map((member) => (
                                    <div
                                        key={member.userId}
                                        className={`member-indicator ${member.isReady ? 'ready' : 'not-ready'}`}
                                        title={`${member.userName} - ${member.isReady ? 'Ready' : 'Not Ready'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lobby-actions">
                        <button
                            className={`ready-button ${isReady ? 'ready' : 'not-ready'}`}
                            onClick={handleToggleReady}
                            aria-pressed={isReady}
                        >
                            {isReady ? (
                                <>
                                    <i className="material-icons">check_circle</i>
                                    <span>I&apos;m Ready</span>
                                </>
                            ) : (
                                <>
                                    <i className="material-icons">radio_button_unchecked</i>
                                    <span>Mark as Ready</span>
                                </>
                            )}
                        </button>

                        {allReady && onStartPlayback && (
                            <button
                                className="start-button"
                                onClick={handleStartPlayback}
                            >
                                <i className="material-icons">play_arrow</i>
                                <span>Start Playback</span>
                            </button>
                        )}
                    </div>

                    <div className="lobby-members">
                        <MemberList
                            members={group.members}
                            currentUserId={currentUserId}
                            showDetailedPing={true}
                        />
                    </div>
                </div>

                <footer className="lobby-footer">
                    <p className="lobby-hint">
                        <i className="material-icons">info</i>
                        Click "Mark as Ready" when you're prepared to start watching
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default LobbyScreen;

