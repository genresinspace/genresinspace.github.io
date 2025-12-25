#!/usr/bin/env fish

# Wikipedia Dump Download Script
# Usage: ./download_dump.fish <date> <directory>
# Example: ./download_dump.fish 2025-06-20 /path/to/dumps

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
    set -l directory $argv[2]

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
    set_color normal
    echo ""

    for file in $files
        set -l url "$base_url/$file"
        set -l output_path "$target_dir/$file"

        if test -f $output_path
            set_color yellow
            echo "  Skipping (already exists): $file"
            set_color normal
        else
            set_color white
            echo "  Downloading: $file"
            set_color normal
            curl -L -o $output_path --progress-bar $url
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
    end

    echo ""
    set_color green
    echo "Done! Files saved to: $target_dir"
    set_color normal
end

main $argv
