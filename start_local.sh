#!/bin/bash
# start_local.sh
# Starts all CabRoute services locally with one command
# Usage: ./start_local.sh
# Stop all: ./start_local.sh stop

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLASK_DIR="$ROOT_DIR/flask_api"
NODE_DIR="$ROOT_DIR/node-api"
CLIENT_DIR="$ROOT_DIR/client"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

stop_all() {
  echo -e "${YELLOW}Stopping all CabRoute services...${NC}"
  pkill -f "python.*app.py" 2>/dev/null && echo "  ✅ Flask stopped" || echo "  Flask was not running"
  pkill -f "nodemon.*server.js" 2>/dev/null
  pkill -f "node.*server.js" 2>/dev/null && echo "  ✅ Node stopped" || echo "  Node was not running"
  brew services stop mongodb-community 2>/dev/null && echo "  ✅ MongoDB stopped" || echo "  MongoDB was not running"
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

if [ "$1" == "stop" ]; then
  stop_all
fi

echo ""
echo "🚌 CabRoute Optimizer — Starting local environment"
echo "=================================================="

# Step 1 — MongoDB
echo -e "\n${YELLOW}[1/3] Starting MongoDB...${NC}"
brew services start mongodb-community > /dev/null 2>&1
sleep 2
if mongosh --eval "db.runCommand({ping:1})" --quiet > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅ MongoDB running on port 27017${NC}"
else
  echo -e "  ${RED}❌ MongoDB failed to start. Run: brew services start mongodb-community${NC}"
  exit 1
fi

# Step 2 — Flask
echo -e "\n${YELLOW}[2/3] Starting Flask optimizer (port 5001)...${NC}"
cd "$FLASK_DIR"
nohup python3 app.py > /tmp/cabroute_flask.log 2>&1 &
FLASK_PID=$!
sleep 3
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Flask running on http://localhost:5001 (pid: $FLASK_PID)${NC}"
else
  echo -e "  ${RED}❌ Flask failed to start. Check logs: tail -20 /tmp/cabroute_flask.log${NC}"
  exit 1
fi

# Step 3 — Node
echo -e "\n${YELLOW}[3/3] Starting Node.js API (port 3001)...${NC}"
cd "$NODE_DIR" || exit 1
nohup npm run dev > /tmp/cabroute_node.log 2>&1 &
NODE_PID=$!
sleep 4
if curl -s http://localhost:3001 > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Node running on http://localhost:3001 (pid: $NODE_PID)${NC}"
else
  echo -e "  ${RED}❌ Node failed to start. Check logs: tail -20 /tmp/cabroute_node.log${NC}"
  exit 1
fi

# Health check
echo -e "\n${YELLOW}Running health check...${NC}"
sleep 2
HEALTH=$(curl -s http://localhost:3001/api/runs/health)
echo "  $HEALTH"

echo ""
echo "=================================================="
echo -e "${GREEN}✅ All services running!${NC}"
echo ""
echo "  🌐 React frontend : http://localhost:5173"
echo "  🔧 Node API       : http://localhost:3001"
echo "  🐍 Flask API      : http://localhost:5001"
echo "  🗄️  MongoDB        : mongodb://localhost:27017"
echo ""
echo "  📋 Logs:"
echo "     Flask : tail -f /tmp/cabroute_flask.log"
echo "     Node  : tail -f /tmp/cabroute_node.log"
echo ""
echo "  🛑 To stop all:  ./start_local.sh stop"
echo "=================================================="
echo ""
echo -e "${YELLOW}Starting React dev server (port 5173)...${NC}"
cd "$CLIENT_DIR" || exit 1
npm run dev
