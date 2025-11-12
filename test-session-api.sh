#!/bin/bash
# Test script to verify session API returns 404 for non-existent sessions

echo "Testing session API endpoint..."
echo ""

# Test with a non-existent session ID
FAKE_SESSION_ID="00000000-0000-0000-0000-000000000000"
BACKEND_URL="${BACKEND_URL:-http://localhost:5174}"

echo "1. Testing non-existent session (should return 404):"
echo "   GET ${BACKEND_URL}/api/sessions/${FAKE_SESSION_ID}"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${BACKEND_URL}/api/sessions/${FAKE_SESSION_ID}")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "   Status Code: ${HTTP_CODE}"
echo "   Response Body: ${BODY}"
echo ""

if [ "$HTTP_CODE" = "404" ]; then
    echo "   ✅ SUCCESS: Correctly returns 404 for non-existent session"
else
    echo "   ❌ FAILED: Expected 404, got ${HTTP_CODE}"
fi

echo ""
echo "2. Testing existing session (if available):"

# Try to get a real session ID from the database
if command -v psql &> /dev/null; then
    REAL_SESSION_ID=$(PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d postgres -t -c "SELECT id FROM sessions ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | xargs)

    if [ -n "$REAL_SESSION_ID" ]; then
        echo "   GET ${BACKEND_URL}/api/sessions/${REAL_SESSION_ID}"
        echo ""

        RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${BACKEND_URL}/api/sessions/${REAL_SESSION_ID}")
        HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
        BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

        echo "   Status Code: ${HTTP_CODE}"
        echo "   Response Body: ${BODY}"
        echo ""

        if [ "$HTTP_CODE" = "200" ]; then
            echo "   ✅ SUCCESS: Correctly returns 200 for existing session"
        else
            echo "   ❌ FAILED: Expected 200, got ${HTTP_CODE}"
        fi
    else
        echo "   ⚠️  SKIPPED: No sessions found in database"
    fi
else
    echo "   ⚠️  SKIPPED: psql not available"
fi
