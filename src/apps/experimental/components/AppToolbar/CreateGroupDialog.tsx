/* eslint-disable @stylistic/jsx-quotes */

import { getSyncPlayApi } from '@jellyfin/sdk/lib/utils/api/sync-play-api';
import Close from '@mui/icons-material/Close';
import GroupAdd from '@mui/icons-material/GroupAdd';
import Settings from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { FC, useCallback, useState, useEffect } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import './CreateGroupDialog.scss';

export const ID = 'app-create-group-dialog';

interface CreateGroupDialogProps {
    open: boolean;
    onClose: () => void;
    onGroupCreated: () => void;
    onOpenSettings?: () => void;
}

const CreateGroupDialog: FC<CreateGroupDialogProps> = ({
    open,
    onClose,
    onGroupCreated,
    onOpenSettings
}) => {
    const { api, user } = useApi();
    const [groupName, setGroupName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Generate default group name when dialog opens
    useEffect(() => {
        if (open && user?.Name) {
            const defaultName = globalize.translate('SyncPlayGroupDefaultTitle', user.Name);
            setGroupName(defaultName);
        }
    }, [open, user?.Name]);

    const handleGroupNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setGroupName(event.target.value);
    }, []);

    const handleCreateGroup = useCallback(async () => {
        if (!groupName.trim() || !api) return;

        setIsCreating(true);
        try {
            await getSyncPlayApi(api).syncPlayCreateGroup({
                newGroupRequestDto: {
                    GroupName: groupName.trim()
                }
            });

            onGroupCreated();
            onClose();
        } catch (err) {
            console.error('[CreateGroupDialog] failed to create a SyncPlay group', err);
        } finally {
            setIsCreating(false);
        }
    }, [api, groupName, onGroupCreated, onClose]);

    const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !isCreating && groupName.trim()) {
            void handleCreateGroup();
        }
    }, [handleCreateGroup, isCreating, groupName]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            className="create-group-dialog"
            id={ID}
        >
            <DialogTitle className="create-group-dialog-title">
                <Box className="create-group-dialog-title-content">
                    <GroupAdd className="create-group-dialog-icon" />
                    <span className="create-group-dialog-title-text">
                        {globalize.translate('LabelSyncPlayCreateGroup')}
                    </span>
                </Box>
                <IconButton
                    aria-label={globalize.translate('Close')}
                    onClick={onClose}
                    className="create-group-dialog-close-button"
                    size="small"
                >
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent className="create-group-dialog-content">
                <Typography variant="body2" className="create-group-dialog-description">
                    {globalize.translate('MessageSyncPlayCreateGroupDescription')}
                </Typography>

                <TextField
                    autoFocus
                    margin="normal"
                    id="group-name"
                    label={globalize.translate('LabelGroupName')}
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={groupName}
                    onChange={handleGroupNameChange}
                    onKeyPress={handleKeyPress}
                    disabled={isCreating}
                    className="create-group-dialog-input"
                    helperText={globalize.translate('MessageGroupNameHelp')}
                />
            </DialogContent>

            <DialogActions className="create-group-dialog-actions">
                {onOpenSettings && (
                    <Button
                        onClick={onOpenSettings}
                        startIcon={<Settings />}
                        className="create-group-dialog-settings-button"
                        disabled={isCreating}
                    >
                        {globalize.translate('Settings')}
                    </Button>
                )}
                <Box sx={{ flex: 1 }} />
                <Button 
                    onClick={onClose}
                    disabled={isCreating}
                >
                    {globalize.translate('Cancel')}
                </Button>
                <Button
                    onClick={handleCreateGroup}
                    variant="contained"
                    color="primary"
                    disabled={isCreating || !groupName.trim()}
                    startIcon={<GroupAdd />}
                >
                    {isCreating ? globalize.translate('Creating') : globalize.translate('LabelSyncPlayCreateGroup')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateGroupDialog;

