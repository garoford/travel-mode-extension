# Travel Mode - GNOME Shell Extension

Battery optimization toggle for hybrid NVIDIA Optimus laptops. Adds a **Travel Mode** button to the GNOME Quick Settings panel.

> Created with AI assistance for the Acer Nitro AN515-55 (i5-10300H + RTX 3050 Mobile) running Fedora 43 / GNOME 49. GPU disable approach inspired by [envycontrol](https://github.com/bayasdev/envycontrol).

## What it does

### When enabled:
| Component | Action |
|-----------|--------|
| **NVIDIA GPU** | Blacklisted + physically removed from PCI bus via udev (completely invisible) |
| **Display** | eDP-1 only at **1600x900 @ 60Hz** (externals disabled) |
| **CPU** | Powersave governor, **2.0 GHz max**, turbo boost disabled |
| **Power profile** | `power-saver` |
| **Bluetooth** | Disabled |
| **Brightness** | 40% |
| **Kernel** | laptop_mode, dirty writeback 15s, audio codec power save |

### When disabled:
**Everything is restored to the exact previous state** — GPU, display, CPU frequency, governor, turbo, bluetooth, brightness, power profile, kernel params, all NVIDIA config files and services.

Both actions require a **reboot** (the GPU removal takes effect via udev on next boot).

## How GPU disable works (envycontrol approach)

1. All NVIDIA kernel modules are blacklisted AND aliased to `off`
2. A udev rule physically **removes** the NVIDIA device from the PCI bus on boot (`ATTR{remove}="1"`)
3. The GPU is powered down (`ATTR{power/control}="auto"`) before removal
4. The initramfs is regenerated without NVIDIA modules

This means `lspci` won't even show the NVIDIA card — it's completely gone until you disable travel mode and reboot.

## Requirements

- GNOME Shell 46-49
- Fedora (tested on 43) or any systemd-based distro with dracut
- NVIDIA Optimus laptop with `akmod-nvidia` drivers
- `python3-dbus` (`sudo dnf install python3-dbus`)

## Installation

```bash
cd ~/Development/travel-mode-extension
chmod +x install.sh
./install.sh
```

Log out and back in for the toggle to appear.

## Uninstallation

```bash
./install.sh --remove
```

## Manual usage

```bash
# Enable (asks for password, then reboot)
pkexec /usr/local/bin/travel-mode enable && sudo reboot

# Disable (asks for password, then reboot)
pkexec /usr/local/bin/travel-mode disable && sudo reboot

# Check status
/usr/local/bin/travel-mode status
```

## Project structure

```
travel-mode-extension/
├── extension/
│   ├── metadata.json          # GNOME Shell extension metadata
│   ├── extension.js           # Quick Settings toggle + modal dialog
│   └── stylesheet.css
├── scripts/
│   ├── travel-mode            # Root backend (pkexec): GPU/CPU/power
│   └── travel-mode-display    # User autostart: display resolution
├── config/
│   ├── org.garoford.travel-mode.policy   # Polkit auth policy
│   └── travel-mode-display.desktop       # XDG autostart entry
├── install.sh
└── README.md
```

## License

MIT
