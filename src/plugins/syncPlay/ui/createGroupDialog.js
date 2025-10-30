/**
 * CreateGroupDialog - a legacy dialog for creating a SyncPlay group with a custom name.
 */
import dialogHelper from '../../../components/dialogHelper/dialogHelper';
import layoutManager from '../../../components/layoutManager';
import globalize from '../../../lib/globalize';
import toast from '../../../components/toast/toast';
import template from './createGroupDialog.html';

import 'material-design-icons-iconfont';
import '../../../elements/emby-input/emby-input';
import '../../../elements/emby-button/emby-button';
import '../../../elements/emby-button/paper-icon-button-light';
import '../../../components/formdialog.scss';

class CreateGroupDialog {
    /**
     * @param {*} apiClient - current ApiClient
     * @param {*} syncPlayManager - SyncPlay Manager instance
     */
    constructor(apiClient, syncPlayManager) {
        this.apiClient = apiClient;
        this.syncPlayManager = syncPlayManager;
        this.context = null;
        this._button = null;
        this._onCreated = null;
    }

    /**
     * Shows the dialog.
     * @param {Object} options
     * @param {string} options.defaultName - initial group name
     * @param {HTMLElement} [options.positionTo] - anchor element for follow-up menus
     * @param {Function} [options.onCreated] - callback invoked after successful creation
     */
    async embed(options = {}) {
        const dialogOptions = { removeOnClose: true, scrollY: false };
        dialogOptions.size = layoutManager.tv ? 'fullscreen' : 'small';

        this.context = dialogHelper.createDialog(dialogOptions);
        this.context.classList.add('formDialog');

        this.context.innerHTML = globalize.translateHtml(template, 'core');

        // Wire up controls
        const txt = this.context.querySelector('#txtGroupName');
        if (txt) txt.value = options.defaultName || '';

        this._button = options.positionTo || null;
        this._onCreated = typeof options.onCreated === 'function' ? options.onCreated : null;

        // Cancel (back) button
        this.context.querySelector('.btnCancel')?.addEventListener('click', () => {
            dialogHelper.close(this.context);
        });

        // Submit on enter
        this.context.querySelector('form')?.addEventListener('submit', (e) => {
            e?.preventDefault();
            this.onCreate(false);
            return false;
        });

        // Explicit create button (create only)
        this.context.querySelector('.btnCreate')?.addEventListener('click', () => this.onCreate(false));

        // Removed "Create and open lobby" per request

        // Settings button
        this.context.querySelector('.btnSettings')?.addEventListener('click', async () => {
            const { default: SettingsEditor } = await import('./settings/SettingsEditor');
            new SettingsEditor(this.apiClient, this.syncPlayManager.getTimeSyncCore())
                .embed()
                .catch((err) => { if (err) { /* dialog cancelled */ } });
        });

        return dialogHelper.open(this.context);
    }

    async onCreate() {
        const btn1 = this.context.querySelector('.btnCreate');
        const name = (this.context.querySelector('#txtGroupName')?.value || '').trim();
        if (!name) {
            return;
        }
        if (btn1) btn1.disabled = true;
        try {
            await this.apiClient.createSyncPlayGroup({ GroupName: name });
            // Close dialog first
            dialogHelper.close(this.context);
        } catch (err) {
            console.error('SyncPlay: failed to create group', err);
            if (btn1) btn1.disabled = false;
        }
    }
}

export default CreateGroupDialog;

