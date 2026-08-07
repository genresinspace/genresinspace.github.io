#!/usr/bin/env fish

# Wikipedia Dump Download Script
# Usage: ./download_dump.fish <date> <directory>
# Example: ./download_dump.fish 2025-06-20 /path/to/dumps
#
# Dump-server download policy (https://dumps.wikimedia.org):
#   - The server rate-limits downloaders and caps concurrent connections at 3
#     per IP. Clients that try to evade these limits may be blocked.
#   - This script downloads files one at a time (a single connection), staying
#     well under the 3-per-IP cap, and does not use parallel streams or other
#     acceleration tricks.
#   - curl retries transient failures (timeouts, 429/5xx, connection refused)
#     with a short backoff and resumes interrupted transfers, which is polite
#     throttling rather than evasion.
#   - Existing files are skipped only when their size matches the server's
#     Content-Length (verified with a single HEAD request per file); partial
#     downloads from interrupted runs are resumed, not skipped.
#   - Optional per-download bandwidth cap: set DUMP_DOWNLOAD_RATE_LIMIT, e.g.
#     "5M". Leave unset to use the server's default download rate.

function validate_date -a date_string
    if string match -qr '^\d{4}-\d{2}-\d{2}$' $date_string
        # Check if it's a valid date by trying to parse it
        if date -d $date_string +%Y-%m-%d >/dev/null 2>&1
            return 0
        end
    end
    return 1
end

function convert_date_format -a date_string
    # Convert YYYY-MM-DD to YYYYMMDD
    string replace -a '-' '' $date_string
end

function main
    if test (count $argv) -ne 2
        echo "Usage: download_dump.fish <date> <directory>"
        echo "Example: download_dump.fish 2025-06-20 /path/to/dumps"
        return 1
    end

    set -l date $argv[1]
    set -l directory (string replace -r '/$' '' $argv[2])

    # Validate date format
    if not validate_date $date
        set_color red
        echo "Error: Date must be in YYYY-MM-DD format (e.g., 2025-06-20)"
        set_color normal
        return 1
    end

    # Check if directory exists
    if not test -d $directory
        set_color red
        echo "Error: Directory '$directory' does not exist"
        set_color normal
        return 1
    end

    # Convert date format
    set -l date_yyyymmdd (convert_date_format $date)
    set -l target_dir "$directory/$date"

    set_color cyan
    echo "Wikipedia Dump Download"
    set_color yellow
    echo "Date: $date ($date_yyyymmdd)"
    set_color normal
    echo ""

    # Create target directory
    if not test -d $target_dir
        mkdir -p $target_dir
        set_color green
        echo "Created directory: $target_dir"
        set_color normal
    else
        set_color yellow
        echo "Directory already exists: $target_dir"
        set_color normal
    end

    echo ""

    # Define files to download
    set -l files \
        "enwiki-$date_yyyymmdd-pages-articles-multistream.xml.bz2" \
        "enwiki-$date_yyyymmdd-pages-articles-multistream-index.txt.bz2" \
        "enwiki-$date_yyyymmdd-linktarget.sql.gz" \
        "enwiki-$date_yyyymmdd-pagelinks.sql.gz"

    set -l base_url "https://dumps.wikimedia.org/enwiki/$date_yyyymmdd"

    set_color cyan
    echo "Downloading files to: $target_dir"
    echo "Downloading one file at a time (dump server caps concurrent connections at 3 per IP)."
    set_color normal
    echo ""

    # Downloads run strictly sequentially: at most one connection at a time,
    # which is within the dump server's 3-connections-per-IP limit. Do not add
    # parallelism to this loop without keeping concurrent connections <= 3.
    for file in $files
        set -l url "$base_url/$file"
        set -l output_path "$target_dir/$file"

        if test -f $output_path
            # An existing file may be a partial download from an interrupted
            # run, so don't skip it blindly. HEAD the URL (serialized, so
            # still one connection at a time) and compare sizes: skip only
            # when complete, resume when shorter, restart when larger.
            set -l headers (curl -sIL "$url")
            set -l http_status (string match -i 'HTTP/*' $headers | string replace -ri '^.*\s(\d{3})\b.*$' '$1' | tail -n1)
            set -l remote_size (string match -i '*content-length:*' $headers | string replace -ri '^.*content-length:\s*(\d+)\s*$' '$1' | tail -n1)
            set -l local_size (command stat -c %s "$output_path" 2>/dev/null; or echo 0)

            # If the remote file is missing (e.g. 404 for a bad dump date),
            # don't attempt the download and don't compare against the error
            # page's Content-Length.
            if string match -qr '^\d{3}$' "$http_status"; and test "$http_status" != 200
                set_color yellow
                echo "  Skipping (remote file unavailable, HTTP $http_status): $file"
                set_color normal
                continue
            end

            if string match -qr '^\d+$' "$remote_size"; and test "$local_size" -eq "$remote_size"
                set_color yellow
                echo "  Skipping (already downloaded): $file"
                set_color normal
                continue
            else if string match -qr '^\d+$' "$remote_size"; and test "$local_size" -gt "$remote_size"
                set_color yellow
                echo "  Restarting (local file larger than remote): $file"
                set_color normal
                command rm -f "$output_path"
            else if string match -qr '^\d+$' "$remote_size"
                set_color yellow
                echo "  Resuming incomplete download ($local_size/$remote_size bytes): $file"
                set_color normal
            else
                set_color yellow
                echo "  Existing file found; resuming if incomplete: $file"
                set_color normal
            end
        end

        set_color white
        echo "  Downloading: $file"
        set_color normal
        # --fail: an HTTP error (e.g. a 429 rate-limit response) fails the
        #   download instead of silently saving the error page as a file.
        # --retry/--retry-delay/--retry-connrefused: back off and resume on
        #   transient failures (timeouts, 429/5xx, connection refused).
        # -C -: resume an interrupted transfer from where it stopped.
        # --limit-rate (optional): explicit per-download bandwidth cap.
        set -l curl_flags -L --fail -C - --retry 5 --retry-delay 5 --retry-connrefused --progress-bar
        if set -q DUMP_DOWNLOAD_RATE_LIMIT
            set -a curl_flags --limit-rate "$DUMP_DOWNLOAD_RATE_LIMIT"
        end
        curl $curl_flags -o $output_path $url
        if test $status -eq 0
            set_color green
            echo "  ✓ Downloaded: $file"
            set_color normal
        else
            set_color red
            echo "  ✗ Failed to download: $file"
            set_color normal
        end
    end

    echo ""
    set_color green
    echo "Done! Files saved to: $target_dir"
    set_color normal
end

main $argv
