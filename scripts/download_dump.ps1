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

# Function to format file size
function Format-FileSize {
    param([long]$Bytes)

    if ($Bytes -lt 1KB) { return "$Bytes B" }
    elseif ($Bytes -lt 1MB) { return "$([math]::Round($Bytes / 1KB, 1)) KB" }
    elseif ($Bytes -lt 1GB) { return "$([math]::Round($Bytes / 1MB, 1)) MB" }
    else { return "$([math]::Round($Bytes / 1GB, 1)) GB" }
}

# Function to download a single file with detailed progress
function Download-FileWithProgress {
    param(
        [string]$Url,
        [string]$OutputPath,
        [string]$FileName,
        [int]$LineNumber
    )

    try {
        # Create directory if it doesn't exist
        $outputDir = Split-Path $OutputPath -Parent
        if (!(Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        }

        # Get file size from server
        $request = [System.Net.WebRequest]::Create($Url)
        $response = $request.GetResponse()
        $totalSize = $response.ContentLength
        $response.Close()

        # Initialize progress line
        $totalSizeFormatted = if ($totalSize -gt 0) { Format-FileSize $totalSize } else { "Unknown" }
        $progressText = "File $LineNumber`: $FileName ($totalSizeFormatted) - Starting..."
        Write-Host $progressText -ForegroundColor Cyan

        # Download with progress tracking using a background job
        $startTime = Get-Date

        $job = Start-Job -ScriptBlock {
            param($Url, $OutputPath, $TotalSize, $FileName, $StartTime)

            try {
                $webClient = New-Object System.Net.WebClient
                $webClient.DownloadFile($Url, $OutputPath)

                if (Test-Path $OutputPath) {
                    $finalSize = (Get-Item $OutputPath).Length
                    $elapsed = (Get-Date) - $StartTime
                    $speed = if ($elapsed.TotalSeconds -gt 0) { $finalSize / $elapsed.TotalSeconds } else { 0 }

                    return @{
                        Success = $true;
                        Path = $OutputPath;
                        Size = $finalSize;
                        Speed = $speed;
                        Elapsed = $elapsed.TotalSeconds
                    }
                } else {
                    return @{ Success = $false; Error = "File not found after download" }
                }
            }
            catch {
                return @{ Success = $false; Error = $_.Exception.Message }
            }
            finally {
                if ($webClient) {
                    $webClient.Dispose()
                }
            }
        } -ArgumentList $Url, $OutputPath, $totalSize, $FileName, $startTime

        return @{ Job = $job; StartTime = $startTime; TotalSize = $totalSize; FileName = $FileName; LineNumber = $LineNumber; OutputPath = $OutputPath }
    }
    catch {
        Write-Host "✗ Error starting download for $FileName : $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# Function to update progress line in place
function Update-ProgressLine {
    param(
        [int]$LineNumber,
        [string]$Text,
        [string]$Color = "White"
    )

    # Move cursor to the line and clear it
    $currentLine = $Host.UI.RawUI.CursorPosition.Y
    $Host.UI.RawUI.CursorPosition = New-Object System.Management.Automation.Host.Coordinates 0, ($currentLine - $LineNumber)
    Write-Host (" " * $Host.UI.RawUI.WindowSize.Width) -NoNewline
    $Host.UI.RawUI.CursorPosition = New-Object System.Management.Automation.Host.Coordinates 0, ($currentLine - $LineNumber)

    # Write the new text
    Write-Host $Text -ForegroundColor $Color -NoNewline

    # Restore cursor position
    $Host.UI.RawUI.CursorPosition = New-Object System.Management.Automation.Host.Coordinates 0, $currentLine
}

# Function to get current download progress
function Get-DownloadProgress {
    param(
        [string]$FilePath,
        [long]$TotalSize
    )

    if (Test-Path $FilePath) {
        $currentSize = (Get-Item $FilePath).Length
        if ($TotalSize -gt 0) {
            $percentage = [math]::Round(($currentSize / $TotalSize) * 100, 1)
            $downloadedFormatted = Format-FileSize $currentSize
            $totalFormatted = Format-FileSize $TotalSize
            return @{
                Percentage = $percentage;
                Downloaded = $currentSize;
                DownloadedFormatted = $downloadedFormatted;
                TotalFormatted = $totalFormatted;
                HasProgress = $true
            }
        } else {
            return @{
                Percentage = 0;
                Downloaded = $currentSize;
                DownloadedFormatted = Format-FileSize $currentSize;
                TotalFormatted = "Unknown";
                HasProgress = $false
            }
        }
    } else {
        return @{
            Percentage = 0;
            Downloaded = 0;
            DownloadedFormatted = "0 B";
            TotalFormatted = Format-FileSize $TotalSize;
            HasProgress = $false
        }
    }
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

    Write-Host "Wikipedia Dump Downloader" -ForegroundColor Cyan
    Write-Host "Date: $Date ($dateYYYYMMDD)" -ForegroundColor Yellow
    Write-Host "Target Directory: $targetDir" -ForegroundColor Yellow
    Write-Host ""

    # Define files to download
    $files = @(
        @{
            Url = "https://dumps.wikimedia.org/enwiki/$dateYYYYMMDD/enwiki-$dateYYYYMMDD-pages-articles-multistream.xml.bz2"
            LocalPath = Join-Path $targetDir "enwiki-$dateYYYYMMDD-pages-articles-multistream.xml.bz2"
            Name = "enwiki-$dateYYYYMMDD-pages-articles-multistream.xml.bz2"
        },
        @{
            Url = "https://dumps.wikimedia.org/enwiki/$dateYYYYMMDD/enwiki-$dateYYYYMMDD-pages-articles-multistream-index.txt.bz2"
            LocalPath = Join-Path $targetDir "enwiki-$dateYYYYMMDD-pages-articles-multistream-index.txt.bz2"
            Name = "enwiki-$dateYYYYMMDD-pages-articles-multistream-index.txt.bz2"
        },
        @{
            Url = "https://dumps.wikimedia.org/enwiki/$dateYYYYMMDD/enwiki-$dateYYYYMMDD-linktarget.sql.gz"
            LocalPath = Join-Path $targetDir "enwiki-$dateYYYYMMDD-linktarget.sql.gz"
            Name = "enwiki-$dateYYYYMMDD-linktarget.sql.gz"
        },
        @{
            Url = "https://dumps.wikimedia.org/enwiki/$dateYYYYMMDD/enwiki-$dateYYYYMMDD-pagelinks.sql.gz"
            LocalPath = Join-Path $targetDir "enwiki-$dateYYYYMMDD-pagelinks.sql.gz"
            Name = "enwiki-$dateYYYYMMDD-pagelinks.sql.gz"
        }
    )

    # Create target directory
    if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Write-Host "Created directory: $targetDir" -ForegroundColor Green
    }

    Write-Host "Starting parallel downloads..." -ForegroundColor Cyan
    Write-Host ""

    # Start all downloads in parallel
    $downloadJobs = @()
    $totalFiles = $files.Count

    for ($i = 0; $i -lt $totalFiles; $i++) {
        $file = $files[$i]
        $lineNumber = $totalFiles - $i  # Reverse order so line 1 is at the top

        $jobInfo = Download-FileWithProgress -Url $file.Url -OutputPath $file.LocalPath -FileName $file.Name -LineNumber $lineNumber
        if ($jobInfo.Job) {
            $downloadJobs += @{
                Job = $jobInfo.Job
                StartTime = $jobInfo.StartTime
                TotalSize = $jobInfo.TotalSize
                FileName = $jobInfo.FileName
                LineNumber = $jobInfo.LineNumber
                LocalPath = $file.LocalPath
                OutputPath = $jobInfo.OutputPath
            }
        }
    }

    # Monitor all downloads and update progress
    $lastProgressUpdate = Get-Date

    while ($downloadJobs | Where-Object { $_.Job.State -eq "Running" }) {
        $currentTime = Get-Date

        # Update progress every 2 seconds
        if (($currentTime - $lastProgressUpdate).TotalSeconds -ge 2) {
            foreach ($jobInfo in $downloadJobs) {
                if ($jobInfo.Job.State -eq "Running") {
                    $elapsed = ($currentTime - $jobInfo.StartTime).TotalSeconds
                    $progress = Get-DownloadProgress -FilePath $jobInfo.OutputPath -TotalSize $jobInfo.TotalSize

                    if ($progress.HasProgress -and $jobInfo.TotalSize -gt 0) {
                        $progressText = "File $($jobInfo.LineNumber)`: $($jobInfo.FileName) - $($progress.Percentage)% ($($progress.DownloadedFormatted)/$($progress.TotalFormatted)) - ${elapsed}s elapsed"
                    } else {
                        $progressText = "File $($jobInfo.LineNumber)`: $($jobInfo.FileName) - $($progress.DownloadedFormatted) downloaded - ${elapsed}s elapsed"
                    }

                    Update-ProgressLine -LineNumber $jobInfo.LineNumber -Text $progressText -Color "Yellow"
                }
            }
            $lastProgressUpdate = $currentTime
        }

        Start-Sleep -Milliseconds 500
    }

    # Process results
    $results = @()
    foreach ($jobInfo in $downloadJobs) {
        $result = Receive-Job $jobInfo.Job
        Remove-Job $jobInfo.Job

        if ($result.Success) {
            $finalSizeFormatted = Format-FileSize $result.Size
            $speedFormatted = Format-FileSize $result.Speed + "/s"
            $elapsedFormatted = [math]::Round($result.Elapsed, 1)
            $progressText = "File $($jobInfo.LineNumber)`: $($jobInfo.FileName) - ✓ Completed ($finalSizeFormatted) in ${elapsedFormatted}s (avg: $speedFormatted)"
            Update-ProgressLine -LineNumber $jobInfo.LineNumber -Text $progressText -Color "Green"
        } else {
            $progressText = "File $($jobInfo.LineNumber)`: $($jobInfo.FileName) - ✗ Failed: $($result.Error)"
            Update-ProgressLine -LineNumber $jobInfo.LineNumber -Text $progressText -Color "Red"
        }

        $results += $result
    }

    Write-Host ""
    Write-Host ""

    # Summary
    Write-Host "Download Summary:" -ForegroundColor Cyan
    Write-Host "================" -ForegroundColor Cyan

    $successCount = 0
    $totalSize = 0

    foreach ($result in $results) {
        if ($result.Success) {
            $successCount++
            $totalSize += $result.Size
            $fileName = Split-Path $result.Path -Leaf
            $fileSizeFormatted = Format-FileSize $result.Size
            Write-Host "✓ $fileName ($fileSizeFormatted)" -ForegroundColor Green
        } else {
            Write-Host "✗ Download failed - Error: $($result.Error)" -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "Total: $successCount of $totalFiles files downloaded successfully" -ForegroundColor Cyan
    if ($totalSize -gt 0) {
        $totalSizeFormatted = Format-FileSize $totalSize
        Write-Host "Total size: $totalSizeFormatted" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "Download process completed!" -ForegroundColor Green
}

# Run the main function
Main
