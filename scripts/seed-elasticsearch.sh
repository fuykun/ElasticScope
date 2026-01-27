#!/bin/bash
# Elasticsearch Seed Data Loader
# This script waits for Elasticsearch to be ready and loads seed data

set -e

ES_HOST="${ES_HOST:-http://elasticsearch:9200}"
SEED_FILE="/seed-data/seed-data.json"
MAX_RETRIES=30
RETRY_INTERVAL=5

echo "🔍 ElasticScope Seed Data Loader"
echo "================================"
echo "Elasticsearch Host: $ES_HOST"
echo ""

# Wait for Elasticsearch to be ready
echo "⏳ Waiting for Elasticsearch to be ready..."
retries=0
until curl -s "$ES_HOST/_cluster/health" | grep -q '"status":"green"\|"status":"yellow"'; do
    retries=$((retries + 1))
    if [ $retries -ge $MAX_RETRIES ]; then
        echo "❌ Elasticsearch did not become ready in time. Exiting."
        exit 1
    fi
    echo "   Attempt $retries/$MAX_RETRIES - Elasticsearch not ready yet, waiting ${RETRY_INTERVAL}s..."
    sleep $RETRY_INTERVAL
done

echo "✅ Elasticsearch is ready!"
echo ""

# Check if seed data file exists
if [ ! -f "$SEED_FILE" ]; then
    echo "❌ Seed data file not found: $SEED_FILE"
    exit 1
fi

echo "📦 Loading seed data from $SEED_FILE"
echo ""

# Parse and load each index
indices=$(cat "$SEED_FILE" | jq -r '.indices | length')
echo "Found $indices indices to create"
echo ""

for i in $(seq 0 $((indices - 1))); do
    index_name=$(cat "$SEED_FILE" | jq -r ".indices[$i].name")
    
    # Check if index already exists
    if curl -s -o /dev/null -w "%{http_code}" "$ES_HOST/$index_name" | grep -q "200"; then
        echo "⚠️  Index '$index_name' already exists, skipping..."
        continue
    fi
    
    echo "📁 Creating index: $index_name"
    
    # Get settings and mappings
    settings=$(cat "$SEED_FILE" | jq ".indices[$i].settings")
    mappings=$(cat "$SEED_FILE" | jq ".indices[$i].mappings")
    
    # Create index with settings and mappings
    index_body=$(jq -n --argjson settings "$settings" --argjson mappings "$mappings" \
        '{settings: $settings, mappings: $mappings}')
    
    response=$(curl -s -X PUT "$ES_HOST/$index_name" \
        -H "Content-Type: application/json" \
        -d "$index_body")
    
    if echo "$response" | grep -q '"acknowledged":true'; then
        echo "   ✅ Index created successfully"
    else
        echo "   ❌ Failed to create index: $response"
        continue
    fi
    
    # Load documents
    doc_count=$(cat "$SEED_FILE" | jq -r ".indices[$i].documents | length")
    echo "   📄 Loading $doc_count documents..."
    
    for j in $(seq 0 $((doc_count - 1))); do
        doc=$(cat "$SEED_FILE" | jq ".indices[$i].documents[$j]")
        
        curl -s -X POST "$ES_HOST/$index_name/_doc" \
            -H "Content-Type: application/json" \
            -d "$doc" > /dev/null
    done
    
    echo "   ✅ Documents loaded successfully"
    echo ""
done

# Refresh all indices
echo "🔄 Refreshing indices..."
curl -s -X POST "$ES_HOST/_refresh" > /dev/null
echo "✅ Indices refreshed"
echo ""

# Show summary
echo "📊 Summary"
echo "=========="
for i in $(seq 0 $((indices - 1))); do
    index_name=$(cat "$SEED_FILE" | jq -r ".indices[$i].name")
    count=$(curl -s "$ES_HOST/$index_name/_count" | jq -r '.count // 0')
    echo "   $index_name: $count documents"
done
echo ""
echo "🎉 Seed data loading complete!"
echo ""
echo "You can now connect to Elasticsearch at: http://localhost:9200"
echo "Or use ElasticScope at: http://localhost:3001"
