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

# Combine F4's core (high rep, charge=1.2, bridge=5) with F2's ring (high grav)

# G1: F4 core params + higher iso gravity, lower spin to close ring
run_config "G1_f4_fix_ring" \
    REPULSION=60000 GRAVITY=0.20 GRAVITY_ISOLATED=0.65 LINK_SPRING=22 LINK_DISTANCE=5 \
    COOLING_RATE=1.2 ITERATIONS=18000 CHARGE_EXP=1.2 SPIN=25 BRIDGE_MULT=5.0

# G2: Same but spin=20
run_config "G2_low_spin" \
    REPULSION=60000 GRAVITY=0.20 GRAVITY_ISOLATED=0.65 LINK_SPRING=22 LINK_DISTANCE=5 \
    COOLING_RATE=1.2 ITERATIONS=18000 CHARGE_EXP=1.2 SPIN=20 BRIDGE_MULT=5.0

# G3: Moderate repulsion, very high gravity on both
run_config "G3_hi_grav" \
    REPULSION=50000 GRAVITY=0.25 GRAVITY_ISOLATED=0.70 LINK_SPRING=20 LINK_DISTANCE=5 \
    COOLING_RATE=1.2 ITERATIONS=18000 CHARGE_EXP=1.2 SPIN=25 BRIDGE_MULT=5.0

# G4: F4 with more iterations + slow cooling for convergence
run_config "G4_long_run" \
    REPULSION=60000 GRAVITY=0.20 GRAVITY_ISOLATED=0.60 LINK_SPRING=22 LINK_DISTANCE=5 \
    COOLING_RATE=1.0 ITERATIONS=25000 CHARGE_EXP=1.2 SPIN=25 BRIDGE_MULT=5.0

echo "Done! Check layout_*.png files."
