# Travel Mode - GNOME Shell Extension

Battery optimization toggle for hybrid NVIDIA laptops (Optimus). Adds a **Travel Mode** button to the GNOME Quick Settings panel.

> This extension was created with AI assistance for the Acer Nitro AN515-55 (i5-10300H + RTX 3050 Mobile) running Fedora 43 / GNOME 49.

## What it does

### When Travel Mode is **enabled**:
- **NVIDIA GPU** is completely disabled (blacklisted at module level — invisible to the system)
- **Display** is set to the laptop's built-in panel at **1600×900 @ 60Hz**
- **CPU** is limited to **2.0 GHz** in powersave governor with turbo boost disabled
- **Bluetooth** is turned off
- **Screen brightness** is lowered to 40%
- **Power profile** is set to `power-saver`
- **Kernel tweaks**: laptop_mode, dirty writeback, PCIe ASPM powersave, audio codec power save

### When Travel Mode is **disabled**:
- All settings are **restored exactly** to their previous state
- NVIDIA GPU, CPU frequency, bluetooth, brightness — everything goes back to normal

Both actions require a **reboot** to fully apply (the NVIDIA module blacklist takes effect on next boot).

## Requirements

- GNOME Shell 46–49
- Fedora (tested on 43) or any systemd-based distro
- NVIDIA Optimus laptop with `akmod-nvidia` drivers
- `python3-dbus` (`sudo dnf install python3-dbus`)
- `polkit` (pre-installed on Fedora)

## Installation

```bash
git clone https://github.com/garoford/travel-mode
cd travel-mode
chmod +x install.sh
./install.sh
```

Then **log out and back in** for the toggle to appear.

## Uninstallation

```bash
./install.sh --remove
```

## Project Structure

```
travel-mode-extension/
├── extension/
│   ├── metadata.json        # GNOME Shell extension metadata
│   ├── extension.js         # Quick Settings toggle (GJS/ESM)
│   └── stylesheet.css
├── scripts/
│   ├── travel-mode          # Backend script (runs as root via pkexec)
│   └── travel-mode-display  # Display config (runs as user on login)
├── config/
│   ├── org.garoford.travel-mode.policy   # Polkit policy
│   └── travel-mode-display.desktop       # Autostart entry
├── install.sh               # Installer/uninstaller
└── README.md
```

## How it works

1. The **GNOME Shell extension** adds a toggle to Quick Settings
2. Clicking the toggle runs `pkexec /usr/local/bin/travel-mode enable|disable`
3. The **polkit policy** prompts for the user's password
4. The **travel-mode script** saves current state, applies power settings, blacklists NVIDIA modules, and regenerates initramfs
5. The system **reboots** automatically
6. On boot, `travel-mode-boot.service` reapplies CPU/power settings
7. The `travel-mode-display` autostart script sets the display to 1600×900@60Hz via Mutter DBus

## Manual usage (without the extension)

```bash
# Check status
travel-mode status

# Enable (with password prompt)
pkexec /usr/local/bin/travel-mode enable
sudo reboot

# Disable
pkexec /usr/local/bin/travel-mode disable
sudo reboot
```

## License

MIT
# travel-mode-extension
