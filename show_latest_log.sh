cd ~/homebrew/logs/pocket-protector
latest_log=$(ls -t *.log 2>/dev/null | head -n 1)
if [ -z "$latest_log" ]; then
    echo "No log files found."
else
    echo "Latest log file: $latest_log"
    echo "Contents of $latest_log:"
    tail -n 20 "$latest_log"
fi