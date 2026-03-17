#!/bin/bash
# Travel Mode Extension - Installer
# Adds a Quick Settings toggle to GNOME Shell for battery optimization
# on hybrid NVIDIA laptops (Optimus).
#
# Usage: ./install.sh          (install)
#        ./install.sh --remove (uninstall)

set -e

EXT_UUID="travel-mode@garoford"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

remove() {
    info "Removing Travel Mode..."

    rm -rf "$EXT_DIR"
    rm -f "$HOME/.config/autostart/travel-mode-display.desktop"

    if [ -f /etc/travel-mode-active ]; then
        warn "Travel Mode is currently ACTIVE. Running disable first..."
        sudo /usr/local/bin/travel-mode disable
    fi

    sudo rm -f /usr/local/bin/travel-mode
    sudo rm -f /usr/local/bin/travel-mode-display
    sudo rm -f /usr/share/polkit-1/actions/org.garoford.travel-mode.policy
    sudo rm -f /etc/systemd/system/travel-mode-boot.service
    sudo rm -f /etc/modprobe.d/travel-mode-nvidia.conf
    sudo rm -rf /etc/travel-mode-state
    sudo rm -f /etc/travel-mode-active
    sudo systemctl daemon-reload 2>/dev/null

    EXTS=$(gsettings get org.gnome.shell enabled-extensions)
    NEW_EXTS=$(echo "$EXTS" | sed "s/, '$EXT_UUID'//g; s/'$EXT_UUID', //g; s/'$EXT_UUID'//g")
    gsettings set org.gnome.shell enabled-extensions "$NEW_EXTS" 2>/dev/null

    info "Removed. Log out and back in to complete."
    exit 0
}

install() {
    # Sanity checks
    command -v gnome-shell >/dev/null || error "GNOME Shell not found."
    command -v pkexec >/dev/null || error "pkexec (polkit) not found."
    python3 -c "import dbus" 2>/dev/null || error "python3-dbus not found. Install: sudo dnf install python3-dbus"

    info "Installing Travel Mode extension..."

    # 1. GNOME Shell extension
    mkdir -p "$EXT_DIR"
    cp "$SCRIPT_DIR/extension/metadata.json" "$EXT_DIR/"
    cp "$SCRIPT_DIR/extension/extension.js"  "$EXT_DIR/"
    cp "$SCRIPT_DIR/extension/stylesheet.css" "$EXT_DIR/"
    info "Extension files → $EXT_DIR"

    # 2. Backend scripts (need root)
    sudo install -m 755 "$SCRIPT_DIR/scripts/travel-mode" /usr/local/bin/travel-mode
    sudo install -m 755 "$SCRIPT_DIR/scripts/travel-mode-display" /usr/local/bin/travel-mode-display
    info "Scripts → /usr/local/bin/"

    # 3. Polkit policy
    sudo install -m 644 "$SCRIPT_DIR/config/org.garoford.travel-mode.policy" \
        /usr/share/polkit-1/actions/org.garoford.travel-mode.policy
    info "Polkit policy installed"

    # 4. Autostart for display config
    mkdir -p "$HOME/.config/autostart"
    cp "$SCRIPT_DIR/config/travel-mode-display.desktop" "$HOME/.config/autostart/"
    info "Display autostart installed"

    # 5. Enable extension in GNOME
    CURRENT=$(gsettings get org.gnome.shell enabled-extensions 2>/dev/null || echo "[]")
    if echo "$CURRENT" | grep -q "$EXT_UUID"; then
        info "Extension already in enabled list"
    else
        NEW=$(echo "$CURRENT" | sed "s/]$/, '$EXT_UUID']/; s/\[, /[/")
        gsettings set org.gnome.shell enabled-extensions "$NEW"
        info "Extension added to enabled list"
    fi

    echo ""
    info "Installation complete!"
    warn "Log out and back in (or reboot) for the toggle to appear in Quick Settings."
    echo ""
    echo "  Once visible, toggle Travel Mode from the Quick Settings panel."
    echo "  The system will ask for your password and reboot automatically."
    echo ""
}

case "${1:-}" in
    --remove|--uninstall|-r) remove ;;
    *) install ;;
esac
