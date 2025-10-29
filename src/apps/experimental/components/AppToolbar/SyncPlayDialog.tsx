import type { GroupInfoDto } from '@jellyfin/sdk/lib/generated-client/models/group-info-dto';
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
import { useApi } from 'hooks/useApi';
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

const SyncPlayDialog: FC<SyncPlayDialogProps> = ({ open, onClose }) => {
    const [syncPlay, setSyncPlay] = useState<SyncPlayInstance>();
    const { __legacyApiClient__, user } = useApi();
    const [currentGroup, setCurrentGroup] = useState<GroupInfoDto>();
    const [tabValue, setTabValue] = useState(0);

    useEffect(() => {
        setSyncPlay(pluginManager.firstOfType(PluginType.SyncPlay)?.instance);
    }, []);

    const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    }, []);

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
                    <div className="syncplay-tab-placeholder">
                        {/* Members tab content will go here */}
                        <p>Members: {currentGroup?.Participants?.length || 0}</p>
                        {currentGroup?.Participants?.map((participant, index) => (
                            <div key={index}>
                                {participant}
                            </div>
                        ))}
                    </div>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <div className="syncplay-tab-placeholder">
                        {/* Chat tab content will go here */}
                        <p>Chat for group: {groupId}</p>
                    </div>
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <div className="syncplay-tab-placeholder">
                        {/* Lobby tab content will go here */}
                        <p>Lobby - Ready System</p>
                    </div>
                </TabPanel>
            </DialogContent>
        </Dialog>
    );
};

export default SyncPlayDialog;

