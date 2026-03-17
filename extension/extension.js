import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const FLAG_PATH = '/etc/travel-mode-active';
const TRAVEL_MODE_BIN = '/usr/local/bin/travel-mode';
const ICON_NAME = 'power-profile-power-saver-symbolic';

// ─── Fullscreen progress overlay ───

const TravelModeOverlay = GObject.registerClass(
class TravelModeOverlay extends St.Widget {
    _init() {
        super._init({
            reactive: true,
            can_focus: true,
            track_hover: false,
            x_expand: true,
            y_expand: true,
        });

        this.add_constraint(new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL,
        }));

        this._bg = new St.Widget({
            style: 'background-color: rgba(0, 0, 0, 0.92);',
            x_expand: true,
            y_expand: true,
        });
        this._bg.add_constraint(new Clutter.BindConstraint({
            source: this,
            coordinate: Clutter.BindCoordinate.ALL,
        }));
        this.add_child(this._bg);

        const centerBox = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            style: 'spacing: 24px; padding: 48px;',
        });
        this.add_child(centerBox);

        this._icon = new St.Icon({
            icon_name: ICON_NAME,
            icon_size: 64,
            style: 'color: #8ff0a4; margin-bottom: 8px;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        centerBox.add_child(this._icon);

        this._title = new St.Label({
            text: 'Travel Mode',
            style: 'font-size: 28px; font-weight: bold; color: white; text-align: center;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        centerBox.add_child(this._title);

        this._subtitle = new St.Label({
            text: 'Do not turn off your computer',
            style: 'font-size: 15px; color: #f66151; font-weight: bold; text-align: center;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        centerBox.add_child(this._subtitle);

        // Progress bar container
        const barContainer = new St.BoxLayout({
            style: 'width: 420px; height: 8px; background-color: rgba(255,255,255,0.15); border-radius: 4px;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        centerBox.add_child(barContainer);

        this._progressBar = new St.Widget({
            style: 'background-color: #8ff0a4; border-radius: 4px; height: 8px; width: 0px;',
        });
        barContainer.add_child(this._progressBar);

        this._percentLabel = new St.Label({
            text: '0%',
            style: 'font-size: 18px; color: rgba(255,255,255,0.8); font-weight: bold; text-align: center;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        centerBox.add_child(this._percentLabel);

        this._statusLabel = new St.Label({
            text: 'Initializing...',
            style: 'font-size: 14px; color: rgba(255,255,255,0.7); text-align: center;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        centerBox.add_child(this._statusLabel);

        // Log area
        const logScroll = new St.ScrollView({
            style: 'width: 500px; max-height: 200px; margin-top: 16px;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        centerBox.add_child(logScroll);

        this._logBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 4px;',
        });
        logScroll.set_child(this._logBox);

        // Block all keyboard/mouse
        this.connect('key-press-event', () => Clutter.EVENT_STOP);
        this.connect('key-release-event', () => Clutter.EVENT_STOP);
        this.connect('button-press-event', () => Clutter.EVENT_STOP);
        this.connect('button-release-event', () => Clutter.EVENT_STOP);
        this.connect('scroll-event', () => Clutter.EVENT_STOP);
        this.connect('motion-event', () => Clutter.EVENT_STOP);
    }

    show() {
        global.stage.add_child(this);
        this.grab_key_focus();

        // Push a modal to block all input globally
        this._grab = Main.pushModal(this, {
            actionMode: Shell.ActionMode.SYSTEM_MODAL,
        });
    }

    hide() {
        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
        global.stage.remove_child(this);
    }

    updateProgress(percent, message) {
        this._percentLabel.text = `${percent}%`;
        this._statusLabel.text = message;
        const barWidth = Math.round(420 * percent / 100);
        this._progressBar.style = `background-color: #8ff0a4; border-radius: 4px; height: 8px; width: ${barWidth}px;`;

        const logLine = new St.Label({
            text: `[${percent}%] ${message}`,
            style: 'font-size: 12px; color: rgba(255,255,255,0.5); font-family: monospace;',
        });
        this._logBox.add_child(logLine);
    }

    setFinished(isEnable) {
        this._icon.style = 'color: #8ff0a4; margin-bottom: 8px;';
        this._title.text = isEnable ? 'Travel Mode Enabled' : 'Travel Mode Disabled';
        this._subtitle.text = 'Rebooting now...';
        this._subtitle.style = 'font-size: 15px; color: #8ff0a4; font-weight: bold; text-align: center;';
        this._percentLabel.text = '100%';
        this._statusLabel.text = 'Forcing reboot...';
        this._progressBar.style = 'background-color: #8ff0a4; border-radius: 4px; height: 8px; width: 420px;';
    }

    setError(msg) {
        this._title.text = 'Error';
        this._subtitle.text = msg;
        this._subtitle.style = 'font-size: 15px; color: #f66151; font-weight: bold; text-align: center;';
        this._statusLabel.text = 'Closing in 5 seconds...';

        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this.hide();
            return GLib.SOURCE_REMOVE;
        });
    }
});

// ─── Confirmation dialog ───

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
                '\u2022 Disable Bluetooth, brightness to 40%',
                '\u2022 Kernel power optimizations',
                '',
                'The system will reboot automatically.',
                'All unsaved work will be lost.',
            ]
            : [
                '\u2022 Re-enable NVIDIA GPU',
                '\u2022 Restore display, CPU, Bluetooth, brightness',
                '\u2022 Restore all NVIDIA configs and services',
                '',
                'The system will reboot automatically.',
                'All unsaved work will be lost.',
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

// ─── Quick Settings toggle ───

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
            this._runWithOverlay(action);
        });

        dialog.connect('closed', () => {
            if (!this._processing)
                this.checked = !this.checked;
        });

        dialog.open();
    }

    _runWithOverlay(action) {
        const overlay = new TravelModeOverlay();
        overlay.show();
        overlay.updateProgress(0, `${action === 'enable' ? 'Enabling' : 'Disabling'} Travel Mode...`);

        try {
            const proc = Gio.Subprocess.new(
                ['pkexec', TRAVEL_MODE_BIN, action],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            // Read stdout line-by-line for progress
            const stdout = proc.get_stdout_pipe();
            this._readLines(stdout, overlay);

            proc.wait_async(null, (_proc, res) => {
                try {
                    _proc.wait_finish(res);
                    this._processing = false;

                    if (_proc.get_successful()) {
                        overlay.setFinished(action === 'enable');
                        // Hard reboot after 2 seconds
                        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                            this._hardReboot();
                            return GLib.SOURCE_REMOVE;
                        });
                    } else {
                        this.checked = !this.checked;
                        overlay.setError('Operation failed. Check system logs.');
                    }
                } catch (e) {
                    this._processing = false;
                    this.checked = !this.checked;
                    overlay.setError(e.message);
                }
            });
        } catch (e) {
            this._processing = false;
            this.checked = !this.checked;
            overlay.setError(e.message);
        }
    }

    _readLines(stream, overlay) {
        const dataStream = Gio.DataInputStream.new(stream);

        const readNext = () => {
            dataStream.read_line_async(GLib.PRIORITY_DEFAULT, null, (_stream, res) => {
                try {
                    const [line] = _stream.read_line_finish_utf8(res);
                    if (line === null) return;

                    // Parse STEP|percent|message
                    if (line.startsWith('STEP|')) {
                        const parts = line.split('|');
                        if (parts.length >= 3) {
                            const percent = parseInt(parts[1], 10);
                            const msg = parts.slice(2).join('|');
                            overlay.updateProgress(percent, msg);
                        }
                    }
                    readNext();
                } catch (e) {
                    // Stream closed
                }
            });
        };
        readNext();
    }

    _hardReboot() {
        // auth_admin_keep: pkexec reuses cached auth from the travel-mode call
        try {
            Gio.Subprocess.new(
                ['pkexec', TRAVEL_MODE_BIN, 'force-reboot'],
                Gio.SubprocessFlags.NONE
            );
        } catch (e) {
            // Fallback: logind (non-interactive = skip confirmation dialogs)
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
                    new GLib.Variant('(b)', [false]),
                    Gio.DBusCallFlags.NONE, -1, null
                );
            } catch (e2) {
                // Should never reach here
            }
        }
    }
});

// ─── Extension entry point ───

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
