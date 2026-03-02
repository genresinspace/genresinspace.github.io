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

# Final refinements — focus on convergence

# M1: K3 base but with 35k iters (more time to settle)
run_config "M1_k3_long" \
    REPULSION=55000 GRAVITY=0.25 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=35000 CHARGE_EXP=1.4 SPIN=25 BRIDGE_MULT=6.0

# M2: bridge=8, cooling=0.8 (not glacial), 30k iters
run_config "M2_bridge8_settled" \
    REPULSION=55000 GRAVITY=0.25 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=30000 CHARGE_EXP=1.4 SPIN=25 BRIDGE_MULT=8.0

# M3: charge=1.5, bridge=7, 30k iters
run_config "M3_charge15_bridge7" \
    REPULSION=50000 GRAVITY=0.25 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.8 ITERATIONS=30000 CHARGE_EXP=1.5 SPIN=25 BRIDGE_MULT=7.0

# M4: charge=1.4, bridge=6, glacial but longer (50k at 0.5 = ends at 0.37)
run_config "M4_truly_glacial" \
    REPULSION=55000 GRAVITY=0.25 GRAVITY_ISOLATED=0.80 LINK_SPRING=28 LINK_DISTANCE=4 \
    COOLING_RATE=0.5 ITERATIONS=50000 CHARGE_EXP=1.4 SPIN=25 BRIDGE_MULT=6.0

echo "Done! Check layout_*.png files."
