#!/bin/bash
# start_server.sh
# Run this on EC2 to start/stop/restart all CabRoute services
# Usage:
#   ./start_server.sh         — start all
#   ./start_server.sh stop    — stop all
#   ./start_server.sh restart — restart all
#   ./start_server.sh status  — check status
#   ./start_server.sh logs    — tail all logs

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

status_all() {
  echo -e "\n${BLUE}CabRoute Service Status${NC}"
  echo "========================"
  pm2 status
  echo ""
  echo -e "${YELLOW}Health check:${NC}"
  HEALTH=$(curl -s http://localhost:3001/api/runs/health 2>/dev/null)
  if [ -n "$HEALTH" ]; then
    echo "  $HEALTH"
  else
    echo -e "  ${RED}Node API not responding${NC}"
  fi
  FLASK=$(curl -s http://localhost:5001/health 2>/dev/null)
  if [ -n "$FLASK" ]; then
    echo "  Flask: $FLASK"
  else
    echo -e "  ${RED}Flask not responding${NC}"
  fi
}

stop_all() {
  echo -e "${YELLOW}Stopping all services...${NC}"
  pm2 stop all
  echo -e "${GREEN}All services stopped. EC2 instance still running.${NC}"
  echo "  💡 To save money: stop the EC2 instance from AWS Console when not needed."
}

restart_all() {
  echo -e "${YELLOW}Restarting all services...${NC}"
  pm2 restart all
  sleep 3
  status_all
}

logs_all() {
  pm2 logs --lines 50
}

start_all() {
  echo ""
  echo "🚌 CabRoute Optimizer — Starting production environment"
  echo "======================================================="

  # Check PM2 process list
  FLASK_RUNNING=$(pm2 list | grep cabroute-flask | grep online)
  NODE_RUNNING=$(pm2 list | grep cabroute-node | grep online)

  # Start Flask if not running
  echo -e "\n${YELLOW}[1/2] Flask optimizer (port 5001)...${NC}"
  if [ -n "$FLASK_RUNNING" ]; then
    echo -e "  ${GREEN}✅ Already running${NC}"
  else
    cd ~/cabroute-optimizer/flask_api
    pm2 start venv/bin/gunicorn \
      --name cabroute-flask \
      --interpreter none \
      -- -w 1 -b 0.0.0.0:5001 --timeout 300 app:app > /dev/null 2>&1
    sleep 3
    if curl -s http://localhost:5001/health > /dev/null 2>&1; then
      echo -e "  ${GREEN}✅ Flask running on port 5001${NC}"
    else
      echo -e "  ${RED}❌ Flask failed. Check: pm2 logs cabroute-flask${NC}"
    fi
  fi

  # Start Node if not running
  echo -e "\n${YELLOW}[2/2] Node.js API (port 3001)...${NC}"
  if [ -n "$NODE_RUNNING" ]; then
    echo -e "  ${GREEN}✅ Already running${NC}"
  else
    cd ~/cabroute-optimizer/node-api
    pm2 start src/server.js \
      --name cabroute-node \
      --node-args="--insecure-http-parser" > /dev/null 2>&1
    sleep 4
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
      echo -e "  ${GREEN}✅ Node running on port 3001${NC}"
    else
      echo -e "  ${RED}❌ Node failed. Check: pm2 logs cabroute-node${NC}"
    fi
  fi

  pm2 save > /dev/null 2>&1

  # Final health check
  echo -e "\n${YELLOW}Health check...${NC}"
  sleep 2
  HEALTH=$(curl -s http://localhost:3001/api/runs/health)
  echo "  $HEALTH"

  PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null)
  echo ""
  echo "======================================================="
  echo -e "${GREEN}✅ CabRoute is live!${NC}"
  echo ""
  echo "  🌐 Live URL  : http://$PUBLIC_IP"
  echo "  🔧 Node API  : http://localhost:3001"
  echo "  🐍 Flask API : http://localhost:5001"
  echo ""
  echo "  📋 Useful commands:"
  echo "     ./start_server.sh status   — check all services"
  echo "     ./start_server.sh restart  — restart everything"
  echo "     ./start_server.sh logs     — tail all logs"
  echo "     ./start_server.sh stop     — stop all services"
  echo "     pm2 logs cabroute-node     — Node logs"
  echo "     pm2 logs cabroute-flask    — Flask logs"
  echo "======================================================="
}

# Route commands
case "$1" in
  stop)    stop_all ;;
  restart) restart_all ;;
  status)  status_all ;;
  logs)    logs_all ;;
  *)       start_all ;;
esac
