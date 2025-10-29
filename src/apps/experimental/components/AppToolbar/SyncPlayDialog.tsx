import type { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client/models/group-info-dto';
import type { GroupMemberInfoDto } from '@jellyfin/sdk/lib/generated-client/models/group-member-info-dto';
import Close from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Box from '@mui/material/Box';
import type { ApiClient } from 'jellyfin-apiclient';
import React, { FC, useCallback, useEffect, useState } from 'react';

import { pluginManager } from 'components/pluginManager';
import { MemberList, ChatPanel, LobbyScreen } from 'components/syncPlay';
import type { GroupMemberInfo, GroupInfo } from 'types/syncPlay';
import { useApi } from 'hooks/useApi';
import { useSyncPlayEnhancements } from 'hooks/useSyncPlayEnhancements';
import globalize from 'lib/globalize';
import { PluginType } from 'types/plugin';
import Events, { Event } from 'utils/events';

import './SyncPlayDialog.scss';

export const ID = 'app-sync-play-dialog';

interface SyncPlayDialogProps {
    open: boolean;
    onClose: () => void;
}

interface SyncPlayInstance {
    Manager: {
        getGroupInfo: () => GroupInfoDto | null | undefined;
        isPlaybackActive: () => boolean;
        isPlaylistEmpty: () => boolean;
        haltGroupPlayback: (apiClient: ApiClient) => void;
        resumeGroupPlayback: (apiClient: ApiClient) => void;
    };
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`syncplay-tabpanel-${index}`}
            aria-labelledby={`syncplay-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `syncplay-tab-${index}`,
        'aria-controls': `syncplay-tabpanel-${index}`
    };
}

/**
 * Convert SDK GroupMemberInfoDto to our GroupMemberInfo type
 */
function convertMemberInfo(member: GroupMemberInfoDto): GroupMemberInfo {
    return {
        userId: member.UserId || '',
        userName: member.UserName || 'Unknown',
        ping: Number(member.Ping) || 0,
        isBuffering: member.IsBuffering || false,
        isReady: member.IsReady || false
    };
}

const SyncPlayDialog: FC<SyncPlayDialogProps> = ({ open, onClose }) => {
    const [syncPlay, setSyncPlay] = useState<SyncPlayInstance>();
    const { __legacyApiClient__, user } = useApi();
    const [currentGroup, setCurrentGroup] = useState<GroupInfoDto>();
    const [tabValue, setTabValue] = useState(0);

    useEffect(() => {
        setSyncPlay(pluginManager.firstOfType(PluginType.SyncPlay)?.instance);
    }, []);

    // Use the SyncPlay enhancements hook for chat and lobby functionality
    const {
        group: enhancedGroup,
        messages,
        sendMessage,
        setReady,
        isLoading: chatLoading
    } = useSyncPlayEnhancements({
        apiClient: __legacyApiClient__,
        autoLoad: open // Only load when dialog is open
    });

    const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    }, []);

    const handleStartPlayback = useCallback(() => {
        if (__legacyApiClient__ && syncPlay) {
            syncPlay.Manager.resumeGroupPlayback(__legacyApiClient__);
            onClose(); // Close dialog when playback starts
        }
    }, [__legacyApiClient__, syncPlay, onClose]);

    const updateSyncPlayGroup = useCallback((_e: Event, enabled: boolean) => {
        if (syncPlay && enabled) {
            setCurrentGroup(syncPlay.Manager.getGroupInfo() ?? undefined);
        } else {
            setCurrentGroup(undefined);
        }
    }, [syncPlay]);

    useEffect(() => {
        if (!syncPlay) return;

        Events.on(syncPlay.Manager, 'enabled', updateSyncPlayGroup);

        // Initialize current group
        const group = syncPlay.Manager.getGroupInfo();
        if (group) {
            setCurrentGroup(group);
        }

        return () => {
            Events.off(syncPlay.Manager, 'enabled', updateSyncPlayGroup);
        };
    }, [updateSyncPlayGroup, syncPlay]);

    const groupName = currentGroup?.GroupName || globalize.translate('SyncPlay');
    const groupId = currentGroup?.GroupId;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            className="syncplay-dialog"
            id={ID}
        >
            <DialogTitle className="syncplay-dialog-title">
                <span className="syncplay-dialog-title-text">
                    {groupName}
                </span>
                <IconButton
                    aria-label={globalize.translate('Close')}
                    onClick={onClose}
                    className="syncplay-dialog-close-button"
                    size="small"
                >
                    <Close />
                </IconButton>
            </DialogTitle>

            <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="SyncPlay tabs"
                className="syncplay-dialog-tabs"
                variant="fullWidth"
            >
                <Tab label={globalize.translate('Members')} {...a11yProps(0)} />
                <Tab label={globalize.translate('Chat')} {...a11yProps(1)} />
                <Tab label={globalize.translate('Lobby')} {...a11yProps(2)} />
            </Tabs>

            <DialogContent className="syncplay-dialog-content">
                <TabPanel value={tabValue} index={0}>
                    {currentGroup?.Members && currentGroup.Members.length > 0 ? (
                        <MemberList
                            members={currentGroup.Members.map(convertMemberInfo)}
                            currentUserId={user?.Id}
                            showDetailedPing={true}
                        />
                    ) : (
                        <div className="syncplay-tab-empty">
                            <p>{globalize.translate('MessageNoMembersInGroup')}</p>
                        </div>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    {groupId ? (
                        <ChatPanel
                            messages={messages}
                            currentUserId={user?.Id || ''}
                            onSendMessage={sendMessage}
                            isLoading={chatLoading}
                            disabled={!groupId}
                        />
                    ) : (
                        <div className="syncplay-tab-empty">
                            <p>{globalize.translate('MessageNotInSyncPlayGroup')}</p>
                        </div>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    {enhancedGroup ? (
                        <LobbyScreen
                            group={enhancedGroup}
                            currentUserId={user?.Id || ''}
                            onToggleReady={setReady}
                            onStartPlayback={handleStartPlayback}
                            isGroupOwner={false} // TODO: Determine if user is group owner
                        />
                    ) : (
                        <div className="syncplay-tab-empty">
                            <p>{globalize.translate('MessageNotInSyncPlayGroup')}</p>
                        </div>
                    )}
                </TabPanel>
            </DialogContent>
        </Dialog>
    );
};

export default SyncPlayDialog;

