#!/usr/bin/env python3
import subprocess
import sys
import os

# Change to the app directory
os.chdir('/app')

# Run uvicorn
subprocess.run([
    'uvicorn', 'main:app', 
    '--host', '0.0.0.0', 
    '--port', '8000', 
    '--workers', '1'
], check=True)
