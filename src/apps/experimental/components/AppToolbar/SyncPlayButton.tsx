import type { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client/models/group-info-dto';
import { SyncPlayUserAccessType } from '@jellyfin/sdk/lib/generated-client/models/sync-play-user-access-type';
import Groups from '@mui/icons-material/Groups';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, { useCallback, useEffect, useState } from 'react';

import { pluginManager } from 'components/pluginManager';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { PluginType } from 'types/plugin';
import Events, { Event } from 'utils/events';

import AppSyncPlayMenu, { ID } from './menus/SyncPlayMenu';
import SyncPlayDialog from './SyncPlayDialog';

interface SyncPlayInstance {
    Manager: {
        getGroupInfo: () => GroupInfoDto | null | undefined;
    };
}

const SyncPlayButton = () => {
    const { user } = useApi();

    const [syncPlayMenuAnchorEl, setSyncPlayMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [syncPlayDialogOpen, setSyncPlayDialogOpen] = useState(false);
    const [syncPlay, setSyncPlay] = useState<SyncPlayInstance>();
    const [currentGroup, setCurrentGroup] = useState<GroupInfoDto>();
    const [memberCount, setMemberCount] = useState(0);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    const isSyncPlayMenuOpen = Boolean(syncPlayMenuAnchorEl);
    const isInGroup = Boolean(currentGroup);

    useEffect(() => {
        setSyncPlay(pluginManager.firstOfType(PluginType.SyncPlay)?.instance);
    }, []);

    const updateSyncPlayGroup = useCallback((_e: Event, enabled: boolean) => {
        if (syncPlay && enabled) {
            const group = syncPlay.Manager.getGroupInfo();
            setCurrentGroup(group ?? undefined);
            setMemberCount(group?.Participants?.length || 0);
        } else {
            setCurrentGroup(undefined);
            setMemberCount(0);
        }
    }, [syncPlay]);

    const handleChatMessage = useCallback(() => {
        // Set unread flag when a new message arrives and dialog is closed
        if (!syncPlayDialogOpen) {
            setHasUnreadMessages(true);
        }
    }, [syncPlayDialogOpen]);

    useEffect(() => {
        if (!syncPlay) return;

        Events.on(syncPlay.Manager, 'enabled', updateSyncPlayGroup);
        Events.on(syncPlay.Manager, 'syncplay-chatmessage', handleChatMessage);

        // Initialize current group
        const group = syncPlay.Manager.getGroupInfo();
        if (group) {
            setCurrentGroup(group);
            setMemberCount(group.Participants?.length || 0);
        }

        return () => {
            Events.off(syncPlay.Manager, 'enabled', updateSyncPlayGroup);
            Events.off(syncPlay.Manager, 'syncplay-chatmessage', handleChatMessage);
        };
    }, [updateSyncPlayGroup, syncPlay, handleChatMessage]);

    const onSyncPlayButtonClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        // If in a group, open the dialog; otherwise open the menu
        if (isInGroup) {
            setSyncPlayDialogOpen(true);
            setHasUnreadMessages(false); // Clear unread flag when opening dialog
        } else {
            setSyncPlayMenuAnchorEl(event.currentTarget);
        }
    }, [isInGroup]);

    const onSyncPlayMenuClose = useCallback(() => {
        setSyncPlayMenuAnchorEl(null);
    }, []);

    const onSyncPlayDialogClose = useCallback(() => {
        setSyncPlayDialogOpen(false);
    }, []);

    if (
        // SyncPlay not enabled for user
        (user?.Policy && user.Policy.SyncPlayAccess === SyncPlayUserAccessType.None)
        // SyncPlay plugin is not loaded
        || pluginManager.ofType(PluginType.SyncPlay).length === 0
    ) {
        return null;
    }

    const tooltipTitle = isInGroup ?
        `${globalize.translate('ButtonSyncPlay')}: ${currentGroup?.GroupName || ''}` :
        globalize.translate('ButtonSyncPlay');

    return (
        <>
            <Tooltip title={tooltipTitle}>
                <IconButton
                    size='large'
                    aria-label={globalize.translate('ButtonSyncPlay')}
                    aria-controls={ID}
                    aria-haspopup='true'
                    onClick={onSyncPlayButtonClick}
                    color={isInGroup ? 'primary' : 'inherit'}
                >
                    <Badge
                        badgeContent={memberCount}
                        color='primary'
                        invisible={!isInGroup}
                    >
                        <Badge
                            variant="dot"
                            color='error'
                            invisible={!hasUnreadMessages}
                        >
                            <Groups />
                        </Badge>
                    </Badge>
                </IconButton>
            </Tooltip>

            <AppSyncPlayMenu
                open={isSyncPlayMenuOpen}
                anchorEl={syncPlayMenuAnchorEl}
                onMenuClose={onSyncPlayMenuClose}
            />

            <SyncPlayDialog
                open={syncPlayDialogOpen}
                onClose={onSyncPlayDialogClose}
            />
        </>
    );
};

export default SyncPlayButton;
