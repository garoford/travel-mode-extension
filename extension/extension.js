import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const FLAG_PATH = '/etc/travel-mode-active';
const TRAVEL_MODE_BIN = '/usr/local/bin/travel-mode';
const ICON_NAME = 'power-profile-power-saver-symbolic';

const TravelModeDialog = GObject.registerClass(
class TravelModeDialog extends ModalDialog.ModalDialog {
    _init(action, onConfirm) {
        super._init({styleClass: 'modal-dialog'});

        const isEnable = action === 'enable';

        const box = new St.BoxLayout({
            vertical: true,
            styleClass: 'modal-dialog-content-box',
        });

        box.add_child(new St.Label({
            text: isEnable ? 'Enable Travel Mode?' : 'Disable Travel Mode?',
            style: 'font-weight: bold; font-size: 16px; margin-bottom: 12px;',
        }));

        const desc = isEnable
            ? [
                '\u2022 Disable NVIDIA GPU completely (removed from PCI bus)',
                '\u2022 Set display to 1600\u00d7900 @ 60Hz (built-in only)',
                '\u2022 CPU limited to 2.0 GHz powersave, turbo off',
                '\u2022 Disable Bluetooth',
                '\u2022 Brightness to 40%, kernel power optimizations',
                '',
                'The system will reboot to apply changes.',
            ]
            : [
                '\u2022 Re-enable NVIDIA GPU',
                '\u2022 Restore display resolution and refresh rate',
                '\u2022 Restore CPU performance settings',
                '\u2022 Restore Bluetooth, brightness, and all configs',
                '',
                'The system will reboot to apply changes.',
            ];

        box.add_child(new St.Label({
            text: desc.join('\n'),
            style: 'font-size: 13px; line-height: 1.4;',
        }));

        this.contentLayout.add_child(box);

        this.addButton({
            label: 'Cancel',
            action: () => this.close(),
            key: Clutter.KEY_Escape,
        });

        this.addButton({
            label: isEnable ? 'Enable & Reboot' : 'Disable & Reboot',
            action: () => {
                this.close();
                onConfirm();
            },
            default: true,
        });
    }
});

const TravelModeToggle = GObject.registerClass(
class TravelModeToggle extends QuickSettings.QuickToggle {
    _init() {
        super._init({
            title: 'Travel Mode',
            iconName: ICON_NAME,
            toggleMode: true,
        });

        this.checked = GLib.file_test(FLAG_PATH, GLib.FileTest.EXISTS);
        this._processing = false;

        this.connect('clicked', () => this._onToggled());
    }

    _onToggled() {
        if (this._processing) return;

        const action = this.checked ? 'enable' : 'disable';

        const dialog = new TravelModeDialog(action, () => {
            this._processing = true;
            this._runTravelMode(action);
        });

        dialog.connect('closed', () => {
            if (!this._processing)
                this.checked = !this.checked;
        });

        dialog.open();
    }

    _runTravelMode(action) {
        try {
            const proc = Gio.Subprocess.new(
                ['pkexec', TRAVEL_MODE_BIN, action],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (_proc, res) => {
                try {
                    const [, stdout, stderr] = _proc.communicate_utf8_finish(res);
                    this._processing = false;

                    if (_proc.get_successful()) {
                        Main.notify('Travel Mode',
                            action === 'enable'
                                ? 'Enabled. Rebooting in 3 seconds...'
                                : 'Disabled. Rebooting in 3 seconds...');

                        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                            this._reboot();
                            return GLib.SOURCE_REMOVE;
                        });
                    } else {
                        this.checked = !this.checked;
                        Main.notifyError('Travel Mode',
                            stderr ? stderr.trim() : 'Unknown error');
                    }
                } catch (e) {
                    this._processing = false;
                    this.checked = !this.checked;
                    Main.notifyError('Travel Mode', e.message);
                }
            });
        } catch (e) {
            this._processing = false;
            this.checked = !this.checked;
            if (!e.message.includes('dismissed'))
                Main.notifyError('Travel Mode', e.message);
        }
    }

    _reboot() {
        try {
            const bus = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.NONE,
                null,
                'org.freedesktop.login1',
                '/org/freedesktop/login1',
                'org.freedesktop.login1.Manager',
                null
            );
            bus.call_sync(
                'Reboot',
                new GLib.Variant('(b)', [true]),
                Gio.DBusCallFlags.NONE, -1, null
            );
        } catch (e) {
            Main.notifyError('Travel Mode', 'Please reboot manually.');
        }
    }
});

export default class TravelModeExtension extends Extension {
    enable() {
        this._indicator = new QuickSettings.SystemIndicator();

        const toggle = new TravelModeToggle();
        this._indicator.quickSettingsItems.push(toggle);

        this._panelIndicator = this._indicator._addIndicator();
        this._panelIndicator.iconName = ICON_NAME;
        this._panelIndicator.visible = GLib.file_test(FLAG_PATH, GLib.FileTest.EXISTS);

        toggle.connect('notify::checked', () => {
            this._panelIndicator.visible = toggle.checked;
        });

        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.quickSettingsItems.forEach(item => item.destroy());
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
