#!/bin/bash
# Quick parameter sweep for force layout tuning.
# Usage: nix-shell --run "bash sweep_layout.sh"
set -e

run_config() {
    local name="$1"; shift
    echo "=== $name ==="
    env "$@" cargo run --manifest-path datagen/Cargo.toml --bin relayout --release 2>&1 | tail -1
    uv run visualize_layout.py 2>&1 | grep -E "std|Edge|Pairwise"
    cp layout_visualization.png "layout_${name}.png"
    echo
}

# Reduced isolated charge to bring ring closer

# P1: iso_charge=0.5 (half the repulsion from core)
run_config "P1_iso05" \
    REPULSION=50000 GRAVITY=0.25 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=30000 CHARGE_EXP=1.5 SPIN=25 BRIDGE_MULT=7.0 ISO_CHARGE=0.5

# P2: iso_charge=0.2 (much less repulsion)
run_config "P2_iso02" \
    REPULSION=50000 GRAVITY=0.25 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=30000 CHARGE_EXP=1.5 SPIN=25 BRIDGE_MULT=7.0 ISO_CHARGE=0.2

# P3: iso_charge=0.1 + slightly stronger iso gravity
run_config "P3_iso01" \
    REPULSION=50000 GRAVITY=0.25 GRAVITY_ISOLATED=1.0 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=30000 CHARGE_EXP=1.5 SPIN=25 BRIDGE_MULT=7.0 ISO_CHARGE=0.1

echo "Done! Check layout_*.png files."
