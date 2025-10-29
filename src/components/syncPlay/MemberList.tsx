/**
 * SyncPlay Member List Component
 * 
 * Displays detailed information about all members in a SyncPlay group.
 * Shows ping, buffering status, and ready state for each member.
 * 
 * Part of Phase 1: Enhanced Member Information
 */

import React from 'react';
import type { GroupMemberInfo } from '../../types/syncPlay';
import {
    getPingQuality,
    getPingQualityLabel,
    getPingQualityColor
} from '../../types/syncPlay';
import './MemberList.scss';

export interface MemberListProps {
    /** Array of group members */
    members: GroupMemberInfo[];
    
    /** Current user's ID to highlight */
    currentUserId?: string;
    
    /** Whether to show detailed ping information */
    showDetailedPing?: boolean;
    
    /** Custom class name */
    className?: string;
}

/**
 * Member List Component
 */
const MemberList: React.FC<MemberListProps> = ({
    members,
    currentUserId,
    showDetailedPing = true,
    className = ''
}) => {
    if (!members || members.length === 0) {
        return (
            <div className={`syncplay-member-list empty ${className}`}>
                <p className="empty-message">No members in group</p>
            </div>
        );
    }

    return (
        <div className={`syncplay-member-list ${className}`}>
            <div className="member-list-header">
                <h3>Members ({members.length})</h3>
            </div>
            
            <ul className="member-list">
                {members.map((member) => (
                    <MemberListItem
                        key={member.userId}
                        member={member}
                        isCurrentUser={member.userId === currentUserId}
                        showDetailedPing={showDetailedPing}
                    />
                ))}
            </ul>
        </div>
    );
};

interface MemberListItemProps {
    member: GroupMemberInfo;
    isCurrentUser: boolean;
    showDetailedPing: boolean;
}

/**
 * Individual member list item
 */
const MemberListItem: React.FC<MemberListItemProps> = ({
    member,
    isCurrentUser,
    showDetailedPing
}) => {
    const pingQuality = getPingQuality(member.ping);
    const pingColor = getPingQualityColor(member.ping);
    const pingLabel = getPingQualityLabel(member.ping);

    return (
        <li
            className={`member-item ${isCurrentUser ? 'current-user' : ''}`}
            data-user-id={member.userId}
        >
            <div className="member-info">
                <div className="member-name-row">
                    <span className="member-name">
                        {member.userName}
                        {isCurrentUser && <span className="you-badge">(You)</span>}
                    </span>
                    
                    <div className="member-status-icons">
                        {member.isBuffering && (
                            <span
                                className="status-icon buffering"
                                title="Buffering"
                                aria-label="Buffering"
                            >
                                <i className="material-icons">hourglass_empty</i>
                            </span>
                        )}
                        
                        {member.isReady && (
                            <span
                                className="status-icon ready"
                                title="Ready"
                                aria-label="Ready"
                            >
                                <i className="material-icons">check_circle</i>
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="member-details">
                    <div className={`ping-indicator ping-${pingQuality}`}>
                        <span
                            className="ping-dot"
                            style={{ backgroundColor: pingColor }}
                            aria-hidden="true"
                        />
                        <span className="ping-text">
                            {showDetailedPing ? (
                                <>
                                    {member.ping}ms
                                    <span className="ping-quality"> ({pingLabel})</span>
                                </>
                            ) : (
                                pingLabel
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </li>
    );
};

export default MemberList;

