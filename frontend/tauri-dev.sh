#!/bin/bash
# Wrapper script to launch Tauri dev mode, clearing snap VS Code environment
# that interferes with GTK/glibc resolution.

unset GTK_EXE_PREFIX
unset GTK_PATH
unset GTK_IM_MODULE_FILE
unset GIO_MODULE_DIR
unset LOCPATH
unset GSETTINGS_SCHEMA_DIR

# Clear any LD_LIBRARY_PATH snap contamination
export LD_LIBRARY_PATH=""

exec npx tauri dev "$@"
