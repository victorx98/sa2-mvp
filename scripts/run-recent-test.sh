#!/bin/bash

# Script to run the most recently modified test file
# Usage: ./scripts/run-recent-test.sh [unit|e2e]

TEST_TYPE=${1:-unit}

# Find the most recently modified test file
if [ "$TEST_TYPE" = "unit" ]; then
    TEST_FILE=$(git diff --name-only HEAD~1 | grep 'src/.*\.spec\.ts$' | head -1)
    COMMAND="npm run test:unit"
elif [ "$TEST_TYPE" = "e2e" ]; then
    TEST_FILE=$(git diff --name-only HEAD~1 | grep 'test/.*\.e2e-spec\.ts$' | head -1)
    COMMAND="npm run test:e2e"
else
    echo "Invalid test type. Use 'unit' or 'e2e'."
    exit 1
fi

if [ -z "$TEST_FILE" ]; then
    echo "No recently modified $TEST_TYPE test files found."
    exit 0
fi

echo "Running $TEST_TYPE test for: $TEST_FILE"
$COMMAND -- --testPathPattern="$TEST_FILE" --verbose