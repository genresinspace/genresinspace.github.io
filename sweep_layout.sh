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

# Refine J2 (triangular 3-lobed) — close the ring gap

# K1: J2 with more spin to spread ring
run_config "K1_more_spin" \
    REPULSION=50000 GRAVITY=0.25 GRAVITY_ISOLATED=0.75 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=25000 CHARGE_EXP=1.5 SPIN=30 BRIDGE_MULT=6.0

# K2: J2 with even higher iso gravity
run_config "K2_hi_iso" \
    REPULSION=50000 GRAVITY=0.25 GRAVITY_ISOLATED=0.85 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=25000 CHARGE_EXP=1.5 SPIN=25 BRIDGE_MULT=6.0

# K3: J2 with slightly less charge (1.4) for a less extreme shape
run_config "K3_charge14" \
    REPULSION=55000 GRAVITY=0.25 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=25000 CHARGE_EXP=1.4 SPIN=25 BRIDGE_MULT=6.0

# K4: J2 + higher core gravity to compact the lobes
run_config "K4_core_grav" \
    REPULSION=50000 GRAVITY=0.30 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=25000 CHARGE_EXP=1.5 SPIN=25 BRIDGE_MULT=6.0

echo "Done! Check layout_*.png files."
