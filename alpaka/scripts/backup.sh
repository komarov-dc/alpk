#!/bin/bash

# Alpaka Database Backup Script
# This script creates backups of the SQLite database

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DB_PATH="prisma/dev.db"
BACKUP_DIR="backups"
MAX_BACKUPS=10  # Keep only the last 10 backups to save space

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to create a backup
create_backup() {
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}Error: Database file not found at $DB_PATH${NC}"
        exit 1
    fi

    # Create timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.db"
    
    # Get database size
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    
    echo -e "${YELLOW}Creating backup...${NC}"
    echo "Database size: $DB_SIZE"
    
    # Copy the database file
    cp "$DB_PATH" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backup created successfully: $BACKUP_FILE${NC}"
        
        # Compress the backup to save space
        gzip -k "$BACKUP_FILE"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Compressed backup created: ${BACKUP_FILE}.gz${NC}"
            # Remove uncompressed version to save space
            rm "$BACKUP_FILE"
        fi
    else
        echo -e "${RED}✗ Backup failed!${NC}"
        exit 1
    fi
}

# Function to clean old backups
clean_old_backups() {
    # Count backup files
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.db.gz 2>/dev/null | wc -l)
    
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
        echo -e "${YELLOW}Cleaning old backups (keeping last $MAX_BACKUPS)...${NC}"
        
        # Delete oldest backups
        ls -t "$BACKUP_DIR"/backup_*.db.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs rm
        
        echo -e "${GREEN}✓ Old backups cleaned${NC}"
    fi
}

# Function to list backups
list_backups() {
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lah "$BACKUP_DIR"/backup_*.db.gz 2>/dev/null | awk '{print $9, $5}' | sed 's|.*/||'
    
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    echo -e "\n${YELLOW}Total backup size: $TOTAL_SIZE${NC}"
}

# Function to restore a backup
restore_backup() {
    local BACKUP_FILE=$1
    
    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${YELLOW}Available backups:${NC}"
        ls -1 "$BACKUP_DIR"/backup_*.db.gz | sed 's|.*/||'
        echo -e "\n${YELLOW}Usage: $0 restore <backup_filename>${NC}"
        exit 1
    fi
    
    # Add path if not provided
    if [[ ! "$BACKUP_FILE" == "$BACKUP_DIR"* ]]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠️  WARNING: This will replace the current database!${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Restoration cancelled."
        exit 0
    fi
    
    # Create a backup of current database before restoring
    echo -e "${YELLOW}Creating backup of current database first...${NC}"
    create_backup
    
    # Decompress if needed
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        echo -e "${YELLOW}Decompressing backup...${NC}"
        TEMP_FILE="${BACKUP_FILE%.gz}"
        gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
        BACKUP_FILE="$TEMP_FILE"
    fi
    
    # Restore the backup
    echo -e "${YELLOW}Restoring backup...${NC}"
    cp "$BACKUP_FILE" "$DB_PATH"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database restored successfully from $BACKUP_FILE${NC}"
        
        # Clean up temp file if it was decompressed
        if [ ! -z "$TEMP_FILE" ]; then
            rm "$TEMP_FILE"
        fi
    else
        echo -e "${RED}✗ Restore failed!${NC}"
        exit 1
    fi
}

# Main script logic
case "${1:-create}" in
    create)
        create_backup
        clean_old_backups
        list_backups
        ;;
    list)
        list_backups
        ;;
    restore)
        restore_backup "$2"
        ;;
    clean)
        clean_old_backups
        list_backups
        ;;
    *)
        echo "Usage: $0 {create|list|restore <filename>|clean}"
        echo ""
        echo "  create  - Create a new backup (default)"
        echo "  list    - List all available backups"
        echo "  restore - Restore from a backup file"
        echo "  clean   - Remove old backups"
        exit 1
        ;;
esac
