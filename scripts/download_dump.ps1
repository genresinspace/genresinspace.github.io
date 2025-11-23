param(
    [Parameter(Mandatory=$true)]
    [string]$Directory,

    [Parameter(Mandatory=$true)]
    [string]$Date
)

# Function to validate date format
function Test-DateFormat {
    param([string]$DateString)

    if ($DateString -match '^\d{4}-\d{2}-\d{2}$') {
        try {
            $date = [DateTime]::ParseExact($DateString, "yyyy-MM-dd", $null)
            return $true
        }
        catch {
            return $false
        }
    }
    return $false
}

# Function to convert YYYY-MM-DD to YYYYMMDD
function Convert-DateFormat {
    param([string]$DateString)

    $date = [DateTime]::ParseExact($DateString, "yyyy-MM-dd", $null)
    return $date.ToString("yyyyMMdd")
}

# Main script logic
function Main {
    # Validate parameters
    if (!(Test-DateFormat $Date)) {
        Write-Host "Error: Date must be in YYYY-MM-DD format (e.g., 2025-06-20)" -ForegroundColor Red
        exit 1
    }

    if (!(Test-Path $Directory)) {
        Write-Host "Error: Directory '$Directory' does not exist" -ForegroundColor Red
        exit 1
    }

    # Convert date format
    $dateYYYYMMDD = Convert-DateFormat $Date
    $targetDir = Join-Path $Directory $Date

    Write-Host "Wikipedia Dump Preparation" -ForegroundColor Cyan
    Write-Host "Date: $Date ($dateYYYYMMDD)" -ForegroundColor Yellow
    Write-Host ""

    # Create target directory
    if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Write-Host "Created directory: $targetDir" -ForegroundColor Green
    } else {
        Write-Host "Directory already exists: $targetDir" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Download Folder:" -ForegroundColor Cyan
    Write-Host $targetDir -ForegroundColor White

    # Copy folder path to clipboard
    Set-Clipboard -Value $targetDir
    Write-Host "(Copied to clipboard!)" -ForegroundColor Green

    Write-Host ""
    Write-Host "Opening download links in your browser..." -ForegroundColor Cyan
    Write-Host ""

    # Define files to download
    $files = @(
        "enwiki-$dateYYYYMMDD-pages-articles-multistream.xml.bz2",
        "enwiki-$dateYYYYMMDD-pages-articles-multistream-index.txt.bz2",
        "enwiki-$dateYYYYMMDD-linktarget.sql.gz",
        "enwiki-$dateYYYYMMDD-pagelinks.sql.gz"
    )

    $baseUrl = "https://dumps.wikimedia.org/enwiki/$dateYYYYMMDD"

    foreach ($file in $files) {
        $url = "$baseUrl/$file"
        Write-Host "  Opening: $file" -ForegroundColor White
        Start-Process $url
        Start-Sleep -Milliseconds 500  # Small delay to avoid overwhelming the browser
    }

    Write-Host ""
    Write-Host "Done! The download folder path is in your clipboard." -ForegroundColor Green
    Write-Host "Save the files from your browser to: $targetDir" -ForegroundColor Yellow
    Write-Host ""
}

# Run the main function
Main
