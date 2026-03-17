import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const FLAG_PATH = '/etc/travel-mode-active';
const TRAVEL_MODE_BIN = '/usr/local/bin/travel-mode';

const TravelModeToggle = GObject.registerClass(
class TravelModeToggle extends QuickSettings.QuickToggle {
    _init() {
        super._init({
            title: 'Travel Mode',
            iconName: 'airplane-mode-symbolic',
            toggleMode: true,
        });

        this.checked = GLib.file_test(FLAG_PATH, GLib.FileTest.EXISTS);
        this._processing = false;

        this.connect('clicked', () => {
            if (this._processing) return;
            this._onToggled();
        });
    }

    _onToggled() {
        const action = this.checked ? 'enable' : 'disable';
        this._processing = true;

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
                                ? 'Enabled. Rebooting in 3s...'
                                : 'Disabled. Rebooting in 3s...');

                        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                            this._reboot();
                            return GLib.SOURCE_REMOVE;
                        });
                    } else {
                        this.checked = !this.checked;
                        Main.notifyError('Travel Mode', stderr || 'Unknown error');
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
        this._panelIndicator.iconName = 'airplane-mode-symbolic';
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
